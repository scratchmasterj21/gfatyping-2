import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { showErrorNotification } from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GameMultiplayerRoomFooter } from "../components/GameMultiplayerRoomFooter";
import { GamePickLayout } from "../components/GamePickLayout";
import {
  GameResultOverlay,
  GameResultView,
} from "../components/GameResultOverlay";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { InviteClassmates } from "../components/InviteClassmates";
import { MULTIPLAYER_UNLOCK_HINT_GENERIC } from "../components/multiplayer-unlock-hints";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import {
  createRaidRoom,
  finishRaidRoom,
  joinRaidRoom,
  leaveRaidRoom,
  RaidRoom,
  raidNow,
  startRaidRoom,
  subscribeRaidRoom,
  syncRaidClock,
  writeBlock,
  writeCleared,
  writeDealt,
} from "./raid-multiplayer";
import {
  currentCharge,
  MAX_RAID_PLAYERS,
  RAID_DIFFICULTIES,
  raidDifficultyFor,
  RaidDifficulty,
  RaidFacts,
  RaidMode,
  raidScore,
  raidStars,
  RaidTeam,
  raidView,
  shieldWord,
  START_PAUSE_MS,
  wordStream,
} from "./raid-rules";
import { RaidBattle, RaidMember, TEAM_BG, TEAM_LABEL } from "./RaidBattle";

const ME = "me";
const RESULT_PAUSE_MS = 1800;

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

const TEAM_SIZES = [
  { label: "2 v 2", size: 2 },
  { label: "3 v 3", size: 3 },
  { label: "4 v 4", size: 4 },
];

type Phase = "pick" | "lobby" | "playing" | "result";

export function MonsterRaidModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  multiplayerUnlocked?: boolean;
  onClose: () => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [raidMode, setRaidMode] = createSignal<RaidMode>("coop");
  const [teamSize, setTeamSize] = createSignal(2);
  const [difficulty, setDifficulty] = createSignal<RaidDifficulty>(
    RAID_DIFFICULTIES[0] as RaidDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  let resultTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  // solo
  const [solo, setSolo] = createSignal<{
    seed: number;
    startAt: number;
    dealt: number;
    blocked: Set<number>;
    clearedAt?: number;
  } | null>(null);

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<RaidRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  /** my damage, kept locally so fast typing never loses a hit */
  let myDealt = 0;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number => (mode() === "together" ? raidNow() : Date.now());

  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 100);
    onCleanup(() => clearInterval(t));
  });

  // ---------------------------------------------------------- shared facts
  const facts = createMemo((): RaidFacts | null => {
    if (mode() === "solo") {
      const s = solo();
      if (s === null) return null;
      return {
        mode: "coop",
        difficulty: difficulty(),
        startAt: s.startAt,
        teams: { [ME]: "red" },
        dealt: { [ME]: s.dealt },
        blocked: { red: s.blocked },
        clearedAt: s.clearedAt === undefined ? {} : { red: s.clearedAt },
      };
    }
    const r = room();
    if (r === null || r.startAt === undefined || r.teams === undefined) {
      return null;
    }
    const blocked: RaidFacts["blocked"] = {};
    for (const [team, ks] of Object.entries(r.blocks ?? {})) {
      blocked[team as RaidTeam] = new Set(Object.keys(ks ?? {}).map(Number));
    }
    const dealt = Object.fromEntries(
      Object.values(r.players ?? {}).map((p) => [p.uid, p.dealt ?? 0]),
    );
    const me = uid();
    if (me !== undefined) dealt[me] = Math.max(dealt[me] ?? 0, myDealt);
    return {
      mode: r.mode,
      difficulty: raidDifficultyFor(r.difficultyLabel),
      startAt: r.startAt,
      teams: r.teams,
      dealt,
      blocked,
      clearedAt: r.cleared ?? {},
    };
  });
  const seed = (): number =>
    mode() === "solo" ? (solo()?.seed ?? 1) : (room()?.seed ?? 1);
  const view = createMemo(() => {
    const f = facts();
    return f === null ? null : raidView(f, now());
  });
  const myTeam = (): RaidTeam => facts()?.teams[myId()] ?? "red";
  const myTeamView = () => view()?.teams.find((t) => t.team === myTeam());
  const charge = createMemo(() => {
    const f = facts();
    if (f === null) return null;
    return currentCharge(f.startAt, now(), f.difficulty);
  });
  const shield = (): string | undefined => {
    const c = charge();
    const f = facts();
    return c === null || f === null
      ? undefined
      : shieldWord(seed(), c.k, f.difficulty.words);
  };
  const shieldBlocked = (): boolean => {
    const c = charge();
    return c !== null && facts()?.blocked[myTeam()]?.has(c.k) === true;
  };
  const myWords = createMemo(() =>
    wordStream(seed(), myId(), (facts()?.difficulty ?? difficulty()).words),
  );
  const names = (): Record<string, string> =>
    mode() === "solo"
      ? { [ME]: getSnapshot()?.name ?? "You" }
      : Object.fromEntries(
          Object.values(room()?.players ?? {}).map((p) => [p.uid, p.name]),
        );
  const members = (): RaidMember[] => {
    const f = facts();
    if (f === null) return [];
    return (myTeamView()?.members ?? []).map((m) => ({
      uid: m === ME ? (uid() ?? ME) : m,
      name: names()[m] ?? "Player",
      dealt: f.dealt[m] ?? 0,
    }));
  };

  // ---------------------------------------------------------- actions
  const onHit = (damage: number): void => {
    if (mode() === "solo") {
      setSolo((s) => (s === null ? s : { ...s, dealt: s.dealt + damage }));
      return;
    }
    const code = roomCode();
    myDealt += damage;
    // refresh the local view right away
    setRoom((r) => (r === null ? r : { ...r }));
    if (code !== undefined) {
      void writeDealt(code, myDealt).catch(() => undefined);
    }
  };

  const onBlock = (k: number): void => {
    if (mode() === "solo") {
      setSolo((s) =>
        s === null ? s : { ...s, blocked: new Set([...s.blocked, k]) },
      );
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      // a teammate may have blocked it first - then this is refused; fine
      void writeBlock(code, myTeam(), k).catch(() => undefined);
    }
  };

  // my team beat the boss: record when (first write wins)
  createEffect(() => {
    const t = myTeamView();
    if (t === undefined || !t.wave.cleared || t.clearedAt !== undefined) return;
    if (view()?.over === true) return;
    if (mode() === "solo") {
      setSolo((s) => (s === null ? s : { ...s, clearedAt: Date.now() }));
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeCleared(code, t.team).catch(() => undefined);
    }
  });

  // the raid is over: show results and claim coins
  createEffect(() => {
    const v = view();
    const f = facts();
    if (v === null || f === null || !v.over || finished) return;
    finished = true;
    const me = myId();
    const team = f.teams[me];
    const won = v.winner !== undefined && v.winner === team;
    const dealt = f.dealt[me] ?? 0;
    const best = Math.max(0, ...Object.values(f.dealt));
    const mvp = mode() === "together" && dealt > 0 && dealt === best;
    const r = untrack(room);
    const blocks =
      mode() === "solo"
        ? (untrack(solo)?.blocked.size ?? 0)
        : Object.values(r?.blocks?.[team ?? "red"] ?? {}).filter(
            (u) => u === me,
          ).length;
    const score = raidScore({ dealt, blocks, won, mvp });
    const hearts = v.teams.find((t) => t.team === team)?.hearts ?? 0;
    if (won) sfx.finish();
    if (r !== null && r.hostUid === uid()) {
      void finishRaidRoom(r.code).catch(() => undefined);
    }
    const headline = won
      ? f.mode === "teams"
        ? `${TEAM_LABEL[team ?? "red"]} wins! 🏆`
        : "Monsters defeated! 🎉"
      : f.mode === "teams" && v.winner !== undefined
        ? `${TEAM_LABEL[v.winner]} beat their boss first!`
        : v.reason === "time"
          ? "Time's up! The monsters got away."
          : "The monsters won this time!";
    resultTimer = setTimeout(() => {
      resultTimer = undefined;
      setResult({
        headline,
        score,
        stars: raidStars(won, hearts),
        stats: [
          { label: "damage", value: String(dealt) },
          { label: "attacks blocked", value: String(blocks) },
          ...(mvp ? [{ label: "MVP", value: "⭐ top damage" }] : []),
        ],
      });
      setPhase("result");
      setClaim("pending");
      void claimMiniGameReward("monster-raid", score).then(setClaim);
    }, RESULT_PAUSE_MS);
  });

  // ---------------------------------------------------------- solo
  const startSolo = (): void => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
    finished = false;
    setResult(null);
    setSolo({
      seed: Math.floor(Math.random() * 2 ** 31),
      startAt: Date.now() + START_PAUSE_MS,
      dealt: 0,
      blocked: new Set(),
    });
    setNow(Date.now());
    setPhase("playing");
  };

  // ---------------------------------------------------------- together
  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    myDealt = 0;
    finished = false;
    setRoomCode(code);
    setPhase("lobby");
    void syncRaidClock();
    unsubscribeRoom = subscribeRaidRoom(code, (next) =>
      untrack(() => onRoom(next)),
    );
  };

  const onRoom = (next: RaidRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (phase() !== "result") {
        setPhase("pick");
        showErrorNotification("The Monster Raid room was closed");
      }
      return;
    }
    setRoom(next);
    if (next.status === "playing" && phase() === "lobby") {
      if (next.teams?.[uid() ?? ""] === undefined) {
        showErrorNotification("That raid started without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      setNow(raidNow());
      setPhase("playing");
    }
  };

  const createRoom = async (): Promise<void> => {
    if (props.multiplayerUnlocked !== true) {
      showErrorNotification(MULTIPLAYER_UNLOCK_HINT_GENERIC);
      return;
    }
    setRoomBusy(true);
    try {
      watchRoom(
        await createRaidRoom({
          mode: raidMode(),
          teamSize: teamSize(),
          difficultyLabel: difficulty().label,
        }),
      );
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await joinRaidRoom(joinCode()));
    } catch (e) {
      showErrorNotification("Could not join", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const leaveRoom = async (): Promise<void> => {
    const code = roomCode();
    unsubscribeRoom?.();
    unsubscribeRoom = undefined;
    setRoom(null);
    setRoomCode(undefined);
    if (code !== undefined) await leaveRaidRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
    finished = false;
    setSolo(null);
    setResult(null);
    setPhase("pick");
    void leaveRoom();
  };
  createEffect(() => {
    if (!props.open) {
      untrack(reset);
    } else {
      setMode(
        props.initialMode === "together" && props.multiplayerUnlocked === true
          ? "together"
          : "solo",
      );
    }
  });
  onCleanup(() => {
    clearTimeout(resultTimer);
    void leaveRoom();
  });

  const lobbyPlayers = (): RaidRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );
  const onlineCount = (): number =>
    lobbyPlayers().filter((p) => p.online).length;
  const minPlayers = (): number => (room()?.mode === "teams" ? 4 : 2);

  return (
    <Show when={props.open}>
      <GameModalFrame
        layout={
          phase() === "playing" || phase() === "result" ? "playing" : "pick"
        }
        needsKeyboard={false}
        onClose={() => props.onClose()}
      >
        <Show when={phase() === "pick"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Monster Raid"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Start solo raid"
                    onClick={startSolo}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="monster-raid"
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                  createLabel="Host a raid for friends"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>⚔️ Type your word to hit the monster.</li>
                <li>🔥 No mistakes in a row = combo for extra damage!</li>
                <li>
                  ⚠️ When the monster charges, type the red shield word to block
                  it - or lose a ❤️.
                </li>
                <li>👑 Beat 2 minions, then the boss!</li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Who do you want to play with?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={props.multiplayerUnlocked === true}
                unlockHint={MULTIPLAYER_UNLOCK_HINT_GENERIC}
                onModeChange={setMode}
                soloLabel="solo practice"
                togetherLabel={`friends (up to ${MAX_RAID_PLAYERS})`}
              />
            </GameSetupSection>
            <Show when={mode() === "together"}>
              <GameSetupSection title="Raid type">
                <div class="grid grid-cols-2 gap-2">
                  <For
                    each={
                      [
                        ["coop", "🤝 Everyone together"],
                        ["teams", "⚔️ Team battle"],
                      ] as const
                    }
                  >
                    {([id, label]) => (
                      <button
                        type="button"
                        class={cn(
                          "press-3d min-h-12 rounded-xl px-3 py-2 text-base font-semibold",
                          raidMode() === id
                            ? "bg-main text-bg"
                            : "bg-sub-alt text-sub hover:text-text",
                        )}
                        onClick={() => setRaidMode(id)}
                      >
                        {label}
                      </button>
                    )}
                  </For>
                </div>
              </GameSetupSection>
              <Show when={raidMode() === "teams"}>
                <GameSetupSection title="Team size">
                  <DifficultySegmented
                    options={TEAM_SIZES}
                    selectedLabel={
                      TEAM_SIZES.find((t) => t.size === teamSize())?.label ?? ""
                    }
                    onSelect={(t) => setTeamSize(t.size)}
                  />
                </GameSetupSection>
              </Show>
            </Show>
            <GameSetupSection title="Words">
              <DifficultySegmented
                options={RAID_DIFFICULTIES}
                selectedLabel={difficulty().label}
                onSelect={(d) => setDifficulty(() => d)}
              />
            </GameSetupSection>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "lobby"}>
          <div class="grid gap-4 p-6 pt-12 font-kid">
            <div class="text-center">
              <div class="text-sm font-bold tracking-widest text-sub uppercase">
                Room code - tell your friends!
              </div>
              <div class="text-5xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                {room()?.mode === "teams"
                  ? `⚔️ Team battle (${room()?.teamSize ?? 2} per team)`
                  : "🤝 Everyone together"}{" "}
                · {raidDifficultyFor(room()?.difficultyLabel ?? "").label} words
                · {lobbyPlayers().length}/{MAX_RAID_PLAYERS} players
              </div>
            </div>
            <For each={lobbyPlayers()}>
              {(player) => (
                <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-2">
                  <UserAvatar uid={player.uid} class="h-9 w-9" />
                  <span class="flex-1 truncate text-lg font-bold text-text">
                    {player.name}
                    {player.uid === room()?.hostUid ? " · host" : ""}
                  </span>
                  <span class={player.online ? "text-main" : "text-sub"}>
                    {player.online ? "ready" : "offline"}
                  </span>
                </div>
              )}
            </For>
            <Show when={onlineCount() < minPlayers()}>
              <div class="text-center text-sub">
                Waiting for friends to join… (need {minPlayers()}
                {room()?.mode === "teams" ? " for teams" : ""})
              </div>
            </Show>
            <InviteClassmates
              gameId="monster-raid"
              code={roomCode()}
              show={room()?.hostUid === uid()}
            />
            <Show
              when={room()?.hostUid === uid()}
              fallback={
                <div class="text-center text-sub">
                  Waiting for the host to start…
                </div>
              }
            >
              <GameSetupPrimaryAction
                text="Start the raid!"
                disabled={onlineCount() < minPlayers()}
                onClick={() => {
                  const r = room();
                  if (r !== null) void startRaidRoom(r);
                }}
              />
            </Show>
            <button
              type="button"
              class="text-center text-sm text-sub underline"
              onClick={() => {
                void leaveRoom();
                setPhase("pick");
              }}
            >
              Leave room
            </button>
          </div>
        </Show>

        <Show when={phase() === "playing" || phase() === "result"}>
          <Show when={view() !== null && facts()}>
            {(f) => (
              <RaidBattle
                mode={f().mode}
                view={view() ?? { teams: [], over: false }}
                now={now()}
                startAt={f().startAt}
                seed={seed()}
                myTeam={myTeam()}
                myUid={uid() ?? ME}
                members={members()}
                words={myWords()}
                charge={charge()}
                shield={shield()}
                shieldBlocked={shieldBlocked()}
                onHit={onHit}
                onBlock={onBlock}
              />
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                note={claimNote(claim())}
                onPlayAgain={mode() === "solo" ? startSolo : undefined}
                onExit={() => props.onClose()}
              />
            )}
          </Show>
          <Show when={phase() === "result" && mode() === "together"}>
            <div class="pointer-events-none absolute top-3 left-3 z-30 grid gap-1 rounded-xl bg-bg/90 p-2 font-kid text-sm">
              <For each={view()?.teams ?? []}>
                {(t) => (
                  <div class="flex items-center gap-2">
                    <span
                      class={cn("h-3 w-3 rounded-full", TEAM_BG[t.team])}
                    ></span>
                    <span class="text-text">
                      {facts()?.mode === "teams" ? TEAM_LABEL[t.team] : "Team"}{" "}
                      ⚔️{t.dealt}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

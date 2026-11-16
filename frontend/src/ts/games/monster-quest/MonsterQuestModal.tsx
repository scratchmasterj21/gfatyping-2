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
import { HERO_ART } from "./hero-art";
import {
  closeTimedOut,
  createQuestRoom,
  finishQuestRoom,
  joinQuestRoom,
  leaveQuestRoom,
  QuestRoom,
  questNow,
  roomInputs,
  roomParty,
  setMyClass,
  startQuestRoom,
  subscribeQuestRoom,
  syncQuestClock,
  writeGuard,
  writeHeroInput,
} from "./quest-multiplayer";
import {
  buildParty,
  CLASS_INFO,
  HERO_CLASSES,
  HeroClass,
  HeroInput,
  PARTY_SIZE,
  pendingDeadline,
  QUEST_DIFFICULTIES,
  questAwards,
  questDifficultyFor,
  QuestDifficulty,
  QuestInput,
  questScore,
  QuestSetup,
  questStars,
  runQuest,
  START_PAUSE_MS,
  TIMEOUT_POWER,
} from "./quest-rules";
import { QuestBattle } from "./QuestBattle";

/** Kept as the old Monster Raid id so teacher game settings and coins carry over. */
const GAME_ID = "monster-raid";
const ME = "me";
/** extra wait before anyone closes a timed-out turn, so the player's own answer wins */
const CLOSE_GRACE_MS = 700;

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

type Phase = "pick" | "lobby" | "playing" | "result";

export function MonsterQuestModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  multiplayerUnlocked?: boolean;
  onClose: () => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [cls, setCls] = createSignal<HeroClass>("knight");
  const [difficulty, setDifficulty] = createSignal<QuestDifficulty>(
    QUEST_DIFFICULTIES[0] as QuestDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");

  // solo
  const [solo, setSolo] = createSignal<{
    setup: QuestSetup;
    startAt: number;
    inputs: QuestInput[];
    times: number[];
  } | null>(null);

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<QuestRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let closeTried = -1;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number => (mode() === "together" ? questNow() : Date.now());

  createEffect(() => {
    if (phase() !== "playing" && phase() !== "result") return;
    const t = setInterval(() => setNow(clock()), 100);
    onCleanup(() => clearInterval(t));
  });

  // ---------------------------------------------------------- the quest
  const setup = createMemo((): QuestSetup | null => {
    if (mode() === "solo") return solo()?.setup ?? null;
    const r = room();
    if (r === null || r.party === undefined) return null;
    return {
      seed: r.seed,
      difficulty: questDifficultyFor(r.difficultyLabel),
      party: roomParty(r),
    };
  });
  const startAt = (): number =>
    mode() === "solo" ? (solo()?.startAt ?? 0) : (room()?.startAt ?? 0);
  const log = createMemo((): { inputs: QuestInput[]; times: number[] } => {
    if (mode() === "solo") {
      const s = solo();
      return { inputs: s?.inputs ?? [], times: s?.times ?? [] };
    }
    const r = room();
    return r === null ? { inputs: [], times: [] } : roomInputs(r);
  });
  const state = createMemo(() => {
    const s = setup();
    return s === null ? null : runQuest(s, log().inputs);
  });
  const deadline = createMemo(() => {
    const st = state();
    return st === null ? null : pendingDeadline(st, startAt(), log().times);
  });

  const pushSolo = (input: QuestInput): void => {
    setSolo((s) =>
      s === null
        ? s
        : {
            ...s,
            inputs: [...s.inputs, input],
            times: [...s.times, Date.now()],
          },
    );
  };

  const onHero = (input: HeroInput): void => {
    const p = state()?.pending;
    if (p?.kind !== "hero") return;
    if (mode() === "solo") {
      pushSolo(input);
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeHeroInput(code, p.n, input).catch(() => undefined);
    }
  };

  const onGuard = (): void => {
    const p = state()?.pending;
    if (p?.kind !== "guard") return;
    if (mode() === "solo") {
      pushSolo({ kind: "guard", guards: { [ME]: true } });
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeGuard(code, p.n, Object.keys(p.words)).catch(() => undefined);
    }
  };

  // turn timer ran out: answer for the slow player
  createEffect(() => {
    const st = state();
    const d = deadline();
    if (st === null || d === null || st.pending === null || st.over) return;
    const p = st.pending;
    if (now() < d) return;
    if (mode() === "solo") {
      untrack(() =>
        pushSolo(
          p.kind === "hero"
            ? {
                kind: "hero",
                action: "attack",
                power: TIMEOUT_POWER,
                timeout: true,
              }
            : { kind: "guard", guards: {} },
        ),
      );
      return;
    }
    // online: anyone may close it, a moment late so the player's answer wins
    if (now() < d + CLOSE_GRACE_MS || closeTried === p.n) return;
    closeTried = p.n;
    const code = roomCode();
    if (code !== undefined) {
      void closeTimedOut(code, p.n, p.kind).catch(() => {
        closeTried = -1;
      });
    }
  });

  const finish = (): void => {
    const st = untrack(state);
    if (st === null || phase() === "result") return;
    const me = st.heroes.find((h) => h.uid === myId());
    const myStats = me === undefined ? undefined : st.stats[me.slot];
    const best = Math.max(
      0,
      ...st.heroes
        .filter((h) => h.uid !== null)
        .map((h) => st.stats[h.slot]?.damage ?? 0),
    );
    const stats = myStats ?? { damage: 0, healed: 0, guards: 0, crits: 0 };
    const mvp =
      mode() === "together" && stats.damage > 0 && stats.damage === best;
    const score = questScore({
      won: st.won,
      stats,
      battlesWon: st.won ? 3 : st.battle,
      mvp,
    });
    if (st.won) sfx.finish();
    const r = untrack(room);
    if (r !== null && r.hostUid === uid() && r.status === "playing") {
      void finishQuestRoom(r.code).catch(() => undefined);
    }
    const awards =
      mode() === "together" ? questAwards(st.heroes, st.stats) : [];
    setResult({
      headline: st.won
        ? "Quest complete! 🎉"
        : st.battle === 2
          ? "So close! The boss won this time."
          : "The monsters won this time!",
      score,
      stars: questStars(st.won, st.heroes),
      stats: [
        { label: "your damage", value: String(stats.damage) },
        { label: "healing", value: String(stats.healed) },
        { label: "guards", value: `🛡️ ${stats.guards}` },
        { label: "critical hits", value: `⭐ ${stats.crits}` },
        ...awards.map((a) => ({
          label: `${a.icon} ${a.title}`,
          value: `${a.names.join(" & ")} (${a.value})`,
        })),
      ],
    });
    setPhase("result");
    setClaim("pending");
    void claimMiniGameReward(GAME_ID, score).then(setClaim);
  };

  // ---------------------------------------------------------- solo
  const startSolo = (): void => {
    setResult(null);
    setSolo({
      setup: {
        seed: Math.floor(Math.random() * 2 ** 31),
        difficulty: difficulty(),
        party: buildParty([
          { uid: ME, name: getSnapshot()?.name ?? "You", cls: cls() },
        ]),
      },
      startAt: Date.now() + START_PAUSE_MS,
      inputs: [],
      times: [],
    });
    setNow(Date.now());
    setPhase("playing");
  };

  // ---------------------------------------------------------- together
  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    closeTried = -1;
    setRoomCode(code);
    setPhase("lobby");
    void syncQuestClock();
    unsubscribeRoom = subscribeQuestRoom(code, (next) =>
      untrack(() => onRoom(next)),
    );
  };

  const onRoom = (next: QuestRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (phase() !== "result") {
        setPhase("pick");
        showErrorNotification("The Monster Quest room was closed");
      }
      return;
    }
    setRoom(next);
    if (next.status === "playing" && phase() === "lobby") {
      if (!roomParty(next).some((h) => h.uid === uid())) {
        showErrorNotification("That quest started without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      setNow(questNow());
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
        await createQuestRoom({
          difficultyLabel: difficulty().label,
          cls: cls(),
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
      watchRoom(await joinQuestRoom(joinCode(), cls()));
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
    if (code !== undefined) await leaveQuestRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
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
    void leaveRoom();
  });

  const lobbyPlayers = (): QuestRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );
  const onlineCount = (): number =>
    lobbyPlayers().filter((p) => p.online).length;
  const takenByOthers = (): Set<HeroClass | undefined> =>
    new Set(
      lobbyPlayers()
        .filter((p) => p.uid !== uid() && p.online)
        .map((p) => p.cls),
    );
  const myLobbyClass = (): HeroClass | undefined =>
    room()?.players[uid() ?? ""]?.cls;

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
                title="Monster Quest"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Start the quest!"
                    onClick={startSolo}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId={GAME_ID}
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                  createLabel="Host a quest for friends"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>🔁 Heroes and monsters take turns.</li>
                <li>
                  ⚔️ On your turn, pick a move, then type its word - fast and no
                  mistakes = ⭐ critical hit!
                </li>
                <li>
                  🛡️ When a monster attacks you, type the guard word quickly to
                  take less damage.
                </li>
                <li>👑 Win 2 battles, then beat the boss!</li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Pick your hero">
              <ClassPicker selected={cls()} onSelect={setCls} />
            </GameSetupSection>
            <GameSetupSection title="Who do you want to play with?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={props.multiplayerUnlocked === true}
                unlockHint={MULTIPLAYER_UNLOCK_HINT_GENERIC}
                onModeChange={setMode}
                soloLabel="me + helpers"
                togetherLabel={`friends (up to ${PARTY_SIZE})`}
              />
            </GameSetupSection>
            <GameSetupSection title="Words">
              <DifficultySegmented
                options={QUEST_DIFFICULTIES}
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
                {questDifficultyFor(room()?.difficultyLabel ?? "").label} words
                · {lobbyPlayers().length}/{PARTY_SIZE} heroes · helpers fill
                empty spots
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
                  <Show when={player.cls}>
                    {(c) => (
                      <span class="flex items-center gap-1 text-text">
                        <img
                          src={HERO_ART[c()]}
                          alt=""
                          class="h-8 w-8 [image-rendering:pixelated]"
                        />
                        {CLASS_INFO[c()].name}
                      </span>
                    )}
                  </Show>
                  <span class={player.online ? "text-main" : "text-sub"}>
                    {player.online ? "ready" : "offline"}
                  </span>
                </div>
              )}
            </For>
            <div>
              <div class="mb-2 text-sm font-bold text-sub">Your hero</div>
              <ClassPicker
                selected={myLobbyClass() ?? cls()}
                taken={takenByOthers()}
                onSelect={(c) => {
                  setCls(c);
                  const code = roomCode();
                  if (code !== undefined) {
                    void setMyClass(code, c).catch(() => undefined);
                  }
                }}
              />
            </div>
            <Show when={onlineCount() < 2}>
              <div class="text-center text-sub">
                Waiting for friends to join… (need 2)
              </div>
            </Show>
            <InviteClassmates
              gameId={GAME_ID}
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
                text="Start the quest!"
                disabled={onlineCount() < 2}
                onClick={() => {
                  const r = room();
                  if (r !== null) void startQuestRoom(r);
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
          <Show when={setup()}>
            {(s) => (
              <Show when={state()}>
                {(st) => (
                  <QuestBattle
                    setup={s()}
                    state={st()}
                    myUid={myId()}
                    now={now()}
                    startAt={startAt()}
                    deadline={deadline()}
                    onHero={onHero}
                    onGuard={onGuard}
                    onFinished={finish}
                  />
                )}
              </Show>
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
        </Show>
      </GameModalFrame>
    </Show>
  );
}

function ClassPicker(props: {
  selected: HeroClass;
  taken?: Set<HeroClass | undefined>;
  onSelect: (cls: HeroClass) => void;
}): JSXElement {
  return (
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <For each={HERO_CLASSES}>
        {(c) => {
          const taken = (): boolean => props.taken?.has(c) === true;
          return (
            <button
              type="button"
              disabled={taken()}
              class={cn(
                "press-3d grid cursor-pointer justify-items-center gap-1 rounded-xl p-3 text-center font-kid",
                props.selected === c
                  ? "bg-main text-bg"
                  : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                taken() && "cursor-not-allowed opacity-40",
              )}
              onClick={() => props.onSelect(c)}
            >
              <img
                src={HERO_ART[c]}
                alt=""
                class="h-16 w-auto [image-rendering:pixelated]"
              />
              <span class="text-lg font-bold">
                {CLASS_INFO[c].emoji} {CLASS_INFO[c].name}
              </span>
              <span class="text-xs leading-tight opacity-80">
                {taken() ? "taken" : CLASS_INFO[c].blurb}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}

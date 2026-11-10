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
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GameMultiplayerRoomFooter } from "../components/GameMultiplayerRoomFooter";
import { GamePickLayout } from "../components/GamePickLayout";
import {
  GameResultOverlay,
  GameResultView,
} from "../components/GameResultOverlay";
import { GameSetupMore } from "../components/GameSetupMore";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { groupWordListOptions } from "../components/groupWordListOptions";
import { InviteClassmates } from "../components/InviteClassmates";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import {
  createDigRoom,
  createProgressWriter,
  digDifficultyFor,
  digEndsAt,
  DigRoom,
  digServerNow,
  finishDigRoom,
  FINISH_GRACE_MS,
  joinDigRoom,
  leaveDigRoom,
  MAX_DIGGERS,
  START_COUNTDOWN_MS,
  startDigRoom,
  subscribeDigRoom,
  syncDigClock,
} from "./dig-multiplayer";
import {
  botBlockDelay,
  buildShaft,
  DIG_DEPTH,
  DIG_DIFFICULTIES,
  DIG_TIME_MS,
  DigBlock,
  DigDifficulty,
  digScore,
  digStars,
  rankDiggers,
} from "./dig-rules";
import { DigLane, GemDig } from "./GemDig";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);

type Phase = "pick" | "loading" | "lobby" | "playing" | "result";
type Progress = { depth: number; gems: number; finishedMs?: number };

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

const ordinal = (n: number): string =>
  n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

export function GemDigModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  onClose: () => void;
  onResult?: (score: number) => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<DigDifficulty>(
    DIG_DIFFICULTIES[0] as DigDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");

  // the match (both modes)
  const [shaft, setShaft] = createSignal<DigBlock[]>([]);
  const [startedAt, setStartedAt] = createSignal(0);
  const [mine, setMine] = createSignal<Progress>({ depth: 0, gems: 0 });

  // solo: Tappy digs its own copy of the shaft
  const [bot, setBot] = createSignal<Progress>({ depth: 0, gems: 0 });
  let botTimer: ReturnType<typeof setTimeout> | undefined;

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<DigRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let writer: ReturnType<typeof createProgressWriter> | undefined;

  const me = (): string | undefined => getAuthenticatedUser()?.uid;
  const myName = (): string => getSnapshot()?.name ?? "You";
  const clock = (): number =>
    mode() === "together" ? digServerNow() : Date.now();

  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 100);
    onCleanup(() => clearInterval(t));
  });

  const lanes = createMemo((): DigLane[] => {
    const my = mine();
    const meLane: DigLane = {
      id: me() ?? "me",
      name: myName(),
      uid: me(),
      isMe: true,
      depth: my.depth,
      gems: my.gems,
      finished: my.finishedMs !== undefined,
    };
    if (mode() === "solo") {
      const b = bot();
      return [
        meLane,
        {
          id: "tappy",
          name: "Tappy",
          isBot: true,
          depth: b.depth,
          gems: b.gems,
          finished: b.finishedMs !== undefined,
        },
      ];
    }
    const others = Object.values(room()?.players ?? {})
      .filter((p) => p.uid !== me())
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(
        (p): DigLane => ({
          id: p.uid,
          name: p.name,
          uid: p.uid,
          depth: p.depth,
          gems: p.gems,
          finished: p.finishedMs !== undefined,
          online: p.online,
        }),
      );
    return [meLane, ...others];
  });

  /** finish times for ranking, keyed by lane id */
  const finishTimes = (): Record<string, number | undefined> => {
    if (mode() === "solo") {
      return { [me() ?? "me"]: mine().finishedMs, tappy: bot().finishedMs };
    }
    const out: Record<string, number | undefined> = {};
    for (const p of Object.values(room()?.players ?? {})) {
      out[p.uid] = p.finishedMs;
    }
    out[me() ?? "me"] = mine().finishedMs;
    return out;
  };

  const endsAt = (): number => {
    const start = startedAt();
    const first = Math.min(
      ...Object.values(finishTimes()).map((f) => f ?? Infinity),
    );
    const byTime = start + DIG_TIME_MS;
    if (mode() === "together") {
      const r = room();
      const fromRoom = r === null ? undefined : digEndsAt(r);
      return Math.min(
        byTime,
        fromRoom ?? byTime,
        start + first + FINISH_GRACE_MS,
      );
    }
    return Math.min(byTime, start + first + FINISH_GRACE_MS);
  };

  const finishGame = (): void => {
    if (untrack(phase) !== "playing") return;
    clearTimeout(botTimer);
    writer?.stop();
    const times = finishTimes();
    const ranked = rankDiggers(
      lanes()
        .filter((l) => l.online !== false || l.depth > 0)
        .map((l) => ({ ...l, finishedMs: times[l.id] })),
    );
    const place = ranked.findIndex((l) => l.isMe === true) + 1;
    const my = mine();
    const won = place === 1 && my.depth > 0;
    const score = digScore(my.depth, my.gems, won);
    if (won) sfx.finish();
    setResult({
      headline: won
        ? "You win! 💎"
        : my.finishedMs !== undefined
          ? "Treasure found!"
          : "Good digging!",
      score,
      stars: digStars(my.depth, won),
      stats: [
        { label: "blocks dug", value: `${my.depth}/${DIG_DEPTH}` },
        { label: "gems", value: String(my.gems) },
        { label: "place", value: `${ordinal(place)} of ${ranked.length}` },
      ],
    });
    setPhase("result");
    props.onResult?.(score);
    setClaim("pending");
    void claimMiniGameReward("gem-dig", score).then(setClaim);
    const r = untrack(room);
    if (r !== null && r.hostUid === me()) void finishDigRoom(r.code);
  };

  // end of match: time limit, grace after the first treasure, or all done
  createEffect(() => {
    if (phase() !== "playing" || startedAt() === 0) return;
    const allDone = lanes()
      .filter((l) => l.online !== false)
      .every((l) => l.finished);
    if (now() >= endsAt() || allDone) untrack(finishGame);
  });

  const dig = (): void => {
    const t = clock();
    if (t < startedAt()) return;
    const cur = mine();
    if (cur.finishedMs !== undefined) return;
    const block = shaft()[cur.depth];
    const depth = cur.depth + 1;
    const gems = cur.gems + (block?.gem === true ? 1 : 0);
    const next: Progress = { depth, gems };
    if (depth >= DIG_DEPTH) {
      next.finishedMs = Math.max(0, t - startedAt());
      sfx.finish();
    } else if (block?.gem === true) {
      sfx.great();
    } else {
      sfx.good();
    }
    setMine(next);
    writer?.push(next);
  };

  // ---------------- solo vs Tappy ----------------
  const botStep = (): void => {
    const b = bot();
    if (b.finishedMs !== undefined || untrack(phase) !== "playing") return;
    const block = shaft()[b.depth];
    if (block === undefined) return;
    botTimer = setTimeout(
      () => {
        const cur = bot();
        const depth = cur.depth + 1;
        const gems = cur.gems + (block.gem ? 1 : 0);
        setBot({
          depth,
          gems,
          finishedMs: depth >= DIG_DEPTH ? Date.now() - startedAt() : undefined,
        });
        botStep();
      },
      botBlockDelay(difficulty(), block, Math.random),
    );
  };

  const startSolo = async (): Promise<void> => {
    setPhase("loading");
    const words = await selected().getWords();
    clearTimeout(botTimer);
    setShaft(buildShaft(words, Math.floor(Math.random() * 1e9), difficulty()));
    setMine({ depth: 0, gems: 0 });
    setBot({ depth: 0, gems: 0 });
    setResult(null);
    const start = Date.now() + START_COUNTDOWN_MS;
    setStartedAt(start);
    setNow(Date.now());
    setPhase("playing");
    botTimer = setTimeout(botStep, START_COUNTDOWN_MS);
  };
  onCleanup(() => clearTimeout(botTimer));

  // ---------------- together ----------------
  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    setRoomCode(code);
    setPhase("lobby");
    void syncDigClock();
    unsubscribeRoom = subscribeDigRoom(code, (next) =>
      untrack(() => onRoom(code, next)),
    );
  };

  const onRoom = (code: string, next: DigRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (phase() === "lobby" || phase() === "playing") {
        setPhase("pick");
        showErrorNotification("The dig room was closed");
      }
      return;
    }
    setRoom(next);
    if (
      next.status === "playing" &&
      next.startedAt !== undefined &&
      phase() === "lobby"
    ) {
      setShaft(
        buildShaft(
          next.words,
          next.seed,
          digDifficultyFor(next.difficultyLabel),
        ),
      );
      setMine({ depth: 0, gems: 0 });
      setResult(null);
      setStartedAt(next.startedAt);
      setNow(digServerNow());
      writer = createProgressWriter(code);
      setPhase("playing");
    }
  };

  const createRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      const words = await selected().getWords();
      const code = await createDigRoom({
        difficultyLabel: difficulty().label,
        wordListLabel: selected().label,
        words,
      });
      watchRoom(code);
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      const code = await joinDigRoom(joinCode());
      watchRoom(code);
    } catch (e) {
      showErrorNotification("Could not join", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const leaveRoom = async (): Promise<void> => {
    const code = roomCode();
    writer?.stop();
    writer = undefined;
    unsubscribeRoom?.();
    unsubscribeRoom = undefined;
    setRoom(null);
    setRoomCode(undefined);
    if (code !== undefined) await leaveDigRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
    clearTimeout(botTimer);
    setResult(null);
    setStartedAt(0);
    setPhase("pick");
    void leaveRoom();
  };
  createEffect(() => {
    if (!props.open) untrack(reset);
    else setMode(props.initialMode ?? "solo");
  });
  onCleanup(() => void leaveRoom());

  const lobbyPlayers = (): DigRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );

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
                title="Gem Dig"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Race Tappy"
                    onClick={() => void startSolo()}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="gem-dig"
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                  createLabel="Create a dig room"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>⛏️ Type the word on the block to dig through it.</li>
                <li>💎 Some blocks hide gems - dig them for bonus points.</li>
                <li>🪨 Rocks have longer words.</li>
                <li>
                  🧰 First to the treasure at block {DIG_DEPTH} wins! The others
                  then get {FINISH_GRACE_MS / 1000} seconds to finish.
                </li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Who do you want to race?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={true}
                unlockHint=""
                onModeChange={setMode}
                soloLabel="vs Tappy"
                togetherLabel={`friends (up to ${MAX_DIGGERS})`}
              />
            </GameSetupSection>
            <GameSetupSection title="Words">
              <DifficultySegmented
                options={DIG_DIFFICULTIES}
                selectedLabel={difficulty().label}
                onSelect={(d) => setDifficulty(() => d)}
              />
            </GameSetupSection>
            <GameSetupMore>
              <GameSetupSection title="Choose a word list">
                <WordListPicker
                  groups={GROUPS}
                  selectedId={selected().id}
                  onSelect={setSelected}
                />
              </GameSetupSection>
            </GameSetupMore>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "loading"}>
          <div class="py-12 text-center text-sub">Loading…</div>
        </Show>

        <Show when={phase() === "lobby"}>
          <div class="grid gap-3 p-6 pt-12 font-kid">
            <div class="text-center">
              <div class="text-sm font-bold tracking-widest text-sub uppercase">
                Room code - tell your friends!
              </div>
              <div class="text-5xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                {room()?.wordListLabel} ·{" "}
                {digDifficultyFor(room()?.difficultyLabel ?? "").label} words ·{" "}
                {lobbyPlayers().length}/{MAX_DIGGERS} diggers
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
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
            </div>
            <Show when={lobbyPlayers().length < 2}>
              <div class="text-center text-sub">
                Waiting for friends to join…
              </div>
            </Show>
            <InviteClassmates
              gameId="gem-dig"
              code={roomCode()}
              show={room()?.hostUid === me()}
            />
            <Show
              when={room()?.hostUid === me()}
              fallback={
                <div class="text-center text-sub">
                  Waiting for the host to start…
                </div>
              }
            >
              <GameSetupPrimaryAction
                text="Start digging"
                disabled={lobbyPlayers().filter((p) => p.online).length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== null) void startDigRoom(r);
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
          <GemDig
            shaft={shaft()}
            me={lanes()[0] as DigLane}
            lanes={lanes()}
            startsInMs={Math.max(0, startedAt() - now())}
            timeLeftMs={Math.max(0, endsAt() - Math.max(now(), startedAt()))}
            hurry={Object.values(finishTimes()).some((f) => f !== undefined)}
            over={phase() === "result"}
            onDig={dig}
          />
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                note={claimNote(claim())}
                onPlayAgain={
                  mode() === "solo" ? () => void startSolo() : undefined
                }
                onExit={() => props.onClose()}
              />
            )}
          </Show>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  on,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { DailyClassBoard } from "../components/DailyClassBoard";
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
import { MULTIPLAYER_UNLOCK_HINT_TYPE_TOSS } from "../components/multiplayer-unlock-hints";
import { PracticeWords } from "../components/PracticeWords";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import { dailyDay } from "../ghost-hunter/daily-haunting";
import { actingHostUid } from "../shared/acting-host";
import {
  arcadeNow,
  ArcadeRoom,
  claimKill,
  createArcadeRoom,
  finishArcadeRoom,
  joinArcadeRoom,
  leaveArcadeRoom,
  startArcadeRoom,
  subscribeArcadeRoom,
  syncArcadeClock,
  updateArcadePlayer,
} from "../shared/arcade-room";
import { submitDailyBest } from "../shared/daily-board";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { PrizeBooth } from "./PrizeBooth";
import {
  dailyTossPlan,
  Stall,
  STALL_IDS,
  STALLS,
  TOSS_DIFFICULTIES,
  TossDifficulty,
  tossStars,
} from "./toss-rules";
import { Booth, boothRequest } from "./toss-store";
import { TossEnd, TossGame, TossShared } from "./TossGame";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);
const KIND = "tossArena" as const;
const MEDIUM = TOSS_DIFFICULTIES[1] as TossDifficulty;
const HOT_HAND_TEXT = "5 in a row with no mistakes = 🔥 hot hand (2× tickets).";

type Props = {
  open: boolean;
  onClose: () => void;
  multiplayerUnlocked?: boolean;
  initialMode?: "solo" | "together";
  lessonWords?: string[];
  onResult?: (
    score: number,
    wave: number,
    difficultyLabel: string,
    wordListGroup: string,
    checkpointCleared?: boolean,
  ) => void;
};

type Run = {
  key: number;
  stall: Stall;
  words: string[];
  seed: number;
  difficulty: TossDifficulty;
  daily: boolean;
  lesson: boolean;
  shared?: TossShared;
};

export function TypeTossModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<TossDifficulty>(MEDIUM);
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [stall, setStall] = createSignal<Stall | "daily">("ducks");
  const [phase, setPhase] = createSignal<
    "pick" | "booth" | "loading" | "playing" | "lobby" | "arena-results"
  >("pick");
  const [run, setRun] = createSignal<Run | null>(null);
  const [booth, setBooth] = createSignal<Booth>({ tickets: 0, prizes: [] });
  const [result, setResult] = createSignal<{
    view: GameResultView;
    practice: string[];
    note?: string;
  } | null>(null);
  // online
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<ArcadeRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  let unsubscribe: (() => void) | undefined;
  let startedAt = 0;
  let runKey = 0;

  const myUid = (): string | undefined => getAuthenticatedUser()?.uid;
  const isLesson = (): boolean => props.lessonWords !== undefined;
  const day = dailyDay();
  const daily = dailyTossPlan(day);

  // ------------------------------------------------------------ solo
  const start = async (wordsOverride?: string[]): Promise<void> => {
    setResult(null);
    setPhase("loading");
    const lesson = wordsOverride !== undefined;
    const isDaily = !lesson && stall() === "daily";
    const option = isDaily
      ? OPTIONS.find((o) => o.id === daily.listId)
      : undefined;
    const words = wordsOverride ?? (await (option ?? selected()).getWords());
    const picked = stall();
    setRun({
      key: ++runKey,
      stall: lesson
        ? "ducks"
        : isDaily
          ? daily.stall
          : picked === "daily"
            ? "ducks"
            : picked,
      words,
      seed: isDaily ? daily.seed : Math.floor(Math.random() * 2 ** 31),
      difficulty: lesson || isDaily ? MEDIUM : difficulty(),
      daily: isDaily,
      lesson,
    });
    setPhase("playing");
  };

  // `played` is the run this game belongs to: the result can land just
  // after the window closed (which clears run()), and must still count.
  const onEnd = async (e: TossEnd, played?: Run): Promise<void> => {
    const r = played ?? untrack(run);
    if (r === null) return;
    props.onResult?.(
      e.tickets,
      e.words,
      r.difficulty.label,
      r.lesson ? "" : selected().group,
      r.lesson,
    );
    const notes: string[] = [];
    if (myUid() !== undefined && e.tickets > 0) {
      const b = await boothRequest(e.tickets).catch(() => null);
      if (b !== null) {
        setBooth(b);
        notes.push(
          `🎟️ ${e.tickets} tickets banked - ${b.tickets} to spend at the prize booth!`,
        );
      }
    }
    if (r.daily && e.tickets > 0 && myUid() !== undefined) {
      const best = await submitDailyBest("dailyToss", day, e.tickets).catch(
        () => false,
      );
      if (best) notes.push("🏆 A new best for your class today!");
    }
    if (r.shared !== undefined) return; // the room shows the results
    const stars = r.lesson ? 3 : tossStars(e.tickets, e.words, e.timeMs);
    setResult({
      view: {
        headline: stars >= 3 ? "Prize champion! 🏆" : "Time's up!",
        score: e.tickets,
        scoreLabel: "tickets",
        stars,
        stats: [
          { label: "targets hit", value: String(e.words) },
          { label: "words per minute", value: String(e.wpm) },
          { label: "accuracy", value: `${e.accuracy}%` },
          { label: "best streak", value: `🔥 ${e.bestStreak}` },
        ],
      },
      practice: e.report.hardest,
      note: notes.join(" "),
    });
  };

  const buy = async (id: string): Promise<void> => {
    const b = await boothRequest(0, id).catch(() => null);
    if (b !== null) setBooth(b);
  };

  // ------------------------------------------------------------ online
  const players = createMemo(() =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    ),
  );
  const online = (): ArcadeRoom["players"][string][] =>
    players().filter((p) => p.online);
  const isHost = (): boolean => room()?.hostUid === myUid();

  const sharedFor = (r: ArcadeRoom): TossShared => ({
    myUid: myUid() ?? "",
    startAt: r.startAt ?? arcadeNow(),
    now: arcadeNow,
    kills: () => room()?.kills ?? {},
    claim: (id) => void claimKill(KIND, r.code, id).catch(() => undefined),
    report: (tickets, done) =>
      void updateArcadePlayer(KIND, r.code, {
        score: tickets,
        lives: 1,
        done,
      }).catch(() => undefined),
    others: () =>
      Object.values(room()?.players ?? {})
        .filter((p) => p.uid !== myUid() && p.online)
        .map((p) => ({ name: p.name, score: p.score })),
  });

  const watch = (code: string): void => {
    unsubscribe?.();
    setRoomCode(code);
    setPhase("lobby");
    void syncArcadeClock();
    unsubscribe = subscribeArcadeRoom(KIND, code, (next) => {
      if (next === null) {
        setRoom(undefined);
        setRoomCode(undefined);
        setRun(null);
        setPhase("pick");
        showErrorNotification("The room was closed");
        return;
      }
      setRoom(next);
      if (
        next.status === "playing" &&
        next.startAt !== undefined &&
        next.startAt !== startedAt
      ) {
        startedAt = next.startAt;
        const st = (
          STALL_IDS.includes(next.difficultyLabel as Stall)
            ? next.difficultyLabel
            : "ducks"
        ) as Stall;
        setResult(null);
        setRun({
          key: ++runKey,
          stall: st,
          words: next.words ?? [],
          seed: next.seed ?? 1,
          difficulty: MEDIUM,
          daily: false,
          lesson: false,
          shared: sharedFor(next),
        });
        setPhase("playing");
      }
      if (next.status === "finished") {
        setRun(null);
        setPhase("arena-results");
      }
    });
  };

  createEffect(() => {
    const r = room();
    // the host - or the next player if the host has dropped out
    if (r?.status !== "playing" || actingHostUid(r) !== myUid()) return;
    const on = Object.values(r.players ?? {}).filter((p) => p.online);
    if (on.length > 0 && on.every((p) => p.done)) {
      void finishArcadeRoom(KIND, r.code).catch(() => undefined);
    }
  });

  const createRoom = async (): Promise<void> => {
    if (props.multiplayerUnlocked !== true) return;
    setRoomBusy(true);
    try {
      const option = selected();
      const st = stall();
      watch(
        await createArcadeRoom(KIND, {
          // the room's stall rides in the difficulty field
          difficultyLabel: st === "daily" ? "ducks" : st,
          wordListLabel: option.label,
          words: await option.getWords(),
          lives: 1,
        }),
      );
    } catch (error) {
      showErrorNotification("Could not create a room", { error });
    } finally {
      setRoomBusy(false);
    }
  };
  const joinRoom = async (): Promise<void> => {
    if (!/^\d{6}$/.test(joinCode())) {
      showErrorNotification("Enter the 6-digit room code");
      return;
    }
    setRoomBusy(true);
    try {
      watch(await joinArcadeRoom(KIND, joinCode(), 1));
    } catch (error) {
      showErrorNotification("Could not join the room", { error });
    } finally {
      setRoomBusy(false);
    }
  };
  const leave = async (): Promise<void> => {
    const code = roomCode();
    unsubscribe?.();
    unsubscribe = undefined;
    setRoom(undefined);
    setRoomCode(undefined);
    startedAt = 0;
    if (code !== undefined) {
      await leaveArcadeRoom(KIND, code).catch(() => undefined);
    }
  };

  // ------------------------------------------------------------ open/close
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) {
          setRun(null);
          setResult(null);
          setPhase("pick");
          void leave();
          return;
        }
        setMode(
          untrack(() => props.initialMode) === "together" &&
            untrack(() => props.multiplayerUnlocked) === true
            ? "together"
            : "solo",
        );
        const words = untrack(() => props.lessonWords);
        if (words !== undefined) {
          void start(words);
          return;
        }
        if (myUid() !== undefined) {
          void boothRequest(0)
            .then(setBooth)
            .catch(() => undefined);
        }
      },
    ),
  );
  onCleanup(() => void leave());

  const layout = (): "pick" | "playing" | "compact" =>
    phase() === "playing"
      ? "playing"
      : (phase() === "pick" || phase() === "booth") && !isLesson()
        ? "pick"
        : "compact";

  const STALL_BUTTONS: {
    id: Stall | "daily";
    emoji: string;
    label: string;
    hint: string;
  }[] = [
    ...STALL_IDS.map((id) => ({
      id,
      emoji: STALLS[id].emoji,
      label: STALLS[id].name,
      hint: STALLS[id].tip,
    })),
    {
      id: "daily",
      emoji: "📅",
      label: "Daily toss",
      hint: "same stall for everyone today",
    },
  ];

  return (
    <Show when={props.open}>
      <GameModalFrame layout={layout()} onClose={() => props.onClose()}>
        <Show when={phase() === "pick" && !isLesson()}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Type Toss"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text={
                      stall() === "daily"
                        ? "Start today's toss"
                        : `Play ${STALLS[stall() as Stall].name}`
                    }
                    onClick={() => void start()}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="type-toss"
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  createLabel="Open a stall for friends"
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <p class="text-em-sm text-sub">
                🎪 Type a target&apos;s word to throw a ball at it and win 🎟️
                tickets! {HOT_HAND_TEXT} Hit 🏆 for 5× tickets, ⏱️ for more
                time, ✨ for double tickets - but never the 💣! Spend your
                tickets at the prize booth.
              </p>
            </GameSetupSection>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <For
                each={
                  mode() === "solo"
                    ? STALL_BUTTONS
                    : STALL_BUTTONS.filter((b) => b.id !== "daily")
                }
              >
                {(b) => (
                  <button
                    type="button"
                    class={cn(
                      "grid cursor-pointer place-items-center gap-0.5 rounded-xl border-2 p-2 text-center",
                      stall() === b.id
                        ? "border-main bg-main/15 text-text"
                        : "border-transparent bg-sub-alt text-sub",
                    )}
                    onClick={() => setStall(b.id)}
                  >
                    <span class="text-2xl">{b.emoji}</span>
                    <span class="text-sm font-bold">{b.label}</span>
                    <span class="text-xs">{b.hint}</span>
                  </button>
                )}
              </For>
            </div>
            <Show when={mode() === "solo" && stall() === "daily"}>
              <GameSetupSection title="📅 Today's toss">
                <div class="grid gap-2 text-sm text-sub">
                  <div>
                    {STALLS[daily.stall].emoji} {STALLS[daily.stall].name} ·
                    Medium · 60 seconds
                  </div>
                  <Show
                    when={myUid() !== undefined}
                    fallback={<div>Sign in to see the class board.</div>}
                  >
                    <DailyClassBoard
                      collection="dailyToss"
                      day={day}
                      unit="🎟️"
                    />
                  </Show>
                </div>
              </GameSetupSection>
            </Show>
            <Show when={mode() === "solo" && stall() !== "daily"}>
              <GameSetupSection title="Choose difficulty">
                <DifficultySegmented
                  options={TOSS_DIFFICULTIES}
                  selectedLabel={difficulty().label}
                  onSelect={(d) => setDifficulty(d)}
                />
              </GameSetupSection>
            </Show>
            <button
              type="button"
              class="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-sub-alt p-3 text-left"
              onClick={() => setPhase("booth")}
            >
              <span class="text-3xl">🎪</span>
              <span class="grid">
                <span class="font-bold text-text">Prize booth</span>
                <span class="text-sm text-sub">
                  🎟️ {booth().tickets} tickets · {booth().prizes.length} prizes
                  on your shelf
                </span>
              </span>
            </button>
            <GameSetupMore>
              <GameSetupSection title="Mode">
                <SoloTogetherToggle
                  mode={mode()}
                  soloLabel="Play alone"
                  togetherLabel="Share a stall"
                  multiplayerUnlocked={props.multiplayerUnlocked === true}
                  unlockHint={MULTIPLAYER_UNLOCK_HINT_TYPE_TOSS}
                  onModeChange={setMode}
                />
              </GameSetupSection>
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

        <Show when={phase() === "booth"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="🎪 Prize booth"
                onClose={() => setPhase("pick")}
              />
            }
            footer={
              <GameSetupPrimaryAction
                text="Done"
                showArrow={false}
                onClick={() => setPhase("pick")}
              />
            }
          >
            <PrizeBooth
              booth={booth()}
              signedIn={myUid() !== undefined}
              onBuy={(id) => void buy(id)}
            />
          </GamePickLayout>
        </Show>

        <Show when={phase() === "loading"}>
          <div class="flex items-center justify-center py-12 text-sub">
            Loading…
          </div>
        </Show>

        <Show when={phase() === "lobby"}>
          <div class="grid gap-4 pt-12">
            <div class="text-center">
              <div class="text-em-xs font-bold tracking-widest text-sub uppercase">
                room code
              </div>
              <div class="text-4xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                🎪 One stall for everyone - a target goes to whoever finishes
                its word first ·{" "}
                {STALLS[(room()?.difficultyLabel ?? "ducks") as Stall]?.name ??
                  ""}{" "}
                · {room()?.wordListLabel}
              </div>
            </div>
            <div class="grid gap-2">
              <For each={players()}>
                {(p) => (
                  <div class="flex items-center gap-3 rounded bg-sub-alt px-3 py-2">
                    <UserAvatar uid={p.uid} class="h-8 w-8" />
                    <span class="flex-1 truncate text-text">
                      {p.name}
                      {p.uid === room()?.hostUid ? " · host" : ""}
                    </span>
                    <span class={p.online ? "text-main" : "text-sub"}>
                      {p.online ? "ready" : "offline"}
                    </span>
                  </div>
                )}
              </For>
            </div>
            <InviteClassmates
              gameId="type-toss"
              code={roomCode()}
              show={isHost()}
            />
            <Show
              when={isHost()}
              fallback={
                <div class="text-center text-sub">Waiting for the host…</div>
              }
            >
              <GameSetupPrimaryAction
                text="Open the stall"
                disabled={online().length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== undefined) {
                    void startArcadeRoom(KIND, r, 1);
                  }
                }}
              />
            </Show>
          </div>
        </Show>

        <Show when={phase() === "playing"}>
          <Show when={run()} keyed>
            {(r) => (
              <TossGame
                stall={r.stall}
                words={r.words}
                seed={r.seed}
                difficulty={r.difficulty}
                {...(r.shared === undefined ? {} : { shared: r.shared })}
                onEnd={(e) => void onEnd(e, r)}
              />
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r().view}
                {...(isLesson() ? {} : { onPlayAgain: () => void start() })}
                {...(r().note === undefined || r().note === ""
                  ? {}
                  : { note: r().note })}
                onExit={() => props.onClose()}
                extra={<PracticeWords words={r().practice} />}
              />
            )}
          </Show>
        </Show>

        <Show when={phase() === "arena-results"}>
          <div class="grid gap-3 pt-12">
            <div class="text-center text-2xl font-bold text-main">
              {(() => {
                const best = [...online()].sort((a, b) => b.score - a.score)[0];
                return best === undefined
                  ? "Stall closed!"
                  : best.uid === myUid()
                    ? "🏆 You won the most tickets!"
                    : `🏆 ${best.name} won the most tickets!`;
              })()}
            </div>
            <For each={[...online()].sort((a, b) => b.score - a.score)}>
              {(p, i) => (
                <div
                  class={cn(
                    "flex items-center gap-3 rounded px-3 py-2",
                    p.uid === myUid() ? "bg-main/20" : "bg-sub-alt",
                  )}
                >
                  <span class="w-6 font-bold text-main">{i() + 1}</span>
                  <UserAvatar uid={p.uid} class="h-9 w-9" />
                  <span class="min-w-0 flex-1 truncate text-text">
                    {p.name}
                  </span>
                  <span class="font-mono text-sub">🎟️ {p.score}</span>
                </div>
              )}
            </For>
            <Show
              when={isHost()}
              fallback={
                <div class="text-center text-sub">Waiting for the host…</div>
              }
            >
              <GameSetupPrimaryAction
                text="Play again"
                disabled={online().length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== undefined) {
                    void startArcadeRoom(KIND, r, 1);
                  }
                }}
              />
            </Show>
            <GameSetupPrimaryAction
              text="Back to lessons"
              showArrow={false}
              onClick={() => props.onClose()}
            />
          </div>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

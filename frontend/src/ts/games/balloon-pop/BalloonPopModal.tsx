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
import { PracticeWords } from "../components/PracticeWords";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import { dailyDay } from "../ghost-hunter/daily-haunting";
import { actingHostUid } from "../shared/acting-host";
import {
  arcadeNow,
  ArcadeRoom,
  createArcadeRoom,
  finishArcadeRoom,
  joinArcadeRoom,
  leaveArcadeRoom,
  sendBalloon,
  startArcadeRoom,
  subscribeArcadeRoom,
  syncArcadeClock,
  updateArcadePlayer,
} from "../shared/arcade-room";
import { createPickGuard, useGameLevel } from "../use-game-level";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { AnimalCollection } from "./AnimalCollection";
import {
  CHECKPOINT_LEVEL,
  dailyGoal,
  dailyGoalText,
  dailyProgress,
  goalText,
  KIND_INFO,
  Level,
  levelById,
  levelOpen,
  levelStars,
  levelTier,
  LEVELS,
  START_LIVES,
  VERSUS_SPEEDS,
  versusLevel,
} from "./balloon-rules";
import {
  addDaily,
  dailyCount,
  loadLocalStars,
  saveStars,
  StarMap,
} from "./balloon-store";
import { BalloonEnd, BalloonGame, BalloonVersus } from "./BalloonGame";
import { LevelMap } from "./LevelMap";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);
const KIND = "balloonRooms" as const;

type Props = {
  open: boolean;
  onClose: () => void;
  initialMode?: "solo" | "together";
  lessonWords?: string[];
  onResult?: (
    score: number,
    wave: number,
    difficultyLabel: string,
    wordListGroup: string,
    /** a lesson checkpoint was beaten */
    cleared?: boolean,
  ) => void;
};

type Run = {
  key: number;
  level: Level;
  words: string[];
  seed: number;
  versus?: BalloonVersus;
};

export function BalloonPopModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [speed, setSpeed] = createSignal(
    VERSUS_SPEEDS[1] as (typeof VERSUS_SPEEDS)[number],
  );
  const lv = useGameLevel(() => props.open);
  createPickGuard(selected, setSelected, lv.listLock, () => OPTIONS);
  createPickGuard(
    speed,
    (d) => setSpeed(() => d),
    lv.speedLock,
    () => VERSUS_SPEEDS,
  );
  const [stars, setStars] = createSignal<StarMap>(loadLocalStars());
  const [levelId, setLevelId] = createSignal(1);
  const [phase, setPhase] = createSignal<
    "pick" | "loading" | "playing" | "lobby" | "versus-results"
  >("pick");
  const [run, setRun] = createSignal<Run | null>(null);
  const [result, setResult] = createSignal<{
    view: GameResultView;
    practice: string[];
    note?: string;
    next?: number;
  } | null>(null);
  const day = dailyDay();
  const goal = dailyGoal(day);
  const [daily, setDaily] = createSignal(dailyCount(day));
  // versus
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<ArcadeRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  let unsubscribe: (() => void) | undefined;
  let startedAt = 0;
  let runKey = 0;
  let sendN = 0;

  const myUid = (): string | undefined => getAuthenticatedUser()?.uid;
  const isLesson = (): boolean => props.lessonWords !== undefined;

  // first open level the player hasn't finished
  const firstUnplayed = (s: StarMap): number =>
    LEVELS.find((l) => levelOpen(l.id, s) && (s[l.id] ?? 0) === 0)?.id ??
    LEVELS.filter((l) => levelOpen(l.id, s)).at(-1)?.id ??
    1;

  // ------------------------------------------------------------ solo
  const start = async (
    id = levelId(),
    wordsOverride?: string[],
  ): Promise<void> => {
    setResult(null);
    setPhase("loading");
    const level =
      wordsOverride !== undefined ? CHECKPOINT_LEVEL : levelById(id);
    const words = wordsOverride ?? (await selected().getWords());
    setLevelId(level.id > 0 ? level.id : levelId());
    setRun({
      key: ++runKey,
      level,
      words,
      seed: Math.floor(Math.random() * 2 ** 31),
    });
    setPhase("playing");
  };

  // `played` is the run this game belongs to: the result can land just
  // after the window closed (which clears run()), and must still count.
  const onEnd = async (e: BalloonEnd, played?: Run): Promise<void> => {
    const r = played ?? untrack(run);
    if (r === null) return;
    const level = r.level;
    props.onResult?.(
      e.score,
      e.wave,
      level.id > 0
        ? levelTier(level.id)
        : r.versus !== undefined
          ? speed().label
          : "Easy",
      isLesson() ? "" : selected().group,
      level.id === 0 ? e.cleared : undefined,
    );
    const notes: string[] = [];
    // today's goal
    const before = daily();
    const now = addDaily(day, dailyProgress(goal, e.tally));
    setDaily(now);
    if (before < goal.n && now >= goal.n) notes.push("🎉 Today's goal done!");
    if (r.versus !== undefined) return; // the room shows the results
    if (level.id === 0) {
      setResult({
        view: {
          headline: e.cleared ? "Checkpoint cleared! 🎉" : "Nice popping!",
          score: e.score,
          stars: e.cleared ? 3 : e.score > 0 ? 1 : 0,
          stats: [
            { label: "balloons popped", value: String(e.hits) },
            { label: "accuracy", value: `${e.accuracy}%` },
            { label: "best streak", value: `🔥 ${e.bestStreak}` },
            { label: "got away", value: String(e.tally.escaped) },
          ],
        },
        practice: e.report.hardest,
        note: notes.join(" "),
      });
      return;
    }
    const got = levelStars({
      level,
      cleared: e.cleared,
      tally: e.tally,
      bestStreak: e.bestStreak,
      accuracy: e.accuracy,
    });
    const hadAnimal = (stars()[level.id] ?? 0) >= 2;
    const map = await saveStars(level.id, got);
    setStars(map);
    if (!hadAnimal && got >= 2) {
      notes.push(
        `${level.animal} You won the ${level.animalName} balloon animal!`,
      );
    }
    const next = LEVELS.find((l) => l.id === level.id + 1);
    setResult({
      view: {
        headline: !e.cleared
          ? "So close - try again!"
          : got === 3
            ? "Perfect level! 🌟"
            : got === 2
              ? "Goal reached! 🎯"
              : "Level done! 🎈",
        score: e.score,
        stars: got,
        stats: [
          { label: "balloons popped", value: String(e.hits) },
          { label: "accuracy", value: `${e.accuracy}%` },
          { label: "best streak", value: `🔥 ${e.bestStreak}` },
          { label: "goal", value: got >= 2 ? "✓" : "✗" },
        ],
      },
      practice: e.report.hardest,
      note: notes.join(" "),
      ...(e.cleared && next !== undefined ? { next: next.id } : {}),
    });
  };

  // ------------------------------------------------------------ versus
  const players = createMemo(() =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    ),
  );
  const online = (): ArcadeRoom["players"][string][] =>
    players().filter((p) => p.online);
  const isHost = (): boolean => room()?.hostUid === myUid();

  const versusFor = (r: ArcadeRoom): BalloonVersus => ({
    myUid: myUid() ?? "",
    startAt: r.startAt ?? arcadeNow(),
    now: arcadeNow,
    sends: () => room()?.sends?.[myUid() ?? ""] ?? {},
    opponent: () => {
      const o = Object.values(room()?.players ?? {}).find(
        (p) => p.uid !== myUid() && p.online,
      );
      return o === undefined
        ? undefined
        : { name: o.name, score: o.score, lives: o.lives, done: o.done };
    },
    send: (word) => {
      const o = Object.values(room()?.players ?? {}).find(
        (p) => p.uid !== myUid() && p.online,
      );
      if (o !== undefined) {
        void sendBalloon(
          KIND,
          r.code,
          o.uid,
          `${(myUid() ?? "x").slice(0, 6)}${++sendN}`,
          word,
        ).catch(() => undefined);
      }
    },
    report: (score, lives, done) =>
      void updateArcadePlayer(KIND, r.code, { score, lives, done }).catch(
        () => undefined,
      ),
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
        const sp =
          VERSUS_SPEEDS.find((v) => v.label === next.difficultyLabel) ??
          VERSUS_SPEEDS[1];
        setResult(null);
        setRun({
          key: ++runKey,
          level: versusLevel(sp?.speed ?? 6),
          words: next.words ?? [],
          seed: next.seed ?? 1,
          versus: versusFor(next),
        });
        setPhase("playing");
      }
      if (next.status === "finished") {
        setRun(null);
        setPhase("versus-results");
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
    setRoomBusy(true);
    try {
      const option = selected();
      watch(
        await createArcadeRoom(KIND, {
          difficultyLabel: speed().label,
          wordListLabel: option.label,
          words: await option.getWords(),
          lives: START_LIVES,
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
      watch(await joinArcadeRoom(KIND, joinCode(), START_LIVES));
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
        setMode(untrack(() => props.initialMode) ?? "solo");
        setDaily(dailyCount(day));
        const words = untrack(() => props.lessonWords);
        if (words !== undefined) {
          void start(0, words);
          return;
        }
        const local = loadLocalStars();
        setStars(local);
        setLevelId(firstUnplayed(local));
        void saveStars(0, 0).then((map) => {
          setStars(map);
          setLevelId(firstUnplayed(map));
        });
      },
    ),
  );
  onCleanup(() => void leave());

  const layout = (): "pick" | "playing" | "compact" =>
    phase() === "playing"
      ? "playing"
      : phase() === "pick" && !isLesson()
        ? "pick"
        : "compact";
  const level = (): Level => levelById(levelId());

  return (
    <Show when={props.open}>
      <GameModalFrame layout={layout()} onClose={() => props.onClose()}>
        <Show when={phase() === "pick" && !isLesson()}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Balloon Pop"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    disabled={!lv.ready()}
                    text={`Play level ${levelId()}: ${level().name}`}
                    onClick={() => void start()}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="balloon-pop"
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  createLabel="Host a balloon battle"
                  onJoinCodeChange={setJoinCode}
                  createDisabled={!lv.ready()}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                />
              </Show>
            }
          >
            <Show
              when={mode() === "solo"}
              fallback={
                <>
                  <GameSetupSection title="How to play" accent>
                    <p class="text-em-sm text-sub">
                      🆚 Pop balloons faster than your rival! Every 3 pops in a
                      row sends a balloon to their side. After 2 minutes (or
                      when you both run out of hearts) the most points wins.
                    </p>
                  </GameSetupSection>
                  <GameSetupSection title="Speed">
                    <DifficultySegmented
                      options={VERSUS_SPEEDS}
                      lockedReason={lv.speedLock}
                      selectedLabel={speed().label}
                      onSelect={(d) => setSpeed(d)}
                    />
                  </GameSetupSection>
                </>
              }
            >
              {/* today's goal */}
              <div class="grid gap-1 rounded-xl bg-sub-alt p-3">
                <div class="flex justify-between text-sm font-bold text-text">
                  <span>📅 {dailyGoalText(goal)}</span>
                  <span>
                    {Math.min(daily(), goal.n)} / {goal.n}{" "}
                    {daily() >= goal.n ? "🎉" : ""}
                  </span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-bg">
                  <div
                    class="h-full rounded-full bg-main"
                    style={{
                      width: `${Math.min(100, (daily() / goal.n) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
              <LevelMap
                stars={stars()}
                selected={levelId()}
                onSelect={setLevelId}
              />
              <div class="grid gap-1 rounded-xl bg-sub-alt p-3 text-sm">
                <div class="font-bold text-text">
                  Level {level().id}: {level().name} {level().animal}
                </div>
                <div class="text-sub">🎯 Goal: {goalText(level().goal)}</div>
                <div class="text-sub">
                  ⭐ finish · ⭐⭐ + goal (wins the {level().animalName}) ·
                  ⭐⭐⭐ nothing gets away
                </div>
                <div class="text-sub">
                  New here:{" "}
                  {level()
                    .kinds.filter(
                      (k) =>
                        k !== "normal" &&
                        !(LEVELS[level().id - 2]?.kinds ?? []).includes(k),
                    )
                    .map((k) => `${KIND_INFO[k].name} (${KIND_INFO[k].tip})`)
                    .join(", ") || "-"}
                </div>
              </div>
              <AnimalCollection stars={stars()} />
            </Show>
            <GameSetupMore>
              <GameSetupSection title="Mode">
                <SoloTogetherToggle
                  mode={mode()}
                  soloLabel="Levels"
                  togetherLabel="Battle a classmate"
                  multiplayerUnlocked={true}
                  unlockHint=""
                  onModeChange={setMode}
                />
              </GameSetupSection>
              <GameSetupSection title="Word list">
                <WordListPicker
                  lockedReason={lv.listLock}
                  groups={GROUPS}
                  selectedId={selected().id}
                  onSelect={setSelected}
                />
              </GameSetupSection>
            </GameSetupMore>
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
                🆚 Balloon battle · {room()?.difficultyLabel} ·{" "}
                {room()?.wordListLabel}
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
              gameId="balloon-pop"
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
                text="Start the battle"
                disabled={online().length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== undefined) {
                    void startArcadeRoom(KIND, r, START_LIVES);
                  }
                }}
              />
            </Show>
          </div>
        </Show>

        <Show when={phase() === "playing"}>
          <Show when={run()} keyed>
            {(r) => (
              <BalloonGame
                level={r.level}
                words={r.words}
                seed={r.seed}
                {...(r.versus === undefined ? {} : { versus: r.versus })}
                onEnd={(e) => void onEnd(e, r)}
              />
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r().view}
                {...(isLesson()
                  ? {}
                  : r().next !== undefined
                    ? {
                        onPlayAgain: () => void start(r().next),
                        playAgainLabel: `Next: level ${r().next}`,
                      }
                    : {
                        onPlayAgain: () => void start(levelId()),
                        playAgainLabel: "Try again",
                      })}
                {...(r().note === undefined || r().note === ""
                  ? {}
                  : { note: r().note })}
                onExit={() => (isLesson() ? props.onClose() : setPhase("pick"))}
                extra={<PracticeWords words={r().practice} />}
              />
            )}
          </Show>
        </Show>

        <Show when={phase() === "versus-results"}>
          <div class="grid gap-3 pt-12">
            <div class="text-center text-2xl font-bold text-main">
              {(() => {
                const best = [...online()].sort((a, b) => b.score - a.score)[0];
                return best === undefined
                  ? "Battle over!"
                  : best.uid === myUid()
                    ? "🏆 You win!"
                    : `🏆 ${best.name} wins!`;
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
                  <span class="font-mono text-sub">⭐ {p.score}</span>
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
                text="Rematch!"
                disabled={online().length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== undefined) {
                    void startArcadeRoom(KIND, r, START_LIVES);
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

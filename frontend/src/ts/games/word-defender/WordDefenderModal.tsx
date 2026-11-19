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
import { LESSON_CHECKPOINT_MAX_WAVE } from "../../lessons/lesson-checkpoints";
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
import { PracticeWords } from "../components/PracticeWords";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import {
  arcadeNow,
  ArcadeRoom,
  claimKill,
  createArcadeRoom,
  finishArcadeRoom,
  joinArcadeRoom,
  leaveArcadeRoom,
  markHit,
  sendFx,
  startArcadeRoom,
  subscribeArcadeRoom,
  syncArcadeClock,
  updateArcadePlayer,
} from "../shared/arcade-room";
import { submitDailyBest } from "../shared/daily-board";
import { waveAccuracy } from "../shared/wave-result";
import {
  dailyDay,
  getMissionWords,
  MISSION_WAVES,
  missionPlan,
} from "./daily-mission";
import {
  DEFENDER_DIFFICULTIES,
  DefenderDifficulty,
  DefenderOpts,
  defenderStars,
  START_LIVES,
} from "./defender-rules";
import { DefenderCoop, DefenderEnd, DefenderGame } from "./DefenderGame";
import { getWordListOptions, WordListOption } from "./systems/vocab-pool";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);
const KIND = "defenderRooms" as const;

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
  opts: DefenderOpts;
  coop?: DefenderCoop;
  daily: boolean;
};

export function WordDefenderModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<DefenderDifficulty>(
    DEFENDER_DIFFICULTIES[0] as DefenderDifficulty,
  );
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [daily, setDaily] = createSignal(false);
  const [phase, setPhase] = createSignal<
    "pick" | "loading" | "playing" | "lobby" | "coop-results"
  >("pick");
  const [run, setRun] = createSignal<Run | null>(null);
  const [result, setResult] = createSignal<{
    view: GameResultView;
    practice: string[];
    note?: string;
  } | null>(null);
  // co-op
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<ArcadeRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  let unsubscribe: (() => void) | undefined;
  let startedAt = 0;
  let runKey = 0;

  const myUid = (): string | undefined => getAuthenticatedUser()?.uid;
  const day = dailyDay();
  const plan = missionPlan(day);
  const isLesson = (): boolean => props.lessonWords !== undefined;

  // ------------------------------------------------------------ solo
  const start = async (wordsOverride?: string[]): Promise<void> => {
    setResult(null);
    setPhase("loading");
    const lesson = wordsOverride !== undefined;
    const isDaily = !lesson && daily();
    const words = lesson
      ? wordsOverride
      : isDaily
        ? await getMissionWords(plan)
        : await selected().getWords();
    setRun({
      key: ++runKey,
      daily: isDaily,
      opts: {
        words,
        difficulty:
          lesson || isDaily
            ? (DEFENDER_DIFFICULTIES[lesson ? 0 : 1] as DefenderDifficulty)
            : difficulty(),
        seed: isDaily ? plan.seed : Math.floor(Math.random() * 2 ** 31),
        maxWave: lesson
          ? LESSON_CHECKPOINT_MAX_WAVE
          : isDaily
            ? MISSION_WAVES
            : 0,
        bosses: !lesson,
        upgrades: !lesson,
      },
    });
    setPhase("playing");
  };

  const onEnd = async (e: DefenderEnd): Promise<void> => {
    const r = untrack(run);
    const diff = r?.opts.difficulty.label ?? "Easy";
    props.onResult?.(
      e.score,
      e.wave,
      diff,
      isLesson() ? "" : selected().group,
      e.cleared,
    );
    let note: string | undefined;
    if (r?.daily === true && e.score > 0 && myUid() !== undefined) {
      const best = await submitDailyBest("dailyDefender", day, e.score).catch(
        () => false,
      );
      if (best) note = "🏆 A new best for your class today!";
    }
    if (r?.coop !== undefined) return; // the room shows the results
    setResult({
      view: {
        headline: e.cleared
          ? r?.daily === true
            ? "Mission complete! 🚀"
            : "Base saved! 🎉"
          : e.wave >= 6
            ? "Space hero!"
            : "Great defending!",
        score: e.score,
        stars: defenderStars(e.wave, e.cleared, e.score),
        stats: [
          { label: "wave reached", value: String(e.wave) },
          { label: "accuracy", value: `${waveAccuracy(e)}%` },
          { label: "ships zapped", value: String(e.hits) },
          { label: "best combo", value: `🔥 ${e.bestStreak}` },
        ],
      },
      practice: e.report.hardest,
      ...(note === undefined ? {} : { note }),
    });
  };

  // ------------------------------------------------------------ co-op
  const players = createMemo(() =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    ),
  );
  const online = (): ArcadeRoom["players"][string][] =>
    players().filter((p) => p.online);
  const isHost = (): boolean => room()?.hostUid === myUid();

  const coopFor = (r: ArcadeRoom): DefenderCoop => ({
    isHost: r.hostUid === myUid(),
    myUid: myUid() ?? "",
    startAt: r.startAt ?? arcadeNow(),
    now: arcadeNow,
    kills: () => room()?.kills ?? {},
    hits: () => room()?.hits ?? {},
    fx: () => room()?.fx ?? {},
    claim: (id) => void claimKill(KIND, r.code, id).catch(() => undefined),
    markHit: (id) => void markHit(KIND, r.code, id).catch(() => undefined),
    sendFx: (n, k) => void sendFx(KIND, r.code, n, k).catch(() => undefined),
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
        const diff =
          DEFENDER_DIFFICULTIES.find((d) => d.label === next.difficultyLabel) ??
          (DEFENDER_DIFFICULTIES[0] as DefenderDifficulty);
        setResult(null);
        setRun({
          key: ++runKey,
          daily: false,
          coop: coopFor(next),
          opts: {
            words: next.words ?? [],
            difficulty: diff,
            seed: next.seed ?? 1,
            maxWave: 0,
            bosses: true,
            upgrades: false,
            authority: next.hostUid === myUid(),
          },
        });
        setPhase("playing");
      }
      if (next.status === "finished") {
        setRun(null);
        setPhase("coop-results");
      }
    });
  };

  // host: everyone's out of lives -> results
  createEffect(() => {
    const r = room();
    if (r?.status !== "playing" || r.hostUid !== myUid()) return;
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
          difficultyLabel: difficulty().label,
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
        const words = untrack(() => props.lessonWords);
        if (words !== undefined) void start(words);
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

  return (
    <Show when={props.open}>
      <GameModalFrame layout={layout()} onClose={() => props.onClose()}>
        <Show when={phase() === "pick" && !isLesson()}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Word Defender"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text={daily() ? "Start today's mission" : "Start game"}
                    onClick={() => void start()}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="word-defender"
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  createLabel="Host a co-op battle"
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <p class="text-em-sm text-sub">
                Type a ship&apos;s word to zap it before it reaches your base.
                🛡️ Shield ships need their word twice, 🦠 splitters break in
                two. Type the word on a power-up to grab it. Clean words in a
                row power up your laser! After each wave, pick an upgrade. Every
                5th wave: the mothership! 🛸
              </p>
            </GameSetupSection>
            <Show when={mode() === "solo"}>
              <div class="grid grid-cols-2 gap-2">
                <For each={[false, true]}>
                  {(d) => (
                    <button
                      type="button"
                      class={cn(
                        "grid cursor-pointer place-items-center gap-0.5 rounded-xl border-2 p-2 text-center",
                        daily() === d
                          ? "border-main bg-main/15 text-text"
                          : "border-transparent bg-sub-alt text-sub",
                      )}
                      onClick={() => setDaily(d)}
                    >
                      <span class="text-2xl">{d ? "📅" : "🚀"}</span>
                      <span class="text-sm font-bold">
                        {d ? "Daily mission" : "Battle"}
                      </span>
                      <span class="text-xs">
                        {d
                          ? `${MISSION_WAVES} waves, same for everyone`
                          : "how many waves can you last?"}
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <Show when={daily()}>
                <GameSetupSection title="📅 Today's mission">
                  <div class="grid gap-2 text-sm text-sub">
                    <div>{plan.label} · Medium · mothership on wave 5</div>
                    <Show
                      when={myUid() !== undefined}
                      fallback={<div>Sign in to see the class board.</div>}
                    >
                      <DailyClassBoard
                        collection="dailyDefender"
                        day={day}
                        unit="pts"
                      />
                    </Show>
                  </div>
                </GameSetupSection>
              </Show>
            </Show>
            <Show when={mode() === "together" || !daily()}>
              <GameSetupSection title="Choose difficulty">
                <DifficultySegmented
                  options={DEFENDER_DIFFICULTIES}
                  selectedLabel={difficulty().label}
                  onSelect={(d) => setDifficulty(d)}
                />
              </GameSetupSection>
            </Show>
            <GameSetupMore>
              <GameSetupSection title="Mode">
                <SoloTogetherToggle
                  mode={mode()}
                  soloLabel="Play alone"
                  togetherLabel="Co-op with classmates"
                  multiplayerUnlocked={true}
                  unlockHint=""
                  onModeChange={setMode}
                />
              </GameSetupSection>
              <Show when={mode() === "together" || !daily()}>
                <GameSetupSection title="Choose a word list">
                  <WordListPicker
                    groups={GROUPS}
                    selectedId={selected().id}
                    onSelect={setSelected}
                  />
                </GameSetupSection>
              </Show>
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
                🤝 Co-op: defend one base together · {room()?.difficultyLabel} ·{" "}
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
              gameId="word-defender"
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
              <DefenderGame
                opts={r.opts}
                {...(r.coop === undefined ? {} : { coop: r.coop })}
                onEnd={(e) => void onEnd(e)}
              />
            )}
          </Show>
          <Show when={roomCode() !== undefined}>
            <div class="pointer-events-none absolute right-2 bottom-24 z-30 grid gap-1 rounded-xl bg-game-ink/70 px-3 py-1 text-xs font-bold text-game-cream">
              <For each={online()}>
                {(p) => (
                  <div>
                    {p.uid === myUid() ? "You" : p.name}: ⭐ {p.score}
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r().view}
                {...(isLesson() ? {} : { onPlayAgain: () => void start() })}
                {...(r().note === undefined ? {} : { note: r().note })}
                onExit={() => props.onClose()}
                extra={<PracticeWords words={r().practice} />}
              />
            )}
          </Show>
        </Show>

        <Show when={phase() === "coop-results"}>
          <div class="grid gap-3 pt-12">
            <div class="text-center text-2xl font-bold text-main">
              🚀 Battle over!
            </div>
            <div class="text-center text-sm text-sub">
              Together you defended the base. Top zapper:
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
                text="Play again"
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

import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  Show,
} from "solid-js";

import { isCurrentUserAdmin } from "../../../auth";
import { AVATAR_ITEMS } from "../../../avatar/avatar-items";
import {
  getAvatarState,
  getEquippedAvatar,
} from "../../../avatar/avatar-state";
import {
  Assignment,
  ASSIGNMENT_PREFIX,
  getAssignmentsForStudent,
  getPassagesForStudent,
  getWordListsForStudent,
  listReadingPassages,
  listWordLists,
  PASSAGE_PREFIX,
  passageTokens,
  ReadingPassage,
  WordList,
  WORDLIST_PREFIX,
  wordListTokens,
} from "../../../classroom/assignments";
import {
  ClassCompareEntry,
  getClassCompare,
  getLessonStarsLeaderboard,
  LessonLeaderboardEntry,
} from "../../../classroom/classroom";
import { getWeeklyQuestState, WEEKLY_QUESTS } from "../../../coins";
import { gradeOf } from "../../../constants/classes";
import { getAuthenticatedUser } from "../../../firebase";
import { BalloonPopModal } from "../../../games/balloon-pop/BalloonPopModal";
import { FruitNinjaModal } from "../../../games/fruit-ninja/FruitNinjaModal";
import { scaleGameScore } from "../../../games/game-difficulty-multiplier";
import { startGame } from "../../../games/game-launcher";
import { games } from "../../../games/games-data";
import { GhostHunterModal } from "../../../games/ghost-hunter/GhostHunterModal";
import { TypeRacerModal } from "../../../games/type-racer/TypeRacerModal";
import { TypeTossModal } from "../../../games/type-toss/TypeTossModal";
import { WordDefenderModal } from "../../../games/word-defender/WordDefenderModal";
import {
  HOME_ROW_GAME_IDS,
  HomeRowCheckpoint,
  LESSON_GROUP_CHECKPOINTS,
} from "../../../lessons/lesson-checkpoints";
import { launchLessonWithIntro } from "../../../lessons/lesson-intro";
import { LESSON_GROUP_INTRO_VIDEOS } from "../../../lessons/lesson-intro-videos";
import { startCustomDrill } from "../../../lessons/lesson-launcher";
import {
  ensureStarsGateGrandfather,
  getAllProgress,
  GAME_PREFIX,
  getUserLessonStats,
  getWeakKeys,
  isCurriculumLesson,
  isLessonLockedAt,
  LessonProgress,
  persistDailyChallengePick,
  pickDailyChallengeLesson,
  recordGameResult,
  recordGameScore,
  claimRecommendedGameReward,
  PracticeRewardCategory,
} from "../../../lessons/lesson-progress";
import {
  initialLessonGroupCollapseState,
  lessonLockMessage,
} from "../../../lessons/lesson-ux";
import {
  findLesson,
  groupIdForLesson,
  Lesson,
  LessonGroup,
  lessonGroups,
  lessonOrder,
  generateWeakKeysDrill,
} from "../../../lessons/lessons-data";
import { japaneseLessonGroups } from "../../../lessons/lessons-data-jp";
import { getActivePage, isAuthenticated } from "../../../states/core";
import { showModal } from "../../../states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { getSnapshot } from "../../../states/snapshot";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { localDateString } from "../../../utils/date-and-time";
import { Avatar } from "../../common/Avatar";
import { Fa } from "../../common/Fa";
import { H2, H3 } from "../../common/Headers";
import { Page } from "../../common/Page";
import { showLessonIntroVideo } from "../../modals/LessonIntroVideoModal";

type GroupRowItem =
  | { kind: "lesson"; lesson: Lesson }
  | { kind: "game"; checkpoint: HomeRowCheckpoint };

/** Lessons, with the group's game checkpoints (if any) spliced in after their lesson. */
function rowItemsFor(group: LessonGroup): GroupRowItem[] {
  const checkpoints = LESSON_GROUP_CHECKPOINTS[group.id] ?? [];
  const items: GroupRowItem[] = [];
  for (const lesson of group.lessons) {
    items.push({ kind: "lesson", lesson });
    const checkpoint = checkpoints.find((c) => c.afterLessonId === lesson.id);
    if (checkpoint !== undefined) {
      items.push({ kind: "game", checkpoint });
    }
  }
  return items;
}

function Stars(props: { count: number }): JSXElement {
  return (
    <div class="flex gap-0.5">
      <For each={[1, 2, 3]}>
        {(n) => (
          <Fa
            icon="fa-star"
            variant={n <= props.count ? "solid" : "regular"}
            class={n <= props.count ? "text-main" : "text-sub"}
            size={0.75}
          />
        )}
      </For>
    </div>
  );
}

function LessonButton(props: {
  lesson: Lesson;
  progress: LessonProgress | undefined;
  locked?: boolean;
  lockedMessage?: string;
  next?: boolean;
}): JSXElement {
  const done = (): boolean => props.progress?.completed === true;
  const locked = (): boolean => props.locked === true;
  const needsImprovement = (): boolean =>
    done() && (props.progress?.stars ?? 3) < 3;
  const onClick = (): void => {
    if (locked()) {
      showNoticeNotification(
        props.lockedMessage ?? "Complete the previous lesson first",
      );
      return;
    }
    launchLessonWithIntro(props.lesson);
  };
  return (
    <button
      type="button"
      class={cn(
        "flex flex-col gap-2 rounded p-3 text-left transition-colors",
        locked()
          ? "cursor-not-allowed bg-sub-alt text-sub opacity-50"
          : needsImprovement()
            ? "cursor-pointer bg-sub-alt text-text ring-1 ring-main/50 hover:bg-text hover:text-bg"
            : "cursor-pointer bg-sub-alt text-text hover:bg-text hover:text-bg",
      )}
      onClick={onClick}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-medium">
          {props.lesson.name}
          <Show when={props.next && !done()}>
            <span class="rounded bg-main px-1.5 py-0.5 text-em-xs text-bg">
              Next
            </span>
          </Show>
        </span>
        <Show when={locked()} fallback={<LessonStatus done={done()} />}>
          <Fa icon="fa-lock" class="text-sub" size={0.9} />
        </Show>
      </div>
      <div class="flex items-center justify-between gap-2 text-em-xs text-sub">
        <Show when={props.progress !== undefined} fallback={<span>start</span>}>
          <span>{Math.round(props.progress?.bestWpm ?? 0)} wpm</span>
        </Show>
        <Stars count={done() ? (props.progress?.stars ?? 1) : 0} />
      </div>
    </button>
  );
}

function LessonStatus(props: { done: boolean }): JSXElement {
  return (
    <Show when={props.done}>
      <Fa icon="fa-check-circle" class="text-main" size={0.9} />
    </Show>
  );
}

/** A checkpoint game tile, styled to match LessonButton so it sits inline in the grid. */
function GameCheckpointButton(props: {
  group: LessonGroup;
  checkpoint: HomeRowCheckpoint;
  progressFor: (id: string) => LessonProgress | undefined;
  loading: boolean;
  onPlay: (group: LessonGroup, checkpoint: HomeRowCheckpoint) => void;
}): JSXElement {
  const key = (): string =>
    `${GAME_PREFIX}${props.group.id}:${HOME_ROW_GAME_IDS[props.checkpoint.gameType]}`;
  const reviewLessonIds = (): string[] =>
    props.checkpoint.reviewLessonIds === "all"
      ? props.group.lessons.map((l) => l.id)
      : props.checkpoint.reviewLessonIds;
  const locked = (): boolean =>
    !reviewLessonIds().every((id) => props.progressFor(id)?.completed === true);
  const done = (): boolean => props.progressFor(key())?.completed === true;

  const onClick = (): void => {
    if (locked()) {
      showNoticeNotification("Finish the lessons above first");
      return;
    }
    props.onPlay(props.group, props.checkpoint);
  };

  return (
    <button
      type="button"
      class={cn(
        "flex flex-col gap-2 rounded p-3 text-left transition-colors",
        locked()
          ? "cursor-not-allowed bg-sub-alt text-sub opacity-50"
          : "cursor-pointer bg-sub-alt text-text hover:bg-text hover:text-bg",
      )}
      onClick={onClick}
      disabled={props.loading}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium">{props.checkpoint.label}</span>
        <Show
          when={locked()}
          fallback={
            <Show
              when={done()}
              fallback={
                <Fa icon={props.checkpoint.icon} class="text-sub" size={0.9} />
              }
            >
              <Fa icon="fa-check-circle" class="text-main" size={0.9} />
            </Show>
          }
        >
          <Fa icon="fa-lock" class="text-sub" size={0.9} />
        </Show>
      </div>
      <div class="text-em-xs text-sub">
        <Show when={done()} fallback="review game">
          best: {props.progressFor(key())?.bestScore ?? 0}
        </Show>
      </div>
    </button>
  );
}

function GameButton(props: {
  name: string;
  description: string;
  icon: FaSolidIcon;
  onClick: () => void;
}): JSXElement {
  return (
    <button
      type="button"
      class={cn(
        "flex cursor-pointer flex-col gap-2 rounded p-3 text-left transition-colors",
        "bg-sub-alt text-text hover:bg-text hover:text-bg",
      )}
      onClick={() => props.onClick()}
    >
      <div class="flex items-center gap-2">
        <Fa icon={props.icon} fixedWidth />
        <span class="font-medium">{props.name}</span>
      </div>
      <div class="text-em-xs text-sub">{props.description}</div>
    </button>
  );
}

function StatCard(props: {
  icon: FaSolidIcon;
  label: string;
  value: string;
  /** 0-1 fraction - renders a thin fill bar under the value when provided. */
  progress?: number;
  sub?: string;
  subClass?: string;
}): JSXElement {
  return (
    <div class="flex flex-col gap-1 rounded bg-sub-alt p-3">
      <div class="flex items-center gap-1.5 text-em-xs text-sub">
        <Fa icon={props.icon} size={0.8} />
        {props.label}
      </div>
      <div class="text-xl font-bold text-text">{props.value}</div>
      <Show when={props.progress !== undefined}>
        <div class="h-1 rounded-full bg-bg">
          <div
            class="h-1 rounded-full bg-main transition-[width]"
            style={{
              width: `${Math.min(100, Math.max(0, (props.progress ?? 0) * 100))}%`,
            }}
          ></div>
        </div>
      </Show>
      <Show when={props.sub !== undefined}>
        <div class={cn("text-em-xs", props.subClass ?? "text-sub")}>
          {props.sub}
        </div>
      </Show>
    </div>
  );
}

function ProgressSummary(props: {
  progress: Map<string, LessonProgress> | undefined;
  assignments: Assignment[];
  wordLists: WordList[];
  passages: ReadingPassage[];
}): JSXElement {
  const lessonsDone = createMemo(() => {
    const p = props.progress;
    return lessonOrder.filter((id) => p?.get(id)?.completed === true).length;
  });
  const totalStars = createMemo(() => {
    const p = props.progress;
    return lessonOrder.reduce((sum, id) => sum + (p?.get(id)?.stars ?? 0), 0);
  });
  const avgLessonWpm = createMemo(() => {
    const p = props.progress;
    const attempted = lessonOrder
      .map((id) => p?.get(id)?.bestWpm ?? 0)
      .filter((w) => w > 0);
    if (attempted.length === 0) return 0;
    return Math.round(attempted.reduce((s, w) => s + w, 0) / attempted.length);
  });
  const needsImprovementCount = createMemo(() => {
    const p = props.progress;
    return lessonOrder.filter((id) => {
      const lp = p?.get(id);
      return lp?.completed === true && lp.stars < 3;
    }).length;
  });

  // "Since you started" - compares average WPM across a student's earliest
  // vs most recent curriculum-lesson attempts, so improvement is visible as
  // a single number instead of only living in per-lesson best scores.
  const wpmTrend = createMemo((): number | undefined => {
    const p = props.progress;
    if (p === undefined) return undefined;
    const entries = [...p.entries()]
      .filter(
        ([id, lp]) => isCurriculumLesson(id) && lp.bestWpm > 0 && lp.lastAt > 0,
      )
      .map(([, lp]) => lp)
      .sort((a, b) => a.lastAt - b.lastAt);
    if (entries.length < 4) return undefined;
    const sampleSize = Math.min(5, Math.floor(entries.length / 2));
    const avg = (arr: LessonProgress[]): number =>
      arr.reduce((sum, lp) => sum + lp.bestWpm, 0) / arr.length;
    const earlyAvg = avg(entries.slice(0, sampleSize));
    const recentAvg = avg(entries.slice(-sampleSize));
    return Math.round(recentAvg - earlyAvg);
  });

  const checkpointsDone = createMemo(() => {
    const p = props.progress;
    return allCheckpoints.filter(
      (item) =>
        p?.get(checkpointKey(item.group, item.checkpoint))?.completed === true,
    ).length;
  });

  const assignmentsDone = createMemo(() => {
    const p = props.progress;
    return props.assignments.filter(
      (a) => p?.get(`${ASSIGNMENT_PREFIX}${a.id}`)?.completed === true,
    ).length;
  });
  const overdueCount = createMemo(() => {
    const p = props.progress;
    return props.assignments.filter(
      (a) =>
        a.dueAt !== undefined &&
        a.dueAt < Date.now() &&
        p?.get(`${ASSIGNMENT_PREFIX}${a.id}`)?.completed !== true,
    ).length;
  });

  const wordListsDone = createMemo(() => {
    const p = props.progress;
    return props.wordLists.filter(
      (wl) => p?.get(`${WORDLIST_PREFIX}${wl.id}`)?.completed === true,
    ).length;
  });
  const passagesDone = createMemo(() => {
    const p = props.progress;
    return props.passages.filter(
      (pg) => p?.get(`${PASSAGE_PREFIX}${pg.id}`)?.completed === true,
    ).length;
  });

  const hasAnything = (): boolean =>
    lessonsDone() > 0 ||
    assignmentsDone() > 0 ||
    wordListsDone() > 0 ||
    passagesDone() > 0;

  const lessonSub = (): string | undefined => {
    const parts: string[] = [];
    if (totalStars() > 0) {
      parts.push(`${totalStars()} ★ · avg ${avgLessonWpm()} wpm`);
    }
    if (needsImprovementCount() > 0) {
      parts.push(`${needsImprovementCount()} need improvement`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  };

  return (
    <Show when={hasAnything()}>
      <section class="grid gap-3">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            icon="fa-graduation-cap"
            label="lessons"
            value={`${lessonsDone()} / ${lessonOrder.length}`}
            progress={
              lessonOrder.length > 0 ? lessonsDone() / lessonOrder.length : 0
            }
            sub={lessonSub()}
            subClass={needsImprovementCount() > 0 ? "text-main" : "text-sub"}
          />
          <Show when={wpmTrend() !== undefined}>
            <StatCard
              icon="fa-chart-line"
              label="since you started"
              value={`${(wpmTrend() ?? 0) >= 0 ? "+" : ""}${wpmTrend()} wpm`}
            />
          </Show>
          <Show when={allCheckpoints.length > 0}>
            <StatCard
              icon="fa-gamepad"
              label="checkpoint games"
              value={`${checkpointsDone()} / ${allCheckpoints.length}`}
              progress={checkpointsDone() / allCheckpoints.length}
            />
          </Show>
          <Show when={props.assignments.length > 0}>
            <StatCard
              icon="fa-list"
              label="assignments"
              value={`${assignmentsDone()} / ${props.assignments.length}`}
              progress={assignmentsDone() / props.assignments.length}
              sub={
                overdueCount() > 0
                  ? `${overdueCount()} overdue`
                  : assignmentsDone() === props.assignments.length
                    ? "all done"
                    : undefined
              }
              subClass={overdueCount() > 0 ? "text-error" : "text-main"}
            />
          </Show>
          <Show when={props.wordLists.length > 0}>
            <StatCard
              icon="fa-keyboard"
              label="word lists"
              value={`${wordListsDone()} / ${props.wordLists.length}`}
              progress={wordListsDone() / props.wordLists.length}
            />
          </Show>
          <Show when={props.passages.length > 0}>
            <StatCard
              icon="fa-book-open"
              label="passages"
              value={`${passagesDone()} / ${props.passages.length}`}
              progress={passagesDone() / props.passages.length}
            />
          </Show>
        </div>
      </section>
    </Show>
  );
}

// A lesson unlocks when the previous one in `lessonOrder` is completed with
// at least a 2-star rating (see meetsStarsGate) - except for lessons at or
// before a student's grandfathered frontier (ensureStarsGateGrandfather),
// which stay unlocked regardless of stars. Assignments and class practice
// are exempt from this gating entirely.
// Disabled per admin decision (unused by students) - flip back to true to
// bring the section back. Deliberately not deleted/removed, just hidden.
const FUNBOX_GAMES_ENABLED = false;

const previousLessonId = new Map<string, string | undefined>();
const lessonIndex = new Map<string, number>();
lessonOrder.forEach((id, i) => {
  previousLessonId.set(id, i === 0 ? undefined : lessonOrder[i - 1]);
  lessonIndex.set(id, i);
});

type ContinueItem =
  | { kind: "lesson"; lesson: Lesson }
  | { kind: "checkpoint"; group: LessonGroup; checkpoint: HomeRowCheckpoint };

/** Progress-map key for a checkpoint's game result, matching GameCheckpointButton. */
const checkpointKey = (
  group: LessonGroup,
  checkpoint: HomeRowCheckpoint,
): string =>
  `${GAME_PREFIX}${group.id}:${HOME_ROW_GAME_IDS[checkpoint.gameType]}`;

// Same lesson/checkpoint interleaving as rowItemsFor, flattened across every
// group and carrying the owning group (needed to key checkpoint progress and
// to launch the game) - lets "continue where you left off" stop at an
// un-played checkpoint instead of skipping straight to the next lesson.
const continueOrder: ContinueItem[] = lessonGroups.flatMap((group) =>
  rowItemsFor(group).map(
    (item): ContinueItem =>
      item.kind === "lesson"
        ? { kind: "lesson", lesson: item.lesson }
        : { kind: "checkpoint", group, checkpoint: item.checkpoint },
  ),
);

const allCheckpoints = continueOrder.filter(
  (item): item is Extract<ContinueItem, { kind: "checkpoint" }> =>
    item.kind === "checkpoint",
);

function ContentButton(props: {
  title: string;
  subtitle?: string;
  subtitleClass?: string;
  done: boolean;
  onClick: () => void;
}): JSXElement {
  return (
    <button
      type="button"
      class={cn(
        "flex cursor-pointer flex-col gap-2 rounded p-3 text-left transition-colors",
        "bg-sub-alt text-text hover:bg-text hover:text-bg",
      )}
      onClick={() => props.onClick()}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium">{props.title}</span>
        <Show when={props.done}>
          <Fa icon="fa-check-circle" class="text-main" size={0.9} />
        </Show>
      </div>
      <Show when={props.subtitle !== undefined}>
        <div class={cn("text-em-xs", props.subtitleClass ?? "text-sub")}>
          {props.subtitle}
        </div>
      </Show>
    </button>
  );
}

function ClassLeaderboard(props: {
  entries: LessonLeaderboardEntry[];
  selfUid: string | undefined;
}): JSXElement {
  const top5 = (): LessonLeaderboardEntry[] => props.entries.slice(0, 5);
  return (
    <Show when={top5().length > 1}>
      <section>
        <H2
          class="text-[1.65em] sm:text-[1.85em]"
          fa={{ icon: "fa-medal" }}
          text="class leaderboard"
        />
        <div class="grid gap-1">
          <For each={top5()}>
            {(entry, i) => {
              // Bounded to the top 5 rows - shares the same cache key/data any
              // other UserAvatar for this uid already fetched, so this is
              // usually a no-op read, not an extra request.
              const highlightQuery = useQuery(() => ({
                queryKey: ["avatarEquipped", entry.uid],
                queryFn: async () => getEquippedAvatar(entry.uid),
                staleTime: 5 * 60 * 1000,
              }));
              const highlight = (): string | undefined =>
                highlightQuery.data?.highlight;

              return (
                <div
                  class={cn(
                    "flex items-center gap-3 rounded p-2",
                    entry.uid === props.selfUid ? "bg-sub-alt" : "",
                  )}
                  style={
                    highlight() === undefined
                      ? undefined
                      : {
                          "border-left": `3px solid ${highlight()}`,
                          "background-color": `${highlight()}22`,
                        }
                  }
                >
                  <span class="w-5 text-center text-em-xs text-sub">
                    {i() + 1}
                  </span>
                  <span class="min-w-0 flex-1 truncate text-text">
                    {entry.name}
                    {entry.uid === props.selfUid ? " (you)" : ""}
                  </span>
                  <span class="text-main">{entry.lessonStars} ★</span>
                </div>
              );
            }}
          </For>
        </div>
      </section>
    </Show>
  );
}

function ClassCompare(props: {
  entries: ClassCompareEntry[];
  selfClassId: string | undefined;
}): JSXElement {
  return (
    <Show when={props.entries.length > 1}>
      <section>
        <H2
          class="text-[1.65em] sm:text-[1.85em]"
          fa={{ icon: "fa-users" }}
          text="class vs class"
        />
        <div class="grid gap-1">
          <For each={props.entries}>
            {(entry) => (
              <div
                class={cn(
                  "flex items-center gap-3 rounded p-2",
                  entry.classId === props.selfClassId ? "bg-sub-alt" : "",
                )}
              >
                <span class="w-5 text-center text-em-xs text-sub">
                  {entry.rank}
                </span>
                <span class="min-w-0 flex-1 truncate text-text">
                  {entry.classId}
                  {entry.classId === props.selfClassId ? " (you)" : ""}
                </span>
                <span class="text-em-xs text-sub">
                  {entry.studentCount} students
                </span>
                <span class="text-main">{entry.avgStars.toFixed(1)} ★ avg</span>
              </div>
            )}
          </For>
        </div>
      </section>
    </Show>
  );
}

function WeeklyQuests(props: {
  progress: Record<string, number>;
  claimed: string[];
}): JSXElement {
  return (
    <section class="grid gap-3 rounded bg-sub-alt p-4">
      <H2
        class="text-[1.65em] sm:text-[1.85em]"
        fa={{ icon: "fa-flag-checkered" }}
        text="this week's quests"
      />
      <For each={WEEKLY_QUESTS}>
        {(quest) => {
          const current = (): number =>
            Math.min(props.progress[quest.counterKey] ?? 0, quest.target);
          const done = (): boolean => props.claimed.includes(quest.id);
          const percent = (): number => (current() / quest.target) * 100;
          const formatProgress = (value: number): string =>
            quest.unit === "seconds"
              ? `${Math.round(value / 60)}m`
              : `${value}`;
          return (
            <div class="grid gap-1">
              <div class="flex items-center justify-between text-em-xs">
                <span class={done() ? "text-main" : "text-text"}>
                  <Show when={done()}>
                    <Fa icon="fa-check-circle" class="mr-1" />
                  </Show>
                  {quest.description}
                </span>
                <span class="flex items-center gap-1 text-sub">
                  <Fa icon="fa-coins" size={0.7} />
                  {quest.coinReward}
                </span>
              </div>
              <div class="h-1 rounded-full bg-bg">
                <div
                  class="h-1 rounded-full bg-main transition-[width]"
                  style={{ width: `${Math.min(100, percent())}%` }}
                ></div>
              </div>
              <span class="text-em-xs text-sub">
                {formatProgress(current())}/{formatProgress(quest.target)}
              </span>
            </div>
          );
        }}
      </For>
    </section>
  );
}

export function LessonsPage(): JSXElement {
  const [reviewLoading, setReviewLoading] = createSignal(false);
  const [defenderOpen, setDefenderOpen] = createSignal(false);
  const [balloonOpen, setBalloonOpen] = createSignal(false);
  const [racerOpen, setRacerOpen] = createSignal(false);
  const [ghostOpen, setGhostOpen] = createSignal(false);
  const [fruitNinjaOpen, setFruitNinjaOpen] = createSignal(false);
  const [typeTossOpen, setTypeTossOpen] = createSignal(false);
  const [lessonDefGroupId, setLessonDefGroupId] = createSignal<string | null>(
    null,
  );
  const [lessonBallGroupId, setLessonBallGroupId] = createSignal<string | null>(
    null,
  );
  const [lessonTossGroupId, setLessonTossGroupId] = createSignal<string | null>(
    null,
  );
  const [lessonGhostGroupId, setLessonGhostGroupId] = createSignal<
    string | null
  >(null);
  const [lessonGameWords, setLessonGameWords] = createSignal<string[]>([]);
  const [lessonGameLoading, setLessonGameLoading] = createSignal(false);
  const [recommendedGameId, setRecommendedGameId] = createSignal<string>();
  const [collapsed, setCollapsed] = createSignal<Set<string>>(
    (() => {
      const stored = localStorage.getItem("lessonSectionsCollapsed");
      try {
        return new Set<string>(JSON.parse(stored ?? "null") as string[]);
      } catch {
        // Default: all lesson sub-groups collapsed, main sections open
        return new Set<string>(lessonGroups.map((g) => g.id));
      }
    })(),
  );
  const manuallyToggledGroups = new Set<string>();
  const persistCollapsed = (value: ReadonlySet<string>): void => {
    try {
      localStorage.setItem(
        "lessonSectionsCollapsed",
        JSON.stringify([...value]),
      );
    } catch {
      // ignore
    }
  };
  const toggle = (id: string): void => {
    if (lessonGroups.some((group) => group.id === id)) {
      manuallyToggledGroups.add(id);
    }
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistCollapsed(next);
      return next;
    });
  };
  const isOpen = (): boolean => getActivePage() === "lessons";

  const progress = useQuery(() => ({
    queryKey: ["lessonProgress"],
    queryFn: getAllProgress,
    enabled: isOpen() && isAuthenticated(),
    staleTime: 0,
  }));

  // Lazily freezes (once) how far this student had already gotten before the
  // 2-star unlock requirement shipped, so isLessonLocked below never re-locks
  // lessons they already had access to. See ensureStarsGateGrandfather.
  const starsGateGrandfather = useQuery(() => ({
    queryKey: ["starsGateGrandfather"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) return 0;
      const progressMap = await getAllProgress();
      return ensureStarsGateGrandfather(uid, progressMap);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: Infinity,
  }));

  // Same queryKey the avatar shop modal uses, so both share one cache entry.
  const avatarStateQuery = useQuery(() => ({
    queryKey: ["avatarState"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) {
        return {
          coins: 0,
          ownedCostumes: {},
          equipped: {},
          shape: "round" as const,
        };
      }
      return getAvatarState(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: 0,
  }));
  const equippedAvatarColor = (): string | undefined => {
    const id = avatarStateQuery.data?.equipped.color;
    return id === undefined
      ? undefined
      : AVATAR_ITEMS.find((i) => i.id === id)?.value;
  };
  const equippedAvatarHighlight = (): string | undefined => {
    const id = avatarStateQuery.data?.equipped.highlight;
    return id === undefined
      ? undefined
      : AVATAR_ITEMS.find((i) => i.id === id)?.value;
  };

  // Same queryKey UserAvatar.tsx uses, so both share one cache entry - just
  // need the animal-avatar override here, not the whole procedural avatar.
  const animalAvatarQuery = useQuery(() => ({
    queryKey: ["avatarEquipped", getAuthenticatedUser()?.uid],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) return {};
      return getEquippedAvatar(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  }));

  const progressFor = (id: string): LessonProgress | undefined =>
    progress.data?.get(id);

  const isLessonLocked = (id: string): boolean => {
    const index = lessonIndex.get(id);
    if (index === undefined) return false; // not a gated curriculum lesson
    const prev = previousLessonId.get(id);
    const prevProgress = prev !== undefined ? progressFor(prev) : undefined;
    return isLessonLockedAt(
      index,
      prevProgress,
      starsGateGrandfather.data ?? Infinity,
    );
  };

  const getLessonLockMessage = (id: string): string | undefined => {
    if (!isLessonLocked(id)) return undefined;
    const prevId = previousLessonId.get(id);
    if (prevId === undefined) return undefined;
    const previous = findLesson(prevId);
    const previousProgress = progressFor(prevId);
    return lessonLockMessage(
      previous?.name ?? "the previous lesson",
      previousProgress?.completed === true,
      previousProgress?.stars ?? 0,
    );
  };

  // The first not-yet-completed lesson OR checkpoint game in curriculum
  // order - i.e. the true sequential frontier, matching what "next test"
  // already enforces (LESSON_IDS_WITH_GAME_CHECKPOINT sends students back to
  // this page instead of skipping the game). Deliberately NOT "most recently
  // touched lesson", since side activities like the daily challenge can
  // complete an earlier lesson out of order (e.g. targeting a weak key)
  // without that meaning the student actually progressed further.
  // Unlike continueItem below, this isn't gated on "has the student started
  // anything yet" - used for group-highlighting, where even a brand-new
  // account should point at the first group, not nothing.
  const frontierItem = createMemo((): ContinueItem | undefined => {
    const p = progress.data;
    if (p === undefined) return undefined;
    return continueOrder.find((item) =>
      item.kind === "lesson"
        ? p.get(item.lesson.id)?.completed !== true
        : p.get(checkpointKey(item.group, item.checkpoint))?.completed !== true,
    );
  });

  const continueItem = createMemo((): ContinueItem | undefined => {
    const p = progress.data;
    if (p === undefined) return undefined;
    const item = frontierItem();
    // frontierItem only checks "completed", not the 2-star gate - if the
    // naive next lesson is actually locked, redirect to its predecessor
    // instead (the lesson the student needs to replay for a higher star
    // rating), so this shortcut can never bypass the gate.
    if (item?.kind === "lesson" && isLessonLocked(item.lesson.id)) {
      const prevId = previousLessonId.get(item.lesson.id);
      const prevLesson = prevId !== undefined ? findLesson(prevId) : undefined;
      if (prevLesson !== undefined) {
        return { kind: "lesson", lesson: prevLesson };
      }
    }
    return item;
  });

  const currentGroupId = createMemo((): string | undefined => {
    const item = frontierItem();
    if (item === undefined) return undefined;
    return item.kind === "lesson"
      ? groupIdForLesson(item.lesson.id)
      : item.group.id;
  });
  const frontierLessonId = createMemo((): string | undefined => {
    const item = frontierItem();
    return item?.kind === "lesson" ? item.lesson.id : undefined;
  });

  // Once progress is available, tuck finished groups away and expose the
  // current frontier. Manual choices made during this session always win.
  let initializedLessonGroups = false;
  createEffect(() => {
    const p = progress.data;
    const id = currentGroupId();
    if (p === undefined || initializedLessonGroups) return;
    initializedLessonGroups = true;
    const completeIds = new Set(
      lessonGroups
        .filter((group) =>
          group.lessons.every((lesson) => p.get(lesson.id)?.completed === true),
        )
        .map((group) => group.id),
    );
    const next = initialLessonGroupCollapseState(
      lessonGroups.map((group) => group.id),
      completeIds,
      id,
      manuallyToggledGroups,
      collapsed(),
    );
    setCollapsed(next);
    persistCollapsed(next);
  });

  const continueIcon = (): FaSolidIcon => {
    const item = continueItem();
    return item?.kind === "checkpoint" ? item.checkpoint.icon : "fa-play";
  };
  const continueLabel = (): string => {
    const item = continueItem();
    if (item === undefined) return "";
    return item.kind === "lesson" ? item.lesson.name : item.checkpoint.label;
  };
  const onContinueClick = (reward = false): void => {
    const item = continueItem();
    if (item === undefined) return;
    if (item.kind === "lesson") {
      launchLessonWithIntro(item.lesson, reward ? "recommendation" : undefined);
    } else {
      void openCheckpointGame(item.group, item.checkpoint, reward);
    }
  };

  // ?? undefined: classId can come back as a literal null from Firestore
  // even though the type says string | undefined.
  const classId = (): string | undefined => getSnapshot()?.classId ?? undefined;

  const assignmentsQuery = useQuery(() => ({
    queryKey: ["studentAssignments", classId(), getAuthenticatedUser()?.uid],
    queryFn: async () =>
      getAssignmentsForStudent(
        classId() as string,
        getAuthenticatedUser()?.uid as string,
      ),
    enabled:
      isOpen() &&
      isAuthenticated() &&
      classId() !== undefined &&
      getAuthenticatedUser()?.uid !== undefined,
    staleTime: 1000 * 30,
  }));

  const wordListsQuery = useQuery(() => ({
    queryKey: ["studentWordLists", classId() ?? "admin"],
    queryFn: async () =>
      isCurrentUserAdmin()
        ? listWordLists()
        : getWordListsForStudent(classId() as string),
    enabled:
      isOpen() &&
      isAuthenticated() &&
      (classId() !== undefined || isCurrentUserAdmin()),
    staleTime: 1000 * 30,
  }));

  const passagesQuery = useQuery(() => ({
    queryKey: ["studentPassages", classId() ?? "admin"],
    queryFn: async () =>
      isCurrentUserAdmin()
        ? listReadingPassages()
        : getPassagesForStudent(classId() as string),
    enabled:
      isOpen() &&
      isAuthenticated() &&
      (classId() !== undefined || isCurrentUserAdmin()),
    staleTime: 1000 * 30,
  }));

  const weakKeysQuery = useQuery(() => ({
    queryKey: ["weakKeys"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) return {};
      return getWeakKeys(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: 0,
  }));

  const userStatsQuery = useQuery(() => ({
    queryKey: ["userLessonStats"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) {
        return {
          streakDays: 0,
          streakFreezesAvailable: 0,
          achievements: [],
          lastDailyChallengeDate: "",
          dailyChallengeDate: "",
          dailyChallengeLessonId: "",
          lastPracticedDate: "",
          lastSeenAssignmentsAt: 0,
          seenAchievementIds: [],
          practiceRewardDates: {},
        };
      }
      return getUserLessonStats(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: 0,
  }));

  const classLeaderboardQuery = useQuery(() => ({
    queryKey: ["lessonLeaderboard", classId()],
    queryFn: async () => getLessonStarsLeaderboard(classId() as string),
    enabled: isOpen() && isAuthenticated() && classId() !== undefined,
    staleTime: 1000 * 60,
  }));

  const grade = (): string | undefined => {
    const c = classId();
    return c === undefined ? undefined : gradeOf(c);
  };

  const classCompareQuery = useQuery(() => ({
    queryKey: ["classCompare", grade()],
    queryFn: async () => getClassCompare(grade() as string),
    enabled: isOpen() && isAuthenticated() && grade() !== undefined,
    staleTime: 1000 * 60,
  }));

  const weeklyQuestQuery = useQuery(() => ({
    queryKey: ["weeklyQuests"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) return { weekId: 0, progress: {}, claimed: [] };
      return getWeeklyQuestState(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: 0,
  }));

  const dailyChallenge = createMemo(() => {
    const today = localDateString();
    const stats = userStatsQuery.data;
    const weakKeys = weakKeysQuery.data ?? {};
    const progressMap = progress.data ?? new Map<string, LessonProgress>();
    // Prefer the persisted pick for today (stable all day); only compute
    // fresh as a fallback until that finishes loading/persisting - see the
    // effect below, which is what keeps it locked in for the rest of the day.
    const lessonId =
      stats?.dailyChallengeDate === today && stats.dailyChallengeLessonId !== ""
        ? stats.dailyChallengeLessonId
        : pickDailyChallengeLesson(weakKeys, progressMap);
    const lesson = findLesson(lessonId);
    const done = stats?.lastDailyChallengeDate === today;
    return { lessonId, lessonName: lesson?.name ?? lessonId, done };
  });

  // Persist today's daily-challenge pick once (per day) so it can't drift
  // as weakKeys/progress keep changing from further practice - see
  // persistDailyChallengePick's doc comment for why that mattered.
  createEffect(() => {
    if (!isOpen() || !isAuthenticated()) return;
    const stats = userStatsQuery.data;
    const weakKeys = weakKeysQuery.data;
    const progressMap = progress.data;
    if (
      stats === undefined ||
      weakKeys === undefined ||
      progressMap === undefined
    ) {
      return;
    }
    const today = localDateString();
    if (stats.dailyChallengeDate === today) return;

    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    const lessonId = pickDailyChallengeLesson(weakKeys, progressMap);
    void persistDailyChallengePick(uid, lessonId).then(() => {
      void userStatsQuery.refetch();
    });
  });

  const wordListById = createMemo(() => {
    const map = new Map<string, WordList>();
    for (const wl of wordListsQuery.data ?? []) map.set(wl.id, wl);
    return map;
  });

  const passageById = createMemo(() => {
    const map = new Map<string, ReadingPassage>();
    for (const p of passagesQuery.data ?? []) map.set(p.id, p);
    return map;
  });

  const dueSubtitle = (a: Assignment): string | undefined =>
    a.dueAt === undefined
      ? undefined
      : `due ${new Date(a.dueAt).toLocaleDateString()}`;

  const dueClass = (a: Assignment): string => {
    if (a.dueAt === undefined) return "text-sub";
    const now = Date.now();
    if (a.dueAt < now) return "text-error";
    if (a.dueAt < now + 2 * 24 * 60 * 60 * 1000) return "text-main";
    return "text-sub";
  };

  const launchAssignment = async (
    a: Assignment,
    rewardCategory?: PracticeRewardCategory,
  ): Promise<void> => {
    const id = `${ASSIGNMENT_PREFIX}${a.id}`;
    if (a.contentType === "lesson") {
      const lesson =
        a.lessonId !== undefined ? findLesson(a.lessonId) : undefined;
      if (lesson === undefined) {
        showErrorNotification("Lesson not found");
        return;
      }
      let tokens: string[];
      try {
        tokens = await lesson.generate();
      } catch (e) {
        console.error(e);
        showErrorNotification("Failed to generate lesson");
        return;
      }
      startCustomDrill({ id, name: a.title, tokens, rewardCategory });
      return;
    }
    if (a.contentType === "passage") {
      const p =
        a.passageId !== undefined ? passageById().get(a.passageId) : undefined;
      if (p === undefined) {
        showErrorNotification("Passage not found");
        return;
      }
      startCustomDrill({
        id,
        name: a.title,
        tokens: passageTokens(p.text),
        preserveOrder: true,
        rewardCategory,
      });
      return;
    }
    const wl =
      a.wordListId !== undefined ? wordListById().get(a.wordListId) : undefined;
    if (wl === undefined) {
      showErrorNotification("Word list not found");
      return;
    }
    startCustomDrill({
      id,
      name: a.title,
      tokens: wordListTokens(wl.text),
      rewardCategory,
    });
  };

  const launchWordList = (wl: WordList): void => {
    startCustomDrill({
      id: `${WORDLIST_PREFIX}${wl.id}`,
      name: wl.title,
      tokens: wordListTokens(wl.text),
    });
  };

  const launchPassage = (p: ReadingPassage): void => {
    startCustomDrill({
      id: `${PASSAGE_PREFIX}${p.id}`,
      name: p.title,
      tokens: passageTokens(p.text),
      preserveOrder: true,
    });
  };

  const isGroupComplete = (group: LessonGroup): boolean =>
    group.lessons.every((l) => progressFor(l.id)?.completed === true);

  const openLessonGame = async (
    group: LessonGroup,
    gameType: "defender" | "balloon",
  ): Promise<void> => {
    setLessonGameLoading(true);
    try {
      const all: string[] = [];
      for (const lesson of group.lessons) {
        all.push(...(await lesson.generate()));
      }
      const words = [...new Set(all.filter((w) => w.length > 0))];
      setLessonGameWords(words);
      if (gameType === "defender") {
        setLessonDefGroupId(group.id);
      } else {
        setLessonBallGroupId(group.id);
      }
    } finally {
      setLessonGameLoading(false);
    }
  };

  const openCheckpointGame = async (
    group: LessonGroup,
    checkpoint: HomeRowCheckpoint,
    recommended = false,
  ): Promise<void> => {
    setLessonGameLoading(true);
    try {
      const reviewIds =
        checkpoint.reviewLessonIds === "all"
          ? group.lessons.map((l) => l.id)
          : checkpoint.reviewLessonIds;
      const lessonsToReview = group.lessons.filter((l) =>
        reviewIds.includes(l.id),
      );
      const all: string[] = [];
      for (const lesson of lessonsToReview) {
        all.push(...(await lesson.generate()));
      }
      const words = [...new Set(all.filter((w) => w.length > 0))];
      setLessonGameWords(words);
      setRecommendedGameId(
        recommended ? HOME_ROW_GAME_IDS[checkpoint.gameType] : undefined,
      );
      if (checkpoint.gameType === "defender") {
        setLessonDefGroupId(group.id);
      } else if (checkpoint.gameType === "balloon") {
        setLessonBallGroupId(group.id);
      } else if (checkpoint.gameType === "toss") {
        setLessonTossGroupId(group.id);
      } else {
        setLessonGhostGroupId(group.id);
      }
    } finally {
      setLessonGameLoading(false);
    }
  };

  const reviewWeakKeys = async () => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined || uid === null || uid === "") return;
    setReviewLoading(true);
    try {
      const weakKeysObj = await getWeakKeys(uid);
      const keys = Object.keys(weakKeysObj).join("");
      if (!keys) {
        showNoticeNotification(
          "You don't have any weak keys yet! Keep practicing.",
        );
        return;
      }
      const tokens = await generateWeakKeysDrill(keys);
      startCustomDrill({
        id: "weak-keys-review",
        name: "Weak Keys Review",
        tokens,
        preserveOrder: true,
        rewardCategory: "adaptive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const openBuiltinGame = (gameId: string, recommended = false): void => {
    setRecommendedGameId(recommended ? gameId : undefined);
    if (gameId === "word-defender") setDefenderOpen(true);
    else if (gameId === "balloon-pop") setBalloonOpen(true);
    else if (gameId === "type-racer") setRacerOpen(true);
    else if (gameId === "ghost-hunter") setGhostOpen(true);
    else if (gameId === "fruit-ninja") setFruitNinjaOpen(true);
    else if (gameId === "type-toss") setTypeTossOpen(true);
  };

  const launchDailyChallenge = async (): Promise<void> => {
    const lesson = findLesson(dailyChallenge().lessonId);
    if (lesson === undefined) return;
    if (isLessonLocked(lesson.id)) {
      showNoticeNotification(
        getLessonLockMessage(lesson.id) ?? "Complete the previous lesson first",
      );
      return;
    }
    const uid = getAuthenticatedUser()?.uid;
    if (uid !== undefined) {
      await persistDailyChallengePick(uid, lesson.id);
      await userStatsQuery.refetch();
    }
    launchLessonWithIntro(lesson, "dailyChallenge");
  };

  type PracticeRecommendation = {
    icon: FaSolidIcon;
    eyebrow: string;
    title: string;
    description: string;
    action: string;
    onStart: () => void;
  };

  const practiceRecommendation = createMemo(
    (): PracticeRecommendation | undefined => {
      if (!isAuthenticated()) return undefined;
      if (
        progress.data === undefined ||
        weakKeysQuery.data === undefined ||
        userStatsQuery.data === undefined ||
        assignmentsQuery.isLoading
      ) {
        return undefined;
      }

      const unfinishedAssignments = (assignmentsQuery.data ?? [])
        .filter(
          (assignment) =>
            progressFor(`${ASSIGNMENT_PREFIX}${assignment.id}`)?.completed !==
            true,
        )
        .sort(
          (a, b) =>
            (a.dueAt ?? Number.POSITIVE_INFINITY) -
            (b.dueAt ?? Number.POSITIVE_INFINITY),
        );
      const urgentAssignment = unfinishedAssignments.find(
        (assignment) =>
          assignment.dueAt !== undefined &&
          assignment.dueAt < Date.now() + 2 * 24 * 60 * 60 * 1000,
      );
      if (urgentAssignment !== undefined) {
        return {
          icon: "fa-list",
          eyebrow: "teacher priority",
          title: urgentAssignment.title,
          description: dueSubtitle(urgentAssignment) ?? "Assignment practice",
          action: "start assignment",
          onStart: () =>
            void launchAssignment(urgentAssignment, "recommendation"),
        };
      }

      const item = continueItem();
      if (item !== undefined) {
        const hasStarted = lessonOrder.some(
          (id) => progress.data?.get(id) !== undefined,
        );
        return {
          icon: continueIcon(),
          eyebrow:
            item.kind === "checkpoint"
              ? "review checkpoint"
              : hasStarted
                ? "continue learning"
                : "start here",
          title: continueLabel(),
          description:
            item.kind === "checkpoint"
              ? "Use the keys you just learned in a quick game."
              : "Keep moving along your personalized lesson path.",
          action:
            item.kind === "checkpoint"
              ? "Play checkpoint"
              : hasStarted
                ? "Continue lesson"
                : "Start first lesson",
          onStart: () => onContinueClick(true),
        };
      }

      const nextAssignment = unfinishedAssignments[0];
      if (nextAssignment !== undefined) {
        return {
          icon: "fa-list",
          eyebrow: "class practice",
          title: nextAssignment.title,
          description: dueSubtitle(nextAssignment) ?? "Assignment practice",
          action: "start assignment",
          onStart: () =>
            void launchAssignment(nextAssignment, "recommendation"),
        };
      }

      const builtinGames = games.filter((game) => game.type === "builtin");
      const day = Number(localDateString().replaceAll("-", ""));
      const game = builtinGames[day % builtinGames.length];
      if (game === undefined) return undefined;
      return {
        icon: game.icon,
        eyebrow: "game of the day",
        title: game.name,
        description: "Finish your practice with a quick typing challenge.",
        action: "play now",
        onStart: () => openBuiltinGame(game.id, true),
      };
    },
  );

  const practiceRewardLabel = (category: PracticeRewardCategory): string =>
    userStatsQuery.data?.practiceRewardDates[category] === localDateString()
      ? "✓ 10 claimed today"
      : "🪙 10 daily";

  const claimRecommendedGame = (
    gameId: string,
    score: number,
    wave: number,
  ): void => {
    if (recommendedGameId() !== gameId) return;
    setRecommendedGameId(undefined);
    void claimRecommendedGameReward(gameId, score, wave).then((coins) => {
      if (coins > 0) {
        showSuccessNotification(`Recommended game complete · +${coins} coins`);
        void userStatsQuery.refetch();
      }
    });
  };

  return (
    <Page id="lessons">
      <div class="content-grid grid gap-5">
        <section class="text-center text-sub">
          Build muscle memory from the ground up. Each drill warms up with a
          little rhythm, then turns into real words using the keys you know -
          and gets easier or harder to match your grade. Your best speed and
          accuracy are saved per lesson.
        </section>

        <Show when={!isAuthenticated()}>
          <section class="rounded bg-sub-alt p-4 text-center text-sub">
            <Fa icon="fa-info-circle" class="mr-2" />
            Sign in to save your lesson progress across devices.
          </section>
        </Show>

        <Show when={(userStatsQuery.data?.streakDays ?? 0) > 0}>
          <section class="flex items-center gap-2 rounded bg-sub-alt px-4 py-2 text-main">
            <Fa icon="fa-fire" />
            <span class="font-bold">
              {userStatsQuery.data?.streakDays ?? 0}
            </span>
            <span class="text-sub">
              {(userStatsQuery.data?.streakDays ?? 0) === 1
                ? "day streak"
                : "day streak — keep going!"}
            </span>
            <Show when={(userStatsQuery.data?.streakFreezesAvailable ?? 0) > 0}>
              <span
                class="ml-1 rounded bg-bg px-1.5 py-0.5 text-em-xs text-sub"
                title="Miss a day and this protects your streak once."
              >
                🧊 freeze ready
              </span>
            </Show>
          </section>
        </Show>

        <Show when={practiceRecommendation()} keyed>
          {(recommendation) => (
            <section class="grid gap-2">
              <div class="grid gap-3 rounded bg-sub-alt p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div class="grid gap-2">
                  <div class="flex items-center gap-2 text-em-xs font-medium text-main">
                    <Fa icon={recommendation.icon} />
                    {recommendation.eyebrow}
                  </div>
                  <div class="text-xl font-bold text-text">
                    {recommendation.title}
                  </div>
                  <p class="max-w-2xl text-sm text-sub">
                    {recommendation.description}
                  </p>
                  <div class="text-em-xs text-sub">
                    <Fa icon="fa-clock" class="mr-1.5" /> about 3–5 minutes
                    <span class="ml-3 text-main">
                      {practiceRewardLabel("recommendation")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  class="cursor-pointer rounded bg-main px-5 py-3 font-bold text-bg transition-opacity hover:opacity-80"
                  onClick={recommendation.onStart}
                  disabled={reviewLoading() || lessonGameLoading()}
                >
                  {recommendation.action}
                  <Fa icon="fa-arrow-right" class="ml-2" />
                </button>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <div class="flex items-center justify-between gap-3 rounded bg-sub-alt p-3">
                  <div class="grid gap-1">
                    <div class="flex items-center gap-2 font-medium text-text">
                      <Fa icon="fa-calendar-day" class="text-main" />
                      Today&apos;s Challenge
                    </div>
                    <span class="text-em-xs text-sub">
                      {dailyChallenge().lessonName}
                    </span>
                    <span class="text-em-xs text-main">
                      {practiceRewardLabel("dailyChallenge")}
                    </span>
                  </div>
                  <Show
                    when={dailyChallenge().done}
                    fallback={
                      <button
                        type="button"
                        class="cursor-pointer rounded bg-bg px-3 py-2 text-em-xs text-text transition-colors hover:bg-text hover:text-bg"
                        onClick={launchDailyChallenge}
                      >
                        start
                      </button>
                    }
                  >
                    <span class="flex items-center gap-1.5 text-em-xs text-main">
                      <Fa icon="fa-check-circle" /> done
                    </span>
                  </Show>
                </div>

                <div class="flex items-center justify-between gap-3 rounded bg-sub-alt p-3">
                  <div class="grid gap-1">
                    <div class="flex items-center gap-2 font-medium text-text">
                      <Fa icon="fa-dumbbell" class="text-main" />
                      Adaptive Review
                    </div>
                    <span class="text-em-xs text-sub">
                      Practice the keys you miss most
                    </span>
                    <span class="text-em-xs text-main">
                      {practiceRewardLabel("adaptive")}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="cursor-pointer rounded bg-bg px-3 py-2 text-em-xs text-text transition-colors hover:bg-text hover:text-bg"
                    onClick={() => void reviewWeakKeys()}
                    disabled={reviewLoading()}
                  >
                    <Fa
                      icon={
                        reviewLoading() ? "fa-circle-notch" : "fa-arrow-right"
                      }
                      class={reviewLoading() ? "fa-spin" : ""}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}
        </Show>

        {/* Avatar + coins */}
        <Show when={isAuthenticated()}>
          <section class="flex items-center justify-between gap-4 rounded bg-sub-alt p-4">
            <div class="flex items-center gap-4">
              <div class="shrink-0">
                <Avatar
                  color={equippedAvatarColor()}
                  shape={avatarStateQuery.data?.shape}
                  hair={avatarStateQuery.data?.equipped.hair}
                  hat={avatarStateQuery.data?.equipped.hat}
                  accessory={avatarStateQuery.data?.equipped.accessory}
                  face={avatarStateQuery.data?.equipped.face}
                  background={avatarStateQuery.data?.equipped.background}
                  highlightColor={equippedAvatarHighlight()}
                  size={56}
                  animalImage={animalAvatarQuery.data?.animalImage}
                />
              </div>
              <div class="flex shrink-0 items-center gap-1.5 rounded bg-bg px-2.5 py-1.5 font-bold text-main">
                <Fa icon="fa-coins" size={0.9} />
                {avatarStateQuery.data?.coins ?? 0}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("Avatar")}
              >
                customize
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("SideImagesShop")}
              >
                <Fa icon="fa-image" class="mr-1.5" />
                side images
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("House")}
              >
                <Fa icon="fa-home" class="mr-1.5" />
                my house
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("HandsShop")}
              >
                <Fa icon="fa-hand-paper" class="mr-1.5" />
                hand styles
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("RgbPaletteShop")}
              >
                <Fa icon="fa-palette" class="mr-1.5" />
                rgb palettes
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("KeyboardSkinShop")}
              >
                <Fa icon="fa-keyboard" class="mr-1.5" />
                keyboard skins
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("KeypressEffectShop")}
              >
                <Fa icon="fa-star" class="mr-1.5" />
                keypress effects
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("CaretEffectShop")}
              >
                <Fa icon="fa-i-cursor" class="mr-1.5" />
                caret effects
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("BackdropShop")}
              >
                <Fa icon="fa-mountain" class="mr-1.5" />
                backdrops
              </button>
              <button
                type="button"
                class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                onClick={() => showModal("Achievements")}
              >
                <Fa icon="fa-trophy" class="mr-1.5" />
                achievements
              </button>
            </div>
          </section>
        </Show>

        {/* 1. Progress summary + streak + leaderboard */}
        <Show when={isAuthenticated()}>
          <ProgressSummary
            progress={progress.data}
            assignments={assignmentsQuery.data ?? []}
            wordLists={wordListsQuery.data ?? []}
            passages={passagesQuery.data ?? []}
          />
          <ClassLeaderboard
            entries={classLeaderboardQuery.data ?? []}
            selfUid={getAuthenticatedUser()?.uid}
          />
          <ClassCompare
            entries={classCompareQuery.data?.entries ?? []}
            selfClassId={classId()}
          />
        </Show>

        {/* Weekly quests */}
        <Show when={isAuthenticated()}>
          <WeeklyQuests
            progress={weeklyQuestQuery.data?.progress ?? {}}
            claimed={weeklyQuestQuery.data?.claimed ?? []}
          />
        </Show>

        {/* 4. Assignments — urgent, graded */}
        <Show when={(assignmentsQuery.data?.length ?? 0) > 0}>
          <section>
            <H2
              class="text-[1.65em] sm:text-[1.85em]"
              fa={{ icon: "fa-list" }}
              text="assignments"
            />
            <p class="mb-3 text-sub">Work set by your teacher.</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <For each={assignmentsQuery.data}>
                {(a) => (
                  <ContentButton
                    title={a.title}
                    subtitle={dueSubtitle(a)}
                    subtitleClass={dueClass(a)}
                    done={
                      progressFor(`${ASSIGNMENT_PREFIX}${a.id}`)?.completed ===
                      true
                    }
                    onClick={() => void launchAssignment(a)}
                  />
                )}
              </For>
            </div>
          </section>
        </Show>

        {/* 5. Typing Lessons — main section wrapping all lesson groups */}
        <section>
          <div class="flex items-center justify-between">
            <H2
              class="text-[1.65em] sm:text-[1.85em]"
              fa={{ icon: "fa-graduation-cap" }}
              text="Typing Lessons"
            />
            <button
              type="button"
              class="rounded p-1.5 text-sub transition-colors hover:text-text"
              onClick={() => toggle("typing-lessons")}
            >
              <Fa
                icon="fa-chevron-down"
                class={cn(
                  "transition-transform duration-200",
                  collapsed().has("typing-lessons") ? "-rotate-90" : "",
                )}
              />
            </button>
          </div>
          <Show when={!collapsed().has("typing-lessons")}>
            <p class="mb-2 text-sm font-medium text-main">
              Start with the lesson marked Next and complete lessons in order.
            </p>
            <div class="grid gap-1">
              <For each={lessonGroups}>
                {(group) => {
                  const doneCount = (): number =>
                    group.lessons.filter(
                      (l) => progressFor(l.id)?.completed === true,
                    ).length;
                  const isCurrent = (): boolean =>
                    group.id === currentGroupId();
                  return (
                    <div id={group.id}>
                      <button
                        type="button"
                        class={cn(
                          "flex w-full items-center justify-between rounded px-2 py-2 text-left transition-colors hover:bg-sub-alt",
                          isCurrent() ? "ring-1 ring-main/50" : "",
                        )}
                        onClick={() => toggle(group.id)}
                      >
                        <div class="flex items-center gap-2 text-sub">
                          <Fa icon={group.icon} size={0.9} />
                          <span class="font-medium text-text">
                            {group.name}
                          </span>
                          <Show when={isCurrent()}>
                            <span class="rounded bg-main px-1.5 py-0.5 text-em-xs text-bg">
                              current
                            </span>
                          </Show>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="text-em-xs text-sub">
                            {doneCount()}/{group.lessons.length}
                          </span>
                          <div class="h-1 w-10 rounded-full bg-bg">
                            <div
                              class="h-1 rounded-full bg-main transition-[width]"
                              style={{
                                width: `${Math.min(100, (doneCount() / group.lessons.length) * 100)}%`,
                              }}
                            ></div>
                          </div>
                          <Fa
                            icon="fa-chevron-down"
                            size={0.8}
                            class={cn(
                              "text-sub transition-transform duration-200",
                              collapsed().has(group.id) ? "-rotate-90" : "",
                            )}
                          />
                        </div>
                      </button>
                      <Show when={!collapsed().has(group.id)}>
                        <p class="mt-1 mb-2 pl-2 text-em-xs text-sub">
                          {group.description}
                        </p>
                        <div class="mb-2 grid grid-cols-1 gap-2 pl-2 sm:grid-cols-2 lg:grid-cols-3">
                          <Show
                            when={LESSON_GROUP_INTRO_VIDEOS[group.id]}
                            keyed
                          >
                            {(videoId) => (
                              <button
                                type="button"
                                class="flex cursor-pointer flex-col gap-2 rounded bg-sub-alt p-3 text-left text-text transition-colors hover:bg-text hover:text-bg"
                                onClick={() => showLessonIntroVideo(videoId)}
                              >
                                <div class="flex items-center justify-between gap-2">
                                  <span class="font-medium">Intro video</span>
                                  <Fa
                                    icon="fa-play-circle"
                                    class="text-sub"
                                    size={0.9}
                                  />
                                </div>
                                <div class="text-em-xs text-sub">
                                  watch before you start
                                </div>
                              </button>
                            )}
                          </Show>
                          <For each={rowItemsFor(group)}>
                            {(item) =>
                              // oxlint-disable-next-line solid/prefer-show -- item.kind is fixed per row (static config), a ternary here is simpler than Show's cast-heavy discriminated narrowing
                              item.kind === "lesson" ? (
                                <LessonButton
                                  lesson={item.lesson}
                                  progress={progressFor(item.lesson.id)}
                                  next={frontierLessonId() === item.lesson.id}
                                  locked={isLessonLocked(item.lesson.id)}
                                  lockedMessage={getLessonLockMessage(
                                    item.lesson.id,
                                  )}
                                />
                              ) : (
                                <GameCheckpointButton
                                  group={group}
                                  checkpoint={item.checkpoint}
                                  progressFor={progressFor}
                                  loading={lessonGameLoading()}
                                  onPlay={(g, c) =>
                                    void openCheckpointGame(g, c)
                                  }
                                />
                              )
                            }
                          </For>
                        </div>
                        {/* Group games — unlocked after all lessons done
                          (groups with interspersed checkpoints above skip this) */}
                        <Show
                          when={
                            LESSON_GROUP_CHECKPOINTS[group.id] === undefined
                          }
                        >
                          <div class="mb-2 flex gap-3 pl-2">
                            <For
                              each={[
                                {
                                  gameId: "balloon-pop" as const,
                                  label: "Balloon Pop",
                                  icon: "fa-circle" as const,
                                  type: "balloon" as const,
                                },
                                {
                                  gameId: "word-defender" as const,
                                  label: "Word Defender",
                                  icon: "fa-rocket" as const,
                                  type: "defender" as const,
                                },
                              ]}
                            >
                              {(g) => {
                                const key = (): string =>
                                  `${GAME_PREFIX}${group.id}:${g.gameId}`;
                                const done = (): boolean =>
                                  progressFor(key())?.completed === true;
                                const locked = (): boolean =>
                                  !isGroupComplete(group);
                                return (
                                  <button
                                    type="button"
                                    class={cn(
                                      "flex items-center gap-2 rounded px-3 py-2 text-em-sm transition-colors",
                                      locked()
                                        ? "cursor-not-allowed bg-sub-alt text-sub opacity-50"
                                        : "cursor-pointer bg-sub-alt text-text hover:bg-text hover:text-bg",
                                    )}
                                    onClick={() => {
                                      if (locked()) {
                                        showNoticeNotification(
                                          "Finish all lessons in this group first",
                                        );
                                        return;
                                      }
                                      void openLessonGame(group, g.type);
                                    }}
                                    disabled={lessonGameLoading()}
                                  >
                                    <Show
                                      when={locked()}
                                      fallback={
                                        <Show
                                          when={done()}
                                          fallback={
                                            <Fa icon={g.icon} size={0.8} />
                                          }
                                        >
                                          <Fa
                                            icon="fa-check-circle"
                                            class="text-main"
                                            size={0.8}
                                          />
                                        </Show>
                                      }
                                    >
                                      <Fa icon="fa-lock" size={0.8} />
                                    </Show>
                                    {g.label}
                                    <Show when={done() && !locked()}>
                                      <span class="text-em-xs text-sub">
                                        best:{" "}
                                        {progressFor(key())?.bestScore ?? 0}
                                      </span>
                                    </Show>
                                  </button>
                                );
                              }}
                            </For>
                          </div>
                        </Show>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </section>

        {/* 6. Class Practice */}
        <Show
          when={
            (wordListsQuery.data?.length ?? 0) > 0 ||
            (passagesQuery.data?.length ?? 0) > 0
          }
        >
          <section>
            <div class="flex items-center justify-between">
              <H2
                class="text-[1.65em] sm:text-[1.85em]"
                fa={{ icon: "fa-keyboard" }}
                text="Class Practice"
              />
              <button
                type="button"
                class="rounded p-1.5 text-sub transition-colors hover:text-text"
                onClick={() => toggle("class-practice")}
              >
                <Fa
                  icon="fa-chevron-down"
                  class={cn(
                    "transition-transform duration-200",
                    collapsed().has("class-practice") ? "-rotate-90" : "",
                  )}
                />
              </button>
            </div>
            <Show when={!collapsed().has("class-practice")}>
              <Show when={(wordListsQuery.data?.length ?? 0) > 0}>
                <p class="mb-4 text-sub">Word lists shared with your class.</p>
                <div class="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <For each={wordListsQuery.data}>
                    {(wl) => (
                      <ContentButton
                        title={wl.title}
                        subtitle={(() => {
                          const p = progressFor(`${WORDLIST_PREFIX}${wl.id}`);
                          return p !== undefined && p.bestWpm > 0
                            ? `${Math.round(p.bestWpm)} wpm`
                            : undefined;
                        })()}
                        done={
                          progressFor(`${WORDLIST_PREFIX}${wl.id}`)
                            ?.completed === true
                        }
                        onClick={() => launchWordList(wl)}
                      />
                    )}
                  </For>
                </div>
              </Show>
              <Show when={(passagesQuery.data?.length ?? 0) > 0}>
                <p class="mb-4 text-sub">
                  Type these passages exactly as written.
                </p>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <For each={passagesQuery.data}>
                    {(p) => (
                      <ContentButton
                        title={p.title}
                        subtitle={(() => {
                          const pr = progressFor(`${PASSAGE_PREFIX}${p.id}`);
                          return pr !== undefined && pr.bestWpm > 0
                            ? `${Math.round(pr.bestWpm)} wpm`
                            : undefined;
                        })()}
                        done={
                          progressFor(`${PASSAGE_PREFIX}${p.id}`)?.completed ===
                          true
                        }
                        onClick={() => launchPassage(p)}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </section>
        </Show>

        {/* 7. Japanese */}
        <section>
          <div class="flex items-center justify-between">
            <H2
              class="text-[1.65em] sm:text-[1.85em]"
              fa={{ icon: "fa-language" }}
              text="Japanese — Romaji"
            />
            <button
              type="button"
              class="rounded p-1.5 text-sub transition-colors hover:text-text"
              onClick={() => toggle("japanese")}
            >
              <Fa
                icon="fa-chevron-down"
                class={cn(
                  "transition-transform duration-200",
                  collapsed().has("japanese") ? "-rotate-90" : "",
                )}
              />
            </button>
          </div>
          <Show when={!collapsed().has("japanese")}>
            <p class="mb-4 text-sub">
              Learn Japanese typing in romaji. Free practice - try these in any
              order.
            </p>
            <div class="grid gap-6">
              <For each={japaneseLessonGroups}>
                {(group) => (
                  <div>
                    <H3 fa={{ icon: group.icon }} text={group.name} />
                    <p class="mb-3 text-em-sm text-sub">{group.description}</p>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <For each={group.lessons}>
                        {(lesson) => (
                          <LessonButton
                            lesson={lesson}
                            progress={progressFor(lesson.id)}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>

        {/* 8. Games */}
        <section>
          <div class="flex items-center justify-between">
            <H2
              class="text-[1.65em] sm:text-[1.85em]"
              fa={{ icon: "fa-gamepad" }}
              text="Games"
            />
            <button
              type="button"
              class="rounded p-1.5 text-sub transition-colors hover:text-text"
              onClick={() => toggle("games")}
            >
              <Fa
                icon="fa-chevron-down"
                class={cn(
                  "transition-transform duration-200",
                  collapsed().has("games") ? "-rotate-90" : "",
                )}
              />
            </button>
          </div>
          <Show when={!collapsed().has("games")}>
            <p class="mb-4 text-sub">
              Take a break with a fun typing challenge. Games don&apos;t affect
              your stats.
            </p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <For each={games.filter((g) => g.type === "builtin")}>
                {(game) => (
                  <GameButton
                    name={game.name}
                    description={game.description}
                    icon={game.icon}
                    onClick={() => openBuiltinGame(game.id)}
                  />
                )}
              </For>
            </div>
          </Show>
        </section>

        {/* 8b. Fun Box */}
        <Show when={FUNBOX_GAMES_ENABLED}>
          <section>
            <div class="flex items-center justify-between">
              <H2
                class="text-[1.65em] sm:text-[1.85em]"
                fa={{ icon: "fa-magic" }}
                text="fun box"
              />
              <button
                type="button"
                class="rounded p-1.5 text-sub transition-colors hover:text-text"
                onClick={() => toggle("funbox")}
              >
                <Fa
                  icon="fa-chevron-down"
                  class={cn(
                    "transition-transform duration-200",
                    collapsed().has("funbox") ? "-rotate-90" : "",
                  )}
                />
              </button>
            </div>
            <Show when={!collapsed().has("funbox")}>
              <p class="mb-4 text-sub">
                Weird typing modes that change how the test feels.
              </p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <For each={games.filter((g) => g.type === "funbox")}>
                  {(game) => (
                    <GameButton
                      name={game.name}
                      description={game.description}
                      icon={game.icon}
                      onClick={() => {
                        if (game.type === "funbox") startGame(game);
                      }}
                    />
                  )}
                </For>
              </div>
            </Show>
          </section>
        </Show>

        <WordDefenderModal
          open={defenderOpen()}
          onClose={() => {
            setDefenderOpen(false);
            setRecommendedGameId(undefined);
          }}
          onResult={(score, wave, difficultyLabel, wordListGroup) => {
            void recordGameScore(
              "word-defender",
              scaleGameScore(score, difficultyLabel, wordListGroup),
            );
            claimRecommendedGame("word-defender", score, wave);
          }}
        />
        <BalloonPopModal
          open={balloonOpen()}
          onClose={() => {
            setBalloonOpen(false);
            setRecommendedGameId(undefined);
          }}
          onResult={(score, wave, difficultyLabel, wordListGroup) => {
            void recordGameScore(
              "balloon-pop",
              scaleGameScore(score, difficultyLabel, wordListGroup),
            );
            claimRecommendedGame("balloon-pop", score, wave);
          }}
        />
        <TypeRacerModal
          open={racerOpen()}
          onClose={() => {
            setRacerOpen(false);
            setRecommendedGameId(undefined);
          }}
          onResult={(score, wave) => {
            void recordGameScore("type-racer", score);
            claimRecommendedGame("type-racer", score, wave);
          }}
        />
        <GhostHunterModal
          open={ghostOpen()}
          onClose={() => {
            setGhostOpen(false);
            setRecommendedGameId(undefined);
          }}
          onResult={(score, wave, difficultyLabel, wordListGroup) => {
            void recordGameScore(
              "ghost-hunter",
              scaleGameScore(score, difficultyLabel, wordListGroup),
            );
            claimRecommendedGame("ghost-hunter", score, wave);
          }}
        />
        <FruitNinjaModal
          open={fruitNinjaOpen()}
          onClose={() => {
            setFruitNinjaOpen(false);
            setRecommendedGameId(undefined);
          }}
          onResult={(score, wave, difficultyLabel, wordListGroup) => {
            void recordGameScore(
              "fruit-ninja",
              scaleGameScore(score, difficultyLabel, wordListGroup),
            );
            claimRecommendedGame("fruit-ninja", score, wave);
          }}
        />
        <TypeTossModal
          open={typeTossOpen()}
          onClose={() => {
            setTypeTossOpen(false);
            setRecommendedGameId(undefined);
          }}
          onResult={(score, wave, difficultyLabel, wordListGroup) => {
            void recordGameScore(
              "type-toss",
              scaleGameScore(score, difficultyLabel, wordListGroup),
            );
            claimRecommendedGame("type-toss", score, wave);
          }}
        />
        {/* Lesson-mode games */}
        <WordDefenderModal
          open={lessonDefGroupId() !== null}
          onClose={() => {
            setLessonDefGroupId(null);
            setRecommendedGameId(undefined);
            void progress.refetch();
          }}
          lessonWords={lessonGameWords()}
          onResult={(score, wave) => {
            const gid = lessonDefGroupId();
            if (gid !== null) {
              void recordGameResult(
                `${GAME_PREFIX}${gid}:word-defender`,
                score,
                wave,
              );
              claimRecommendedGame("word-defender", score, wave);
            }
          }}
        />
        <BalloonPopModal
          open={lessonBallGroupId() !== null}
          onClose={() => {
            setLessonBallGroupId(null);
            setRecommendedGameId(undefined);
            void progress.refetch();
          }}
          lessonWords={lessonGameWords()}
          onResult={(score, wave) => {
            const gid = lessonBallGroupId();
            if (gid !== null) {
              void recordGameResult(
                `${GAME_PREFIX}${gid}:balloon-pop`,
                score,
                wave,
              );
              claimRecommendedGame("balloon-pop", score, wave);
            }
          }}
        />
        <TypeTossModal
          open={lessonTossGroupId() !== null}
          onClose={() => {
            setLessonTossGroupId(null);
            setRecommendedGameId(undefined);
            void progress.refetch();
          }}
          lessonWords={lessonGameWords()}
          onResult={(score, wave) => {
            const gid = lessonTossGroupId();
            if (gid !== null) {
              void recordGameResult(
                `${GAME_PREFIX}${gid}:type-toss`,
                score,
                wave,
              );
              claimRecommendedGame("type-toss", score, wave);
            }
          }}
        />
        <GhostHunterModal
          open={lessonGhostGroupId() !== null}
          onClose={() => {
            setLessonGhostGroupId(null);
            setRecommendedGameId(undefined);
            void progress.refetch();
          }}
          lessonWords={lessonGameWords()}
          onResult={(score, wave) => {
            const gid = lessonGhostGroupId();
            if (gid !== null) {
              void recordGameResult(
                `${GAME_PREFIX}${gid}:ghost-hunter`,
                score,
                wave,
              );
              claimRecommendedGame("ghost-hunter", score, wave);
            }
          }}
        />
      </div>
    </Page>
  );
}

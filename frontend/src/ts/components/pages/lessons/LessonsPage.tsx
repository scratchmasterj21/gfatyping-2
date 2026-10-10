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
import { getClassGoals } from "../../../classroom/class-goals";
import {
  ClassCompareEntry,
  getClassCompare,
  getLessonStarsLeaderboard,
  LessonLeaderboardEntry,
} from "../../../classroom/classroom";
import { getWeeklyQuestState } from "../../../coins";
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
import { TypingRpgModal } from "../../../games/typing-rpg/TypingRpgModal";
import { WordDefenderModal } from "../../../games/word-defender/WordDefenderModal";
import {
  checkpointLockMessage,
  checkpointProgressKey,
  continueOrder,
  ContinueItem,
  incompleteCheckpointBeforeLesson,
} from "../../../lessons/lesson-checkpoint-order";
import {
  HOME_ROW_GAME_IDS,
  HomeRowCheckpoint,
} from "../../../lessons/lesson-checkpoints";
import { launchLessonWithIntro } from "../../../lessons/lesson-intro";
import { startCustomDrill } from "../../../lessons/lesson-launcher";
import {
  getContinueItem,
  getFrontierItem,
  isLessonLockedForProgress,
  launchContinueTarget,
  scrollToContinueTarget as scrollToContinueItem,
} from "../../../lessons/lesson-navigation";
import {
  ensureStarsGateGrandfather,
  getAllProgress,
  GAME_PREFIX,
  getUserLessonStats,
  getWeakKeys,
  isCurriculumLesson,
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
  LessonGroup,
  lessonGroups,
  lessonOrder,
  generateWeakKeysDrill,
} from "../../../lessons/lessons-data";
import { japaneseLessonGroups } from "../../../lessons/lessons-data-jp";
import { getActivePage, isAuthenticated } from "../../../states/core";
import { ModalId, showModal } from "../../../states/modals";
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
import { Button } from "../../common/Button";
import { ClassGoalBar } from "../../common/ClassGoalBar";
import { Fa } from "../../common/Fa";
import { H2, H3 } from "../../common/Headers";
import { Page } from "../../common/Page";
import { RankRow } from "../leaderboard/RankRow";
import { AdventureMap, MapStopState } from "./AdventureMap";
import { LessonCard } from "./LessonCard";
import { LessonGroupSection } from "./LessonGroupSection";
import { LessonHero } from "./LessonHero";
import { LessonsCollapsibleHeader } from "./LessonsCollapsibleHeader";
import { StickerBook } from "./StickerBook";

const allCheckpoints = continueOrder.filter(
  (
    item,
  ): item is Extract<(typeof continueOrder)[number], { kind: "checkpoint" }> =>
    item.kind === "checkpoint",
);

function GameButton(props: {
  name: string;
  description: string;
  icon: FaSolidIcon;
  locked?: boolean;
  lockedMessage?: string;
  recommended?: boolean;
  onClick: () => void;
}): JSXElement {
  return (
    <button
      type="button"
      class={cn(
        "flex min-h-[5.5rem] flex-col gap-2 rounded-xl p-4 text-left transition-colors",
        props.locked
          ? "cursor-not-allowed bg-sub-alt text-sub"
          : "cursor-pointer bg-sub-alt text-text hover:bg-text hover:text-bg",
      )}
      aria-disabled={props.locked === true}
      onClick={() => {
        if (props.locked === true) return;
        props.onClick();
      }}
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <Fa icon={props.icon} class="text-main" fixedWidth />
          <span class="font-medium">{props.name}</span>
        </div>
        <Show when={props.recommended === true}>
          <span class="shrink-0 rounded bg-main px-2 py-0.5 text-em-xs font-semibold text-bg">
            Today
          </span>
        </Show>
        <Show when={props.locked === true}>
          <Fa icon="fa-lock" class="shrink-0 text-sub" size={0.85} />
        </Show>
      </div>
      <div class="text-em-xs text-sub">
        {props.locked
          ? (props.lockedMessage ??
            "Complete the required typing lessons to play")
          : props.description}
      </div>
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
        p?.get(checkpointProgressKey(item.group, item.checkpoint))
          ?.completed === true,
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

type ShopTab = "me" | "keyboard" | "home";

const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: "me", label: "Me" },
  { id: "keyboard", label: "Keyboard" },
  { id: "home", label: "Home" },
];

const SHOP_ITEMS: {
  tab: ShopTab;
  modal: ModalId;
  icon: FaSolidIcon;
  label: string;
}[] = [
  { tab: "me", modal: "Avatar", icon: "fa-user", label: "customize" },
  {
    tab: "me",
    modal: "HandsShop",
    icon: "fa-hand-paper",
    label: "hand styles",
  },
  {
    tab: "keyboard",
    modal: "KeyboardSkinShop",
    icon: "fa-keyboard",
    label: "keyboard skins",
  },
  {
    tab: "keyboard",
    modal: "BackdropShop",
    icon: "fa-mountain",
    label: "backdrops",
  },
  {
    tab: "keyboard",
    modal: "RgbPaletteShop",
    icon: "fa-palette",
    label: "rgb palettes",
  },
  {
    tab: "keyboard",
    modal: "KeypressEffectShop",
    icon: "fa-star",
    label: "keypress effects",
  },
  {
    tab: "keyboard",
    modal: "CaretEffectShop",
    icon: "fa-i-cursor",
    label: "caret effects",
  },
  { tab: "home", modal: "House", icon: "fa-home", label: "my house" },
  {
    tab: "home",
    modal: "SideImagesShop",
    icon: "fa-image",
    label: "side images",
  },
];

const previousLessonId = new Map<string, string | undefined>();
const lessonIndex = new Map<string, number>();
lessonOrder.forEach((id, i) => {
  previousLessonId.set(id, i === 0 ? undefined : lessonOrder[i - 1]);
  lessonIndex.set(id, i);
});

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
                <RankRow
                  rank={i() + 1}
                  variant={{
                    kind: "lessonStars",
                    name: entry.name,
                    uid: entry.uid,
                    lessonStars: entry.lessonStars,
                  }}
                  selfUid={props.selfUid}
                  highlightColor={highlight()}
                />
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

export function LessonsPage(): JSXElement {
  const [reviewLoading, setReviewLoading] = createSignal(false);
  const [defenderOpen, setDefenderOpen] = createSignal(false);
  const [balloonOpen, setBalloonOpen] = createSignal(false);
  const [racerOpen, setRacerOpen] = createSignal(false);
  const [ghostOpen, setGhostOpen] = createSignal(false);
  const [fruitNinjaOpen, setFruitNinjaOpen] = createSignal(false);
  const [typeTossOpen, setTypeTossOpen] = createSignal(false);
  const [rpgOpen, setRpgOpen] = createSignal(false);
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
  const [showExtras, setShowExtras] = createSignal(false);
  const [shopTab, setShopTab] = createSignal<ShopTab>("me");
  const shopItems = createMemo(() =>
    SHOP_ITEMS.filter((item) => item.tab === shopTab()),
  );
  const [gamesTab, setGamesTab] = createSignal<
    "solo" | "multiplayer" | "rewards"
  >("solo");
  const [gameLaunchMode, setGameLaunchMode] = createSignal<"solo" | "together">(
    "solo",
  );
  const [collapsed, setCollapsed] = createSignal<Set<string>>(
    (() => {
      const stored = localStorage.getItem("lessonSectionsCollapsed");
      const defaults = [
        ...lessonGroups.map((group) => group.id),
        "class-practice",
        "japanese",
        "games",
        "funbox",
      ];
      if (stored === null) return new Set(defaults);
      try {
        const parsed: unknown = JSON.parse(stored);
        return Array.isArray(parsed)
          ? new Set(parsed.filter((id): id is string => typeof id === "string"))
          : new Set(defaults);
      } catch {
        return new Set(defaults);
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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

  const isNewStudent = createMemo((): boolean => {
    if (!isAuthenticated()) return true;
    const map = progress.data;
    if (map === undefined) return false;
    return ![...map.values()].some((p) => p.completed);
  });

  const isLessonLocked = (id: string): boolean => {
    const progressMap = progress.data;
    if (progressMap === undefined) return false;
    return isLessonLockedForProgress(
      id,
      progressMap,
      starsGateGrandfather.data ?? Infinity,
    );
  };

  const getLessonLockMessage = (id: string): string | undefined => {
    if (!isLessonLocked(id)) return undefined;
    const progressMap = progress.data;
    if (progressMap !== undefined) {
      const block = incompleteCheckpointBeforeLesson(id, progressMap);
      if (block !== undefined) {
        return checkpointLockMessage(block.checkpoint);
      }
    }
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
  const rpgUnlocked = (): boolean =>
    isCurrentUserAdmin() ||
    (progress.data !== undefined && !isLessonLocked("all-keys-1"));

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
    return getFrontierItem(p);
  });

  const continueItem = createMemo((): ContinueItem | undefined => {
    const p = progress.data;
    if (p === undefined) return undefined;
    return getContinueItem(p, starsGateGrandfather.data ?? Infinity);
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
  const frontierCheckpointTarget = createMemo(
    ():
      | { groupId: string; gameType: HomeRowCheckpoint["gameType"] }
      | undefined => {
      const item = frontierItem();
      if (item?.kind !== "checkpoint") return undefined;
      return {
        groupId: item.group.id,
        gameType: item.checkpoint.gameType,
      };
    },
  );

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
    const currentIdx =
      id === undefined
        ? 0
        : Math.max(
            0,
            lessonGroups.findIndex((group) => group.id === id),
          );
    for (let i = 0; i < lessonGroups.length; i++) {
      const group = lessonGroups[i];
      if (group === undefined) continue;
      if (i <= currentIdx || manuallyToggledGroups.has(group.id)) continue;
      next.add(group.id);
      const firstLessonId = group.lessons[0]?.id;
      if (firstLessonId !== undefined && isLessonLocked(firstLessonId)) {
        next.add(group.id);
      }
    }
    const hashGroupId = window.location.hash.replace(/^#/, "");
    const hashTarget =
      hashGroupId.length > 0 &&
      lessonGroups.some((group) => group.id === hashGroupId)
        ? hashGroupId
        : undefined;
    next.delete("typing-lessons");
    const expandGroupId = hashTarget ?? id;
    if (expandGroupId !== undefined) {
      next.delete(expandGroupId);
    }
    setCollapsed(next);
    persistCollapsed(next);

    queueMicrotask(() => {
      if (hashTarget !== undefined) {
        document.getElementById(hashTarget)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
      if (
        !isAuthenticated() ||
        sessionStorage.getItem("lessonsScrolledToFrontier") === "1"
      ) {
        return;
      }
      const item = getContinueItem(p, starsGateGrandfather.data ?? Infinity);
      if (item === undefined) return;
      scrollToContinueItem(item);
      sessionStorage.setItem("lessonsScrolledToFrontier", "1");
    });
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
    launchContinueTarget(
      item,
      {
        launchLesson: launchLessonWithIntro,
        openCheckpoint: (group, checkpoint, rewardFlag) =>
          void openCheckpointGame(group, checkpoint, rewardFlag),
      },
      reward,
    );
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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

  const classGoalsQuery = useQuery(() => ({
    queryKey: ["classGoals"],
    queryFn: getClassGoals,
    enabled: isOpen() && isAuthenticated() && classId() !== undefined,
    staleTime: 1000 * 60 * 30,
  }));
  const classGoal = createMemo(() => {
    const id = classId();
    if (id === undefined) return undefined;
    const goal = classGoalsQuery.data?.[id];
    const entry = classCompareQuery.data?.entries.find((e) => e.classId === id);
    if (goal === undefined || entry === undefined) return undefined;
    return { classId: id, current: entry.totalStars, ...goal };
  });

  const weeklyQuestQuery = useQuery(() => ({
    queryKey: ["weeklyQuests"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) return { weekId: 0, progress: {}, claimed: [] };
      return getWeeklyQuestState(uid);
    },
    enabled: isOpen() && isAuthenticated(),
    staleTime: 5 * 60 * 1000,
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

  const [mapHidden, setMapHidden] = createSignal(
    localStorage.getItem("lessonsMapHidden") === "1",
  );
  const toggleMap = (): void => {
    const next = !mapHidden();
    setMapHidden(next);
    try {
      localStorage.setItem("lessonsMapHidden", next ? "1" : "0");
    } catch {
      // ignore
    }
  };
  const mapStopState = (group: LessonGroup): MapStopState => {
    if (isGroupComplete(group)) return "done";
    if (group.id === currentGroupId()) return "current";
    const first = group.lessons[0]?.id;
    if (first !== undefined && isLessonLocked(first)) return "locked";
    return "open";
  };
  const groupStars = (group: LessonGroup): { earned: number; max: number } => ({
    earned: group.lessons.reduce(
      (sum, l) => sum + (progressFor(l.id)?.stars ?? 0),
      0,
    ),
    max: group.lessons.length * 3,
  });
  const goToGroup = (group: LessonGroup): void => {
    if (collapsed().has("typing-lessons")) toggle("typing-lessons");
    if (collapsed().has(group.id)) toggle(group.id);
    queueMicrotask(() => {
      document.getElementById(group.id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

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
    if (gameId === "typing-rpg" && !rpgUnlocked()) {
      showNoticeNotification(
        "Unlock the All Keys lessons to play Typing Quest",
      );
      return;
    }
    setRecommendedGameId(recommended ? gameId : undefined);
    if (gameId === "word-defender") setDefenderOpen(true);
    else if (gameId === "balloon-pop") setBalloonOpen(true);
    else if (gameId === "type-racer") setRacerOpen(true);
    else if (gameId === "ghost-hunter") setGhostOpen(true);
    else if (gameId === "fruit-ninja") setFruitNinjaOpen(true);
    else if (gameId === "type-toss") setTypeTossOpen(true);
    else if (gameId === "typing-rpg") setRpgOpen(true);
  };

  const launchGame = (
    gameId: string,
    mode: "solo" | "together" = "solo",
  ): void => {
    setGameLaunchMode(mode);
    openBuiltinGame(gameId);
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

  const scrollToContinueTarget = (): void => {
    const item = continueItem();
    if (item === undefined) return;
    scrollToContinueItem(item);
  };

  const practiceRecommendation = createMemo(
    (): import("./LessonHero").PracticeRecommendation | undefined => {
      if (!isAuthenticated()) return undefined;
      if (progress.data === undefined) return undefined;

      const item = continueItem();
      if (item !== undefined) {
        const hasStarted = lessonOrder.some(
          (id) => progress.data?.get(id) !== undefined,
        );
        return {
          icon: continueIcon(),
          eyebrow:
            item.kind === "checkpoint"
              ? "Next up: checkpoint"
              : hasStarted
                ? "Next up: lesson"
                : "Start here",
          title: continueLabel(),
          description:
            item.kind === "checkpoint"
              ? item.checkpoint.gameType === "toss"
                ? "Play the full Type Toss round to unlock your next lesson."
                : "Beat 3 waves in this checkpoint game to unlock your next lesson."
              : "Opens your next lesson in the typing area.",
          action:
            item.kind === "checkpoint"
              ? item.checkpoint.gameType === "toss"
                ? "Go to checkpoint"
                : "Go to checkpoint"
              : hasStarted
                ? "Go to next lesson"
                : "Start first lesson",
          onStart: () => onContinueClick(true),
          onScrollToTarget: scrollToContinueTarget,
        };
      }

      if (
        weakKeysQuery.data === undefined ||
        userStatsQuery.data === undefined
      ) {
        return undefined;
      }

      const builtinGames = games.filter(
        (game) =>
          game.type === "builtin" &&
          (game.id !== "typing-rpg" || rpgUnlocked()),
      );
      const day = Number(localDateString().replaceAll("-", ""));
      const game = builtinGames[day % builtinGames.length];
      if (game === undefined) return undefined;
      const completedToday =
        userStatsQuery.data.practiceRewardDates.recommendation ===
        localDateString();
      return {
        icon: game.icon,
        eyebrow: "game of the day",
        title: game.name,
        description: completedToday
          ? "Daily reward claimed. Play again anytime for extra practice."
          : "Finish your practice with a quick typing challenge.",
        action: completedToday ? "Play again" : "Play now",
        onStart: () => openBuiltinGame(game.id, true),
      };
    },
  );

  const practiceRewardLabel = (category: PracticeRewardCategory): string =>
    userStatsQuery.data?.practiceRewardDates[category] === localDateString()
      ? "✓ 10 claimed today"
      : "🪙 10 daily";

  const todayPracticeDone = (): number =>
    (
      [
        userStatsQuery.data?.practiceRewardDates.recommendation ===
          localDateString(),
        dailyChallenge().done,
        userStatsQuery.data?.practiceRewardDates.adaptive === localDateString(),
      ] as boolean[]
    ).filter(Boolean).length;

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

  const currentGroupIndex = createMemo((): number => {
    const id = currentGroupId();
    if (id === undefined) return 0;
    const idx = lessonGroups.findIndex((group) => group.id === id);
    return idx === -1 ? 0 : idx;
  });

  return (
    <Page id="lessons">
      <div class="lessons-student-ui content-grid grid gap-5">
        <LessonHero
          signedIn={isAuthenticated()}
          showClassSetupNotice={
            isAuthenticated() &&
            !isCurrentUserAdmin() &&
            classId() === undefined
          }
          isNewStudent={isNewStudent()}
          streakDays={userStatsQuery.data?.streakDays ?? 0}
          streakFreezes={userStatsQuery.data?.streakFreezesAvailable ?? 0}
          recommendation={practiceRecommendation()}
          todayPracticeDone={todayPracticeDone()}
          practiceRewardLabel={practiceRewardLabel}
          dailyChallengeName={dailyChallenge().lessonName}
          dailyChallengeDone={dailyChallenge().done}
          onDailyChallenge={launchDailyChallenge}
          onAdaptiveReview={() => void reviewWeakKeys()}
          adaptiveLoading={reviewLoading()}
          adaptiveDoneToday={
            userStatsQuery.data?.practiceRewardDates.adaptive ===
            localDateString()
          }
          primaryLoading={reviewLoading() || lessonGameLoading()}
          weeklyQuestProgress={weeklyQuestQuery.data?.progress}
          weeklyQuestClaimed={weeklyQuestQuery.data?.claimed}
          avatar={
            isAuthenticated()
              ? {
                  color: equippedAvatarColor(),
                  shape: avatarStateQuery.data?.shape,
                  hair: avatarStateQuery.data?.equipped.hair,
                  hat: avatarStateQuery.data?.equipped.hat,
                  accessory: avatarStateQuery.data?.equipped.accessory,
                  face: avatarStateQuery.data?.equipped.face,
                  background: avatarStateQuery.data?.equipped.background,
                  highlightColor: equippedAvatarHighlight(),
                  animalImage: animalAvatarQuery.data?.animalImage,
                }
              : undefined
          }
        />

        <Show when={isAuthenticated() && continueItem() !== undefined}>
          <div
            class={cn(
              "sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-sub-alt bg-bg/95 px-3 py-2 text-sm shadow-sm backdrop-blur-sm",
            )}
            data-ui-element="lessonsContinueBar"
          >
            <span class="max-w-[min(100%,14rem)] truncate font-medium text-text">
              Next: {continueLabel()}
            </span>
            <Button
              class="min-h-9 bg-main px-3 py-1.5 text-sm text-bg hover:opacity-90"
              fa={{ icon: continueIcon(), fixedWidth: true }}
              text={
                continueItem()?.kind === "checkpoint"
                  ? "Go"
                  : "Go to next lesson"
              }
              onClick={() => onContinueClick(false)}
            />
            <Button
              variant="text"
              class="min-h-9 px-3 py-1.5 text-sm"
              fa={{ icon: "fa-list", fixedWidth: true }}
              text="Show"
              onClick={scrollToContinueTarget}
            />
          </div>
        </Show>

        {/* Teacher work stays near the primary action, before optional areas. */}
        <Show when={(assignmentsQuery.data?.length ?? 0) > 0}>
          <section>
            <H2
              class="text-[1.65em] sm:text-[1.85em]"
              fa={{ icon: "fa-list" }}
              text="Teacher Assignments"
            />
            <p class="mb-3 text-sub">Finish these before free practice.</p>
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

        <Show when={isAuthenticated() && progress.data !== undefined}>
          <section class="grid gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 text-lg font-bold text-text">
                <Fa icon="fa-map" class="text-main" />
                Adventure Map
              </h2>
              <Button
                variant="text"
                class="text-sm"
                fa={{ icon: mapHidden() ? "fa-map" : "fa-eye-slash" }}
                text={mapHidden() ? "Show map" : "Hide map"}
                onClick={toggleMap}
              />
            </div>
            <Show when={!mapHidden()}>
              <AdventureMap
                groups={lessonGroups}
                stateFor={mapStopState}
                starsFor={groupStars}
                onSelect={goToGroup}
                avatar={
                  <Avatar
                    color={equippedAvatarColor()}
                    shape={avatarStateQuery.data?.shape}
                    hair={avatarStateQuery.data?.equipped.hair}
                    hat={avatarStateQuery.data?.equipped.hat}
                    accessory={avatarStateQuery.data?.equipped.accessory}
                    face={avatarStateQuery.data?.equipped.face}
                    background={avatarStateQuery.data?.equipped.background}
                    highlightColor={equippedAvatarHighlight()}
                    size={28}
                    animalImage={animalAvatarQuery.data?.animalImage}
                  />
                }
              />
            </Show>
          </section>
        </Show>

        <Show when={classGoal()} keyed>
          {(g) => (
            <ClassGoalBar
              classId={g.classId}
              current={g.current}
              goal={g.stars}
              reward={g.reward}
            />
          )}
        </Show>

        <Show when={isAuthenticated()}>
          <section class="rounded bg-sub-alt">
            <button
              type="button"
              class="flex min-h-12 w-full items-center justify-between gap-3 rounded px-4 py-3 text-left text-text transition-colors hover:bg-bg"
              aria-expanded={showExtras()}
              onClick={() => setShowExtras((open) => !open)}
            >
              <span class="flex items-center gap-2 font-bold">
                <Fa icon="fa-gift" class="text-main" />
                Rewards, Progress &amp; Customization
              </span>
              <span class="flex items-center gap-2 text-sm text-sub">
                {showExtras() ? "Hide" : "Show"}
                <Fa
                  icon="fa-chevron-down"
                  class={cn(
                    "transition-transform duration-200",
                    showExtras() ? "rotate-180" : "",
                  )}
                />
              </span>
            </button>
          </section>
        </Show>

        <Show when={isAuthenticated() && showExtras()}>
          <div class="grid gap-5">
            {/* Avatar + coins */}
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
              <button
                type="button"
                class="cursor-pointer rounded bg-bg px-4 py-1.5 text-sm font-medium text-text transition-colors hover:bg-main hover:text-bg"
                onClick={() => showModal("Achievements")}
              >
                <Fa icon="fa-trophy" class="mr-1.5 text-main" />
                achievements
              </button>
            </section>

            <section class="grid gap-3 rounded bg-sub-alt p-4">
              <div class="flex flex-wrap items-center gap-2">
                <span class="mr-1 flex items-center gap-2 font-bold text-text">
                  <Fa icon="fa-store" class="text-main" />
                  Shop
                </span>
                <For each={SHOP_TABS}>
                  {(tab) => (
                    <button
                      type="button"
                      class={cn(
                        "cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors",
                        shopTab() === tab.id
                          ? "bg-main text-bg"
                          : "bg-bg text-sub hover:text-text",
                      )}
                      aria-pressed={shopTab() === tab.id}
                      onClick={() => setShopTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  )}
                </For>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <For each={shopItems()}>
                  {(item) => (
                    <button
                      type="button"
                      class="cursor-pointer rounded bg-main px-4 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-80"
                      onClick={() => showModal(item.modal)}
                    >
                      <Fa icon={item.icon} class="mr-1.5" />
                      {item.label}
                    </button>
                  )}
                </For>
              </div>
            </section>

            <StickerBook
              groups={lessonGroups}
              isGroupComplete={isGroupComplete}
            />

            {/* Progress summary + leaderboards */}
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
          </div>
        </Show>

        {/* 5. Typing Lessons — main section wrapping all lesson groups */}
        <section>
          <LessonsCollapsibleHeader
            sectionId="typing-lessons"
            text="Typing Lessons"
            icon="fa-graduation-cap"
            collapsed={collapsed}
            onToggle={toggle}
          />
          <Show when={!collapsed().has("typing-lessons")}>
            <div id="lessons-section-typing-lessons">
              <p class="mb-2 text-sm font-medium text-main">
                Start with the lesson marked Next and complete lessons in order.
              </p>
              <Show when={progress.isLoading && progress.data === undefined}>
                <div class="mb-4 grid gap-3" aria-hidden="true">
                  <div class="h-8 w-48 animate-pulse rounded-2xl bg-sub-alt"></div>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div class="h-48 animate-pulse rounded-2xl bg-sub-alt"></div>
                    <div class="h-48 animate-pulse rounded-2xl bg-sub-alt"></div>
                    <div class="h-48 animate-pulse rounded-2xl bg-sub-alt"></div>
                  </div>
                </div>
              </Show>
              <div class="grid gap-1">
                <For each={lessonGroups}>
                  {(group, index) => (
                    <LessonGroupSection
                      group={group}
                      collapsed={collapsed().has(group.id)}
                      onToggle={() => toggle(group.id)}
                      isCurrent={group.id === currentGroupId()}
                      isFuture={index() > currentGroupIndex()}
                      isComplete={isGroupComplete(group)}
                      progressFor={progressFor}
                      isLessonLocked={isLessonLocked}
                      getLessonLockMessage={getLessonLockMessage}
                      frontierLessonId={frontierLessonId()}
                      frontierCheckpointTarget={frontierCheckpointTarget()}
                      lessonGameLoading={lessonGameLoading()}
                      onCheckpointPlay={(g, c) => void openCheckpointGame(g, c)}
                      onGroupGame={(g, type) => void openLessonGame(g, type)}
                      grade={grade()}
                      isGroupComplete={isGroupComplete}
                    />
                  )}
                </For>
              </div>
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
            <LessonsCollapsibleHeader
              sectionId="class-practice"
              text="Class Practice"
              icon="fa-keyboard"
              collapsed={collapsed}
              onToggle={toggle}
            />
            <Show when={!collapsed().has("class-practice")}>
              <div id="lessons-section-class-practice">
                <Show when={(wordListsQuery.data?.length ?? 0) > 0}>
                  <p class="mb-4 text-sub">
                    Word lists shared with your class.
                  </p>
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
                            progressFor(`${PASSAGE_PREFIX}${p.id}`)
                              ?.completed === true
                          }
                          onClick={() => launchPassage(p)}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </section>
        </Show>

        {/* 7. Japanese */}
        <section>
          <LessonsCollapsibleHeader
            sectionId="japanese"
            text="Japanese — Romaji"
            icon="fa-language"
            collapsed={collapsed}
            onToggle={toggle}
          />
          <Show when={!collapsed().has("japanese")}>
            <div id="lessons-section-japanese">
              <p class="mb-4 text-sub">
                Learn Japanese typing in romaji. Free practice - try these in
                any order.
              </p>
              <div class="grid gap-6">
                <For each={japaneseLessonGroups}>
                  {(group) => (
                    <div>
                      <H3 fa={{ icon: group.icon }} text={group.name} />
                      <p class="mb-3 text-em-sm text-sub">
                        {group.description}
                      </p>
                      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <For each={group.lessons}>
                          {(lesson) => (
                            <LessonCard
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
            </div>
          </Show>
        </section>

        {/* 8. Games */}
        <section>
          <LessonsCollapsibleHeader
            sectionId="games"
            text="Games"
            icon="fa-gamepad"
            collapsed={collapsed}
            onToggle={toggle}
          />
          <Show when={!collapsed().has("games")}>
            <div id="lessons-section-games">
              <p class="mb-4 text-sub">
                Play solo, challenge classmates, or check your game rewards.
              </p>
              <div
                role="tablist"
                aria-label="Game categories"
                class="mb-4 flex gap-2 border-b border-sub pb-2"
              >
                <For each={["solo", "multiplayer", "rewards"] as const}>
                  {(tab) => (
                    <button
                      id={`games-tab-${tab}`}
                      type="button"
                      role="tab"
                      aria-selected={gamesTab() === tab}
                      aria-controls="games-tab-panel"
                      tabIndex={gamesTab() === tab ? 0 : -1}
                      class={cn(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        gamesTab() === tab
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-sub hover:text-text",
                      )}
                      onClick={() => setGamesTab(tab)}
                      onKeyDown={(event) => {
                        const tabs = [
                          "solo",
                          "multiplayer",
                          "rewards",
                        ] as const;
                        const index = tabs.indexOf(tab);
                        const next =
                          event.key === "ArrowRight"
                            ? tabs[(index + 1) % tabs.length]
                            : event.key === "ArrowLeft"
                              ? tabs[(index + tabs.length - 1) % tabs.length]
                              : event.key === "Home"
                                ? tabs[0]
                                : event.key === "End"
                                  ? tabs[tabs.length - 1]
                                  : undefined;
                        if (next === undefined) return;
                        event.preventDefault();
                        setGamesTab(next);
                        document.getElementById(`games-tab-${next}`)?.focus();
                      }}
                    >
                      {tab === "solo"
                        ? "Solo play"
                        : tab === "multiplayer"
                          ? "Multiplayer"
                          : "Rewards"}
                    </button>
                  )}
                </For>
              </div>
              <div
                id="games-tab-panel"
                role="tabpanel"
                aria-labelledby={`games-tab-${gamesTab()}`}
              >
                <Show when={gamesTab() === "solo"}>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <For each={games.filter((g) => g.type === "builtin")}>
                      {(game) => (
                        <GameButton
                          name={game.name}
                          description={game.description}
                          icon={game.icon}
                          recommended={recommendedGameId() === game.id}
                          locked={game.id === "typing-rpg" && !rpgUnlocked()}
                          onClick={() => launchGame(game.id)}
                        />
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={gamesTab() === "multiplayer"}>
                  <p class="mb-3 text-sub">
                    Create a room or join friends with a code.
                  </p>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <For
                      each={games.filter(
                        (g) =>
                          g.type === "builtin" &&
                          ["type-toss", "type-racer", "ghost-hunter"].includes(
                            g.id,
                          ),
                      )}
                    >
                      {(game) => {
                        const requiredLesson =
                          game.id === "type-racer"
                            ? "home-middle"
                            : game.id === "type-toss"
                              ? "home-words"
                              : "all-keys-1";
                        const locked = () =>
                          !isCurrentUserAdmin() &&
                          isLessonLocked(requiredLesson);
                        return (
                          <GameButton
                            name={game.name}
                            description={game.description}
                            icon={game.icon}
                            locked={locked()}
                            lockedMessage="🔒 Complete the required typing lessons to play together"
                            onClick={() => {
                              if (!locked()) launchGame(game.id, "together");
                            }}
                          />
                        );
                      }}
                    </For>
                  </div>
                </Show>
                <Show when={gamesTab() === "rewards"}>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="rounded bg-sub-alt p-4">
                      <h3 class="font-medium text-text">Typing Quest</h3>
                      <p class="my-2 text-sub">
                        Earn coins for clearing waves. Fast mode earns more;
                        both modes share the daily bonus limit.
                      </p>
                      <button
                        type="button"
                        class="rounded bg-text px-3 py-2 text-bg"
                        onClick={() => launchGame("typing-rpg")}
                      >
                        Play Typing Quest
                      </button>
                    </div>
                    <div class="rounded bg-sub-alt p-4">
                      <h3 class="font-medium text-text">
                        Today&apos;s practice reward
                      </h3>
                      <p class="my-2 text-sub">
                        Finish today&apos;s recommended activity for its daily
                        practice reward.
                      </p>
                      <button
                        type="button"
                        class="rounded bg-text px-3 py-2 text-bg"
                        onClick={() => practiceRecommendation()?.onStart()}
                      >
                        {practiceRecommendation()?.title ??
                          "See today's practice"}
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </section>

        {/* 8b. Fun Box */}
        <Show when={FUNBOX_GAMES_ENABLED}>
          <section>
            <LessonsCollapsibleHeader
              sectionId="funbox"
              text="fun box"
              icon="fa-magic"
              collapsed={collapsed}
              onToggle={toggle}
            />
            <Show when={!collapsed().has("funbox")}>
              <div id="lessons-section-funbox">
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
          initialMode={gameLaunchMode()}
          multiplayerUnlocked={
            isCurrentUserAdmin() || !isLessonLocked("home-middle")
          }
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
          initialMode={gameLaunchMode()}
          multiplayerUnlocked={
            isCurrentUserAdmin() || !isLessonLocked("all-keys-1")
          }
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
          initialMode={gameLaunchMode()}
          multiplayerUnlocked={
            isCurrentUserAdmin() || !isLessonLocked("home-words")
          }
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
        <TypingRpgModal
          open={rpgOpen() && rpgUnlocked()}
          onClose={() => setRpgOpen(false)}
          onResult={(score) => {
            void recordGameScore("typing-rpg", score);
            claimRecommendedGame("typing-rpg", score, 1);
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
          onResult={(score, wave, _label, _group, checkpointCleared) => {
            const gid = lessonTossGroupId();
            if (gid !== null) {
              void recordGameResult(
                `${GAME_PREFIX}${gid}:type-toss`,
                score,
                wave,
                { cleared: checkpointCleared },
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

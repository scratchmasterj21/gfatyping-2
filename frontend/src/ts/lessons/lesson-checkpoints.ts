import { FaSolidIcon } from "../types/font-awesome";

export type HomeRowGameType = "balloon" | "defender" | "toss" | "ghost";

export type HomeRowCheckpoint = {
  /** the checkpoint is inserted right after this lesson in the grid */
  afterLessonId: string;
  gameType: HomeRowGameType;
  /** which lessons' words this game reviews, or "all" for the group finale */
  reviewLessonIds: string[] | "all";
  label: string;
  icon: FaSolidIcon;
};

// Matches the game ids used by the general (non-lesson) games section, so
// progress recorded here shares history with any pre-existing keys.
export const HOME_ROW_GAME_IDS: Record<HomeRowGameType, string> = {
  balloon: "balloon-pop",
  defender: "word-defender",
  toss: "type-toss",
  ghost: "ghost-hunter",
};

// Games interspersed through the "home-row" group specifically, each
// reviewing the lessons just completed. Non-blocking: lessons keep unlocking
// purely by lesson completion (see isLessonLocked) regardless of these.
export const HOME_ROW_CHECKPOINTS: HomeRowCheckpoint[] = [
  {
    afterLessonId: "home-middle",
    gameType: "balloon",
    reviewLessonIds: ["home-index", "home-middle"],
    label: "Balloon Pop",
    icon: "fa-circle",
  },
  {
    afterLessonId: "home-pinky",
    gameType: "defender",
    reviewLessonIds: ["home-ring", "home-pinky"],
    label: "Word Defender",
    icon: "fa-rocket",
  },
  {
    afterLessonId: "home-all",
    gameType: "toss",
    reviewLessonIds: ["home-reach", "home-all"],
    label: "Type Toss",
    icon: "fa-hourglass",
  },
  {
    afterLessonId: "home-words",
    gameType: "ghost",
    reviewLessonIds: "all",
    label: "Ghost Hunter",
    icon: "fa-ghost",
  },
];

// Games interspersed through the "top-row" group, mirroring the home-row
// pattern above.
export const TOP_ROW_CHECKPOINTS: HomeRowCheckpoint[] = [
  {
    afterLessonId: "top-middle",
    gameType: "balloon",
    reviewLessonIds: ["top-index", "top-middle"],
    label: "Balloon Pop",
    icon: "fa-circle",
  },
  {
    afterLessonId: "top-pinky",
    gameType: "defender",
    reviewLessonIds: ["top-ring", "top-pinky"],
    label: "Word Defender",
    icon: "fa-rocket",
  },
  {
    afterLessonId: "top-home",
    gameType: "toss",
    reviewLessonIds: ["top-all", "top-home"],
    label: "Type Toss",
    icon: "fa-hourglass",
  },
  {
    afterLessonId: "top-words",
    gameType: "ghost",
    reviewLessonIds: "all",
    label: "Ghost Hunter",
    icon: "fa-ghost",
  },
];

// Games interspersed through the "bottom-row" group, mirroring the home-row
// pattern above.
export const BOTTOM_ROW_CHECKPOINTS: HomeRowCheckpoint[] = [
  {
    afterLessonId: "bottom-middle",
    gameType: "balloon",
    reviewLessonIds: ["bottom-index", "bottom-middle"],
    label: "Balloon Pop",
    icon: "fa-circle",
  },
  {
    afterLessonId: "bottom-pinky",
    gameType: "defender",
    reviewLessonIds: ["bottom-ring", "bottom-pinky"],
    label: "Word Defender",
    icon: "fa-rocket",
  },
  {
    afterLessonId: "bottom-home",
    gameType: "toss",
    reviewLessonIds: ["bottom-all", "bottom-home"],
    label: "Type Toss",
    icon: "fa-hourglass",
  },
  {
    afterLessonId: "bottom-words",
    gameType: "ghost",
    reviewLessonIds: "all",
    label: "Ghost Hunter",
    icon: "fa-ghost",
  },
];

// Games interspersed through the "all-keys" group. This group has no
// finger-group structure (just increasing difficulty), so checkpoints map to
// difficulty milestones instead.
export const ALL_KEYS_CHECKPOINTS: HomeRowCheckpoint[] = [
  {
    afterLessonId: "all-keys-2",
    gameType: "balloon",
    reviewLessonIds: ["all-keys-1", "all-keys-2"],
    label: "Balloon Pop",
    icon: "fa-circle",
  },
  {
    afterLessonId: "all-keys-4",
    gameType: "defender",
    reviewLessonIds: ["all-keys-3", "all-keys-4"],
    label: "Word Defender",
    icon: "fa-rocket",
  },
  {
    afterLessonId: "all-keys-5",
    gameType: "toss",
    reviewLessonIds: ["all-keys-4", "all-keys-5"],
    label: "Type Toss",
    icon: "fa-hourglass",
  },
  {
    afterLessonId: "all-keys-6",
    gameType: "ghost",
    reviewLessonIds: "all",
    label: "Ghost Hunter",
    icon: "fa-ghost",
  },
];

// Games interspersed through "common-words" (real English words, so the
// word-based games work naturally here too).
export const COMMON_WORDS_CHECKPOINTS: HomeRowCheckpoint[] = [
  {
    afterLessonId: "common-words-1",
    gameType: "balloon",
    reviewLessonIds: ["common-words-1"],
    label: "Balloon Pop",
    icon: "fa-circle",
  },
  {
    afterLessonId: "common-words-3",
    gameType: "ghost",
    reviewLessonIds: "all",
    label: "Ghost Hunter",
    icon: "fa-ghost",
  },
];

// Short, single-drill-type groups (capitals/punctuation/numbers/symbols/hand
// drills) just get one wrap-up game at the end instead of the full spread -
// too few lessons to intersperse, and several aren't real-word content.
const finaleOnly = (afterLessonId: string): HomeRowCheckpoint[] => [
  {
    afterLessonId,
    gameType: "ghost",
    reviewLessonIds: "all",
    label: "Ghost Hunter",
    icon: "fa-ghost",
  },
];

/**
 * Per-lesson-group interspersed game checkpoints. Add an entry here to add
 * checkpoints for a group - no other wiring needed (see LessonsPage.tsx).
 */
export const LESSON_GROUP_CHECKPOINTS: Record<string, HomeRowCheckpoint[]> = {
  "home-row": HOME_ROW_CHECKPOINTS,
  "top-row": TOP_ROW_CHECKPOINTS,
  "bottom-row": BOTTOM_ROW_CHECKPOINTS,
  "all-keys": ALL_KEYS_CHECKPOINTS,
  "common-words": COMMON_WORDS_CHECKPOINTS,
  capitals: finaleOnly("capitals-2"),
  punctuation: finaleOnly("punctuation-5"),
  numbers: finaleOnly("numbers-3"),
  symbols: finaleOnly("symbols-3"),
  "hand-drills": finaleOnly("hand-drills-right"),
  "connected-text": finaleOnly("connected-text-3"),
};

/**
 * Lesson ids that have a bonus mini-game checkpoint placed right after them
 * on the Lessons page. Used so "next test" sends students back to the
 * Lessons page instead of silently skipping past the game to the next lesson.
 */
export const LESSON_IDS_WITH_GAME_CHECKPOINT: ReadonlySet<string> = new Set(
  Object.values(LESSON_GROUP_CHECKPOINTS).flatMap((checkpoints) =>
    checkpoints.map((c) => c.afterLessonId),
  ),
);

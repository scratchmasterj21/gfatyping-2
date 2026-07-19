import { ASSIGNMENT_PREFIX, WORDLIST_PREFIX } from "../classroom/assignments";
import { LessonProgress } from "../lessons/lesson-progress";
import { lessonGroups } from "../lessons/lessons-data";
import { MiniSnapshot } from "../states/snapshot";
import { FaSolidIcon } from "../types/font-awesome";
import { getLevelFromTotalXp } from "../utils/levels";

export type AchievementContext = {
  snapshot: MiniSnapshot;
  lessonProgress: Map<string, LessonProgress>;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: FaSolidIcon;
  earned: (ctx: AchievementContext) => boolean;
};

const WPM_LANGUAGE = "english";

/** Best english wpm for a given time-mode duration (e.g. "30", "60"). */
function bestTimeWpm(snapshot: MiniSnapshot, mode2: string): number {
  const arr = snapshot.personalBests?.time?.[mode2] ?? [];
  let best = 0;
  for (const pb of arr) {
    if (pb.language === WPM_LANGUAGE && pb.wpm > best) best = pb.wpm;
  }
  return best;
}

/** Best english wpm at the default test (time 30). */
function bestWpmAtDefault(snapshot: MiniSnapshot): number {
  return bestTimeWpm(snapshot, "30");
}

/** Best english wpm at any time duration - the user's headline speed. */
function bestWpmAnyTime(snapshot: MiniSnapshot): number {
  const time = snapshot.personalBests?.time ?? {};
  let best = 0;
  for (const arr of Object.values(time)) {
    for (const pb of arr) {
      if (pb.language === WPM_LANGUAGE && pb.wpm > best) best = pb.wpm;
    }
  }
  return best;
}

function hasPerfectAccuracyRun(snapshot: MiniSnapshot): boolean {
  const time = snapshot.personalBests?.time ?? {};
  for (const arr of Object.values(time)) {
    for (const pb of arr) {
      if (pb.acc >= 100) return true;
    }
  }
  return false;
}

/** Best consistency percent across all english time PBs. */
function bestConsistency(snapshot: MiniSnapshot): number {
  const time = snapshot.personalBests?.time ?? {};
  let best = 0;
  for (const arr of Object.values(time)) {
    for (const pb of arr) {
      const c = pb.consistency ?? 0;
      if (pb.language === WPM_LANGUAGE && c > best) best = c;
    }
  }
  return best;
}

/** Total time typed, in hours. */
function hoursTyped(snapshot: MiniSnapshot): number {
  return (snapshot.typingStats?.timeTyping ?? 0) / 3600;
}

/**
 * Built-in English lesson keys only. Excludes assignment / word-list progress
 * and the Japanese romaji track (`jp-`), which is a separate parallel track and
 * shouldn't count toward English-track achievement totals.
 */
function builtInLessonEntries(
  lessonProgress: Map<string, LessonProgress>,
): LessonProgress[] {
  const out: LessonProgress[] = [];
  for (const [key, p] of lessonProgress) {
    if (key.startsWith(ASSIGNMENT_PREFIX)) continue;
    if (key.startsWith(WORDLIST_PREFIX)) continue;
    if (key.startsWith("jp-")) continue;
    out.push(p);
  }
  return out;
}

function lessonsCompleted(lessonProgress: Map<string, LessonProgress>): number {
  return builtInLessonEntries(lessonProgress).filter((p) => p.completed).length;
}

function totalStars(lessonProgress: Map<string, LessonProgress>): number {
  return builtInLessonEntries(lessonProgress).reduce(
    (sum, p) => sum + (p.completed ? (p.stars ?? 0) : 0),
    0,
  );
}

function threeStarCount(lessonProgress: Map<string, LessonProgress>): number {
  return builtInLessonEntries(lessonProgress).filter(
    (p) => p.completed && (p.stars ?? 0) >= 3,
  ).length;
}

const homeRowLessonIds: string[] =
  lessonGroups.find((g) => g.id === "home-row")?.lessons.map((l) => l.id) ?? [];

function homeRowComplete(lessonProgress: Map<string, LessonProgress>): boolean {
  if (homeRowLessonIds.length === 0) return false;
  return homeRowLessonIds.every(
    (id) => lessonProgress.get(id)?.completed === true,
  );
}

const TOTAL_LESSONS = lessonGroups.reduce((n, g) => n + g.lessons.length, 0);
const TOTAL_STARS = TOTAL_LESSONS * 3;

export const achievements: Achievement[] = [
  // --- speed ---
  {
    id: "speed-20",
    name: "Getting started",
    description: "Reach 20 wpm (30s english)",
    icon: "fa-seedling",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 20,
  },
  {
    id: "speed-30",
    name: "Picking up speed",
    description: "Reach 30 wpm (30s english)",
    icon: "fa-bolt",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 30,
  },
  {
    id: "speed-40",
    name: "Fast fingers",
    description: "Reach 40 wpm (30s english)",
    icon: "fa-rocket",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 40,
  },
  {
    id: "speed-50",
    name: "Speed demon",
    description: "Reach 50 wpm (30s english)",
    icon: "fa-fire",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 50,
  },
  {
    id: "speed-60",
    name: "Blazing",
    description: "Reach 60 wpm (30s english)",
    icon: "fa-meteor",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 60,
  },
  {
    id: "speed-70",
    name: "Lightning hands",
    description: "Reach 70 wpm (30s english)",
    icon: "fa-fighter-jet",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 70,
  },
  {
    id: "speed-80",
    name: "Supersonic",
    description: "Reach 80 wpm (30s english)",
    icon: "fa-dragon",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 80,
  },
  {
    id: "speed-100",
    name: "Triple digits",
    description: "Reach 100 wpm (30s english)",
    icon: "fa-skull",
    earned: ({ snapshot }) => bestWpmAtDefault(snapshot) >= 100,
  },
  {
    id: "speed-endurance-50",
    name: "Marathon runner",
    description: "Reach 50 wpm on a 60 second test",
    icon: "fa-mountain",
    earned: ({ snapshot }) => bestTimeWpm(snapshot, "60") >= 50,
  },
  // --- accuracy ---
  {
    id: "accuracy-perfect",
    name: "Flawless",
    description: "Finish a test with 100% accuracy",
    icon: "fa-bullseye",
    earned: ({ snapshot }) => hasPerfectAccuracyRun(snapshot),
  },
  {
    id: "accuracy-sniper",
    name: "Sniper",
    description: "Hit 100% accuracy at 50+ wpm",
    icon: "fa-crosshairs",
    earned: ({ snapshot }) =>
      hasPerfectAccuracyRun(snapshot) && bestWpmAnyTime(snapshot) >= 50,
  },
  {
    id: "consistency-90",
    name: "Smooth operator",
    description: "Reach 90% consistency (english)",
    icon: "fa-ruler",
    earned: ({ snapshot }) => bestConsistency(snapshot) >= 90,
  },
  // --- volume ---
  {
    id: "tests-10",
    name: "Warmed up",
    description: "Complete 10 tests",
    icon: "fa-keyboard",
    earned: ({ snapshot }) => (snapshot.typingStats?.completedTests ?? 0) >= 10,
  },
  {
    id: "tests-50",
    name: "Dedicated",
    description: "Complete 50 tests",
    icon: "fa-keyboard",
    earned: ({ snapshot }) => (snapshot.typingStats?.completedTests ?? 0) >= 50,
  },
  {
    id: "tests-100",
    name: "Centurion",
    description: "Complete 100 tests",
    icon: "fa-medal",
    earned: ({ snapshot }) =>
      (snapshot.typingStats?.completedTests ?? 0) >= 100,
  },
  {
    id: "tests-250",
    name: "Relentless",
    description: "Complete 250 tests",
    icon: "fa-award",
    earned: ({ snapshot }) =>
      (snapshot.typingStats?.completedTests ?? 0) >= 250,
  },
  {
    id: "tests-500",
    name: "Machine",
    description: "Complete 500 tests",
    icon: "fa-gem",
    earned: ({ snapshot }) =>
      (snapshot.typingStats?.completedTests ?? 0) >= 500,
  },
  {
    id: "tests-1000",
    name: "Legend",
    description: "Complete 1000 tests",
    icon: "fa-chess-king",
    earned: ({ snapshot }) =>
      (snapshot.typingStats?.completedTests ?? 0) >= 1000,
  },
  // --- time typed ---
  {
    id: "time-1h",
    name: "Hour one",
    description: "Type for a total of 1 hour",
    icon: "fa-clock",
    earned: ({ snapshot }) => hoursTyped(snapshot) >= 1,
  },
  {
    id: "time-5h",
    name: "Clocking in",
    description: "Type for a total of 5 hours",
    icon: "fa-stopwatch",
    earned: ({ snapshot }) => hoursTyped(snapshot) >= 5,
  },
  {
    id: "time-10h",
    name: "Time well spent",
    description: "Type for a total of 10 hours",
    icon: "fa-hourglass-half",
    earned: ({ snapshot }) => hoursTyped(snapshot) >= 10,
  },
  {
    id: "time-24h",
    name: "A full day",
    description: "Type for a total of 24 hours",
    icon: "fa-hourglass-end",
    earned: ({ snapshot }) => hoursTyped(snapshot) >= 24,
  },
  // --- streak ---
  {
    id: "streak-3",
    name: "On a roll",
    description: "Practice 3 days in a row",
    icon: "fa-fire",
    earned: ({ snapshot }) => (snapshot.maxStreak ?? 0) >= 3,
  },
  {
    id: "streak-7",
    name: "Weekly habit",
    description: "Practice 7 days in a row",
    icon: "fa-fire",
    earned: ({ snapshot }) => (snapshot.maxStreak ?? 0) >= 7,
  },
  {
    id: "streak-14",
    name: "Fortnight focus",
    description: "Practice 14 days in a row",
    icon: "fa-calendar-check",
    earned: ({ snapshot }) => (snapshot.maxStreak ?? 0) >= 14,
  },
  {
    id: "streak-30",
    name: "Unstoppable",
    description: "Practice 30 days in a row",
    icon: "fa-crown",
    earned: ({ snapshot }) => (snapshot.maxStreak ?? 0) >= 30,
  },
  {
    id: "streak-60",
    name: "Iron will",
    description: "Practice 60 days in a row",
    icon: "fa-calendar",
    earned: ({ snapshot }) => (snapshot.maxStreak ?? 0) >= 60,
  },
  {
    id: "streak-100",
    name: "Centennial streak",
    description: "Practice 100 days in a row",
    icon: "fa-infinity",
    earned: ({ snapshot }) => (snapshot.maxStreak ?? 0) >= 100,
  },
  // --- lessons ---
  {
    id: "lessons-first",
    name: "First steps",
    description: "Complete your first lesson",
    icon: "fa-shoe-prints",
    earned: ({ lessonProgress }) => lessonsCompleted(lessonProgress) >= 1,
  },
  {
    id: "lessons-homerow",
    name: "Home sweet home",
    description: "Complete every home row lesson",
    icon: "fa-graduation-cap",
    earned: ({ lessonProgress }) => homeRowComplete(lessonProgress),
  },
  {
    id: "lessons-10",
    name: "Studious",
    description: "Complete 10 lessons",
    icon: "fa-graduation-cap",
    earned: ({ lessonProgress }) => lessonsCompleted(lessonProgress) >= 10,
  },
  {
    id: "lessons-25",
    name: "Scholar",
    description: "Complete 25 lessons",
    icon: "fa-book",
    earned: ({ lessonProgress }) => lessonsCompleted(lessonProgress) >= 25,
  },
  {
    id: "lessons-all",
    name: "Graduate",
    description: "Complete every single lesson",
    icon: "fa-certificate",
    earned: ({ lessonProgress }) =>
      lessonsCompleted(lessonProgress) >= TOTAL_LESSONS,
  },
  {
    id: "stars-25",
    name: "Star collector",
    description: "Earn 25 lesson stars",
    icon: "fa-star",
    earned: ({ lessonProgress }) => totalStars(lessonProgress) >= 25,
  },
  {
    id: "stars-50",
    name: "Star student",
    description: "Earn 50 lesson stars",
    icon: "fa-star",
    earned: ({ lessonProgress }) => totalStars(lessonProgress) >= 50,
  },
  {
    id: "threestar-10",
    name: "Perfectionist",
    description: "Earn 3 stars on 10 lessons",
    icon: "fa-hand-sparkles",
    earned: ({ lessonProgress }) => threeStarCount(lessonProgress) >= 10,
  },
  {
    id: "stars-all",
    name: "Full marks",
    description: "Earn 3 stars on every lesson",
    icon: "fa-gem",
    earned: ({ lessonProgress }) => totalStars(lessonProgress) >= TOTAL_STARS,
  },
  // --- level ---
  {
    id: "level-5",
    name: "Level 5",
    description: "Reach level 5",
    icon: "fa-trophy",
    earned: ({ snapshot }) => getLevelFromTotalXp(snapshot.xp ?? 0) >= 5,
  },
  {
    id: "level-10",
    name: "Level 10",
    description: "Reach level 10",
    icon: "fa-trophy",
    earned: ({ snapshot }) => getLevelFromTotalXp(snapshot.xp ?? 0) >= 10,
  },
  {
    id: "level-25",
    name: "Level 25",
    description: "Reach level 25",
    icon: "fa-trophy",
    earned: ({ snapshot }) => getLevelFromTotalXp(snapshot.xp ?? 0) >= 25,
  },
  {
    id: "level-50",
    name: "Level 50",
    description: "Reach level 50",
    icon: "fa-chess-king",
    earned: ({ snapshot }) => getLevelFromTotalXp(snapshot.xp ?? 0) >= 50,
  },
];

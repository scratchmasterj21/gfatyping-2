import type { ActivityDays } from "../../../classroom/activity";
import { tokyoDate } from "../../../classroom/activity";

/**
 * Pure helpers for the kid-friendly User stats page: achievement groups and
 * "how close am I" progress, the last 7 days of activity, and the recent
 * speed line. Kept apart from the components so they can be tested.
 */

export type StatValues = {
  /** best English 30-second test */
  bestWpm30: number;
  bestWpm60: number;
  completedTests: number;
  /** seconds */
  timeTyping: number;
  streak: number;
  level: number;
  lessonsCompleted: number;
  lessonStars: number;
  threeStarLessons: number;
  raceWins: number;
};

export const ACHIEVEMENT_GROUPS: {
  id: string;
  name: string;
  emoji: string;
  match: (achievementId: string) => boolean;
}[] = [
  {
    id: "speed",
    name: "Speed & accuracy",
    emoji: "⚡",
    match: (id) =>
      id.startsWith("speed-") ||
      id.startsWith("accuracy-") ||
      id.startsWith("consistency-"),
  },
  {
    id: "practice",
    name: "Practice",
    emoji: "📅",
    match: (id) =>
      id.startsWith("tests-") ||
      id.startsWith("time-") ||
      id.startsWith("streak-"),
  },
  {
    id: "lessons",
    name: "Lessons",
    emoji: "📚",
    match: (id) =>
      id.startsWith("lessons-") ||
      id.startsWith("stars-") ||
      id.startsWith("threestar-"),
  },
  {
    id: "races",
    name: "Races",
    emoji: "🏁",
    match: (id) => id.startsWith("races-") || id === "class-champion",
  },
  {
    id: "levels",
    name: "Levels",
    emoji: "🌟",
    match: (id) => id.startsWith("level-"),
  },
];

/** Current value and target for achievements that are a number to reach. */
export function achievementProgress(
  id: string,
  v: StatValues,
): { current: number; target: number; unit: string } | undefined {
  const n = (prefix: string): number | undefined => {
    const m = new RegExp(`^${prefix}(\\d+)h?$`).exec(id);
    return m === null ? undefined : Number(m[1]);
  };
  const pick = (
    prefix: string,
    current: number,
    unit: string,
  ): { current: number; target: number; unit: string } | undefined => {
    const target = n(prefix);
    return target === undefined ? undefined : { current, target, unit };
  };
  if (id === "speed-endurance-50") {
    return { current: Math.round(v.bestWpm60), target: 50, unit: "wpm" };
  }
  return (
    pick("speed-", Math.round(v.bestWpm30), "wpm") ??
    pick("tests-", v.completedTests, "tests") ??
    pick("time-", Math.floor(v.timeTyping / 3600), "hours") ??
    pick("streak-", v.streak, "days") ??
    pick("lessons-", v.lessonsCompleted, "lessons") ??
    pick("stars-", v.lessonStars, "stars") ??
    pick("threestar-", v.threeStarLessons, "3-star lessons") ??
    pick("races-", v.raceWins, "wins") ??
    pick("level-", v.level, "level")
  );
}

/** The closest unearned number goals, nearest first. */
export function upNext<A extends { id: string }>(
  list: A[],
  earned: (id: string) => boolean,
  v: StatValues,
  count = 3,
): { achievement: A; current: number; target: number; unit: string }[] {
  return list
    .filter((a) => !earned(a.id))
    .flatMap((a) => {
      const p = achievementProgress(a.id, v);
      return p === undefined || p.target <= 0 ? [] : [{ achievement: a, ...p }];
    })
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, count);
}

export type WeekDay = {
  date: string;
  /** "Mon" */
  label: string;
  typingMin: number;
  gameMin: number;
};

/** The last 7 Japan days, oldest first. */
export function lastSevenDays(
  activity: ActivityDays | undefined,
  now = Date.now(),
): WeekDay[] {
  const out: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const t = now - i * 86_400_000;
    const date = tokyoDate(t);
    const d = activity?.[date];
    out.push({
      date,
      label: new Date(`${date}T12:00:00+09:00`).toLocaleDateString("en-US", {
        weekday: "short",
      }),
      typingMin: Math.round(Math.max(d?.t ?? 0, d?.l ?? 0) / 60),
      gameMin: Math.round((d?.g ?? 0) / 60),
    });
  }
  return out;
}

/** Up to the last `count` results' speeds, oldest first. */
export function speedSeries(
  results: { wpm: number; timestamp: number }[],
  count = 20,
): number[] {
  return [...results]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, count)
    .reverse()
    .map((r) => Math.round(r.wpm));
}

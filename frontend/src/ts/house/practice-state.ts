import { ActivityDays, tokyoDate } from "../classroom/activity";

/**
 * How a student's garden and pets look, driven by real practice: a
 * "practice day" is a Japan date with at least one lesson passed with 2+
 * stars on that try (activityDays[date].lx, written by the API).
 */

export type PracticeMood =
  /** 3+ ⭐⭐ lessons today - pets do tricks */
  | "great"
  /** practiced today */
  | "happy"
  /** last practice 1-2 days ago */
  | "sleepy"
  /** 3+ days without practice - plants droop */
  | "droopy"
  /** no practice on record yet */
  | "new";

export type PracticeSummary = {
  mood: PracticeMood;
  /** 0 seedling - 1 sprout - 2 growing - 3 blooming */
  plantStage: 0 | 1 | 2 | 3;
  drooping: boolean;
  /** practice days in the last 14 */
  practiceDays: number;
  todayStarLessons: number;
  /** days since the last practice day (0 = today) */
  daysSince?: number;
};

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;
export const DROOP_AFTER_DAYS = 3;
const GREAT_DAY_LESSONS = 3;

function dayIndex(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function summarizePractice(input: {
  activity: ActivityDays | undefined;
  /** server stamp, kept past the 14-day activity window */
  lastStarLessonDate?: string;
  /** ⭐⭐ lessons passed today on this device not yet in `activity` */
  extraTodayLessons?: string[];
  now?: number;
}): PracticeSummary {
  const now = input.now ?? Date.now();
  const today = tokyoDate(now);
  const activity = input.activity ?? {};

  const todayIds = new Set([
    ...(activity[today]?.lx ?? []),
    ...(input.extraTodayLessons ?? []),
  ]);
  let practiceDays = todayIds.size > 0 ? 1 : 0;
  let lastDate: string | undefined = todayIds.size > 0 ? today : undefined;
  for (let i = 1; i < WINDOW_DAYS; i++) {
    const date = tokyoDate(now - i * DAY_MS);
    if ((activity[date]?.lx?.length ?? 0) > 0) {
      practiceDays++;
      lastDate ??= date;
    }
  }
  if (
    input.lastStarLessonDate !== undefined &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.lastStarLessonDate) &&
    (lastDate === undefined || input.lastStarLessonDate > lastDate)
  ) {
    lastDate = input.lastStarLessonDate;
  }

  const daysSince =
    lastDate === undefined
      ? undefined
      : Math.max(0, dayIndex(today) - dayIndex(lastDate));
  const drooping = daysSince !== undefined && daysSince >= DROOP_AFTER_DAYS;

  let mood: PracticeMood;
  if (todayIds.size >= GREAT_DAY_LESSONS) mood = "great";
  else if (daysSince === 0) mood = "happy";
  else if (daysSince === undefined) mood = "new";
  else if (drooping) mood = "droopy";
  else mood = "sleepy";

  return {
    mood,
    plantStage: Math.min(3, practiceDays) as 0 | 1 | 2 | 3,
    drooping,
    practiceDays,
    todayStarLessons: todayIds.size,
    daysSince,
  };
}

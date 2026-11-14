import { ActivityDays, summarizeDates, tokyoDate, weekDates } from "./activity";

/**
 * The teacher's "This week" screen: who practised, who hasn't, who's stuck,
 * who's doing more than last week. Built from activityDays (kept 14 days)
 * plus the progress rows' stuck lessons and last-active time. Pure.
 */

export type WeekReportInput = {
  uid: string;
  name: string;
  activity: ActivityDays;
  /** from the progress scan, when loaded */
  lastActive?: number;
  stuckLessons?: { name: string; attempts: number }[];
};

export type WeekDay = {
  date: string;
  /** "Mon".."Sun" */
  label: string;
  /** later this week */
  future: boolean;
};

export type WeekStudent = {
  uid: string;
  name: string;
  lessonsPassed: number;
  typingSec: number;
  gameSec: number;
  daysPracticed: number;
  /** practised (1+ min typing) on each day of `days` */
  practiced: boolean[];
  /** same weekdays last week; undefined when not comparable */
  prevLessons?: number;
  prevTypingSec?: number;
  lastActive?: number;
  stuckLessons: { name: string; attempts: number }[];
  improving: boolean;
};

export type WeekReport = {
  days: WeekDay[];
  students: WeekStudent[];
  practiced: WeekStudent[];
  notYet: WeekStudent[];
  stuck: WeekStudent[];
  improving: WeekStudent[];
  totals: { lessonsPassed: number; typingSec: number };
  /** same weekdays last week (this week only) */
  prevTotals?: { lessonsPassed: number; typingSec: number; practiced: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** at least this much more typing than last week to count as "doing more" */
const IMPROVE_MIN_SEC = 10 * 60;

function practisedAtAll(s: {
  typingSec: number;
  lessonsPassed: number;
}): boolean {
  return s.typingSec >= 60 || s.lessonsPassed > 0;
}

function isImproving(
  now: { lessonsPassed: number; typingSec: number },
  prev: { lessonsPassed: number; typingSec: number },
): boolean {
  if (!practisedAtAll(now)) return false;
  const moreLessons = now.lessonsPassed >= prev.lessonsPassed + 2;
  const moreTyping =
    now.typingSec >= prev.typingSec + IMPROVE_MIN_SEC &&
    now.typingSec >= prev.typingSec * 1.5;
  return moreLessons || moreTyping;
}

/** `weeksBefore` 0 = this week so far, 1 = last week (Mon-Sun). */
export function buildWeekReport(
  input: WeekReportInput[],
  options: { weeksBefore?: 0 | 1; now?: number } = {},
): WeekReport {
  const now = options.now ?? Date.now();
  const weeksBefore = options.weeksBefore ?? 0;
  const dates = weekDates(now, weeksBefore);
  // full Mon-Sun row, future days greyed out
  const monday = Date.parse(`${dates[0]}T12:00:00Z`);
  const today = tokyoDate(now);
  const days: WeekDay[] = LABELS.map((label, i) => {
    const date = new Date(monday + i * DAY_MS).toISOString().slice(0, 10);
    return { date, label, future: date > today };
  });
  // compare this week so far with the same weekdays last week
  const prevDates =
    weeksBefore === 0 ? weekDates(now, 1).slice(0, dates.length) : undefined;

  const students = input
    .map((s): WeekStudent => {
      const week = summarizeDates(s.activity, dates);
      const prev =
        prevDates === undefined
          ? undefined
          : summarizeDates(s.activity, prevDates);
      return {
        uid: s.uid,
        name: s.name,
        lessonsPassed: week.lessonsPassed,
        typingSec: week.typingSec,
        gameSec: week.gameSec,
        daysPracticed: week.daysPracticed,
        practiced: days.map(
          (d) =>
            Math.max(s.activity[d.date]?.t ?? 0, s.activity[d.date]?.l ?? 0) >=
            60,
        ),
        prevLessons: prev?.lessonsPassed,
        prevTypingSec: prev?.typingSec,
        lastActive: s.lastActive,
        stuckLessons: s.stuckLessons ?? [],
        improving: prev !== undefined && isImproving(week, prev),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const practiced = students
    .filter(practisedAtAll)
    .sort(
      (a, b) => b.lessonsPassed - a.lessonsPassed || b.typingSec - a.typingSec,
    );
  const notYet = students
    .filter((s) => !practisedAtAll(s))
    .sort((a, b) => (a.lastActive ?? 0) - (b.lastActive ?? 0));

  const sum = (key: "lessonsPassed" | "typingSec"): number =>
    students.reduce((n, s) => n + s[key], 0);
  const prevTotals =
    prevDates === undefined
      ? undefined
      : {
          lessonsPassed: students.reduce((n, s) => n + (s.prevLessons ?? 0), 0),
          typingSec: students.reduce((n, s) => n + (s.prevTypingSec ?? 0), 0),
          practiced: students.filter((s) =>
            practisedAtAll({
              lessonsPassed: s.prevLessons ?? 0,
              typingSec: s.prevTypingSec ?? 0,
            }),
          ).length,
        };

  return {
    days,
    students,
    practiced,
    notYet,
    stuck: students.filter((s) => s.stuckLessons.length > 0),
    improving: students
      .filter((s) => s.improving)
      .sort((a, b) => b.typingSec - a.typingSec),
    totals: {
      lessonsPassed: sum("lessonsPassed"),
      typingSec: sum("typingSec"),
    },
    ...(prevTotals !== undefined ? { prevTotals } : {}),
  };
}

/** "today", "yesterday", "3d ago", "never" */
export function lastSeenText(
  lastActive: number | undefined,
  now = Date.now(),
): string {
  if (lastActive === undefined || lastActive <= 0) return "never";
  const days =
    (Date.parse(`${tokyoDate(now)}T00:00:00Z`) -
      Date.parse(`${tokyoDate(lastActive)}T00:00:00Z`)) /
    DAY_MS;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

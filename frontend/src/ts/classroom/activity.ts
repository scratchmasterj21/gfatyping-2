import { collection, getDocs, query, where } from "firebase/firestore";

import { getDb } from "../firebase";

/**
 * Per-day activity counters stored on users/{uid}.activityDays (written only
 * by the API - see api/_lib/activity.ts). Keyed by Japan date (YYYY-MM-DD).
 */
export type ActivityDay = {
  /** seconds of typing tests (lessons + free practice) */
  t?: number;
  /** seconds in lessons / assignments / passages */
  l?: number;
  /** ids of lessons passed with 2+ stars on that attempt (distinct) */
  lx?: string[];
  /** seconds in free-play games */
  g?: number;
  /** free-play games opened */
  gp?: number;
};

export type ActivityDays = Record<string, ActivityDay>;

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar date in Japan - matches the server's tokyoDateString. */
export function tokyoDate(timestamp = Date.now()): string {
  return new Date(timestamp + TOKYO_OFFSET_MS).toISOString().slice(0, 10);
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

export function parseActivityDays(raw: unknown): ActivityDays {
  if (raw === null || typeof raw !== "object") return {};
  const out: ActivityDays = {};
  for (const [date, d] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (d === null || typeof d !== "object") continue;
    const day = d as Record<string, unknown>;
    out[date] = {
      t: num(day["t"]),
      l: num(day["l"]),
      g: num(day["g"]),
      gp: num(day["gp"]),
      lx: Array.isArray(day["lx"])
        ? (day["lx"] as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
    };
  }
  return out;
}

export type ActivitySummary = {
  /** typing seconds (lessons + practice) */
  typingSec: number;
  gameSec: number;
  gamesOpened: number;
  lessonsPassed: number;
};

/** Totals over the last `days` Japan days (1 = today only). */
export function summarizeActivity(
  activity: ActivityDays | undefined,
  days: number,
  now = Date.now(),
): ActivitySummary {
  const out: ActivitySummary = {
    typingSec: 0,
    gameSec: 0,
    gamesOpened: 0,
    lessonsPassed: 0,
  };
  if (activity === undefined) return out;
  for (let i = 0; i < days; i++) {
    const d = activity[tokyoDate(now - i * DAY_MS)];
    if (d === undefined) continue;
    // lessons also go through free-practice results, so t usually includes
    // l; max() keeps lessons counted when result saving was off
    out.typingSec += Math.max(d.t ?? 0, d.l ?? 0);
    out.gameSec += d.g ?? 0;
    out.gamesOpened += d.gp ?? 0;
    out.lessonsPassed += d.lx?.length ?? 0;
  }
  return out;
}

/** Japan dates from Monday of this week (or `weeksBefore` weeks back) to Sunday, capped at today. */
export function weekDates(now = Date.now(), weeksBefore = 0): string[] {
  const today = tokyoDate(now);
  const daysSinceMonday = (new Date(now + TOKYO_OFFSET_MS).getUTCDay() + 6) % 7;
  const monday = now - (daysSinceMonday + weeksBefore * 7) * DAY_MS;
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = tokyoDate(monday + i * DAY_MS);
    if (d > today) break;
    out.push(d);
  }
  return out;
}

/** Totals for the given Japan dates (see weekDates). */
export function summarizeDates(
  activity: ActivityDays | undefined,
  dates: string[],
): ActivitySummary & { daysPracticed: number } {
  const out = {
    typingSec: 0,
    gameSec: 0,
    gamesOpened: 0,
    lessonsPassed: 0,
    daysPracticed: 0,
  };
  if (activity === undefined) return out;
  for (const date of dates) {
    const d = activity[date];
    if (d === undefined) continue;
    const typing = Math.max(d.t ?? 0, d.l ?? 0);
    out.typingSec += typing;
    out.gameSec += d.g ?? 0;
    out.gamesOpened += d.gp ?? 0;
    out.lessonsPassed += d.lx?.length ?? 0;
    if (typing >= 60) out.daysPracticed++;
  }
  return out;
}

/** This week's class-goal counts for one student (see class-goals.ts). */
export function weekTotalsOf(activity: ActivityDays | undefined): {
  weekLessons: number;
  weekTypingSec: number;
} {
  const w = summarizeDates(activity, weekDates());
  return { weekLessons: w.lessonsPassed, weekTypingSec: w.typingSec };
}

/** Minimum game time over 7 days before "mostly games" is flagged. */
const FLAG_MIN_GAME_SEC = 10 * 60;

/** Flag: more game time than typing time over the last 7 days. */
export function isMostlyGames(week: ActivitySummary): boolean {
  return week.gameSec >= FLAG_MIN_GAME_SEC && week.gameSec > week.typingSec;
}

/** "1h 5m", "12m", "0m" */
export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export type StudentActivity = {
  uid: string;
  name: string;
  avatarUrl?: string;
  activity: ActivityDays;
};

/** One read per student in the class (user docs only, no lesson scans). */
export async function getClassActivity(
  classId: string,
): Promise<StudentActivity[]> {
  const snap = await getDocs(
    query(collection(getDb(), "users"), where("classId", "==", classId)),
  );
  return snap.docs
    .map((d) => {
      const data = d.data() as {
        uid?: string;
        name?: string;
        avatarUrl?: string;
        activityDays?: unknown;
      };
      return {
        uid: data.uid ?? d.id,
        name: data.name ?? "Student",
        avatarUrl: data.avatarUrl,
        activity: parseActivityDays(data.activityDays),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

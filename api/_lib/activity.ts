import admin from "firebase-admin";

import { tokyoDateString } from "./time.js";

/**
 * Per-day activity counters on users/{uid}.activityDays, for the teacher's
 * "lessons vs games" view and the earn-game-time rule. Keyed by Japan date.
 *   t  - seconds of typing tests (lessons + free practice)
 *   l  - seconds in lessons / assignments / passages
 *   lx - ids of lessons passed with 2+ stars on that attempt (distinct)
 *   g  - seconds in free-play games
 *   gp - free-play games opened
 * Mirrors frontend/src/ts/classroom/activity.ts.
 */
export type ActivityDelta = Partial<Record<"t" | "l" | "g" | "gp", number>>;

/** Days kept on the user doc. */
const KEEP_DAYS = 14;

/**
 * Fields to merge into the user doc (set(..., { merge: true })): increments
 * today's counters and drops days older than KEEP_DAYS.
 */
export function activityUpdate(
  userData: Record<string, unknown> | undefined,
  delta: ActivityDelta,
  options: { passedLessonId?: string; now?: number } = {},
): { activityDays: Record<string, unknown> } {
  const now = options.now ?? Date.now();
  const today = tokyoDateString(now);
  const oldest = tokyoDateString(now - (KEEP_DAYS - 1) * 86_400_000);
  const inc: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      inc[k] = admin.firestore.FieldValue.increment(Math.round(v));
    }
  }
  if (options.passedLessonId !== undefined) {
    // distinct lessons passed today - repeating one lesson counts once
    inc["lx"] = admin.firestore.FieldValue.arrayUnion(options.passedLessonId);
  }
  const days: Record<string, unknown> = { [today]: inc };
  const existing = userData?.["activityDays"];
  if (existing !== null && typeof existing === "object") {
    for (const date of Object.keys(existing)) {
      if (date < oldest) days[date] = admin.firestore.FieldValue.delete();
    }
  }
  return { activityDays: days };
}

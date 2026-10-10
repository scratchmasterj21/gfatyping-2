import { createSignal } from "solid-js";
import { z } from "zod";

import { getAuthenticatedUser } from "../firebase";
import { localDateString } from "../utils/date-and-time";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";

export const DAILY_GOAL_SECONDS = 10 * 60;

// Device-local on purpose: tracking typing time in Firestore would cost a
// write per test for every student on the Spark plan.
const store = new LocalStorageWithSchema({
  key: "gfaDailyGoal",
  schema: z.object({ uid: z.string(), date: z.string(), seconds: z.number() }),
  fallback: { uid: "", date: "", seconds: 0 },
});

function todaysSeconds(): number {
  const uid = getAuthenticatedUser()?.uid ?? "";
  const saved = store.get();
  return saved.uid === uid && saved.date === localDateString()
    ? saved.seconds
    : 0;
}

const [seconds, setSeconds] = createSignal(0);

/** Seconds typed today on this device (refreshes on read). */
export function getDailyGoalSeconds(): number {
  return seconds();
}

export function refreshDailyGoal(): void {
  setSeconds(todaysSeconds());
}

export function addDailyTypingSeconds(delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const next = todaysSeconds() + Math.min(delta, 15 * 60);
  store.set({
    uid: getAuthenticatedUser()?.uid ?? "",
    date: localDateString(),
    seconds: next,
  });
  setSeconds(next);
}

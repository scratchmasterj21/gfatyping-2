import { doc, getDoc, setDoc } from "firebase/firestore";

import { getDb } from "../firebase";

/**
 * What a class goal counts:
 * - stars: all lesson stars ever (never resets)
 * - weekLessons: lessons passed with 2+ stars this week (resets Monday, Japan)
 * - weekMinutes: minutes of typing this week (resets Monday, Japan)
 */
export type ClassGoalKind = "stars" | "weekLessons" | "weekMinutes";

export const CLASS_GOAL_KINDS: readonly ClassGoalKind[] = [
  "weekLessons",
  "weekMinutes",
  "stars",
];

/**
 * A teacher-set target for one class, e.g. 60 lessons this week -> "class
 * party". `stars` is the target number for every kind (old docs had no kind).
 */
export type ClassGoal = { stars: number; reward: string; kind?: ClassGoalKind };

export type ClassGoalCounts = {
  totalStars: number;
  weekLessons?: number;
  weekTypingSec?: number;
};

export function goalKind(goal: ClassGoal): ClassGoalKind {
  return goal.kind ?? "stars";
}

export function isWeeklyGoal(goal: ClassGoal): boolean {
  return goalKind(goal) !== "stars";
}

/** Progress toward the goal, in the goal's own unit. */
export function goalCurrent(goal: ClassGoal, counts: ClassGoalCounts): number {
  switch (goalKind(goal)) {
    case "weekLessons":
      return counts.weekLessons ?? 0;
    case "weekMinutes":
      return Math.floor((counts.weekTypingSec ?? 0) / 60);
    default:
      return counts.totalStars;
  }
}

/** "lessons" / "minutes" / "stars" (singular for 1). */
export function goalUnit(kind: ClassGoalKind, n = 2): string {
  const word =
    kind === "weekLessons"
      ? "lesson"
      : kind === "weekMinutes"
        ? "minute"
        : "star";
  return n === 1 ? word : `${word}s`;
}

export const GOAL_KIND_LABEL: Record<ClassGoalKind, string> = {
  weekLessons: "⭐⭐ lessons this week",
  weekMinutes: "minutes of typing this week",
  stars: "stars (all time)",
};

/** Kid-facing icon for the goal's unit. */
export const GOAL_KIND_EMOJI: Record<ClassGoalKind, string> = {
  weekLessons: "📚",
  weekMinutes: "⏱️",
  stars: "⭐",
};

export type ClassGoals = Record<string, ClassGoal>;

const MAX_REWARD_LENGTH = 60;

function goalsRef(): ReturnType<typeof doc> {
  return doc(getDb(), "schoolConfig", "classGoals");
}

function parseGoals(data: unknown): ClassGoals {
  if (data === null || typeof data !== "object") return {};
  const raw = (data as { goals?: unknown }).goals;
  if (raw === null || typeof raw !== "object") return {};
  const out: ClassGoals = {};
  for (const [classId, g] of Object.entries(raw as Record<string, unknown>)) {
    if (g === null || typeof g !== "object") continue;
    const stars = Number((g as { stars?: unknown }).stars);
    const reward = (g as { reward?: unknown }).reward;
    const kind = (g as { kind?: unknown }).kind;
    if (!Number.isFinite(stars) || stars <= 0) continue;
    out[classId] = {
      stars: Math.round(stars),
      reward:
        typeof reward === "string" ? reward.slice(0, MAX_REWARD_LENGTH) : "",
      ...(CLASS_GOAL_KINDS.includes(kind as ClassGoalKind)
        ? { kind: kind as ClassGoalKind }
        : {}),
    };
  }
  return out;
}

/** One small shared doc for every class - cache it (see callers' staleTime). */
export async function getClassGoals(): Promise<ClassGoals> {
  const snap = await getDoc(goalsRef());
  return parseGoals(snap.exists() ? snap.data() : null);
}

/** Admin only (schoolConfig is admin-write in firestore.rules). `null` clears the goal. */
export async function setClassGoal(
  classId: string,
  goal: ClassGoal | null,
): Promise<void> {
  const goals = Object.fromEntries(
    Object.entries(await getClassGoals()).filter(([id]) => id !== classId),
  );
  if (goal !== null) {
    goals[classId] = {
      stars: Math.max(1, Math.round(goal.stars)),
      reward: goal.reward.trim().slice(0, MAX_REWARD_LENGTH),
      kind: goalKind(goal),
    };
  }
  await setDoc(goalsRef(), { goals });
}

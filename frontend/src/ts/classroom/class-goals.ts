import { doc, getDoc, setDoc } from "firebase/firestore";

import { getDb } from "../firebase";

/** A teacher-set star target for one class, e.g. 500 stars -> "class party". */
export type ClassGoal = { stars: number; reward: string };

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
    if (!Number.isFinite(stars) || stars <= 0) continue;
    out[classId] = {
      stars: Math.round(stars),
      reward:
        typeof reward === "string" ? reward.slice(0, MAX_REWARD_LENGTH) : "",
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
    };
  }
  await setDoc(goalsRef(), { goals });
}

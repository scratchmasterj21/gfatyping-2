import { doc, getDoc } from "firebase/firestore";

import { callApi } from "../../api-client";
import { getDb } from "../../firebase";

/**
 * Daily class bests (one small Firestore doc per day, written by
 * api/save-game-result.ts): Ghost Hunter's Daily Haunting, Word
 * Ping-Pong's Daily Rally and Type Racer's Daily Race.
 */
export type DailyCollection = "dailyGhost" | "dailyRally" | "dailyRace";

export type DailyClassScore = { classId: string; score: number; name: string };

/** Best classes first. */
export async function getDailyClassBoard(
  collection: DailyCollection,
  day: number,
): Promise<DailyClassScore[]> {
  const snap = await getDoc(doc(getDb(), collection, String(day)));
  const classes = (snap.data()?.["classes"] ?? {}) as Record<
    string,
    { score?: unknown; name?: unknown }
  >;
  return Object.entries(classes)
    .filter(([, v]) => typeof v.score === "number")
    .map(([classId, v]) => ({
      classId,
      score: v.score as number,
      name: typeof v.name === "string" ? v.name : "",
    }))
    .sort((a, b) => b.score - a.score);
}

/** Send my score; true if it's my class's new best today. */
export async function submitDailyBest(
  collection: DailyCollection,
  day: number,
  score: number,
): Promise<boolean> {
  const res = await callApi<{ ok: boolean; best?: boolean }>(
    "/api/save-game-result",
    { [collection]: { day, score: Math.round(score) } },
  );
  return res.best === true;
}

import { doc, getDoc } from "firebase/firestore";

import { callApi } from "../../api-client";
import { currentWeekId } from "../../ape/firestore/leaderboards";
import { getDb } from "../../firebase";

/**
 * Weekly Monster Quest class times: one small doc per week
 * (weeklyQuest/{week}), written by api/save-game-result.ts.
 */

export type WeeklyClassTime = {
  classId: string;
  ms: number;
  name: string;
};

export const questWeek = (): number => currentWeekId(0);

/** Fastest classes first. */
export async function getWeeklyBoard(week: number): Promise<WeeklyClassTime[]> {
  const snap = await getDoc(doc(getDb(), "weeklyQuest", String(week)));
  const classes = (snap.data()?.["classes"] ?? {}) as Record<
    string,
    { ms?: unknown; name?: unknown }
  >;
  return Object.entries(classes)
    .filter(([, v]) => typeof v.ms === "number")
    .map(([classId, v]) => ({
      classId,
      ms: v.ms as number,
      name: typeof v.name === "string" ? v.name : "",
    }))
    .sort((a, b) => a.ms - b.ms);
}

/** Send my clear time; true if it's my class's new best. */
export async function submitWeeklyTime(
  week: number,
  ms: number,
): Promise<boolean> {
  const res = await callApi<{ ok: boolean; best?: boolean }>(
    "/api/save-game-result",
    { weeklyQuest: { week, ms: Math.round(ms) } },
  );
  return res.best === true;
}

export function formatQuestTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

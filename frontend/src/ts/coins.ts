import { CompletedEvent } from "@monkeytype/schemas/results";
import { collection, doc, getDoc, increment, setDoc } from "firebase/firestore";

import { currentWeekId } from "./ape/firestore/leaderboards";
import { getDb } from "./firebase";
import { invalidateCoinQueries } from "./queries/coins";

/** Seconds of actual typing in a completed event (afk removed, clamped >= 0). */
export function activeSeconds(ce: CompletedEvent): number {
  const t =
    ce.testDuration + (ce.incompleteTestSeconds ?? 0) - (ce.afkDuration ?? 0);
  return Math.max(0, t);
}

/** Credits coins to a user's balance. No-op for non-positive amounts. */
export async function awardCoins(uid: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const userRef = doc(collection(getDb(), "users"), uid);
  await setDoc(userRef, { coins: increment(amount) }, { merge: true });
  invalidateCoinQueries();
}

/** A counter that feeds one or more weekly quests. */
export type WeeklyQuestCounterKey = "lessonsCompleted" | "typingSeconds";

export type WeeklyQuest = {
  id: string;
  name: string;
  description: string;
  counterKey: WeeklyQuestCounterKey;
  target: number;
  coinReward: number;
  /** When set, progress renders in minutes instead of a raw count. */
  unit?: "seconds";
};

// v1 quest set - small on purpose, matching the rest of the shop's "start
// small" catalogs. Both quests are effort-based (practice volume/time)
// rather than tied to a skill ceiling - a "beat your personal best" quest
// used to live here, but became permanently unachievable for any student
// who'd already maxed the curriculum or plateaued on wpm, since there was
// nothing left to improve on. Effort-based goals stay completable every
// week regardless of skill level.
export const WEEKLY_QUESTS: WeeklyQuest[] = [
  {
    id: "lessons-3",
    name: "Lesson Streaker",
    description: "Practice 3 different lessons this week",
    counterKey: "lessonsCompleted",
    target: 3,
    coinReward: 15,
  },
  {
    id: "practice-time",
    name: "Practice Time",
    description: "Type for 15 minutes this week",
    counterKey: "typingSeconds",
    target: 15 * 60,
    coinReward: 15,
    unit: "seconds",
  },
];

export type WeeklyQuestState = {
  weekId: number;
  progress: Record<string, number>;
  claimed: string[];
};

function emptyWeeklyQuestState(): WeeklyQuestState {
  return { weekId: currentWeekId(0), progress: {}, claimed: [] };
}

/** Reads this week's quest progress for display - safe to call for any uid, defaults to empty/fresh if the stored week has rolled over. */
export async function getWeeklyQuestState(
  uid: string,
): Promise<WeeklyQuestState> {
  try {
    const snap = await getDoc(doc(collection(getDb(), "users"), uid));
    if (!snap.exists()) return emptyWeeklyQuestState();
    const data = snap.data();
    const weekId = currentWeekId(0);
    const sameWeek = data["questsWeekId"] === weekId;
    return {
      weekId,
      progress: sameWeek
        ? ((data["questProgress"] as Record<string, number> | undefined) ?? {})
        : {},
      claimed: sameWeek
        ? ((data["questsClaimed"] as string[] | undefined) ?? [])
        : [],
    };
  } catch (e) {
    console.error("Failed to get weekly quest state:", e);
    return emptyWeeklyQuestState();
  }
}

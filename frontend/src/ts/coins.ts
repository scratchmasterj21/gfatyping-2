import { CompletedEvent } from "@monkeytype/schemas/results";
import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  setDoc,
} from "firebase/firestore";

import { currentWeekId } from "./ape/firestore/leaderboards";
import { getDb } from "./firebase";
import { localDateString } from "./utils/date-and-time";

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
}

const TRY_COIN_DAILY_CAP = 5;

/**
 * Awards a flat 1-coin "repeat practice" reward for finishing a regular test,
 * capped per bucket per day - so replaying the same test config over and
 * over can't farm unlimited coins. Bucketed coarsely (e.g. "time:30" - just
 * mode + duration, ignoring punctuation/numbers/language/difficulty/funbox)
 * so switching those settings can't be used to open fresh daily allowances.
 * Runs as a transaction across the bucket doc + user doc together so a race
 * between two near-simultaneous saves (e.g. two tabs) can't over-grant.
 */
export async function awardTryCoin(
  uid: string,
  bucketId: string,
): Promise<void> {
  const bucketRef = doc(
    collection(getDb(), "users", uid, "testTryCoins"),
    bucketId,
  );
  const userRef = doc(collection(getDb(), "users"), uid);
  const today = localDateString();
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(bucketRef);
      const data = snap.exists() ? snap.data() : {};
      const count =
        (data["date"] as string | undefined) === today
          ? ((data["count"] as number | undefined) ?? 0)
          : 0;
      if (count >= TRY_COIN_DAILY_CAP) return;

      tx.set(bucketRef, { date: today, count: count + 1 }, { merge: true });
      tx.set(userRef, { coins: increment(1) }, { merge: true });
    });
  } catch (e) {
    console.error("Failed to award try coin:", e);
  }
}

/** A counter that feeds one or more weekly quests. */
export type WeeklyQuestCounterKey = "lessonsCompleted" | "newPbs";

export type WeeklyQuest = {
  id: string;
  name: string;
  description: string;
  counterKey: WeeklyQuestCounterKey;
  target: number;
  coinReward: number;
};

/** v1 quest set - small on purpose, matching the rest of the shop's "start small" catalogs. */
export const WEEKLY_QUESTS: WeeklyQuest[] = [
  {
    id: "lessons-3",
    name: "Lesson Streaker",
    description: "Finish 3 lessons this week",
    counterKey: "lessonsCompleted",
    target: 3,
    coinReward: 15,
  },
  {
    id: "new-pb",
    name: "Personal Best",
    description: "Beat a personal best this week",
    counterKey: "newPbs",
    target: 1,
    coinReward: 15,
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

/**
 * Increments a weekly-quest counter and, in the same transaction, claims and
 * pays out any quest tied to it that just reached its target for the first
 * time this week. Counters/claims lazily reset whenever the stored week
 * doesn't match the current one (same idea as the lesson repeat-coin
 * counters - no cron/migration needed). Returns any quests newly completed
 * by this call, so the caller can show a celebration.
 */
export async function bumpWeeklyQuestCounter(
  uid: string,
  counterKey: WeeklyQuestCounterKey,
): Promise<WeeklyQuest[]> {
  const userRef = doc(collection(getDb(), "users"), uid);
  const weekId = currentWeekId(0);
  const newlyCompleted: WeeklyQuest[] = [];
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists() ? snap.data() : {};
      const sameWeek = data["questsWeekId"] === weekId;
      const progress: Record<string, number> = sameWeek
        ? { ...((data["questProgress"] as Record<string, number>) ?? {}) }
        : {};
      const claimed: string[] = sameWeek
        ? [...((data["questsClaimed"] as string[]) ?? [])]
        : [];

      const newCount = (progress[counterKey] ?? 0) + 1;
      progress[counterKey] = newCount;

      let coinsToAward = 0;
      for (const quest of WEEKLY_QUESTS) {
        if (quest.counterKey !== counterKey) continue;
        if (claimed.includes(quest.id)) continue;
        if (newCount >= quest.target) {
          claimed.push(quest.id);
          coinsToAward += quest.coinReward;
          newlyCompleted.push(quest);
        }
      }

      tx.set(
        userRef,
        {
          questsWeekId: weekId,
          questProgress: progress,
          questsClaimed: claimed,
          ...(coinsToAward > 0 ? { coins: increment(coinsToAward) } : {}),
        },
        { merge: true },
      );
    });
  } catch (e) {
    console.error("Failed to update weekly quest progress:", e);
  }
  return newlyCompleted;
}

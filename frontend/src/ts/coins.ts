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

/**
 * Increments a weekly-quest counter and, in the same transaction, claims and
 * pays out any quest tied to it that just reached its target for the first
 * time this week. Counters/claims/dedupe lazily reset whenever the stored
 * week doesn't match the current one (same idea as the lesson repeat-coin
 * counters - no cron/migration needed). Returns any quests newly completed
 * by this call, so the caller can show a celebration.
 *
 * `dedupeKey`, when given, makes this a no-op if the same key was already
 * counted this week (e.g. a lesson id) - so "practice 3 different lessons"
 * can't be satisfied by replaying one lesson three times, while still
 * counting genuine repeat practice on lessons the student has already
 * mastered (unlike the old bonusDue-gated version, which became permanently
 * unachievable once every lesson was maxed out).
 */
export async function bumpWeeklyQuestCounter(
  uid: string,
  counterKey: WeeklyQuestCounterKey,
  options?: { amount?: number; dedupeKey?: string },
): Promise<WeeklyQuest[]> {
  const amount = options?.amount ?? 1;
  if (amount <= 0) return [];

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
      const dedupe: Record<string, string[]> = sameWeek
        ? { ...((data["questDedupe"] as Record<string, string[]>) ?? {}) }
        : {};

      if (options?.dedupeKey !== undefined) {
        const seen = dedupe[counterKey] ?? [];
        if (seen.includes(options.dedupeKey)) return;
        dedupe[counterKey] = [...seen, options.dedupeKey];
      }

      const newCount = (progress[counterKey] ?? 0) + amount;
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
          questDedupe: dedupe,
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

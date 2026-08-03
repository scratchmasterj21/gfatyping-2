import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { verifyStudent } from "./_lib/auth.js";

// Mirrors lessons-data.ts / lesson-progress.ts on the frontend - duplicated
// here (not imported) for the same reason as _lib/catalogs.ts: this file
// runs outside the frontend's Vite build, and these are small enough tables
// that duplicating is safer than an untested cross-package import. Keep in
// sync if the frontend versions change.
const STAR_THRESHOLDS: Record<number, [number, number]> = {
  1: [8, 15],
  2: [10, 18],
  3: [12, 22],
  4: [15, 28],
  5: [18, 35],
  6: [22, 45],
};
const PASS_ACCURACY: Record<number, number> = {
  1: 80,
  2: 82,
  3: 85,
  4: 88,
  5: 90,
  6: 90,
};
const REPEAT_DAILY_CAP = 5;

// Weekly quests - mirrors coins.ts's WEEKLY_QUESTS/bumpWeeklyQuestCounter.
// Duplicated locally for the same reason as everything else in api/.
type WeeklyQuest = {
  id: string;
  name: string;
  counterKey: string;
  target: number;
  coinReward: number;
};
const WEEKLY_QUESTS: WeeklyQuest[] = [
  {
    id: "lessons-3",
    name: "Lesson Streaker",
    counterKey: "lessonsCompleted",
    target: 3,
    coinReward: 15,
  },
  {
    id: "practice-time",
    name: "Practice Time",
    counterKey: "typingSeconds",
    target: 15 * 60,
    coinReward: 15,
  },
];

/** Monday-UTC-midnight timestamp - mirrors currentWeekId() in leaderboards.ts. */
function currentWeekId(): number {
  const d = new Date();
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0,
  );
}

type QuestState = {
  questsWeekId?: number;
  questProgress?: Record<string, number>;
  questsClaimed?: string[];
  questDedupe?: Record<string, string[]>;
};

/** Bumps a quest counter and returns coins earned plus the update to merge into the user doc write. Mutates nothing - pure. */
function bumpQuest(
  state: QuestState,
  counterKey: string,
  amount: number,
  dedupeKey?: string,
): {
  coinsToAward: number;
  newlyCompleted: { name: string; coinReward: number }[];
  update: Partial<QuestState>;
} {
  const weekId = currentWeekId();
  const sameWeek = state.questsWeekId === weekId;
  const progress = sameWeek ? { ...state.questProgress } : {};
  const claimed = sameWeek ? [...(state.questsClaimed ?? [])] : [];
  const dedupe = sameWeek ? { ...state.questDedupe } : {};

  if (dedupeKey !== undefined) {
    const seen = dedupe[counterKey] ?? [];
    if (seen.includes(dedupeKey)) {
      return {
        coinsToAward: 0,
        newlyCompleted: [],
        update: {
          questsWeekId: weekId,
          questProgress: progress,
          questsClaimed: claimed,
          questDedupe: dedupe,
        },
      };
    }
    dedupe[counterKey] = [...seen, dedupeKey];
  }

  const newCount = (progress[counterKey] ?? 0) + amount;
  progress[counterKey] = newCount;

  let coinsToAward = 0;
  const newlyCompleted: { name: string; coinReward: number }[] = [];
  for (const quest of WEEKLY_QUESTS) {
    if (quest.counterKey !== counterKey) continue;
    if (claimed.includes(quest.id)) continue;
    if (newCount >= quest.target) {
      claimed.push(quest.id);
      coinsToAward += quest.coinReward;
      newlyCompleted.push({ name: quest.name, coinReward: quest.coinReward });
    }
  }

  return {
    coinsToAward,
    newlyCompleted,
    update: {
      questsWeekId: weekId,
      questProgress: progress,
      questsClaimed: claimed,
      questDedupe: dedupe,
    },
  };
}

// Sanity bounds - not a full keystroke-replay verification, but enough to
// reject physically-implausible self-reported results (e.g. "1000 wpm, 3
// second test"), same idea as the isTestTooShort check the real Monkeytype
// backend already does for its own results collection.
const MAX_PLAUSIBLE_WPM = 200;
const MAX_TEST_DURATION_SECONDS = 600;

function starsForGrade(wpm: number, grade: number | undefined): number {
  const [two, three] =
    grade !== undefined ? (STAR_THRESHOLDS[grade] ?? [30, 45]) : [30, 45];
  if (wpm >= three) return 3;
  if (wpm >= two) return 2;
  return 1;
}

function lessonPassAccuracy(grade: number | undefined): number {
  if (grade === undefined) return 85;
  return PASS_ACCURACY[grade] ?? 85;
}

function gradeFromClassId(classId: string | undefined): number | undefined {
  if (classId === undefined) return undefined;
  const m = /^G(\d)/i.exec(classId);
  if (m === null) return undefined;
  const grade = Number(m[1]);
  return grade >= 1 && grade <= 6 ? grade : undefined;
}

function localDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Non-curriculum progress keys (assignments/word lists/passages/Japanese
// practice) auto-pass on finish instead of needing the accuracy bar -
// mirrors isCurriculumLesson()'s inverse in lessons-data.ts.
function isGatedLesson(lessonId: string): boolean {
  return (
    !lessonId.startsWith("assign:") &&
    !lessonId.startsWith("wl:") &&
    !lessonId.startsWith("passage:") &&
    !lessonId.startsWith("jp-") &&
    !lessonId.startsWith("game:")
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const auth = await verifyStudent(req);
  if (!auth.ok) {
    res.status(auth.status).json({ message: auth.message });
    return;
  }

  const body = req.body as {
    lessonId?: unknown;
    wpm?: unknown;
    acc?: unknown;
    testDuration?: unknown;
    incompleteTestSeconds?: unknown;
    afkDuration?: unknown;
  };

  const lessonId = body.lessonId;
  const wpm = Number(body.wpm);
  const acc = Number(body.acc);
  const testDuration = Number(body.testDuration);
  const incompleteTestSeconds = Number(body.incompleteTestSeconds ?? 0);
  const afkDuration = Number(body.afkDuration ?? 0);

  if (
    typeof lessonId !== "string" ||
    lessonId === "" ||
    !Number.isFinite(wpm) ||
    wpm < 0 ||
    wpm > MAX_PLAUSIBLE_WPM ||
    !Number.isFinite(acc) ||
    acc < 0 ||
    acc > 100 ||
    !Number.isFinite(testDuration) ||
    testDuration < 0 ||
    testDuration > MAX_TEST_DURATION_SECONDS
  ) {
    res.status(400).json({ ok: false, reason: "Invalid result" });
    return;
  }

  const activeSeconds = Math.max(
    0,
    testDuration + incompleteTestSeconds - afkDuration,
  );

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);
  const progressRef = userRef.collection("lessonProgress").doc(lessonId);

  try {
    const result = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const [userSnap, progressSnap] = await Promise.all([
          tx.get(userRef),
          tx.get(progressRef),
        ]);
        const userData = userSnap.exists ? userSnap.data() : undefined;
        const prev = progressSnap.exists
          ? (progressSnap.data() as {
              bestWpm?: number;
              bestAcc?: number;
              stars?: number;
              completed?: boolean;
              bonusPaid?: boolean;
              repeatCoinsDate?: string;
              repeatCoinsCount?: number;
            })
          : {};

        const grade = gradeFromClassId(userData?.["classId"] as string);
        const bestWpm = Math.max(prev.bestWpm ?? 0, wpm);
        const bestAcc = Math.max(prev.bestAcc ?? 0, acc);

        const gated = isGatedLesson(lessonId);
        const passed = !gated || acc >= lessonPassAccuracy(grade);
        const completed = prev.completed === true || passed;
        const newStars = completed ? starsForGrade(bestWpm, grade) : 0;

        const bonusDue =
          completed &&
          (prev.bonusPaid !== true || newStars > (prev.stars ?? 0));
        const completionCoins = bonusDue ? 5 + newStars * 5 : 0;

        const today = localDateString();
        const repeatCountSoFar =
          prev.repeatCoinsDate === today ? (prev.repeatCoinsCount ?? 0) : 0;
        const repeatEligible =
          completed && !bonusDue && repeatCountSoFar < REPEAT_DAILY_CAP;
        const repeatCoins = repeatEligible ? 1 : 0;
        const repeatCoinsCount = repeatEligible
          ? repeatCountSoFar + 1
          : repeatCountSoFar;

        const timeCoins = Math.floor(activeSeconds / 30);

        // Weekly quests - mirrors the two bumpWeeklyQuestCounter() calls in
        // lesson-progress.ts's recordCompletion.
        const questState: QuestState = userData ?? {};
        let questUpdate: Partial<QuestState> = {};
        let questCoins = 0;
        const newlyCompletedQuests: { name: string; coinReward: number }[] = [];
        if (completed) {
          const bump = bumpQuest(questState, "lessonsCompleted", 1, lessonId);
          questUpdate = bump.update;
          questCoins += bump.coinsToAward;
          newlyCompletedQuests.push(...bump.newlyCompleted);
          Object.assign(questState, bump.update);
        }
        {
          const bump = bumpQuest(questState, "typingSeconds", activeSeconds);
          questUpdate = bump.update;
          questCoins += bump.coinsToAward;
          newlyCompletedQuests.push(...bump.newlyCompleted);
        }

        const totalCoins =
          timeCoins + completionCoins + repeatCoins + questCoins;

        tx.set(
          progressRef,
          {
            lessonId,
            bestWpm,
            bestAcc,
            stars: newStars,
            completed,
            attempts: admin.firestore.FieldValue.increment(1),
            timeSpent: admin.firestore.FieldValue.increment(activeSeconds),
            lastAt: Date.now(),
            ...(bonusDue ? { bonusPaid: true } : {}),
            repeatCoinsDate: today,
            repeatCoinsCount,
          },
          { merge: true },
        );

        tx.set(
          userRef,
          {
            ...questUpdate,
            ...(totalCoins > 0
              ? { coins: admin.firestore.FieldValue.increment(totalCoins) }
              : {}),
          },
          { merge: true },
        );

        return {
          completed,
          coinsAwarded: totalCoins,
          stars: newStars,
          newlyCompletedQuests,
        };
      },
    );

    res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("complete-lesson failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

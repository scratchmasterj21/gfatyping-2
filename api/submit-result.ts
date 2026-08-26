import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getAdminApp } from "./_lib/admin.js";
import { verifyStudent } from "./_lib/auth.js";
import { tokyoDateString, tokyoDayId, tokyoWeekId } from "./_lib/time.js";

// Mirrors ape/firestore/scoring.ts + ape/firestore/results.ts + parts of
// ape/firestore/leaderboards.ts on the frontend - duplicated (not imported)
// for the same cross-package-import-safety reason as _lib/catalogs.ts.
// Keep in sync if those change.

const MAX_PLAUSIBLE_WPM = 250;
const MAX_TEST_DURATION_SECONDS = 3600;
const MAX_RESULT_AGE_MS = 10 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;
const WPM_MODE2_OPTIONS = ["15", "30", "60"] as const;
type WpmMode2 = (typeof WPM_MODE2_OPTIONS)[number];
const WPM_LANGUAGE = "english";
const DAY_MS = 24 * 60 * 60 * 1000;

type ResultInput = {
  mode: string;
  mode2: string | number;
  language: string;
  wpm: number;
  rawWpm: number;
  acc: number;
  consistency?: number;
  testDuration: number;
  incompleteTestSeconds?: number;
  afkDuration?: number;
  restartCount?: number;
  punctuation?: boolean;
  numbers?: boolean;
  difficulty?: string;
  lazyMode?: boolean;
  tags?: string[];
  [key: string]: unknown;
};

/**
 * The submitted body exactly as it arrives off the wire. Every field is
 * `unknown` because a client controls all of it - a request can carry
 * `"120"`, null, or an object where a number is expected. Values only become
 * a trusted `ResultInput` after the coercion and range checks in the handler,
 * which is why this type exists separately rather than casting the body
 * straight to `ResultInput`.
 */
type RawResultInput = {
  [key: string]: unknown;
};

type PersonalBest = {
  language: string;
  difficulty: string;
  lazyMode: boolean;
  punctuation: boolean;
  numbers: boolean;
  wpm: number;
  acc: number;
  raw: number;
  consistency?: number;
  timestamp: number;
};

type PersonalBests = Record<string, Record<string, PersonalBest[]>>;

function emptyPersonalBests(): PersonalBests {
  return { time: {}, words: {}, quote: {}, zen: {}, custom: {} };
}

function matchesPb(
  pb: PersonalBest,
  c: {
    punctuation: boolean;
    numbers: boolean;
    difficulty: string;
    language: string;
    lazyMode: boolean;
  },
): boolean {
  return (
    (pb.punctuation ?? false) === c.punctuation &&
    (pb.numbers ?? false) === c.numbers &&
    pb.difficulty === c.difficulty &&
    pb.language === c.language &&
    (pb.lazyMode ?? false) === c.lazyMode
  );
}

function checkAndUpdatePersonalBest(
  personalBests: PersonalBests,
  result: ResultInput,
): { isPb: boolean } {
  if (result.mode === "quote" || result.mode === "zen") return { isPb: false };

  const modeBucket = (personalBests[result.mode] ??= {});
  const key = String(result.mode2);
  const list = (modeBucket[key] ??= []);

  const criteria = {
    punctuation: result.punctuation ?? false,
    numbers: result.numbers ?? false,
    difficulty: result.difficulty ?? "normal",
    language: result.language,
    lazyMode: result.lazyMode ?? false,
  };

  const existing = list.find((pb) => matchesPb(pb, criteria));
  const isPb = existing === undefined || result.wpm > existing.wpm;
  if (!isPb) return { isPb: false };

  const entry: PersonalBest = {
    ...criteria,
    wpm: result.wpm,
    acc: result.acc,
    raw: result.rawWpm,
    ...(result.consistency !== undefined
      ? { consistency: result.consistency }
      : {}),
    timestamp: Date.now(),
  };
  if (existing === undefined) {
    list.push(entry);
  } else {
    Object.assign(existing, entry);
  }
  return { isPb: true };
}

type StreakData = {
  length: number;
  maxLength: number;
  lastResultTimestamp: number;
  hourOffset?: number;
};

function dayIndex(timestamp: number, hourOffset = 0): number {
  return Math.floor((timestamp - hourOffset * 60 * 60 * 1000) / DAY_MS);
}

function computeStreak(
  current: StreakData | undefined,
  resultTimestamp: number,
): StreakData {
  const hourOffset = current?.hourOffset;
  const prevTimestamp = current?.lastResultTimestamp ?? 0;
  const prevLength = current?.length ?? 0;
  const prevMax = current?.maxLength ?? 0;

  let length: number;
  if (prevTimestamp === 0 || prevLength === 0) {
    length = 1;
  } else {
    const diff =
      dayIndex(resultTimestamp, hourOffset) -
      dayIndex(prevTimestamp, hourOffset);
    if (diff === 0) length = prevLength;
    else if (diff === 1) length = prevLength + 1;
    else length = 1;
  }

  return {
    length,
    maxLength: Math.max(prevMax, length),
    lastResultTimestamp: resultTimestamp,
    ...(hourOffset !== undefined ? { hourOffset } : {}),
  };
}

type XpBreakdown = { base: number; fullAccuracy?: number };

function computeXp(result: ResultInput): {
  xp: number;
  breakdown: XpBreakdown;
} {
  const typedTime =
    result.testDuration +
    (result.incompleteTestSeconds ?? 0) -
    (result.afkDuration ?? 0);
  const base = Math.max(1, Math.round(Math.max(0, typedTime) * 2));
  const breakdown: XpBreakdown = { base };
  let xp = base;
  if (result.acc === 100) {
    const fullAccuracy = Math.round(base * 0.15);
    breakdown.fullAccuracy = fullAccuracy;
    xp += fullAccuracy;
  }
  return { xp, breakdown };
}

type WeeklyPeriodWpm = {
  wpm: number;
  acc: number;
  raw: number;
  consistency?: number;
  timestamp: number;
};
type WeeklyPeriodData = {
  weekId: number;
  xp: number;
  lastActivityTimestamp: number;
  wpm: Partial<Record<WpmMode2, WeeklyPeriodWpm>>;
};

function computeWeeklyPeriod(
  current: WeeklyPeriodData | undefined,
  result: ResultInput,
  xpEarned: number,
  timestamp: number,
  weekId: number,
): WeeklyPeriodData {
  const base: WeeklyPeriodData =
    current?.weekId === weekId
      ? current
      : { weekId, xp: 0, lastActivityTimestamp: 0, wpm: {} };

  const wpm = { ...base.wpm };
  const mode2 = String(result.mode2);
  if (
    result.mode === "time" &&
    result.language === WPM_LANGUAGE &&
    (WPM_MODE2_OPTIONS as readonly string[]).includes(mode2)
  ) {
    const key = mode2 as WpmMode2;
    const existing = wpm[key];
    if (existing === undefined || result.wpm > existing.wpm) {
      wpm[key] = {
        wpm: result.wpm,
        acc: result.acc,
        raw: result.rawWpm,
        ...(result.consistency !== undefined
          ? { consistency: result.consistency }
          : {}),
        timestamp,
      };
    }
  }

  return {
    weekId,
    xp: base.xp + xpEarned,
    lastActivityTimestamp: timestamp,
    wpm,
  };
}

function currentWeekId(weeksBefore: number): number {
  return tokyoWeekId(Date.now(), weeksBefore);
}

function leaderboardKey(mode: string, mode2: string, language: string): string {
  return `${mode}_${mode2}_${language}`;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

const TRY_COIN_DAILY_CAP = 5;

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
  weekId: number,
): {
  coinsToAward: number;
  newlyCompleted: { name: string; coinReward: number }[];
  update: Partial<QuestState>;
} {
  const sameWeek = state.questsWeekId === weekId;
  const progress = sameWeek ? { ...state.questProgress } : {};
  const claimed = sameWeek ? [...(state.questsClaimed ?? [])] : [];
  const dedupe = sameWeek ? { ...state.questDedupe } : {};

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

  const body = req.body as { result?: RawResultInput };
  const result = body.result;
  if (result === undefined || typeof result !== "object") {
    res.status(400).json({ ok: false, reason: "Missing result" });
    return;
  }

  const wpm = Number(result["wpm"]);
  const rawWpm = Number(result["rawWpm"]);
  const acc = Number(result["acc"]);
  const testDuration = Number(result["testDuration"]);
  const incompleteTestSeconds = Number(result["incompleteTestSeconds"] ?? 0);
  const afkDuration = Number(result["afkDuration"] ?? 0);
  const clientTimestamp = Number(result["timestamp"]);

  const mode = result["mode"];
  const language = result["language"];

  if (
    typeof mode !== "string" ||
    typeof language !== "string" ||
    !Number.isFinite(wpm) ||
    wpm < 0 ||
    wpm > MAX_PLAUSIBLE_WPM ||
    !Number.isFinite(rawWpm) ||
    rawWpm < 0 ||
    rawWpm > MAX_PLAUSIBLE_WPM ||
    !Number.isFinite(acc) ||
    acc < 0 ||
    acc > 100 ||
    !Number.isFinite(testDuration) ||
    testDuration < 1 ||
    testDuration > MAX_TEST_DURATION_SECONDS ||
    !Number.isFinite(incompleteTestSeconds) ||
    incompleteTestSeconds < 0 ||
    incompleteTestSeconds > MAX_TEST_DURATION_SECONDS ||
    testDuration + incompleteTestSeconds > MAX_TEST_DURATION_SECONDS ||
    !Number.isFinite(afkDuration) ||
    afkDuration < 0 ||
    afkDuration > testDuration + incompleteTestSeconds ||
    !Number.isFinite(clientTimestamp) ||
    !Number.isInteger(clientTimestamp) ||
    clientTimestamp < Date.now() - MAX_RESULT_AGE_MS ||
    clientTimestamp > Date.now() + MAX_FUTURE_SKEW_MS
  ) {
    res.status(400).json({ ok: false, reason: "Invalid result" });
    return;
  }
  // Everything below this point works off `normalized`, which is the only
  // value with a trustworthy type - the raw body's numeric fields have now
  // been coerced and range-checked.
  const normalized: ResultInput = {
    ...result,
    mode,
    mode2: (result["mode2"] as string | number | undefined) ?? "",
    language,
    wpm,
    rawWpm,
    acc,
    testDuration,
    incompleteTestSeconds,
    afkDuration,
  };

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);
  // CompletedEvent.timestamp is stable across retries. Using it as the id
  // makes the authoritative award transaction idempotent.
  const resultRef = userRef.collection("results").doc(String(clientTimestamp));
  const timestamp = Date.now();

  try {
    const outcome = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const [userSnap, existingResultSnap] = await Promise.all([
          tx.get(userRef),
          tx.get(resultRef),
        ]);
        if (!userSnap.exists) throw new Error("User not found");
        if (existingResultSnap.exists) {
          return {
            duplicate: true as const,
            insertedId: resultRef.id,
          };
        }
        const user = userSnap.data() ?? {};

        const personalBests =
          (user["personalBests"] as PersonalBests | undefined) ??
          emptyPersonalBests();
        const { isPb } = checkAndUpdatePersonalBest(personalBests, normalized);

        const { xp, breakdown: xpBreakdown } = computeXp(normalized);
        const newXp = ((user["xp"] as number | undefined) ?? 0) + xp;
        const streak = computeStreak(
          user["streak"] as StreakData | undefined,
          timestamp,
        );
        const weeklyPeriod = computeWeeklyPeriod(
          user["weeklyPeriod"] as WeeklyPeriodData | undefined,
          normalized,
          xp,
          timestamp,
          currentWeekId(0),
        );

        const activeSeconds = Math.max(
          0,
          testDuration + incompleteTestSeconds - afkDuration,
        );
        const timeTyping =
          ((user["timeTyping"] as number | undefined) ?? 0) + activeSeconds;
        const completedTests =
          ((user["completedTests"] as number | undefined) ?? 0) + 1;

        // Daily-capped "repeat practice" try-coin - same bucket/cap idea as
        // the old client-side awardTryCoin, now server-computed instead of
        // trusting a client-supplied bucket id.
        const bucketId = `${normalized.mode}:${normalized.mode2}`;
        const today = tokyoDateString(timestamp);
        const tryCoinSnap = await tx.get(
          userRef.collection("testTryCoins").doc(bucketId),
        );
        const tryCoinData = tryCoinSnap.exists ? tryCoinSnap.data() : {};
        const tryCoinCount =
          (tryCoinData?.["date"] as string | undefined) === today
            ? ((tryCoinData?.["count"] as number | undefined) ?? 0)
            : 0;
        const tryCoinEligible = tryCoinCount < TRY_COIN_DAILY_CAP;
        if (tryCoinEligible) {
          tx.set(
            userRef.collection("testTryCoins").doc(bucketId),
            { date: today, count: tryCoinCount + 1 },
            { merge: true },
          );
        }
        const tryCoin = tryCoinEligible ? 1 : 0;

        // Mirrors test-logic.ts's post-submit coin math (timeCoins + pbCoins)
        // plus coins.ts's bumpWeeklyQuestCounter("typingSeconds", ...).
        const timeCoins = Math.floor(activeSeconds / 30);
        const pbCoins = isPb ? Math.floor(wpm / 5) : 0;
        const quest = bumpQuest(
          user as QuestState,
          "typingSeconds",
          activeSeconds,
          currentWeekId(0),
        );
        const totalCoins = tryCoin + timeCoins + pbCoins + quest.coinsToAward;

        tx.set(
          resultRef,
          stripUndefined({
            ...normalized,
            _id: resultRef.id,
            uid: auth.uid,
            isPb: isPb || undefined,
            timestamp,
          }),
        );
        tx.set(
          userRef,
          stripUndefined({
            personalBests,
            xp: newXp,
            streak,
            timeTyping,
            completedTests,
            weeklyPeriod,
            ...quest.update,
            ...(totalCoins > 0
              ? { coins: admin.firestore.FieldValue.increment(totalCoins) }
              : {}),
          }),
          { merge: true },
        );

        return {
          duplicate: false as const,
          isPb,
          xp,
          xpBreakdown,
          streakLength: streak.length,
          activeSeconds,
          name: (user["name"] as string | undefined) ?? "",
          newlyCompletedQuests: quest.newlyCompleted,
        };
      },
    );

    if (outcome.duplicate) {
      res.status(200).json({
        ok: true,
        insertedId: outcome.insertedId,
        isPb: false,
        xp: 0,
        streak: 0,
        newlyCompletedQuests: [],
      });
      return;
    }

    // Leaderboard writes happen outside the transaction, same as the
    // client-side add() handler - best-effort, a failure here shouldn't
    // fail the whole result submission.
    const key = leaderboardKey(
      normalized.mode,
      String(normalized.mode2),
      normalized.language,
    );
    const dayId = tokyoDayId(timestamp);
    const weekId = currentWeekId(0);

    const writeIfBetter = async (
      ref: admin.firestore.DocumentReference,
    ): Promise<void> => {
      await db.runTransaction(async (tx: admin.firestore.Transaction) => {
        const snap = await tx.get(ref);
        const existingWpm = snap.exists
          ? ((snap.data()?.["wpm"] as number | undefined) ?? 0)
          : 0;
        if (wpm <= existingWpm) return;
        tx.set(
          ref,
          stripUndefined({
            uid: auth.uid,
            name: outcome.name,
            wpm,
            acc,
            raw: rawWpm,
            consistency: normalized.consistency,
            timestamp,
          }),
        );
      });
    };

    await Promise.all([
      writeIfBetter(
        db
          .collection("leaderboards")
          .doc(key)
          .collection("entries")
          .doc(auth.uid),
      ),
      writeIfBetter(
        db
          .collection("dailyLeaderboards")
          .doc(`${dayId}_${key}`)
          .collection("entries")
          .doc(auth.uid),
      ),
      (async (): Promise<void> => {
        const ref = db
          .collection("weeklyXpLeaderboards")
          .doc(String(weekId))
          .collection("entries")
          .doc(auth.uid);
        await db.runTransaction(async (tx: admin.firestore.Transaction) => {
          const snap = await tx.get(ref);
          const prev = snap.exists ? snap.data() : {};
          tx.set(
            ref,
            stripUndefined({
              uid: auth.uid,
              name: outcome.name,
              totalXp:
                ((prev?.["totalXp"] as number | undefined) ?? 0) + outcome.xp,
              timeTypedSeconds:
                ((prev?.["timeTypedSeconds"] as number | undefined) ?? 0) +
                outcome.activeSeconds,
              lastActivityTimestamp: timestamp,
            }),
            { merge: true },
          );
        });
      })(),
    ]);

    res.status(200).json({
      ok: true,
      insertedId: resultRef.id,
      isPb: outcome.isPb,
      xp: outcome.xp,
      xpBreakdown: outcome.xpBreakdown,
      streak: outcome.streakLength,
      newlyCompletedQuests: outcome.newlyCompletedQuests,
    });
  } catch (e) {
    console.error("submit-result failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

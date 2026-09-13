import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { isAdminEmail, verifyStudent } from "./_lib/auth.js";
import { tokyoDateString } from "./_lib/time.js";
import {
  typingQuestDepthPayout,
  questRewardMultiplier,
  qualifiesForFastMode,
  typingQuestPayout,
  type TypingQuestMode,
  validTypingQuestRunTiming,
  validTypingQuestClear,
} from "./_lib/typing-quest-reward.js";

const DAILY_GREETING_BONUS = 2;
const DAILY_PRACTICE_REWARD = 10;
const RECOMMENDED_GAME_IDS = new Set([
  "word-defender",
  "balloon-pop",
  "type-racer",
  "ghost-hunter",
  "fruit-ninja",
  "type-toss",
  "typing-rpg",
]);

/**
 * Standalone rewards not tied to a completed typing test: the house greeting
 * a transaction-capped recommended-game bonus, and Typing Quest clears.
 */
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
    type?: unknown;
    gameId?: unknown;
    score?: unknown;
    wave?: unknown;
    hits?: unknown;
    elapsed?: unknown;
    mistakes?: unknown;
    completedWaves?: unknown;
    runId?: unknown;
    mode?: unknown;
  };
  if (
    body.type !== "dailyGreeting" &&
    body.type !== "recommendedGame" &&
    body.type !== "typingQuest" &&
    body.type !== "typingQuestStart" &&
    body.type !== "typingQuestStatus"
  ) {
    res.status(400).json({ ok: false, reason: "Unknown reward type" });
    return;
  }
  const isRecommendedGame = body.type === "recommendedGame";
  const isTypingQuest = body.type === "typingQuest";
  const isTypingQuestStart = body.type === "typingQuestStart";
  const score = Number(body.score);
  const wave = Number(body.wave);
  const hits = Number(body.hits);
  const elapsed = Number(body.elapsed);
  const mistakes = Number(body.mistakes);
  const completedWaves = Number(body.completedWaves);
  if (
    isRecommendedGame &&
    (typeof body.gameId !== "string" ||
      !RECOMMENDED_GAME_IDS.has(body.gameId) ||
      !Number.isFinite(score) ||
      score <= 0 ||
      !Number.isFinite(wave) ||
      wave < 1)
  ) {
    res.status(400).json({ ok: false, reason: "Invalid game result" });
    return;
  }
  if (
    isTypingQuest &&
    (typeof body.runId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.runId,
      ))
  ) {
    res.status(400).json({ ok: false, reason: "Invalid quest run" });
    return;
  }

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);
  const today = tokyoDateString();

  try {
    if (
      body.type === "typingQuestStatus" ||
      (isTypingQuestStart && body.mode === "fast")
    ) {
      const profile = await userRef.get();
      let fastUnlocked =
        (Number(profile.get("typingQuestFastQualifiers")) || 0) >= 2;
      if (!fastUnlocked) {
        // Include qualifying tests saved before Fast Mode was introduced.
        const recentResults = await userRef
          .collection("results")
          .orderBy("timestamp", "desc")
          .limit(200)
          .get();
        fastUnlocked =
          recentResults.docs.filter((doc) =>
            qualifiesForFastMode(
              doc.data() as Parameters<typeof qualifiesForFastMode>[0],
            ),
          ).length >= 2;
        if (fastUnlocked) {
          await userRef.set({ typingQuestFastQualifiers: 2 }, { merge: true });
        }
      }
      if (body.type === "typingQuestStatus") {
        res.status(200).json({ fastUnlocked });
        return;
      }
      const requestedMode: TypingQuestMode =
        body.mode === "fast" ? "fast" : "normal";
      if (requestedMode === "fast" && !fastUnlocked) {
        res.status(403).json({
          ok: false,
          reason: "Fast Mode requires two 40 WPM, 95% accuracy 30-second tests",
        });
        return;
      }
    }
    if ((isTypingQuest || isTypingQuestStart) && !isAdminEmail(auth.email)) {
      const prerequisite = await userRef
        .collection("lessonProgress")
        .doc("bottom-words")
        .get();
      if (prerequisite.data()?.["completed"] !== true) {
        res.status(403).json({ ok: false, reason: "All Keys is locked" });
        return;
      }
    }
    if (isTypingQuestStart) {
      const runId = randomUUID();
      const profile = await userRef.get();
      const mode: TypingQuestMode = body.mode === "fast" ? "fast" : "normal";
      const bestWave = Math.max(
        0,
        Number(profile.get("typingQuestBestWave")) || 0,
      );
      await userRef.collection("typingQuestClaims").doc(runId).create({
        startedAt: Date.now(),
        mode,
      });
      res.status(200).json({ runId, bestWave, mode });
      return;
    }
    let claimed = false;
    let firstClear = false;
    let coinsAwarded = 0;
    let bonusRepeatClears = 0;
    let baseCoins = 0;
    let depthCoins = 0;
    let bestWave = 0;
    let invalidRun = false;
    let questMode: TypingQuestMode = "normal";
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      claimed = false;
      firstClear = false;
      coinsAwarded = 0;
      bonusRepeatClears = 0;
      baseCoins = 0;
      depthCoins = 0;
      bestWave = 0;
      invalidRun = false;
      questMode = "normal";
      const snap = await tx.get(userRef);
      const runRef = isTypingQuest
        ? userRef.collection("typingQuestClaims").doc(body.runId as string)
        : null;
      const runSnap = runRef ? await tx.get(runRef) : null;
      if (isTypingQuest) {
        if (!runSnap?.exists) {
          invalidRun = true;
          return;
        }
        if (runSnap.get("claimedAt") !== undefined) return;
        questMode = runSnap.get("mode") === "fast" ? "fast" : "normal";
        if (
          !validTypingQuestClear(
            { hits, elapsed, mistakes, score, completedWaves },
            questMode,
          )
        ) {
          invalidRun = true;
          return;
        }
        if (
          !validTypingQuestRunTiming(
            runSnap.get("startedAt") as number,
            Date.now(),
            elapsed,
          )
        ) {
          invalidRun = true;
          return;
        }
      }
      const data = snap.exists ? snap.data() : {};
      const rewardDates =
        (data?.["practiceRewardDates"] as Record<string, string> | undefined) ??
        {};
      const lastClaim = isRecommendedGame
        ? rewardDates["recommendation"]
        : (data?.["houseGreetingDate"] as string | undefined);
      if (!isTypingQuest && lastClaim === today) return;

      const questPayout = isTypingQuest
        ? typingQuestPayout(
            rewardDates,
            data?.["typingQuestBonusRepeatClears"] as number,
            today,
          )
        : { coins: 0, firstClear: false, bonusRepeatClears: 0 };
      firstClear = questPayout.firstClear;
      bonusRepeatClears = questPayout.bonusRepeatClears;
      const paidDepthToday =
        isTypingQuest && data?.["typingQuestDepthBonusDate"] === today
          ? Math.max(0, Number(data?.["typingQuestDepthBonusCoins"]) || 0)
          : 0;
      const depthUnits = isTypingQuest
        ? typingQuestDepthPayout(completedWaves, paidDepthToday)
        : 0;
      const multiplier = questRewardMultiplier(questMode);
      depthCoins = depthUnits * multiplier;
      baseCoins = questPayout.coins * multiplier;
      bestWave = isTypingQuest
        ? Math.max(Number(data?.["typingQuestBestWave"]) || 0, completedWaves)
        : 0;
      const coins = isTypingQuest
        ? baseCoins + depthCoins
        : isRecommendedGame
          ? DAILY_PRACTICE_REWARD
          : DAILY_GREETING_BONUS;
      coinsAwarded = coins;
      tx.set(
        userRef,
        {
          ...(isTypingQuest
            ? {
                practiceRewardDates: {
                  ...rewardDates,
                  typingQuestLastReward: today,
                  typingQuestBonusRepeatDate: today,
                  ...(firstClear ? { typingQuestFirstClear: today } : {}),
                },
                typingQuestBonusRepeatClears: bonusRepeatClears,
                typingQuestDepthBonusDate: today,
                typingQuestDepthBonusCoins: paidDepthToday + depthUnits,
                typingQuestBestWave: bestWave,
              }
            : isRecommendedGame
              ? {
                  practiceRewardDates: {
                    ...rewardDates,
                    recommendation: today,
                  },
                }
              : { houseGreetingDate: today }),
          coins: admin.firestore.FieldValue.increment(coins),
        },
        { merge: true },
      );
      if (runRef) {
        tx.update(runRef, {
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      claimed = true;
    });
    if (invalidRun) {
      res.status(400).json({
        claimed: false,
        coins: 0,
        reason: "Invalid quest run or elapsed time",
      });
      return;
    }
    res.status(200).json({
      claimed,
      firstClear: claimed && firstClear,
      coins: claimed ? coinsAwarded : 0,
      baseCoins: claimed ? baseCoins : 0,
      depthCoins: claimed ? depthCoins : 0,
      bestWave: claimed ? bestWave : undefined,
      bonusRepeatClears: claimed ? bonusRepeatClears : undefined,
    });
  } catch (e) {
    console.error("claim-reward failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { isAdminEmail, verifyStudent } from "./_lib/auth.js";
import { tokyoDateString } from "./_lib/time.js";
import {
  typingQuestPayout,
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
    runId?: unknown;
  };
  if (
    body.type !== "dailyGreeting" &&
    body.type !== "recommendedGame" &&
    body.type !== "typingQuest"
  ) {
    res.status(400).json({ ok: false, reason: "Unknown reward type" });
    return;
  }
  const isRecommendedGame = body.type === "recommendedGame";
  const isTypingQuest = body.type === "typingQuest";
  const score = Number(body.score);
  const wave = Number(body.wave);
  const hits = Number(body.hits);
  const elapsed = Number(body.elapsed);
  const mistakes = Number(body.mistakes);
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
    !validTypingQuestClear({ hits, elapsed, mistakes, score })
  ) {
    res.status(400).json({ ok: false, reason: "Invalid quest clear" });
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
    if (isTypingQuest && !isAdminEmail(auth.email)) {
      const prerequisite = await userRef
        .collection("lessonProgress")
        .doc("bottom-words")
        .get();
      if (prerequisite.data()?.["completed"] !== true) {
        res.status(403).json({ ok: false, reason: "All Keys is locked" });
        return;
      }
    }
    let claimed = false;
    let firstClear = false;
    let coinsAwarded = 0;
    let bonusRepeatClears = 0;
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      claimed = false;
      firstClear = false;
      coinsAwarded = 0;
      bonusRepeatClears = 0;
      const snap = await tx.get(userRef);
      const runRef = isTypingQuest
        ? userRef.collection("typingQuestClaims").doc(body.runId as string)
        : null;
      const runSnap = runRef ? await tx.get(runRef) : null;
      if (runSnap?.exists) return;
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
          )
        : { coins: 0, firstClear: false, bonusRepeatClears: 0 };
      firstClear = questPayout.firstClear;
      bonusRepeatClears = questPayout.bonusRepeatClears;
      const coins = isTypingQuest
        ? questPayout.coins
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
                  ...(firstClear ? { typingQuestFirstClear: today } : {}),
                },
                typingQuestBonusRepeatClears: bonusRepeatClears,
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
        tx.create(runRef, {
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      claimed = true;
    });
    res.status(200).json({
      claimed,
      firstClear: claimed && firstClear,
      coins: claimed ? coinsAwarded : 0,
      bonusRepeatClears: claimed ? bonusRepeatClears : undefined,
    });
  } catch (e) {
    console.error("claim-reward failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

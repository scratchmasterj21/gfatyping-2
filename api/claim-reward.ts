import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { verifyStudent } from "./_lib/auth.js";
import { tokyoDateString } from "./_lib/time.js";

const DAILY_GREETING_BONUS = 2;
const DAILY_PRACTICE_REWARD = 10;
const RECOMMENDED_GAME_IDS = new Set([
  "word-defender",
  "balloon-pop",
  "type-racer",
  "ghost-hunter",
  "fruit-ninja",
  "type-toss",
]);

/**
 * Standalone rewards not tied to a completed typing test: the house greeting
 * and a transaction-capped recommended-game completion bonus.
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
  };
  if (body.type !== "dailyGreeting" && body.type !== "recommendedGame") {
    res.status(400).json({ ok: false, reason: "Unknown reward type" });
    return;
  }
  const isRecommendedGame = body.type === "recommendedGame";
  const score = Number(body.score);
  const wave = Number(body.wave);
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

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);
  const today = tokyoDateString();

  try {
    let claimed = false;
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data() : {};
      const rewardDates =
        (data?.["practiceRewardDates"] as Record<string, string> | undefined) ??
        {};
      const lastClaim = isRecommendedGame
        ? rewardDates["recommendation"]
        : (data?.["houseGreetingDate"] as string | undefined);
      if (lastClaim === today) return;

      const coins = isRecommendedGame
        ? DAILY_PRACTICE_REWARD
        : DAILY_GREETING_BONUS;
      tx.set(
        userRef,
        {
          ...(isRecommendedGame
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
      claimed = true;
    });
    res.status(200).json({
      claimed,
      coins: claimed
        ? isRecommendedGame
          ? DAILY_PRACTICE_REWARD
          : DAILY_GREETING_BONUS
        : 0,
    });
  } catch (e) {
    console.error("claim-reward failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

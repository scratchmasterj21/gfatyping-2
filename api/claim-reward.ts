import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { verifyStudent } from "./_lib/auth.js";

const DAILY_GREETING_BONUS = 2;

function localDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Standalone reward claims not tied to a completed-test event (those go
 * through complete-lesson.ts/submit-result.ts instead, alongside the actual
 * result). Currently just the house's once-a-day avatar-greeting bonus.
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

  const body = req.body as { type?: unknown };
  if (body.type !== "dailyGreeting") {
    res.status(400).json({ ok: false, reason: "Unknown reward type" });
    return;
  }

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);
  const today = localDateString();

  try {
    let claimed = false;
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data() : {};
      const lastClaim = data?.["houseGreetingDate"] as string | undefined;
      if (lastClaim === today) return;

      tx.set(
        userRef,
        {
          houseGreetingDate: today,
          coins: admin.firestore.FieldValue.increment(DAILY_GREETING_BONUS),
        },
        { merge: true },
      );
      claimed = true;
    });
    res.status(200).json({ claimed, coins: DAILY_GREETING_BONUS });
  } catch (e) {
    console.error("claim-reward failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

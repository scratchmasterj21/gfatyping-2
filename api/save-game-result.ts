import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { activityUpdate } from "./_lib/activity.js";
import { verifyStudent } from "./_lib/auth.js";
import { tokyoDateString } from "./_lib/time.js";

// Mirrors LESSON_CHECKPOINT_COMPLETE_WAVE in lesson-checkpoints.ts.
const COMPLETE_WAVE = 3;
const GAME_IDS = new Set([
  "balloon-pop",
  "word-defender",
  "type-toss",
  "ghost-hunter",
]);
const KEY_PATTERN =
  /^game:[a-z0-9]+(?:-[a-z0-9]+)*:(balloon-pop|word-defender|type-toss|ghost-hunter)$/;
// Free-play games (Lessons page > Games) whose time is tracked for teachers.
const FREE_PLAY_IDS = new Set([
  "word-defender",
  "balloon-pop",
  "type-racer",
  "ghost-hunter",
  "fruit-ninja",
  "type-toss",
  "typing-rpg",
  "tower-climb",
  "snack-shop",
  "echo-keys",
  "word-pong",
  "gem-dig",
  "four-row",
  "word-bomb",
]);
/** One session can't count for more than this (tab left open, etc). */
const MAX_SESSION_SECONDS = 30 * 60;
const MAX_SCORE = 1_000_000;
const MAX_WAVE = 50;

/**
 * Lesson checkpoint games used to write users/{uid}/lessonProgress from the
 * browser. Those docs are admin-only now (see firestore.rules), so a finished
 * game failed with "Missing or insufficient permissions." This writes the
 * same fields through the Admin SDK. It does not pay coins; claim-reward
 * still handles that.
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

  const sessionBody = (req.body as { session?: unknown }).session;
  if (sessionBody !== undefined) {
    await saveGameSession(auth.uid, sessionBody, res);
    return;
  }

  const body = req.body as {
    key?: unknown;
    score?: unknown;
    wave?: unknown;
    cleared?: unknown;
  };
  const key = body.key;
  const score = Number(body.score);
  const wave = Number(body.wave);
  const gameId = typeof key === "string" ? key.split(":").at(-1) : undefined;
  if (
    typeof key !== "string" ||
    !KEY_PATTERN.test(key) ||
    gameId === undefined ||
    !GAME_IDS.has(gameId) ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > MAX_SCORE ||
    !Number.isFinite(wave) ||
    wave < 0 ||
    wave > MAX_WAVE ||
    (body.cleared !== undefined && typeof body.cleared !== "boolean")
  ) {
    res.status(400).json({ ok: false, reason: "Invalid game result" });
    return;
  }

  const cleared = body.cleared === true;
  const db = getAdminApp().firestore();
  const progressRef = db
    .collection("users")
    .doc(auth.uid)
    .collection("lessonProgress")
    .doc(key);

  try {
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      const snap = await tx.get(progressRef);
      const prev = snap.exists
        ? (snap.data() as {
            bestScore?: number;
            completed?: boolean;
          })
        : {};
      const completed =
        prev.completed === true || wave > COMPLETE_WAVE || cleared;
      tx.set(
        progressRef,
        {
          lessonId: key,
          bestWpm: 0,
          bestAcc: 0,
          stars: completed ? 1 : 0,
          completed,
          attempts: admin.firestore.FieldValue.increment(1),
          timeSpent: 0,
          lastAt: Date.now(),
          bestScore: Math.max(prev.bestScore ?? 0, score),
        },
        { merge: true },
      );
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("save-game-result failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

/**
 * Time spent in a free-play game, for the teacher's activity view and the
 * bonus-game-time budget. Body: { session: { gameId, seconds, opened } }.
 */
async function saveGameSession(
  uid: string,
  raw: unknown,
  res: VercelResponse,
): Promise<void> {
  const session = (raw ?? {}) as {
    gameId?: unknown;
    seconds?: unknown;
    opened?: unknown;
  };
  const seconds = Number(session.seconds);
  if (
    typeof session.gameId !== "string" ||
    !FREE_PLAY_IDS.has(session.gameId) ||
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    (session.opened !== undefined && typeof session.opened !== "boolean")
  ) {
    res.status(400).json({ ok: false, reason: "Invalid game session" });
    return;
  }
  const db = getAdminApp().firestore();
  const userRef = db.collection("users").doc(uid);
  try {
    const gameSecondsToday = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const snap = await tx.get(userRef);
        const data = snap.data();
        const add = Math.min(MAX_SESSION_SECONDS, Math.round(seconds));
        tx.set(
          userRef,
          activityUpdate(data, {
            g: add,
            gp: session.opened === true ? 1 : 0,
          }),
          { merge: true },
        );
        const days = data?.["activityDays"] as
          | Record<string, { g?: number }>
          | undefined;
        return (days?.[tokyoDateString()]?.g ?? 0) + add;
      },
    );
    res.status(200).json({ ok: true, gameSecondsToday });
  } catch (e) {
    console.error("save-game-result (session) failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

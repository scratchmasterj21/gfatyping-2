import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { activityUpdate } from "./_lib/activity.js";
import { verifyStudent } from "./_lib/auth.js";
import { tokyoDateString, tokyoDayId } from "./_lib/time.js";

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
  "karuta",
  "goldfish",
  "shiritori",
  "monster-raid",
  "rescue-ship",
  "zoo-keeper",
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
  const weeklyBody = (req.body as { weeklyQuest?: unknown }).weeklyQuest;
  if (weeklyBody !== undefined) {
    await saveWeeklyQuest(auth.uid, weeklyBody, res);
    return;
  }

  const dailyBody = (req.body as { dailyGhost?: unknown }).dailyGhost;
  if (dailyBody !== undefined) {
    await saveDailyBest(
      auth.uid,
      dailyBody,
      res,
      "dailyGhost",
      MAX_DAILY_SCORE,
    );
    return;
  }
  const rallyBody = (req.body as { dailyRally?: unknown }).dailyRally;
  if (rallyBody !== undefined) {
    await saveDailyBest(auth.uid, rallyBody, res, "dailyRally", MAX_RALLY_HITS);
    return;
  }
  for (const [key, max] of [
    ["dailyDig", MAX_DIG_SCORE],
    ["dailyToss", MAX_TOSS_SCORE],
  ] as const) {
    const daily = (req.body as Record<string, unknown>)[key];
    if (daily !== undefined) {
      await saveDailyBest(auth.uid, daily, res, key, max);
      return;
    }
  }
  const missionBody = (req.body as { dailyDefender?: unknown }).dailyDefender;
  if (missionBody !== undefined) {
    await saveDailyBest(
      auth.uid,
      missionBody,
      res,
      "dailyDefender",
      MAX_MISSION_SCORE,
    );
    return;
  }
  const raceBody = (req.body as { dailyRace?: unknown }).dailyRace;
  if (raceBody !== undefined) {
    await saveDailyBest(auth.uid, raceBody, res, "dailyRace", MAX_RACE_WPM);
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

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
/** Mirrors currentWeekId in frontend ape/firestore/leaderboards.ts. */
function weekIdAt(now: number): number {
  const shifted = new Date(now + TOKYO_OFFSET_MS);
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysSinceMonday,
    ) - TOKYO_OFFSET_MS
  );
}
/** A real quest takes minutes; anything faster is a glitch. */
const MIN_QUEST_MS = 60 * 1000;
const MAX_QUEST_MS = 2 * 60 * 60 * 1000;

/**
 * Weekly Monster Quest: keep each class's fastest clear this week in
 * weeklyQuest/{week} (one small doc, read once by the game).
 * Body: { weeklyQuest: { week, ms } }.
 */
async function saveWeeklyQuest(
  uid: string,
  raw: unknown,
  res: VercelResponse,
): Promise<void> {
  const body = (raw ?? {}) as { week?: unknown; ms?: unknown };
  const week = Number(body.week);
  const ms = Math.round(Number(body.ms));
  const now = Date.now();
  // a quest started just before Monday midnight still counts
  const validWeek =
    week === weekIdAt(now) || week === weekIdAt(now - 2 * 60 * 60 * 1000);
  if (
    !validWeek ||
    !Number.isFinite(ms) ||
    ms < MIN_QUEST_MS ||
    ms > MAX_QUEST_MS
  ) {
    res.status(400).json({ ok: false, reason: "Invalid weekly quest" });
    return;
  }
  const db = getAdminApp().firestore();
  const user = (await db.collection("users").doc(uid).get()).data() as
    | { classId?: unknown; role?: unknown; name?: unknown; graduated?: unknown }
    | undefined;
  const classId = user?.classId;
  if (
    typeof classId !== "string" ||
    classId === "" ||
    user?.role === "teacher" ||
    user?.graduated === true
  ) {
    res.status(200).json({ ok: true, counted: false });
    return;
  }
  const name =
    typeof user?.name === "string" ? user.name.slice(0, 40) : "Student";
  const ref = db.collection("weeklyQuest").doc(String(week));
  try {
    const best = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const snap = await tx.get(ref);
        const classes = (snap.data()?.["classes"] ?? {}) as Record<
          string,
          { ms?: number }
        >;
        const prev = classes[classId]?.ms;
        if (prev !== undefined && prev <= ms) return false;
        tx.set(
          ref,
          { week, classes: { [classId]: { ms, name, uid, at: now } } },
          { merge: true },
        );
        return true;
      },
    );
    res.status(200).json({ ok: true, counted: true, best });
  } catch (e) {
    console.error("save-game-result (weekly) failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

/** A 5-wave Daily Haunting can't score more than this. */
const MAX_DAILY_SCORE = 20_000;
/** Word Ping-Pong daily rally: longest rally (hits) anyone could manage. */
const MAX_RALLY_HITS = 400;
/** Gem Dig daily dig (points) and Type Toss daily toss (tickets). */
const MAX_DIG_SCORE = 2000;
const MAX_TOSS_SCORE = 5000;
/** Word Defender's 8-wave daily mission. */
const MAX_MISSION_SCORE = 30_000;
/** Type Racer daily race: words per minute. */
const MAX_RACE_WPM = 250;

/**
 * Daily class bests: Ghost Hunter's Daily Haunting (dailyGhost/{day}) and
 * Word Ping-Pong's Daily Rally (dailyRally/{day}) and Type Racer's Daily
 * Race (dailyRace/{day}). One small doc per day, read once by the game menu.
 * Body: { dailyGhost | dailyRally | dailyRace: { day, score } }.
 */
async function saveDailyBest(
  uid: string,
  raw: unknown,
  res: VercelResponse,
  collection:
    | "dailyGhost"
    | "dailyRally"
    | "dailyRace"
    | "dailyDefender"
    | "dailyDig"
    | "dailyToss",
  max: number,
): Promise<void> {
  const body = (raw ?? {}) as { day?: unknown; score?: unknown };
  const day = Number(body.day);
  const score = Math.round(Number(body.score));
  const now = Date.now();
  // a run started just before midnight still counts
  const validDay =
    day === tokyoDayId(now) || day === tokyoDayId(now - 30 * 60 * 1000);
  if (!validDay || !Number.isFinite(score) || score <= 0 || score > max) {
    res.status(400).json({ ok: false, reason: "Invalid daily score" });
    return;
  }
  const db = getAdminApp().firestore();
  const user = (await db.collection("users").doc(uid).get()).data() as
    | { classId?: unknown; role?: unknown; name?: unknown; graduated?: unknown }
    | undefined;
  const classId = user?.classId;
  if (
    typeof classId !== "string" ||
    classId === "" ||
    user?.role === "teacher" ||
    user?.graduated === true
  ) {
    res.status(200).json({ ok: true, counted: false });
    return;
  }
  const name =
    typeof user?.name === "string" ? user.name.slice(0, 40) : "Student";
  const ref = db.collection(collection).doc(String(day));
  try {
    const best = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const snap = await tx.get(ref);
        const classes = (snap.data()?.["classes"] ?? {}) as Record<
          string,
          { score?: number }
        >;
        const prev = classes[classId]?.score;
        if (prev !== undefined && prev >= score) return false;
        tx.set(
          ref,
          { day, classes: { [classId]: { score, name, uid, at: now } } },
          { merge: true },
        );
        return true;
      },
    );
    res.status(200).json({ ok: true, counted: true, best });
  } catch (e) {
    console.error("save-game-result (daily) failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

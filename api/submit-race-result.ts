import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getAdminApp } from "./_lib/admin.js";
import { verifyStudent } from "./_lib/auth.js";

// Mirrors writeFinal() in race/race-db.ts - the one race write that feeds
// rank/coins (updateRaceStats), so it's the one that needs server-side
// sanity checks. Live progress ticks (writeProgress) stay client-writable:
// low stakes, ephemeral, needed for real-time UI. Coin awarding itself
// (updateRaceStats/saveHistory) stays client-side too, since it only ever
// runs from the admin's own authenticated session when hosting a race.

const MAX_PLAUSIBLE_WPM = 250;

class SubmitError extends Error {}

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
    pin?: unknown;
    wpm?: unknown;
    acc?: unknown;
    progress?: unknown;
    wordIndex?: unknown;
  };

  const pin = body.pin;
  const wpm = Number(body.wpm);
  const acc = Number(body.acc);
  const progress = Number(body.progress);
  const wordIndex = Number(body.wordIndex);

  if (
    typeof pin !== "string" ||
    pin === "" ||
    !Number.isFinite(wpm) ||
    wpm < 0 ||
    wpm > MAX_PLAUSIBLE_WPM ||
    !Number.isFinite(acc) ||
    acc < 0 ||
    acc > 100 ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1 ||
    !Number.isFinite(wordIndex) ||
    wordIndex < 0 ||
    !Number.isInteger(wordIndex)
  ) {
    res.status(400).json({ ok: false, reason: "Invalid result" });
    return;
  }

  if (!/^\d{4,8}$/.test(pin)) {
    res.status(400).json({ ok: false, reason: "Invalid result" });
    return;
  }

  const app = getAdminApp();
  const raceRef = app.firestore().collection("races").doc(pin);
  // Live participants are in RTDB (see race-db.ts); the race control doc
  // stays in Firestore.
  const participantRef = app
    .database()
    .ref(`classRaces/${pin}/participants/${auth.uid}`);

  try {
    const [raceSnap, participantSnap] = await Promise.all([
      raceRef.get(),
      participantRef.get(),
    ]);
    if (!raceSnap.exists) throw new SubmitError("Race not found");
    if (!participantSnap.exists()) {
      throw new SubmitError("You haven't joined this race");
    }

    const race = raceSnap.data() as {
      status?: string;
      format?: string;
      tokens?: string[];
      durationSec?: number;
      runningAt?: number;
      finishedAt?: number;
    };
    const justFinished =
      race.status === "finished" &&
      Number.isFinite(race.finishedAt) &&
      Date.now() - Number(race.finishedAt) <= 15_000;
    if (race.status !== "running" && !justFinished) {
      throw new SubmitError("Race is not running");
    }

    const tokenCount = Array.isArray(race.tokens) ? race.tokens.length : 0;
    const runningAt = Number(race.runningAt);
    const elapsedMs = Date.now() - runningAt;
    const timedComplete =
      race.format === "timed" &&
      Number.isFinite(race.durationSec) &&
      elapsedMs >= Number(race.durationSec) * 1000 - 1_000;
    const textComplete = wordIndex >= tokenCount - 1;
    if (
      tokenCount === 0 ||
      progress !== 1 ||
      wordIndex > tokenCount ||
      (!timedComplete && !textComplete)
    ) {
      throw new SubmitError("Result doesn't match the race content");
    }

    if (!Number.isFinite(runningAt) || Date.now() < runningAt) {
      throw new SubmitError("Race hasn't started");
    }

    await participantRef.update({
      finished: true,
      finishedAt: Date.now(),
      finalWpm: wpm,
      finalAcc: acc,
      progress,
      wordIndex,
      lastSeen: Date.now(),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    if (e instanceof SubmitError) {
      res.status(200).json({ ok: false, reason: e.message });
      return;
    }
    console.error("submit-race-result failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

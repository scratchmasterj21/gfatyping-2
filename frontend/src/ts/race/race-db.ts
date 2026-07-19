import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { getPassage, getWordList } from "../classroom/assignments";
import { findLesson, realWords } from "../lessons/lessons-data";
import { getAuthenticatedUser, getDb } from "../firebase";
import {
  generatePin,
  Race,
  RaceFormat,
  RaceHistory,
  RaceParticipant,
  RaceStanding,
  rankParticipants,
} from "./race-types";

/** Description of what a race should be run on, resolved into tokens at create time. */
export type RaceContentSource =
  | { type: "random"; count: number }
  | { type: "custom"; text: string }
  | { type: "lesson"; lessonId: string }
  | { type: "wordlist"; wordListId: string }
  | { type: "passage"; passageId: string };

function raceDoc(pin: string): DocumentReference {
  return doc(getDb(), "races", pin);
}

function participantsCol(pin: string): CollectionReference {
  return collection(getDb(), "races", pin, "participants");
}

function historyCol(): CollectionReference {
  return collection(getDb(), "raceHistory");
}

/** Drop undefined keys so Firestore writes don't fail. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Delete every participant doc under a PIN. */
async function clearParticipants(pin: string): Promise<void> {
  const snap = await getDocs(participantsCol(pin));
  await Promise.all(snap.docs.map(async (d) => deleteDoc(d.ref)));
}

/** Split a raw passage into typing tokens (whitespace separated). */
function passageTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Resolve a content source into the exact token list every client will type,
 * plus a human-readable label for the lobby/standings.
 */
export async function resolveRaceTokens(
  source: RaceContentSource,
): Promise<{ tokens: string[]; label: string }> {
  switch (source.type) {
    case "random": {
      const tokens = await realWords("english", source.count);
      return { tokens, label: `${source.count} random words` };
    }
    case "custom": {
      return { tokens: passageTokens(source.text), label: "Custom passage" };
    }
    case "lesson": {
      const lesson = findLesson(source.lessonId);
      if (lesson === undefined) {
        throw new Error("Lesson not found");
      }
      const tokens = await lesson.generate();
      return { tokens, label: lesson.name };
    }
    case "wordlist": {
      const wl = await getWordList(source.wordListId);
      if (wl === null) {
        throw new Error("Word list not found");
      }
      return { tokens: passageTokens(wl.text), label: wl.title };
    }
    case "passage": {
      const p = await getPassage(source.passageId);
      if (p === null) {
        throw new Error("Passage not found");
      }
      return { tokens: passageTokens(p.text), label: p.title };
    }
  }
}

/**
 * Create a new race in the lobby state with a unique PIN. Returns the PIN.
 * Admin-only (enforced by Firestore rules).
 */
export async function createRace(input: {
  format: RaceFormat;
  tokens: string[];
  contentLabel: string;
  durationSec?: number;
  classId?: string;
}): Promise<string> {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Not signed in");

  let pin = generatePin();
  let reusingFinishedPin = false;
  // Avoid colliding with a race that is still live under the same PIN.
  for (let i = 0; i < 10; i++) {
    const existing = await getDoc(raceDoc(pin));
    const data = existing.data() as Race | undefined;
    if (!existing.exists()) break;
    if (data?.status === "finished") {
      reusingFinishedPin = true;
      break;
    }
    pin = generatePin();
  }

  // The old race's participants would otherwise leak into the new one under
  // the same PIN as ghost players.
  if (reusingFinishedPin) {
    await clearParticipants(pin);
  }

  const race: Race = {
    pin,
    hostUid: user.uid,
    hostName: user.displayName ?? "Teacher",
    status: "lobby",
    round: 1,
    format: input.format,
    durationSec: input.format === "timed" ? input.durationSec : undefined,
    tokens: input.tokens,
    contentLabel: input.contentLabel,
    classId: input.classId,
    createdAt: Date.now(),
  };
  await setDoc(raceDoc(pin), clean(race));
  return pin;
}

/** One-shot read of a race control doc. */
export async function getRace(pin: string): Promise<Race | null> {
  const snap = await getDoc(raceDoc(pin));
  if (!snap.exists()) return null;
  return snap.data() as Race;
}

/** Move a race into countdown: clients see startAt and launch in sync. */
export async function startRace(
  pin: string,
  countdownMs: number,
): Promise<void> {
  await setDoc(
    raceDoc(pin),
    { status: "countdown", startAt: Date.now() + countdownMs },
    { merge: true },
  );
}

/** Mark the race as actively running (typing allowed). */
export async function setRaceRunning(pin: string): Promise<void> {
  await setDoc(
    raceDoc(pin),
    { status: "running", runningAt: Date.now() },
    { merge: true },
  );
}

/** Mark the race finished so all clients show final standings. */
export async function finishRace(pin: string): Promise<void> {
  await setDoc(
    raceDoc(pin),
    { status: "finished", finishedAt: Date.now() },
    { merge: true },
  );
}

/**
 * Re-run the same race (same PIN, same students) with a fresh round and
 * optionally new content/format. Returns the race to the lobby so the host can
 * start the next round. Admin-only.
 */
export async function restartRace(
  pin: string,
  input: {
    round: number;
    format: RaceFormat;
    tokens: string[];
    contentLabel: string;
    durationSec?: number;
  },
): Promise<void> {
  await setDoc(
    raceDoc(pin),
    clean({
      status: "lobby",
      round: input.round,
      format: input.format,
      tokens: input.tokens,
      contentLabel: input.contentLabel,
      durationSec: input.format === "timed" ? input.durationSec : undefined,
    }),
    { merge: true },
  );
}

/** Student joins by creating/overwriting their own participant doc. */
export async function joinRace(
  pin: string,
  student: { name: string; avatarUrl?: string },
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Not signed in");

  const participant: RaceParticipant = {
    uid: user.uid,
    name: student.name,
    avatarUrl: student.avatarUrl,
    joinedAt: Date.now(),
    wordIndex: 0,
    progress: 0,
    finished: false,
    lastSeen: Date.now(),
  };
  await setDoc(doc(participantsCol(pin), user.uid), clean(participant));
}

/** Student resets their own participant doc for a new round (kept in the room). */
export async function resetParticipant(pin: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await setDoc(
    doc(participantsCol(pin), user.uid),
    {
      wordIndex: 0,
      progress: 0,
      finished: false,
      finishedAt: 0,
      finalWpm: 0,
      finalAcc: 0,
      lastSeen: Date.now(),
    },
    { merge: true },
  );
}

/**
 * Host-authoritative reset for every current participant when starting a new
 * round. Each student's own client also resets its own doc on round change,
 * but that only happens if the student is actually connected - this covers
 * students who disconnected or left the page, so their stale finished/wpm
 * data from the previous round doesn't bleed into the next one.
 */
export async function resetAllParticipants(
  pin: string,
  uids: string[],
): Promise<void> {
  await Promise.all(
    uids.map(async (uid) =>
      setDoc(
        doc(participantsCol(pin), uid),
        {
          wordIndex: 0,
          progress: 0,
          finished: false,
          finishedAt: 0,
          finalWpm: 0,
          finalAcc: 0,
          lastSeen: Date.now(),
        },
        { merge: true },
      ),
    ),
  );
}

/** Student leaves the lobby; removes their participant doc. */
export async function leaveRace(pin: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await deleteDoc(doc(participantsCol(pin), user.uid)).catch(() => undefined);
}

/** Throttled live progress write for the current student. */
export async function writeProgress(
  pin: string,
  data: { wordIndex: number; progress: number; liveWpm?: number },
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await setDoc(
    doc(participantsCol(pin), user.uid),
    clean({
      wordIndex: data.wordIndex,
      progress: data.progress,
      liveWpm: data.liveWpm,
      lastSeen: Date.now(),
    }),
    { merge: true },
  );
}

/** Final result write for the current student when their test completes. */
export async function writeFinal(
  pin: string,
  data: { wpm: number; acc: number; progress: number; wordIndex: number },
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await setDoc(
    doc(participantsCol(pin), user.uid),
    {
      finished: true,
      finishedAt: Date.now(),
      finalWpm: data.wpm,
      finalAcc: data.acc,
      progress: data.progress,
      wordIndex: data.wordIndex,
      lastSeen: Date.now(),
    },
    { merge: true },
  );
}

/** One-shot read of all participant docs. */
export async function getParticipants(pin: string): Promise<RaceParticipant[]> {
  const snap = await getDocs(participantsCol(pin));
  return snap.docs.map((d) => d.data() as RaceParticipant);
}

/** Subscribe to the race control doc. Returns an unsubscribe function. */
export function subscribeRace(
  pin: string,
  cb: (race: Race | null) => void,
): () => void {
  return onSnapshot(
    raceDoc(pin),
    (snap) => cb(snap.exists() ? (snap.data() as Race) : null),
    () => cb(null),
  );
}

/** Subscribe to the participant list. Returns an unsubscribe function. */
export function subscribeParticipants(
  pin: string,
  cb: (participants: RaceParticipant[]) => void,
): () => void {
  return onSnapshot(
    participantsCol(pin),
    (snap) => cb(snap.docs.map((d) => d.data() as RaceParticipant)),
    () => cb([]),
  );
}

type RaceStatsDoc = {
  raceBestWpm?: number;
  raceBestWpmAcc?: number;
  raceBestAcc?: number;
  raceBestAccWpm?: number;
  raceTotalRaces?: number;
  raceWins?: number;
};

/**
 * Denormalize each participant's race bests onto their own user doc, so the
 * classroom racewpm/raceacc leaderboards can rank from `users` directly
 * instead of scanning the entire (ever-growing) raceHistory collection.
 */
async function updateRaceStats(standings: RaceStanding[]): Promise<void> {
  await Promise.all(
    standings.map(async (s) => {
      const ref = doc(getDb(), "users", s.uid);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? (snap.data() as RaceStatsDoc) : {};

      const bestWpm =
        s.finalWpm > (prev.raceBestWpm ?? 0)
          ? { raceBestWpm: s.finalWpm, raceBestWpmAcc: s.finalAcc }
          : {};
      const bestAcc =
        s.finalAcc > (prev.raceBestAcc ?? 0)
          ? { raceBestAcc: s.finalAcc, raceBestAccWpm: s.finalWpm }
          : {};

      await setDoc(
        ref,
        {
          ...bestWpm,
          ...bestAcc,
          raceTotalRaces: increment(1),
          raceWins: increment(s.rank === 1 ? 1 : 0),
        },
        { merge: true },
      );
    }),
  );
}

/** Persist the final standings to raceHistory for later teacher review. */
export async function saveHistory(
  race: Race,
  participants: RaceParticipant[],
): Promise<void> {
  const ref = doc(historyCol());
  const record: RaceHistory = {
    id: ref.id,
    pin: race.pin,
    format: race.format,
    durationSec: race.durationSec,
    contentLabel: race.contentLabel,
    classId: race.classId,
    hostName: race.hostName,
    createdAt: race.createdAt,
    finishedAt: race.finishedAt ?? Date.now(),
    savedAt: Date.now(),
    standings: rankParticipants(participants, race.format),
  };
  await setDoc(ref, clean(record));
  await updateRaceStats(record.standings);
}

/** Delete the live race and all participant docs (post-race cleanup). */
export async function deleteRace(pin: string): Promise<void> {
  await clearParticipants(pin);
  await deleteDoc(raceDoc(pin));
}

/** List saved race history, newest first. */
export async function listHistory(): Promise<RaceHistory[]> {
  const snap = await getDocs(historyCol());
  return snap.docs
    .map((d) => ({ ...(d.data() as RaceHistory), id: d.id }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** History scoped to one class, newest first. */
export async function listHistoryForClass(
  classId: string,
): Promise<RaceHistory[]> {
  const snap = await getDocs(
    query(historyCol(), where("classId", "==", classId)),
  );
  return snap.docs
    .map((d) => ({ ...(d.data() as RaceHistory), id: d.id }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

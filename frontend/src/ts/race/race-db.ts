import {
  DatabaseReference,
  get,
  onValue,
  ref as dbRef,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import {
  collection,
  CollectionReference,
  deleteDoc,
  deleteField,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { callApi } from "../api-client";
import { getPassage, getWordList } from "../classroom/assignments";
import { findLesson, realWords } from "../lessons/lessons-data";
import {
  getAuthenticatedUser,
  getDb,
  getRealtimeDb,
  trackRealtimeListener,
} from "../firebase";
import {
  generatePin,
  isTimedFormat,
  Race,
  RaceFormat,
  RaceHistory,
  RaceParticipant,
  RaceStanding,
  rankParticipants,
  TugTeam,
  Championship,
  RaceContentSource,
} from "./race-types";
import { BlitzAnswer, blitzCoins, BlitzState } from "./blitz";
import { tugCoins, tugOutcome, TugTotals } from "./tug";
import { ChampRow, championshipCoins } from "./championship";

/** Description of what a race should be run on, resolved into tokens at create time. */
export type { RaceContentSource } from "./race-types";

function raceDoc(pin: string): DocumentReference {
  return doc(getDb(), "races", pin);
}

// Live participant progress lives in RTDB, not Firestore: every student writes
// every couple of seconds while typing, which would eat the Spark daily
// Firestore write quota with a full class.
function participantsRef(pin: string): DatabaseReference {
  return dbRef(getRealtimeDb(), `classRaces/${pin}/participants`);
}

function participantRef(pin: string, uid: string): DatabaseReference {
  return dbRef(getRealtimeDb(), `classRaces/${pin}/participants/${uid}`);
}

function readParticipants(value: unknown): RaceParticipant[] {
  if (value === null || typeof value !== "object") return [];
  return Object.values(value as Record<string, RaceParticipant>).filter(
    (p) => typeof p.uid === "string" && typeof p.name === "string",
  );
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

/** Delete every participant under a PIN. */
async function clearParticipants(pin: string): Promise<void> {
  await remove(dbRef(getRealtimeDb(), `classRaces/${pin}`));
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
  // Avoid colliding with a race that is still live under the same PIN.
  for (let i = 0; i < 10; i++) {
    const existing = await getDoc(raceDoc(pin));
    const data = existing.data() as Race | undefined;
    if (!existing.exists()) break;
    if (data?.status === "finished") break;
    pin = generatePin();
  }

  // An old race's participants (finished race reusing the PIN, or a race doc
  // removed without cleanup) would otherwise leak in as ghost players.
  await clearParticipants(pin);

  const race: Race = {
    pin,
    hostUid: user.uid,
    hostName: user.displayName ?? "Teacher",
    status: "lobby",
    round: 1,
    format: input.format,
    durationSec: isTimedFormat(input.format) ? input.durationSec : undefined,
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
  teams?: Record<string, TugTeam>,
): Promise<void> {
  await setDoc(
    raceDoc(pin),
    {
      status: "countdown",
      startAt: Date.now() + countdownMs,
      teams: teams ?? deleteField(),
    },
    { merge: true },
  );
}

// ---- Word Blitz ----

function blitzRef(pin: string, path = ""): DatabaseReference {
  return dbRef(getRealtimeDb(), `classRaces/${pin}/blitz${path}`);
}

/** Host: clear any previous game's rounds before a new one. */
export async function clearBlitz(pin: string): Promise<void> {
  await remove(blitzRef(pin));
}

/** Host: publish the current round (students only watch this node). */
export async function writeBlitzState(
  pin: string,
  state: BlitzState,
): Promise<void> {
  await set(blitzRef(pin, "/state"), {
    ...state,
    startedAt: state.phase === "live" ? serverTimestamp() : state.startedAt,
  });
}

export function subscribeBlitzState(
  pin: string,
  cb: (state: BlitzState | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(
      blitzRef(pin, "/state"),
      (snap) => cb(snap.exists() ? (snap.val() as BlitzState) : null),
      () => cb(null),
    ),
  );
}

/**
 * Student: answer the live round. The database stamps the time itself and
 * the rules only accept the current round's word, once per student.
 */
export async function submitBlitzAnswer(
  pin: string,
  round: number,
  word: string,
  name: string,
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await set(blitzRef(pin, `/answers/${round}/${user.uid}`), {
    word,
    name: name.slice(0, 80),
    at: serverTimestamp(),
  });
}

/** Host: watch one round's answers as they arrive. */
export function subscribeBlitzAnswers(
  pin: string,
  round: number,
  cb: (answers: Record<string, BlitzAnswer> | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(
      blitzRef(pin, `/answers/${round}`),
      (snap) =>
        cb(snap.exists() ? (snap.val() as Record<string, BlitzAnswer>) : null),
      () => cb(null),
    ),
  );
}

/**
 * Host: store final points on each participant (points live in wordIndex)
 * so standings, history and coins work like any other race.
 */
export async function writeBlitzScores(
  pin: string,
  points: Record<string, number>,
  uids: string[],
): Promise<void> {
  const now = Date.now();
  await Promise.all(
    uids.map(async (uid) => {
      const p = points[uid] ?? 0;
      await update(participantRef(pin, uid), {
        wordIndex: p,
        progress: 1,
        finished: p > 0,
        finishedAt: p > 0 ? now : 0,
        lastSeen: now,
      });
    }),
  );
}

function tugRef(pin: string): DatabaseReference {
  return dbRef(getRealtimeDb(), `classRaces/${pin}/tug`);
}

/**
 * Host publishes the live team totals (a tiny node) so students can see the
 * rope without each listening to every classmate's progress.
 */
export async function writeTugTotals(
  pin: string,
  totals: TugTotals,
): Promise<void> {
  await set(tugRef(pin), totals);
}

export function subscribeTugTotals(
  pin: string,
  cb: (totals: TugTotals | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(
      tugRef(pin),
      (snap) => cb(snap.exists() ? (snap.val() as TugTotals) : null),
      () => cb(null),
    ),
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
      teams: deleteField(),
      status: "lobby",
      round: input.round,
      format: input.format,
      tokens: input.tokens,
      contentLabel: input.contentLabel,
      durationSec: isTimedFormat(input.format) ? input.durationSec : undefined,
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
  await set(participantRef(pin, user.uid), clean(participant));
}

/** Student resets their own participant doc for a new round (kept in the room). */
export async function resetParticipant(pin: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await update(participantRef(pin, user.uid), {
    wordIndex: 0,
    progress: 0,
    finished: false,
    finishedAt: 0,
    finalWpm: 0,
    finalAcc: 0,
    lastSeen: Date.now(),
  });
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
      update(participantRef(pin, uid), {
        wordIndex: 0,
        progress: 0,
        finished: false,
        finishedAt: 0,
        finalWpm: 0,
        finalAcc: 0,
        lastSeen: Date.now(),
      }),
    ),
  );
}

/** Student leaves the lobby; removes their participant doc. */
export async function leaveRace(pin: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await remove(participantRef(pin, user.uid)).catch(() => undefined);
}

/** Throttled live progress write for the current student. */
export async function writeProgress(
  pin: string,
  data: { wordIndex: number; progress: number; liveWpm?: number },
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await update(
    participantRef(pin, user.uid),
    clean({
      wordIndex: data.wordIndex,
      progress: data.progress,
      liveWpm: data.liveWpm,
      lastSeen: Date.now(),
    }),
  );
}

/**
 * Final result write for the current student when their test completes -
 * sanity-checked server-side (see api/submit-race-result.ts) since this
 * feeds rank and coin payouts; a direct client write here used to let a
 * student self-report an arbitrary wpm/acc to win unfairly.
 */
export async function writeFinal(
  pin: string,
  data: { wpm: number; acc: number; progress: number; wordIndex: number },
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  try {
    await callApi("/api/submit-race-result", { pin, ...data });
  } catch (e) {
    console.error("Failed to submit race result:", e);
  }
}

/** One-shot read of all participant docs. */
export async function getParticipants(pin: string): Promise<RaceParticipant[]> {
  const snap = await get(participantsRef(pin));
  return readParticipants(snap.val());
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
  return trackRealtimeListener(
    onValue(
      participantsRef(pin),
      (snap) => cb(readParticipants(snap.val())),
      () => cb([]),
    ),
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

const RACE_PARTICIPATION_COINS = 5;
const RACE_RANK_BONUS: Record<number, number> = { 1: 20, 2: 10, 3: 5 };

/**
 * Coins a standing earns for this race: a flat participation reward for
 * anyone who actually finished the text, plus a podium bonus for the top 3.
 * Never finishing (finishedAt === 0, e.g. left early or ran out of time
 * without completing) earns nothing. Pure function of already-computed
 * standings, so the results overlay (RaceOverlay.tsx) can show the same
 * number to each student locally without waiting on the host's write.
 */
export function raceCoinsEarned(s: RaceStanding): number {
  if (s.finishedAt <= 0) return 0;
  return RACE_PARTICIPATION_COINS + (RACE_RANK_BONUS[s.rank] ?? 0);
}

/** Copy each player's Tug of War team onto their standing. */
export function withTeams(
  standings: RaceStanding[],
  teams: Record<string, TugTeam> | undefined,
): RaceStanding[] {
  if (teams === undefined) return standings;
  return standings.map((s) => {
    const team = teams[s.uid];
    return team === undefined ? s : { ...s, team };
  });
}

/** Final team totals from standings (words each player pulled). */
export function standingTotals(standings: RaceStanding[]): TugTotals {
  const totals: TugTotals = { red: 0, blue: 0 };
  for (const s of standings) {
    if (s.team !== undefined) totals[s.team] += s.words ?? 0;
  }
  return totals;
}

/**
 * Coins for a standing in any race format. Tug of War pays its own (higher)
 * rates: participation + winning team + MVP; see race/tug.ts.
 */
export function standingCoins(
  s: RaceStanding,
  format: RaceFormat | undefined,
  standings: RaceStanding[],
): number {
  if (format === "blitz") return blitzCoins(s);
  if (format !== "tug") return raceCoinsEarned(s);
  const mvpWords = Math.max(0, ...standings.map((x) => x.words ?? 0));
  return tugCoins(s, tugOutcome(standingTotals(standings)), mvpWords);
}

/**
 * Denormalize each participant's race bests onto their own user doc, so the
 * classroom racewpm/raceacc leaderboards can rank from `users` directly
 * instead of scanning the entire (ever-growing) raceHistory collection. Also
 * awards race-completion coins (see raceCoinsEarned) in the same write.
 */
async function updateRaceStats(
  standings: RaceStanding[],
  format: RaceFormat,
  /** championship rounds: bests only - prizes come when the champion is crowned */
  rewards = true,
): Promise<void> {
  const outcome =
    format === "tug" ? tugOutcome(standingTotals(standings)) : null;
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
      const coinsEarned = rewards ? standingCoins(s, format, standings) : 0;
      const won =
        rewards && (outcome === null ? s.rank === 1 : outcome === s.team);

      await setDoc(
        ref,
        {
          ...bestWpm,
          ...bestAcc,
          raceTotalRaces: increment(1),
          raceWins: increment(won ? 1 : 0),
          ...(coinsEarned > 0 ? { coins: increment(coinsEarned) } : {}),
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
    standings: withTeams(
      rankParticipants(participants, race.format),
      race.teams,
    ),
  };
  await setDoc(ref, clean(record));
  await updateRaceStats(
    record.standings,
    race.format,
    race.championship === undefined,
  );
}

// ---- Class Championship ----

/** Deep copy without undefined fields (Firestore rejects them). */
function dropUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v: unknown) => dropUndefined(v)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = dropUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** Host: replace the race's championship state (rounds + points). */
export async function setChampionship(
  pin: string,
  championship: Championship,
): Promise<void> {
  await updateDoc(raceDoc(pin), {
    championship: dropUndefined(championship),
  });
}

/** A crowned Class Champion (hall of champions). */
export type ChampionRecord = {
  id: string;
  classId: string;
  uid: string;
  name: string;
  avatarUrl?: string;
  points: number;
  wins: number;
  players: number;
  crownedAt: number;
  /** 1st, 2nd, 3rd (wins = rounds won; missing on older records) */
  podium: { uid: string; name: string; points: number; wins?: number }[];
  /** podium uids, so a student can find their own podium finishes */
  podiumUids?: string[];
  /** rounds in the championship (missing on older records) */
  rounds?: number;
};

function championsCol(): CollectionReference {
  return collection(getDb(), "champions");
}

/**
 * Host: pay the championship prizes and record the champion. Coins for the
 * podium (and a few for everyone who scored); the champion's championWins
 * unlocks the crown, title and trophy. Admin-only (firestore.rules).
 */
export async function crownChampion(
  classId: string,
  ranked: ChampRow[],
  rounds?: number,
): Promise<ChampionRecord | null> {
  const champion = ranked[0];
  if (champion === undefined || champion.points === 0) return null;
  const crownedAt = Date.now();
  await Promise.all(
    ranked.map(async (row) => {
      const coins = championshipCoins(row);
      const isChampion = row.uid === champion.uid;
      if (coins === 0 && !isChampion) return;
      await setDoc(
        doc(getDb(), "users", row.uid),
        {
          ...(coins > 0 ? { coins: increment(coins) } : {}),
          ...(isChampion
            ? { championWins: increment(1), lastChampionAt: crownedAt }
            : {}),
        },
        { merge: true },
      );
    }),
  );
  const ref = doc(championsCol());
  const record: ChampionRecord = {
    id: ref.id,
    classId,
    uid: champion.uid,
    name: champion.name,
    ...(champion.avatarUrl !== undefined
      ? { avatarUrl: champion.avatarUrl }
      : {}),
    points: champion.points,
    wins: champion.wins,
    players: ranked.filter((r) => r.points > 0).length,
    crownedAt,
    podium: ranked
      .filter((r) => r.points > 0)
      .slice(0, 3)
      .map((r) => ({
        uid: r.uid,
        name: r.name,
        points: r.points,
        wins: r.wins,
      })),
    podiumUids: ranked
      .filter((r) => r.points > 0)
      .slice(0, 3)
      .map((r) => r.uid),
    ...(rounds !== undefined ? { rounds } : {}),
  };
  await setDoc(ref, record);
  return record;
}

/** Past champions of a class, newest first (one small query, no index). */
export async function listChampions(
  classId: string,
): Promise<ChampionRecord[]> {
  const snap = await getDocs(
    query(championsCol(), where("classId", "==", classId)),
  );
  return snap.docs
    .map((d) => d.data() as ChampionRecord)
    .sort((a, b) => b.crownedAt - a.crownedAt);
}

export async function getChampionRecord(
  id: string,
): Promise<ChampionRecord | null> {
  const snap = await getDoc(doc(championsCol(), id));
  return snap.exists() ? (snap.data() as ChampionRecord) : null;
}

/** Championships where a student finished 1st, 2nd or 3rd, newest first. */
export async function listPodiumFinishesFor(
  uid: string,
): Promise<ChampionRecord[]> {
  const snap = await getDocs(
    query(championsCol(), where("podiumUids", "array-contains", uid)),
  );
  return snap.docs
    .map((d) => d.data() as ChampionRecord)
    .sort((a, b) => b.crownedAt - a.crownedAt);
}

/** 1, 2 or 3 for a student on a championship's podium (0 = not on it). */
export function podiumPlace(record: ChampionRecord, uid: string): number {
  const i = record.podium.findIndex((p) => p.uid === uid);
  return i < 0 ? 0 : i + 1;
}

/** Every championship a student has won (any class, any year), newest first. */
export async function listChampionWinsFor(
  uid: string,
): Promise<ChampionRecord[]> {
  const snap = await getDocs(query(championsCol(), where("uid", "==", uid)));
  return snap.docs
    .map((d) => d.data() as ChampionRecord)
    .sort((a, b) => b.crownedAt - a.crownedAt);
}

/** Delete the live race and all participant docs (post-race cleanup). */
export async function deleteRace(pin: string): Promise<void> {
  await clearParticipants(pin);
  await deleteDoc(raceDoc(pin));
}

/** How many past races the class dashboard loads. */
export const RACE_HISTORY_LIMIT = 50;

/**
 * History scoped to one class, newest first - only the latest
 * RACE_HISTORY_LIMIT, so the read cost stays flat as races pile up. Needs the
 * (classId, savedAt desc) index in firestore.indexes.json; until that's
 * deployed, falls back to reading the class's whole history.
 */
export async function listHistoryForClass(
  classId: string,
): Promise<RaceHistory[]> {
  const toHistory = (
    docs: { id: string; data: () => unknown }[],
  ): RaceHistory[] =>
    docs
      .map((d) => ({ ...(d.data() as RaceHistory), id: d.id }))
      .sort((a, b) => b.savedAt - a.savedAt);
  try {
    const snap = await getDocs(
      query(
        historyCol(),
        where("classId", "==", classId),
        orderBy("savedAt", "desc"),
        limit(RACE_HISTORY_LIMIT),
      ),
    );
    return toHistory(snap.docs);
  } catch (e) {
    if ((e as { code?: string }).code !== "failed-precondition") throw e;
    const snap = await getDocs(
      query(historyCol(), where("classId", "==", classId)),
    );
    return toHistory(snap.docs);
  }
}

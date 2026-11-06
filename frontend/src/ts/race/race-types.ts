/**
 * Shared types for the live class race feature. A race is a short, teacher-run
 * multiplayer typing event built entirely on Firestore real-time listeners.
 *
 * Documents:
 *  - races/{pin}                     the live race control doc (pin = doc id)
 *  - RTDB classRaces/{pin}/participants/{uid}  one node per student, live progress
 *  - raceHistory/{autoId}            an immutable snapshot saved when finished
 */

/**
 * First-to-finish, accuracy race (full text, ranked by accuracy), timed sprint,
 * Tug of War (timed, two teams pulling with every word typed), or Word Blitz
 * (quiz-show rounds: fastest to type the shown word scores most).
 */
export type RaceFormat = "finish" | "timed" | "accuracy" | "tug" | "blitz";

/** Tug of War team. */
export type TugTeam = "red" | "blue";

/** Formats that run on a clock (durationSec) instead of a full text. */
export function isTimedFormat(format: RaceFormat | undefined): boolean {
  return format === "timed" || format === "tug";
}

/**
 * Lifecycle of a race:
 *  - lobby: students join and wait
 *  - countdown: teacher started; clients show a synced 3-2-1
 *  - running: everyone is typing
 *  - finished: standings are final
 */
export type RaceStatus = "lobby" | "countdown" | "running" | "finished";

export type Race = {
  pin: string;
  hostUid: string;
  hostName: string;
  status: RaceStatus;
  format: RaceFormat;
  /** increments each time the teacher re-runs with the same PIN (starts at 1) */
  round: number;
  /** seconds, only present for the "timed" format */
  durationSec?: number;
  /** the exact words every client types, snapshotted at create time */
  tokens: string[];
  /** human-readable description of the content, e.g. "Animals word list" */
  contentLabel: string;
  /** class the race targets, if any (purely informational) */
  classId?: string;
  createdAt: number;
  /** Tug of War only: each participant's team, set when the host starts */
  teams?: Record<string, TugTeam>;
  /** epoch ms the race is scheduled to start; set when status -> countdown */
  startAt?: number;
  /** epoch ms when status actually became "running"; used for timed countdown */
  runningAt?: number;
  finishedAt?: number;
  /** Class Championship: rounds + running points (see championship.ts) */
  championship?: Championship;
};

export type RaceParticipant = {
  uid: string;
  name: string;
  avatarUrl?: string;
  joinedAt: number;
  /** index of the word currently being typed */
  wordIndex: number;
  /** 0..1 fraction of the text completed */
  progress: number;
  /** rolling WPM estimate written with each progress update */
  liveWpm?: number;
  finished: boolean;
  finishedAt?: number;
  finalWpm?: number;
  finalAcc?: number;
  /** Updated with progress writes (RTDB) while running; used to detect disconnects. */
  lastSeen?: number;
};

export type RaceStanding = {
  uid: string;
  name: string;
  avatarUrl?: string;
  finalWpm: number;
  finalAcc: number;
  /** 0 if the student never finished the text */
  finishedAt: number;
  progress: number;
  rank: number;
  /** words typed (Tug of War pulls) */
  words?: number;
  /** Tug of War team */
  team?: TugTeam;
};

export type RaceHistory = {
  id: string;
  pin: string;
  format: RaceFormat;
  durationSec?: number;
  contentLabel: string;
  classId?: string;
  hostName: string;
  createdAt: number;
  finishedAt: number;
  savedAt: number;
  standings: RaceStanding[];
};

/** A fresh six-digit join PIN. Uniqueness is checked against live races. */
export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Rank participants for final standings.
 * - "finish": earliest to complete wins; progress then accuracy break ties.
 * - "accuracy": highest accuracy wins; WPM then finish time break ties.
 * - "timed": highest WPM wins; accuracy breaks ties.
 */
export function rankParticipants(
  participants: RaceParticipant[],
  format: RaceFormat,
): RaceStanding[] {
  const sorted = [...participants].sort((a, b) => {
    if (format === "accuracy") {
      if ((b.finalAcc ?? 0) !== (a.finalAcc ?? 0)) {
        return (b.finalAcc ?? 0) - (a.finalAcc ?? 0);
      }
      if ((b.finalWpm ?? 0) !== (a.finalWpm ?? 0)) {
        return (b.finalWpm ?? 0) - (a.finalWpm ?? 0);
      }
      return (a.finishedAt ?? 0) - (b.finishedAt ?? 0);
    }
    if (format === "finish") {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) {
        return (a.finishedAt ?? 0) - (b.finishedAt ?? 0);
      }
      if (b.progress !== a.progress) return b.progress - a.progress;
      return (b.finalAcc ?? 0) - (a.finalAcc ?? 0);
    }
    // tug: most words pulled; blitz: most points (both kept in wordIndex)
    if (format === "tug" || format === "blitz") {
      if (b.wordIndex !== a.wordIndex) return b.wordIndex - a.wordIndex;
      return (b.finalAcc ?? 0) - (a.finalAcc ?? 0);
    }
    // timed: rank by wpm, then accuracy
    if ((b.finalWpm ?? 0) !== (a.finalWpm ?? 0)) {
      return (b.finalWpm ?? 0) - (a.finalWpm ?? 0);
    }
    return (b.finalAcc ?? 0) - (a.finalAcc ?? 0);
  });

  return sorted.map((p, i) => ({
    uid: p.uid,
    name: p.name,
    avatarUrl: p.avatarUrl,
    finalWpm: p.finalWpm ?? 0,
    finalAcc: p.finalAcc ?? 0,
    finishedAt: p.finishedAt ?? 0,
    progress: p.progress,
    rank: i + 1,
    words: p.wordIndex,
  }));
}

/** What a race/round types (resolved to tokens by race-db). */
export type RaceContentSource =
  | { type: "random"; count: number }
  | { type: "custom"; text: string }
  | { type: "lesson"; lessonId: string }
  | { type: "wordlist"; wordListId: string }
  | { type: "passage"; passageId: string };

// ---- Class Championship (logic in championship.ts) ----

export type ChampRoundKind = "speed" | "accuracy" | "blitz" | "final";

export type ChampRoundPlan = {
  kind: ChampRoundKind;
  source: RaceContentSource;
  /** use only this many words (0 / missing = all) - see pickRoundWords */
  limit?: number;
  /** speed round only: 30 or 60 */
  durationSec?: number;
};

export type ChampScore = {
  name: string;
  avatarUrl?: string;
  points: number;
  /** rounds won (1st place) */
  wins: number;
  /** place in each scored round (0 = didn't take part) */
  places: number[];
};

export type Championship = {
  classId: string;
  rounds: ChampRoundPlan[];
  /** index of the round being played / last played */
  current: number;
  /** rounds already added to `scores` (keeps scoring idempotent) */
  scoredRounds: number;
  scores: Record<string, ChampScore>;
  /** set once the champion is crowned and prizes are paid */
  crowned?: boolean;
};

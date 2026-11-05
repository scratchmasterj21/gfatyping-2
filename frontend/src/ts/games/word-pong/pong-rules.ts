import type { DifficultyOption } from "../components/DifficultySegmented";

export type Side = "left" | "right";

export type PongDifficulty = DifficultyOption & {
  /** Time to type the first word of a rally, ms. */
  baseMs: number;
  /** Fastest the ball ever gets, ms. */
  minMs: number;
  /** How much faster each hit in a rally makes the ball, ms. */
  stepMs: number;
  /** Tappy's chance to return a short word (solo). */
  botAccuracy: number;
  /** Tappy's "typing" time per letter (solo), ms. */
  botCharMs: number;
};

export const PONG_DIFFICULTIES: PongDifficulty[] = [
  {
    label: "Easy",
    hint: "slow ball",
    baseMs: 8000,
    minMs: 4000,
    stepMs: 400,
    botAccuracy: 0.6,
    botCharMs: 420,
  },
  {
    label: "Medium",
    baseMs: 6500,
    minMs: 3200,
    stepMs: 400,
    botAccuracy: 0.72,
    botCharMs: 330,
  },
  {
    label: "Hard",
    hint: "fast ball",
    baseMs: 5000,
    minMs: 2500,
    stepMs: 350,
    botAccuracy: 0.84,
    botCharMs: 250,
  },
];

/** First to this many points wins. */
export const WIN_POINTS = 7;

export type PongState = {
  score: Record<Side, number>;
  /** hits in the current rally (the ball speeds up with each) */
  hits: number;
  /** side that must type the word to return the ball */
  toSide: Side;
  /** increases with every ball sent - keeps multiplayer updates in order */
  seq: number;
  word: string;
  over: boolean;
  /** side that won the last point, for the banner */
  lastPoint?: Side;
};

export const otherSide = (s: Side): Side => (s === "left" ? "right" : "left");

export function initialPong(
  firstWord: string,
  toSide: Side = "left",
): PongState {
  return {
    score: { left: 0, right: 0 },
    hits: 0,
    toSide,
    seq: 1,
    word: firstWord,
    over: false,
  };
}

/** Ball travel time for this many hits into a rally. */
export function speedFor(d: PongDifficulty, hits: number): number {
  return Math.max(d.minMs, d.baseMs - hits * d.stepMs);
}

/**
 * The next word: rallies start short and grow (3 letters, then longer every
 * two hits, up to 8). `seq` makes the pick deterministic.
 */
export function wordForRally(
  pool: string[],
  hits: number,
  seq: number,
): string {
  const clean = pool.filter((w) => w.length > 0 && !w.includes(" "));
  if (clean.length === 0) return "pong";
  const lo = Math.min(3 + Math.floor(hits / 2), 8);
  const band = clean.filter((w) => w.length >= lo && w.length <= lo + 2);
  const source = band.length > 0 ? band : clean;
  return source[(seq * 7919) % source.length] ?? "pong";
}

/** The side that had to type returned the ball. */
export function onReturn(s: PongState, nextWord: string): PongState {
  return {
    ...s,
    hits: s.hits + 1,
    toSide: otherSide(s.toSide),
    seq: s.seq + 1,
    word: nextWord,
  };
}

/**
 * The receiving side missed: the other side scores, a new rally starts and
 * the scorer gets the next ball (so a player who's winning keeps typing).
 */
export function onMiss(s: PongState, nextWord: string): PongState {
  const winner = otherSide(s.toSide);
  const score = { ...s.score, [winner]: s.score[winner] + 1 };
  return {
    score,
    hits: 0,
    toSide: winner,
    seq: s.seq + 1,
    word: nextWord,
    over: score[winner] >= WIN_POINTS,
    lastPoint: winner,
  };
}

/** Does Tappy return this word, and how long does it take? */
export function botReturn(
  d: PongDifficulty,
  word: string,
  rng: () => number,
): { returns: boolean; delayMs: number } {
  const chance = Math.max(
    0.3,
    d.botAccuracy - Math.max(0, word.length - 4) * 0.04,
  );
  return {
    returns: rng() < chance,
    delayMs: 500 + word.length * d.botCharMs,
  };
}

/** Score for coins and the high-score table. */
export function pongScore(myPoints: number, won: boolean): number {
  return myPoints * 10 + (won ? 30 : 0);
}

/** 3 for a win, 2 for a close loss (4+ points), 1 for any point. */
export function pongStars(myPoints: number, won: boolean): number {
  if (won) return 3;
  if (myPoints >= 4) return 2;
  return myPoints > 0 ? 1 : 0;
}

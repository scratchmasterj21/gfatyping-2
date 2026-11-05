import type { RaceStanding } from "./race-types";

/** Words per Word Blitz game. */
export const BLITZ_ROUNDS = 10;
/** A round closes after this long even if not everyone has answered. */
export const BLITZ_ROUND_MS = 15_000;
/** How long the projector shows who won a round before the next word. */
export const BLITZ_REVEAL_MS = 3_500;
/** Points: the fastest correct answer gets more than everyone else. */
export const BLITZ_POINTS = { fastest: 3, correct: 1 };
/** Coins - higher than a class race since it's a rare event. */
export const BLITZ_COINS = { participation: 10, podium: [40, 25, 15] };

export type BlitzPhase = "live" | "reveal";

/** Live round state the host publishes (a tiny RTDB node students watch). */
export type BlitzState = {
  round: number;
  word: string;
  phase: BlitzPhase;
  startedAt: number;
  /** set on reveal */
  winnerUid?: string;
  winnerName?: string;
};

/** One student's answer to a round; `at` is the database's own clock. */
export type BlitzAnswer = { word: string; at: number; name?: string };

/**
 * Pick the game's words from the race content: unique, reasonably short
 * words in their original (already shuffled) order.
 */
export function pickBlitzWords(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    const w = raw.trim();
    if (w.length === 0 || w.length > 14 || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length === BLITZ_ROUNDS) break;
  }
  return out;
}

/** Answers for one round, fastest first. */
export function rankAnswers(
  answers: Record<string, BlitzAnswer> | null,
): { uid: string; answer: BlitzAnswer }[] {
  return Object.entries(answers ?? {})
    .map(([uid, answer]) => ({ uid, answer }))
    .sort((a, b) => a.answer.at - b.answer.at);
}

/** Points earned in one round per player. */
export function roundPoints(
  answers: Record<string, BlitzAnswer> | null,
): Record<string, number> {
  const ranked = rankAnswers(answers);
  const points: Record<string, number> = {};
  ranked.forEach(({ uid }, i) => {
    points[uid] = i === 0 ? BLITZ_POINTS.fastest : BLITZ_POINTS.correct;
  });
  return points;
}

/** Add a round's points onto running totals. */
export function addPoints(
  totals: Record<string, number>,
  round: Record<string, number>,
): Record<string, number> {
  const out = { ...totals };
  for (const [uid, p] of Object.entries(round)) out[uid] = (out[uid] ?? 0) + p;
  return out;
}

/** Coins for a player: participation for scoring at all, plus a podium bonus. */
export function blitzCoins(standing: RaceStanding): number {
  if (standing.finishedAt <= 0 || (standing.words ?? 0) <= 0) return 0;
  return (
    BLITZ_COINS.participation + (BLITZ_COINS.podium[standing.rank - 1] ?? 0)
  );
}

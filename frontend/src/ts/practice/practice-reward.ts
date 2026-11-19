import { createSignal } from "solid-js";

import { getSnapshot } from "../states/snapshot";

/**
 * What the last saved free-typing test earned (from api/submit-result), for
 * the kid result card: coins and where they came from, garden words, and
 * whether it beat last week's best.
 */
export type CoinParts = {
  try: number;
  time: number;
  accuracy: number;
  warmUp: number;
  pb: number;
  quests: number;
};

export type PracticeReward = {
  /** the result's timestamp, to match it to the result on screen */
  at: number;
  coins: number;
  parts?: CoinParts;
  testsToday: number;
  wordsAdded: number;
  typedWords: number;
  /** wpm above last week's best (0 = not this time) */
  gain: number;
};

const [reward, setReward] = createSignal<PracticeReward | null>(null);
const [typedWords, setTypedWords] = createSignal<number | undefined>();

export const practiceReward = reward;

export function notePracticeReward(r: PracticeReward): void {
  setReward(r);
  setTypedWords(r.typedWords);
}

/** All correct words typed ever (the garden's size). */
export function myTypedWords(): number {
  return Math.max(typedWords() ?? 0, getSnapshot()?.typedWords ?? 0);
}

/** First tests each day pay double. Mirrors api/submit-result.ts. */
export const WARM_UP_TESTS = 3;

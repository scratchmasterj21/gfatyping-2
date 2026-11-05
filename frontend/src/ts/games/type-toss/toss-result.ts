export type TossEnd = {
  score: number;
  wordsTyped: number;
  hits: number;
  misses: number;
  totalChars: number;
  totalTime: number;
  multiplayer?: boolean;
};

export const tossWpm = (d: TossEnd): number =>
  d.totalTime > 0 ? Math.round(d.totalChars / 5 / (d.totalTime / 60)) : 0;

export const tossAccuracy = (d: TossEnd): number =>
  d.hits + d.misses > 0 ? Math.round((d.hits / (d.hits + d.misses)) * 100) : 0;

/** 1-3 stars from typing speed over the round. */
export function tossStars(d: TossEnd): number {
  if (d.wordsTyped <= 0) return 0;
  const wpm = tossWpm(d);
  if (wpm >= 20) return 3;
  if (wpm >= 10) return 2;
  return 1;
}

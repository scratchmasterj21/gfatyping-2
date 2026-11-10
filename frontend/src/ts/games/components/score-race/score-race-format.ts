export const medal = (rank: number): string =>
  rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `${rank + 1}`;

export const formatTime = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Ranks with ties sharing a place (dense). */
export function ranks(scores: number[]): number[] {
  let rank = 0;
  return scores.map((score, i) => {
    if (i > 0 && score !== scores[i - 1]) rank += 1;
    return rank;
  });
}

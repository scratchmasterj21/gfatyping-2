/** 1-3 stars from waves cleared in one run. */
export function questStars(completedWaves: number): number {
  if (completedWaves <= 0) return 0;
  if (completedWaves >= 5) return 3;
  if (completedWaves >= 2) return 2;
  return 1;
}

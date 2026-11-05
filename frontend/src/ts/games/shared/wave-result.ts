/** End-of-run numbers shared by the wave-based Phaser games. */
export type WaveEnd = {
  score: number;
  wave: number;
  hits: number;
  misses: number;
  /** true when a lesson's wave target was cleared (not out of lives) */
  cleared?: boolean;
};

export const waveAccuracy = (d: WaveEnd): number =>
  d.hits + d.misses > 0 ? Math.round((d.hits / (d.hits + d.misses)) * 100) : 0;

/** 1-3 stars: clearing a lesson is 3; otherwise by wave reached. */
export function waveStars(d: WaveEnd): number {
  if (d.cleared === true) return 3;
  if (d.score <= 0) return 0;
  if (d.wave >= 6) return 3;
  if (d.wave >= 3) return 2;
  return 1;
}

import type { RacerPlayer } from "./type-racer-multiplayer";
export type RaceEnd = {
  playerWon: boolean;
  wpm: number;
  accuracy: number;
  elapsed: number;
  wordsTyped: number;
  marginChars: number;
  multiplayer?: boolean;
};

/** A finish within this many characters counts as a photo finish. */
export const PHOTO_FINISH_CHARS = 5;

/** 3 for a win, 2 for a photo-finish loss, 1 for any words typed. */
export function raceStars(r: RaceEnd): number {
  if (r.playerWon) return 3;
  if (r.wordsTyped <= 0) return 0;
  return r.marginChars <= PHOTO_FINISH_CHARS ? 2 : 1;
}

export function raceHeadline(r: RaceEnd): string {
  if (r.playerWon) return "You win! 🏆";
  if (r.marginChars <= PHOTO_FINISH_CHARS) return "Photo finish!";
  return "Nice race!";
}

/**
 * Race standings: whoever typed the whole passage first (by their own race
 * time, not the device clock), then everyone else by how far they got.
 */
export function rankRacers<
  T extends Pick<
    RacerPlayer,
    "progress" | "wpm" | "finished" | "finishedAt" | "completed" | "raceMs"
  >,
>(players: T[]): T[] {
  const done = (p: T): boolean => p.completed === true || p.progress >= 1;
  const time = (p: T): number =>
    p.raceMs !== undefined && p.raceMs > 0 ? p.raceMs : Infinity;
  return [...players].sort((a, b) => {
    if (done(a) !== done(b)) return done(a) ? -1 : 1;
    if (done(a) && time(a) !== time(b)) return time(a) - time(b);
    if (b.progress !== a.progress) return b.progress - a.progress;
    return b.wpm - a.wpm;
  });
}

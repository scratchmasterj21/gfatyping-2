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

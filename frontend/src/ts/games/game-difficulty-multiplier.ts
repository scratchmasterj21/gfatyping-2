/**
 * Scales a free-play game's leaderboard score by how the round was played:
 * the chosen game difficulty, and separately the chosen word list's content
 * difficulty. Every game's own scoring formula is flat regardless of either
 * (Easy just means slower/fewer enemies; a word-list pick doesn't change
 * per-word scoring), so without this a student who grinds Easy mode on the
 * shortest word list can outscore someone actually playing Hard on harder
 * content. Only applied at the free-play "Games" leaderboard write site -
 * lesson checkpoint games don't feed that leaderboard and are unaffected.
 */
const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  Easy: 1,
  Medium: 1.25,
  Hard: 1.5,
};

/**
 * Word-list content difficulty, keyed by the curriculum group a chosen
 * free-play word list belongs to (the `group` field on WordListOption -
 * see games/word-defender/systems/vocab-pool.ts and lessons/lessons-data.ts's
 * lessonGroups names, which this must match exactly). Calibrated off actual
 * word length/complexity, not just curriculum order: Connected text plays
 * full sentence-length passages (by far the longest content), Symbols and
 * Punctuation demand awkward shift/reach combos, while the row-drill groups
 * are short letter/word warmups.
 */
const WORD_LIST_MULTIPLIERS: Record<string, number> = {
  "Home row": 1,
  "Top row": 1,
  "Bottom row": 1.05,
  "All keys": 1.15,
  "Capitals & shift": 1.2,
  Punctuation: 1.25,
  "Common words": 1.1,
  "Hand drills": 1.05,
  "Connected text": 1.5,
  Numbers: 1.1,
  Symbols: 1.3,
  "Tab & Enter": 1.15,
};

/** Combines both multipliers into the final score written to the leaderboard. */
export function scaleGameScore(
  score: number,
  difficultyLabel: string,
  wordListGroup: string,
): number {
  const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficultyLabel] ?? 1;
  const wordListMultiplier = WORD_LIST_MULTIPLIERS[wordListGroup] ?? 1;
  return Math.round(score * difficultyMultiplier * wordListMultiplier);
}

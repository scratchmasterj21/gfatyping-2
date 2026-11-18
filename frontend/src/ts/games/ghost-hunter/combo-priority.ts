import {
  MatchResult,
  WordMatcher,
} from "../word-defender/systems/word-matcher";

/**
 * The Chain Beam phrase uses lesson words, so its first word can also be a
 * ghost's word ("kjd jdd" while a ghost says "kjd"). The matcher completes
 * exact matches first, so typing "kjd" would catch that ghost and the space
 * after it would have nothing left to match. While the typed text is still
 * the start of the combo phrase, words it would complete are set aside for
 * that one key.
 */
export function handleKeyWithCombo(
  matcher: WordMatcher,
  char: string,
  combo: string | null,
  targetableWords: string[],
): MatchResult {
  const shielded: string[] = [];
  if (combo !== null && char !== "Backspace") {
    const next = (matcher.getBuffer() + char).toLowerCase();
    const phrase = combo.toLowerCase();
    if (phrase.startsWith(next) && next !== phrase) {
      for (const w of targetableWords) {
        if (w.toLowerCase() === next && matcher.getLockedWord() !== w) {
          matcher.unregister(w);
          shielded.push(w);
        }
      }
    }
  }
  const result = matcher.handleKey(char);
  // set aside, not caught: still there to type afterwards
  for (const w of shielded) matcher.register(w);
  return result;
}

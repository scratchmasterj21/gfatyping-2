export type MatchResult =
  | { status: "none" }
  | { status: "partial"; matches: string[] }
  | { status: "locked"; word: string }
  | { status: "complete"; word: string }
  | { status: "miss" };

// Anti-spam: if the last SPAM_WINDOW_SIZE real keystrokes only used
// SPAM_MAX_DISTINCT or fewer distinct characters, treat the current one as
// a no-op miss instead of matching it. Real words (even short home-row ones)
// pull in more distinct letters than this well before the window fills, so
// this only catches mashing/holding a key or alternating 1-2 keys.
const SPAM_WINDOW_SIZE = 8;
const SPAM_MAX_DISTINCT = 2;

// If the player keeps missing on the same locked target this many times in a
// row, give up the lock for them - otherwise a hard word can trap them
// (visually stuck on one highlighted target, e.g. a descending ship in Word
// Defender) with no way out except finishing it or manually backspacing to
// an empty buffer.
const MISS_STREAK_LIMIT = 3;

export class WordMatcher {
  private buffer = "";
  private activeWords = new Set<string>();
  private lockedWord: string | null = null;
  private onBufferChange: (buf: string, locked: string | null) => void;
  private recentKeys: string[] = [];
  private missStreak = 0;

  constructor(onBufferChange: (buf: string, locked: string | null) => void) {
    this.onBufferChange = onBufferChange;
  }

  private isSpamKey(char: string): boolean {
    this.recentKeys.push(char);
    if (this.recentKeys.length > SPAM_WINDOW_SIZE) {
      this.recentKeys.shift();
    }
    if (this.recentKeys.length < SPAM_WINDOW_SIZE) return false;
    return new Set(this.recentKeys).size <= SPAM_MAX_DISTINCT;
  }

  register(word: string): void {
    this.activeWords.add(word);
  }

  unregister(word: string): void {
    this.activeWords.delete(word);
    if (this.lockedWord === word) {
      this.lockedWord = null;
      this.buffer = "";
      this.missStreak = 0;
      this.onBufferChange("", null);
    }
  }

  handleKey(char: string): MatchResult {
    if (char === "Backspace") {
      this.buffer = this.buffer.slice(0, -1);
      if (this.buffer === "") {
        this.lockedWord = null;
        this.missStreak = 0;
      }
      this.onBufferChange(this.buffer, this.lockedWord);
      return { status: "none" };
    }

    if (this.isSpamKey(char)) {
      this.onBufferChange(this.buffer, this.lockedWord);
      return { status: "miss" };
    }

    const next = this.buffer + char;
    // Compare case-insensitively (Caps Lock/Shift shouldn't silently block
    // typing forever) while keeping `buffer`/`next` as the raw keys pressed,
    // so on-screen "typed so far" display is unaffected.
    const nextLower = next.toLowerCase();

    // If locked onto a target, only accept chars for that word
    if (this.lockedWord !== null) {
      if (!this.lockedWord.toLowerCase().startsWith(nextLower)) {
        this.missStreak++;
        if (this.missStreak >= MISS_STREAK_LIMIT) {
          this.lockedWord = null;
          this.buffer = "";
          this.missStreak = 0;
          this.onBufferChange("", null);
          return { status: "miss" };
        }
        this.onBufferChange(this.buffer, this.lockedWord);
        return { status: "miss" };
      }
      this.missStreak = 0;
      this.buffer = next;
      this.onBufferChange(this.buffer, this.lockedWord);
      if (this.lockedWord.toLowerCase() === nextLower) {
        const word = this.lockedWord;
        this.buffer = "";
        this.lockedWord = null;
        this.activeWords.delete(word);
        this.onBufferChange("", null);
        return { status: "complete", word };
      }
      return { status: "locked", word: this.lockedWord };
    }

    // No lock yet — find all matching active words
    const matches = [...this.activeWords].filter((w) =>
      w.toLowerCase().startsWith(nextLower),
    );

    if (matches.length === 0) {
      // Miss — don't advance buffer. Same miss-streak escape as the locked
      // case: without this, a wrong keystroke while ambiguous (2+ words
      // still sharing the typed prefix) never advances and never resets,
      // permanently trapping the buffer until the player manually
      // backspaces - including blocking a power-up from ever starting.
      this.missStreak++;
      if (this.missStreak >= MISS_STREAK_LIMIT) {
        this.buffer = "";
        this.missStreak = 0;
        this.onBufferChange("", null);
        return { status: "miss" };
      }
      this.onBufferChange(this.buffer, null);
      return { status: "miss" };
    }

    this.missStreak = 0;
    this.buffer = next;

    // Exact match takes priority even when other words share the prefix
    // (e.g. typing "a" completes word "a" before "ash" or "aa" can compete)
    const exactMatch = matches.find((w) => w.toLowerCase() === nextLower);
    if (exactMatch !== undefined) {
      this.activeWords.delete(exactMatch);
      this.buffer = "";
      this.onBufferChange("", null);
      return { status: "complete", word: exactMatch };
    }

    // Single prefix match → lock onto it
    if (matches.length === 1) {
      this.lockedWord = matches[0] as string;
      this.onBufferChange(this.buffer, this.lockedWord);
      return { status: "locked", word: this.lockedWord };
    }

    this.onBufferChange(this.buffer, null);
    return { status: "partial", matches };
  }

  clear(): void {
    this.buffer = "";
    this.lockedWord = null;
    this.activeWords.clear();
    this.recentKeys = [];
    this.missStreak = 0;
    this.onBufferChange("", null);
  }

  getBuffer(): string {
    return this.buffer;
  }

  getLockedWord(): string | null {
    return this.lockedWord;
  }

  /**
   * Abandons the current lock/buffer without touching activeWords - lets a
   * caller give a specific word (e.g. a time-limited power-up) a chance to
   * be typed even if the player was already mid-word on something else,
   * which handleKey() otherwise always treats as a miss.
   */
  releaseLock(): void {
    this.buffer = "";
    this.lockedWord = null;
    this.missStreak = 0;
    this.onBufferChange("", null);
  }
}

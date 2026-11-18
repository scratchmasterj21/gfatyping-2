/** What the end screen shows about the player's own typing. */
export type TypingReport = {
  wpm: number;
  /** % of keys pressed that were right */
  accuracy: number;
  words: number;
  /** words to practice: most mistakes (or got away) first */
  hardest: string[];
};

/** Collects the player's typing during one Ghost Hunter run. */
export class TypingTracker {
  private chars = 0;
  private words = 0;
  private misses = 0;
  private activeMs = 0;
  private trouble = new Map<string, number>();

  /** A word finished, with this many wrong keys while typing it. */
  word(word: string, misses: number): void {
    this.chars += word.length;
    this.words++;
    if (misses > 0) this.addTrouble(word, misses);
  }

  miss(): void {
    this.misses++;
  }

  /** A ghost reached the log before its word was typed. */
  escaped(word: string): void {
    this.addTrouble(word, 2);
  }

  /** Time the waves were actually running. */
  tick(ms: number): void {
    this.activeMs += ms;
  }

  report(): TypingReport {
    const minutes = this.activeMs / 60000;
    const total = this.chars + this.misses;
    return {
      wpm: minutes > 0 ? Math.round(this.chars / 5 / minutes) : 0,
      accuracy: total > 0 ? Math.round((this.chars / total) * 100) : 0,
      words: this.words,
      hardest: [...this.trouble.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([w]) => w),
    };
  }

  private addTrouble(word: string, n: number): void {
    this.trouble.set(word, (this.trouble.get(word) ?? 0) + n);
  }
}

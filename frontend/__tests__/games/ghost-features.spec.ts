import { describe, expect, it } from "vitest";

import {
  pickKind,
  seededRng,
} from "../../src/ts/games/ghost-hunter/ghost-kinds";
import { TypingTracker } from "../../src/ts/games/shared/typing-report";

describe("ghost kinds", () => {
  it("only normal ghosts in wave 1", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 200; i++)
      expect(pickKind(rng, 1, false)).toBe("normal");
  });

  it("brings in special ghosts wave by wave", () => {
    const seen = (wave: number, easy: boolean): Set<string> => {
      const rng = seededRng(wave);
      const s = new Set<string>();
      for (let i = 0; i < 2000; i++) s.add(pickKind(rng, wave, easy));
      return s;
    };
    expect([...seen(2, false)].sort()).toEqual(["armored", "normal", "speedy"]);
    expect(seen(3, false).has("twin")).toBe(true);
    expect(seen(3, false).has("shy")).toBe(false);
    expect(seen(4, false).has("shy")).toBe(true);
    expect(seen(4, true).has("shy")).toBe(false);
    expect(seen(5, true).has("shy")).toBe(true);
  });

  it("same seed, same ghosts (Daily Haunting)", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const run = (r: () => number): string[] =>
      Array.from({ length: 30 }, () => pickKind(r, 5, false));
    expect(run(a)).toEqual(run(b));
  });
});

describe("typing report", () => {
  it("counts WPM, key accuracy and the hardest words", () => {
    const t = new TypingTracker();
    t.word("ghost", 0);
    t.word("spooky", 2);
    t.word("bat", 1);
    t.miss();
    t.miss();
    t.miss();
    t.escaped("crypt");
    t.tick(30_000);
    const r = t.report();
    // 14 letters in 30 s = 2.8 words in half a minute
    expect(r.wpm).toBe(6);
    expect(r.accuracy).toBe(Math.round((14 / 17) * 100));
    expect(r.words).toBe(3);
    expect(r.hardest).toEqual(["spooky", "crypt", "bat"]);
  });

  it("is empty before anything is typed", () => {
    expect(new TypingTracker().report()).toEqual({
      wpm: 0,
      accuracy: 0,
      words: 0,
      hardest: [],
    });
  });
});

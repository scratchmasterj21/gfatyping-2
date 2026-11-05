import { describe, expect, it } from "vitest";

import {
  addPoints,
  blitzCoins,
  BLITZ_ROUNDS,
  pickBlitzWords,
  rankAnswers,
  roundPoints,
} from "../../src/ts/race/blitz";
import type { RaceStanding } from "../../src/ts/race/race-types";

const standing = (over: Partial<RaceStanding>): RaceStanding => ({
  uid: "a",
  name: "A",
  finalWpm: 0,
  finalAcc: 0,
  finishedAt: 1,
  progress: 1,
  rank: 1,
  words: 5,
  ...over,
});

describe("word blitz", () => {
  it("picks unique, short words up to the round count", () => {
    const words = pickBlitzWords([
      "cat",
      "cat",
      "",
      "supercalifragilistic",
      ...Array.from({ length: 20 }, (_, i) => `w${i}`),
    ]);
    expect(words).toHaveLength(BLITZ_ROUNDS);
    expect(words[0]).toBe("cat");
    expect(new Set(words).size).toBe(words.length);
    expect(words).not.toContain("supercalifragilistic");
  });

  it("ranks answers by the database time and gives the fastest 3", () => {
    const answers = {
      b: { word: "x", at: 200 },
      a: { word: "x", at: 100 },
      c: { word: "x", at: 300 },
    };
    expect(rankAnswers(answers).map((r) => r.uid)).toEqual(["a", "b", "c"]);
    expect(roundPoints(answers)).toEqual({ a: 3, b: 1, c: 1 });
    expect(roundPoints(null)).toEqual({});
  });

  it("adds round points onto totals", () => {
    expect(addPoints({ a: 3 }, { a: 1, b: 3 })).toEqual({ a: 4, b: 3 });
  });

  it("pays participation plus podium coins", () => {
    expect(blitzCoins(standing({ rank: 1 }))).toBe(50);
    expect(blitzCoins(standing({ rank: 3 }))).toBe(25);
    expect(blitzCoins(standing({ rank: 5 }))).toBe(10);
    expect(blitzCoins(standing({ words: 0 }))).toBe(0);
  });
});

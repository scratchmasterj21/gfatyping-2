import { describe, expect, it } from "vitest";

import {
  botBlockDelay,
  buildShaft,
  DIG_DEPTH,
  DIG_DIFFICULTIES,
  digScore,
  digStars,
  gemsAt,
  rankDiggers,
} from "../../src/ts/games/gem-dig/dig-rules";

const easy = DIG_DIFFICULTIES[0]!;
const pool = [
  "a",
  "at",
  "cat",
  "dog",
  "frog",
  "jump",
  "plant",
  "garden",
  "rabbit",
  "monkeys",
];

describe("gem dig", () => {
  it("builds the same shaft for the same seed", () => {
    const a = buildShaft(pool, 42, easy);
    const b = buildShaft(pool, 42, easy);
    expect(a).toEqual(b);
    expect(a).toHaveLength(DIG_DEPTH);
    expect(buildShaft(pool, 43, easy)).not.toEqual(a);
  });

  it("gets longer with depth and puts rocks every 5th block", () => {
    const s = buildShaft(pool, 7, easy);
    expect(s[0]!.word.length).toBeLessThanOrEqual(3);
    expect(s[DIG_DEPTH - 2]!.word.length).toBeGreaterThanOrEqual(4);
    expect(s.filter((b) => b.rock)).toHaveLength(DIG_DEPTH / 5);
    expect(s.every((b) => !(b.rock && b.gem))).toBe(true);
  });

  it("falls back when the pool is empty", () => {
    expect(buildShaft([], 1, easy)[0]!.word).toBe("dig");
  });

  it("counts gems dug so far", () => {
    const s = buildShaft(pool, 3, easy);
    expect(gemsAt(s, 0)).toBe(0);
    expect(gemsAt(s, DIG_DEPTH)).toBe(s.filter((b) => b.gem).length);
  });

  it("ranks finishers first, then depth, then gems", () => {
    const r = rankDiggers([
      { id: "a", depth: 12, gems: 1 },
      { id: "b", depth: 20, gems: 0, finishedMs: 90_000 },
      { id: "c", depth: 12, gems: 3 },
      { id: "d", depth: 20, gems: 5, finishedMs: 80_000 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("scores and stars", () => {
    expect(digScore(20, 4, true)).toBe(170);
    expect(digStars(20, true)).toBe(3);
    expect(digStars(10, false)).toBe(2);
    expect(digStars(1, false)).toBe(1);
    expect(digStars(0, false)).toBe(0);
  });

  it("Tappy takes longer on rocks", () => {
    const block = { word: "cat", gem: false, rock: false };
    const mid = () => 0.5;
    expect(botBlockDelay(easy, { ...block, rock: true }, mid)).toBeGreaterThan(
      botBlockDelay(easy, block, mid),
    );
  });
});

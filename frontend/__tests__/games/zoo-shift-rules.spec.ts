import { describe, expect, it } from "vitest";

import { ZOO_INFO, ZOO_SPECIES } from "../../src/ts/games/zoo/zoo-animals";
import {
  initialZooShift,
  isStreak,
  needWords,
  nextGap,
  nextHappiness,
  pickNeedWord,
  pickZooSpecies,
  STREAK_AFTER,
  ZOO_DIFFICULTIES,
  ZOO_NEEDS,
  zooOnCare,
  zooOnMiss,
  zooStars,
} from "../../src/ts/games/zoo/zoo-shift-rules";

const seq = (...values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("zoo keeper words", () => {
  it("every animal has words for every need at every level", () => {
    for (const species of ZOO_SPECIES) {
      for (const need of ZOO_NEEDS) {
        for (const level of [0, 1, 2] as const) {
          expect(needWords(species, need, level).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("easy words are short single words, hard ones are phrases", () => {
    for (const species of ZOO_SPECIES) {
      for (const need of ZOO_NEEDS) {
        for (const w of needWords(species, need, 0)) {
          expect(w).not.toContain(" ");
          expect(w.length).toBeLessThanOrEqual(5);
        }
        for (const w of needWords(species, need, 1)) {
          expect(w).not.toContain(" ");
        }
      }
    }
    for (const species of ZOO_SPECIES) {
      expect(ZOO_INFO[species].food[2].every((w) => w.includes(" "))).toBe(
        true,
      );
    }
  });

  it("all words are lowercase letters and spaces", () => {
    for (const species of ZOO_SPECIES) {
      for (const need of ZOO_NEEDS) {
        for (const level of [0, 1, 2] as const) {
          for (const w of needWords(species, need, level)) {
            expect(w).toMatch(/^[a-z]+( [a-z]+)*$/);
          }
        }
      }
    }
  });

  it("skips words whose first letter is already on screen", () => {
    expect(pickNeedWord("lion", "food", 0, new Set(["m"]), seq(0))).toBe(
      undefined,
    );
    expect(pickNeedWord("rabbit", "food", 0, new Set(["k"]), seq(0))).toBe(
      "hay",
    );
  });
});

describe("zoo keeper setup", () => {
  it("picks different animals for the pens", () => {
    const picked = pickZooSpecies(6, Math.random);
    expect(picked).toHaveLength(6);
    expect(new Set(picked).size).toBe(6);
  });

  it("pens and active requests grow with difficulty", () => {
    const [easy, medium, hard] = ZOO_DIFFICULTIES;
    expect(easy?.pens).toBeLessThan(hard?.pens ?? 0);
    expect(medium?.maxActive).toBeLessThanOrEqual(hard?.maxActive ?? 0);
    for (const d of ZOO_DIFFICULTIES) {
      expect(d.maxActive).toBeLessThan(d.pens);
    }
  });

  it("requests come faster as the shift goes on", () => {
    expect(nextGap(4, 1, () => 0.5)).toBeLessThan(nextGap(4, 0, () => 0.5));
  });
});

describe("zoo keeper scoring", () => {
  it("scores letters plus speed, ignoring spaces", () => {
    const s = zooOnCare(initialZooShift(), "a big hug", 1);
    expect(s.score).toBe(7 * 2 + 10);
    expect(s.cared).toBe(1);
  });

  it("doubles points on a happy streak and a miss ends it", () => {
    let s = initialZooShift();
    for (let i = 0; i < STREAK_AFTER; i++) s = zooOnCare(s, "hay", 0);
    expect(isStreak(s)).toBe(true);
    const before = s.score;
    s = zooOnCare(s, "hay", 0);
    expect(s.score - before).toBe(12);
    s = zooOnMiss(s);
    expect(s.streak).toBe(0);
    expect(s.missed).toBe(1);
    expect(s.bestStreak).toBe(STREAK_AFTER + 1);
  });

  it("stars and happiness", () => {
    expect(zooStars(0)).toBe(0);
    expect(zooStars(1)).toBe(1);
    expect(zooStars(9)).toBe(2);
    expect(zooStars(16)).toBe(3);
    expect(nextHappiness(95, true)).toBe(100);
    expect(nextHappiness(15, false)).toBe(10);
  });
});

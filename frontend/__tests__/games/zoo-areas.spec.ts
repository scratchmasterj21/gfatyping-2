import { describe, expect, it } from "vitest";

import { CATALOGS } from "../../../api/_lib/catalogs";
import { ZOO_LESSON_GROUPS } from "../../../api/_lib/zoo";
import { ZOO_SPECIES } from "../../src/ts/games/zoo/zoo-animals";
import {
  careWords,
  STARTER_ANIMAL,
  ZOO_AREAS,
  ZOO_PRICES,
} from "../../src/ts/games/zoo/zoo-areas";
import { zooStateFromDoc } from "../../src/ts/games/zoo/zoo-state";
import { lessonGroups } from "../../src/ts/lessons/lessons-data";

describe("my zoo catalog", () => {
  it("every animal is in exactly one area", () => {
    const all = ZOO_AREAS.flatMap((a) => a.species);
    expect([...all].sort()).toEqual([...ZOO_SPECIES].sort());
  });

  it("server prices and lesson gates match the app", () => {
    for (const area of ZOO_AREAS) {
      for (const s of area.species) {
        if (s === STARTER_ANIMAL) {
          expect(CATALOGS.zoo[s]).toBeUndefined();
          continue;
        }
        expect(CATALOGS.zoo[s]?.price).toBe(ZOO_PRICES[s]);
        expect(CATALOGS.zoo[s]?.requiresLessonGroup).toBe(area.requires);
      }
    }
  });

  it("server lesson groups match the curriculum", () => {
    for (const [id, lessons] of Object.entries(ZOO_LESSON_GROUPS)) {
      const group = lessonGroups.find((g) => g.id === id);
      expect(group?.lessons.map((l) => l.id)).toEqual(lessons);
    }
    for (const area of ZOO_AREAS) {
      if (area.requires !== undefined) {
        expect(ZOO_LESSON_GROUPS[area.requires]).toBeDefined();
      }
    }
  });
});

describe("my zoo care words", () => {
  it("feeding uses the animals' foods, at least 3 words", () => {
    expect(careWords("feed", ["rabbit"], "2026-11-26")).toHaveLength(3);
    const words = careWords("feed", ["lion", "penguin"], "2026-11-26");
    expect(words).toContain("meat");
    expect(words).toContain("fish");
  });

  it("same words all day, 5 for clean and vet", () => {
    expect(careWords("clean", [], "2026-11-26")).toEqual(
      careWords("clean", [], "2026-11-26"),
    );
    expect(careWords("vet", [], "2026-11-26")).toHaveLength(5);
  });
});

describe("my zoo state", () => {
  it("always has the starter, ignores junk", () => {
    const s = zooStateFromDoc({
      coins: 12,
      ownedZooAnimals: { lion: true, dragon: true },
      zooLayout: { lion: { xPct: 20, yPct: 30 }, rabbit: { xPct: "x" } },
      zooCareDates: { feed: "2026-11-26", bogus: "x" },
    });
    expect(s.animals).toEqual(["rabbit", "lion"]);
    expect(s.layout).toEqual({ lion: { xPct: 20, yPct: 30 } });
    expect(s.careDates).toEqual({ feed: "2026-11-26" });
    expect(zooStateFromDoc(undefined).animals).toEqual(["rabbit"]);
  });
});

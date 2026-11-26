import { describe, expect, it } from "vitest";

import {
  CATALOGS,
  QUEST_HERO_PRICE as SERVER_PRICE,
  QUEST_HERO_SETS,
  QUEST_SET_PRICE as SERVER_SET_PRICE,
  questSetPrice as serverSetPrice,
} from "../../../api/_lib/catalogs";
import { ZOO_LESSON_GROUPS } from "../../../api/_lib/zoo";
import { resolvePolicy } from "../../src/ts/games/game-access";
import {
  canPlayHero,
  ownsFullSet,
  QUEST_HERO_PRICE,
  QUEST_SET_PRICE,
  questHeroStateFromDoc,
  questSetPrice,
  setTitles,
} from "../../src/ts/games/monster-quest/quest-heroes";
import { HERO_SETS } from "../../src/ts/games/monster-quest/quest-rules";

describe("monster quest hero shop", () => {
  it("prices and sets match the server", () => {
    expect(QUEST_HERO_PRICE).toBe(SERVER_PRICE);
    expect(QUEST_SET_PRICE).toBe(SERVER_SET_PRICE);
    const heroes = HERO_SETS.flatMap((s) => s.heroes);
    expect(Object.keys(CATALOGS.questHero).sort()).toEqual([...heroes].sort());
    for (const set of HERO_SETS) {
      expect(QUEST_HERO_SETS[set.id]?.heroes).toEqual(set.heroes);
      expect(QUEST_HERO_SETS[set.id]?.requiresLessonGroup).toBe(set.requires);
      expect(ZOO_LESSON_GROUPS[set.requires]).toBeDefined();
      for (const h of set.heroes) {
        expect(CATALOGS.questHero[h]).toEqual({
          price: QUEST_HERO_PRICE,
          requiresLessonGroup: set.requires,
        });
      }
    }
  });

  it("a set costs less when you own some of it", () => {
    for (const n of [0, 1, 2, 3, 4]) {
      expect(questSetPrice(n)).toBe(serverSetPrice(n));
    }
    expect(questSetPrice(4)).toBe(300);
    expect(questSetPrice(3)).toBe(270);
    expect(questSetPrice(1)).toBe(90);
  });

  it("reads owned heroes, free heroes always playable", () => {
    const st = questHeroStateFromDoc({
      coins: 120,
      ownedQuestHeroes: { rogue: true, knight: true, nope: true },
    });
    expect(st).toEqual({ coins: 120, owned: ["rogue"] });
    expect(canPlayHero("knight", [], true)).toBe(true);
    expect(canPlayHero("rogue", ["rogue"], false)).toBe(true);
    expect(canPlayHero("rogue", ["rogue"], true)).toBe(false);
    expect(canPlayHero("ranger", ["rogue"], false)).toBe(false);
  });

  it("full set gives the title", () => {
    const legends = HERO_SETS[0];
    if (legends === undefined) throw new Error("no sets");
    expect(ownsFullSet(legends, ["paladin", "rogue", "ranger"])).toBe(false);
    expect(setTitles([...legends.heroes])).toEqual([legends.title]);
  });

  it("teacher switch: student beats class", () => {
    const access = {
      classes: { c1: { questHeroesOff: true } },
      students: { s2: { questHeroesOff: false } },
    };
    expect(resolvePolicy(access, "c1", "s1").questHeroesOff).toBe(true);
    expect(resolvePolicy(access, "c1", "s2").questHeroesOff).toBe(false);
    expect(resolvePolicy(access, "c2", "s1").questHeroesOff).toBe(false);
  });
});

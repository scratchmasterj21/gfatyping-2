import { describe, expect, it } from "vitest";

import {
  canUse,
  gainXp,
  heroMove,
  monsterMove,
  MOVES,
  newBattle,
  wordsForMove,
  xpForLevel,
} from "../../src/ts/games/typing-rpg/battle-engine";
import type { MonsterKind } from "../../src/ts/games/typing-rpg/wave-appearance";

const never = (): number => 0.99;
const always = (): number => 0;

const battle = (kind: MonsterKind, hp = 18, attack = 4) =>
  newBattle({
    hero: { hp: 100, maxHp: 100, level: 1, potions: 2 },
    monster: { name: "Test", kind, hp, maxHp: hp, attack },
  });

describe("typing quest battles", () => {
  it("a clean, fast Quick Hit is a critical; a slow one isn't", () => {
    const fast = battle("slime");
    const f = heroMove(
      fast,
      { move: "quick", wordsDone: 3, mistakes: 0, timeUsed: 0.3 },
      never,
    );
    expect(f.crit).toBe(true);
    expect(f.damage).toBe(Math.round((3 * 2 + 2) * 1.5));
    const slow = battle("slime");
    const s = heroMove(
      slow,
      { move: "quick", wordsDone: 3, mistakes: 0, timeUsed: 0.8 },
      never,
    );
    expect(s.crit).toBe(false);
    expect(s.damage).toBe(8);
    // mistakes cost damage; running out of time hits weaker
    const sloppy = heroMove(
      battle("slime"),
      { move: "quick", wordsDone: 3, mistakes: 2, timeUsed: 0.8 },
      never,
    );
    expect(sloppy.damage).toBe(4);
    const partial = heroMove(
      battle("slime"),
      { move: "quick", wordsDone: 1, mistakes: 0, timeUsed: 1 },
      never,
    );
    expect(partial.damage).toBe(2);
  });

  it("guardian armour halves hits until a Power Strike breaks it", () => {
    const s = battle("guardian", 40);
    const q = heroMove(
      s,
      { move: "quick", wordsDone: 3, mistakes: 0, timeUsed: 0.8 },
      never,
    );
    expect(q.damage).toBe(4);
    const p = heroMove(
      s,
      { move: "power", wordsDone: 2, mistakes: 0, timeUsed: 0.8 },
      never,
    );
    expect(p.armourBroke).toBe(true);
    expect(p.damage).toBe(10);
    expect(s.monster.armour).toBe(false);
  });

  it("imps can dodge weak hits", () => {
    const s = battle("imp");
    const r = heroMove(
      s,
      { move: "quick", wordsDone: 1, mistakes: 0, timeUsed: 1 },
      always,
    );
    expect(r.dodged).toBe(true);
    expect(s.monster.hp).toBe(18);
  });

  it("guard halves the next attack; heal uses a potion", () => {
    const s = battle("imp", 18, 6);
    heroMove(
      s,
      { move: "guard", wordsDone: 1, mistakes: 0, timeUsed: 0.2 },
      never,
    );
    expect(monsterMove(s, never).damage).toBe(3);
    expect(monsterMove(s, never).damage).toBe(6);
    s.hero.hp = 50;
    const h = heroMove(
      s,
      { move: "heal", wordsDone: 3, mistakes: 0, timeUsed: 0.5 },
      never,
    );
    expect(h.healed).toBe(15);
    expect(s.hero.potions).toBe(1);
    s.hero.potions = 0;
    expect(canUse(s, "heal")).toBe(false);
  });

  it("slimes sometimes hit twice; fights end when someone faints", () => {
    const s = battle("slime", 5, 60);
    expect(monsterMove(s, always).hits).toBe(2);
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    const w = battle("slime", 5);
    heroMove(
      w,
      { move: "power", wordsDone: 2, mistakes: 0, timeUsed: 0.9 },
      never,
    );
    expect(w.won).toBe(true);
  });

  it("move words: short for quick, long for power", () => {
    const pool = ["cat", "dog", "sun", "planet", "garden", "rabbit"];
    const q = wordsForMove("quick", pool, Math.random);
    expect(q).toHaveLength(MOVES.quick.words);
    expect(q.every((w) => w.length <= 4)).toBe(true);
    const p = wordsForMove("power", pool, Math.random);
    expect(p).toHaveLength(2);
    expect(p.every((w) => w.length >= 6)).toBe(true);
  });

  it("XP levels you up", () => {
    expect(gainXp(1, 0, 10)).toEqual({ level: 1, xp: 10, levelsUp: 0 });
    const up = gainXp(1, 20, xpForLevel(1));
    expect(up.level).toBe(2);
    expect(up.levelsUp).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildShaft,
  DIG_DIFFICULTIES,
  dailyDigPlan,
  gemCount,
  gemsAt,
  gemsByKind,
  wordToType,
  WORLDS,
} from "../../src/ts/games/gem-dig/dig-rules";
import {
  dailyTossPlan,
  STALL_IDS,
  TOSS_DIFFICULTIES,
  TossSim,
  tossStars,
} from "../../src/ts/games/type-toss/toss-rules";

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
  "sun",
  "map",
];
const medium = DIG_DIFFICULTIES[1] as (typeof DIG_DIFFICULTIES)[number];

describe("gem dig worlds", () => {
  it("each world has its own blocks and gems", () => {
    for (const w of WORLDS) {
      const s = buildShaft(pool, 11, medium, w.id);
      const kinds = new Set(s.map((b) => b.kind));
      expect(kinds.has("stone")).toBe(true);
      expect(kinds.has("treasure")).toBe(true);
      for (const b of s) {
        if (b.gemId !== undefined) expect(w.gems).toContain(b.gemId);
      }
      if (w.id === "garden") {
        expect(kinds.has("ice")).toBe(false);
        expect(kinds.has("lava")).toBe(false);
      }
    }
    const crystal = WORLDS.map((w) => w.id).includes("crystal");
    expect(crystal).toBe(true);
  });

  it("treasure blocks hold two gems; gems by kind add up", () => {
    const s = buildShaft(pool, 5, medium, "crystal");
    const treasure = s.find((b) => b.kind === "treasure");
    expect(gemCount(treasure)).toBe(2);
    const byKind = gemsByKind(s, s.length);
    const total = Object.values(byKind).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(gemsAt(s, s.length));
  });

  it("drill boost shortens words; the daily dig is the same for everyone", () => {
    expect(wordToType({ word: "garden", gem: false, rock: false }, true)).toBe(
      "ga",
    );
    expect(wordToType({ word: "garden", gem: false, rock: false }, false)).toBe(
      "garden",
    );
    expect(dailyDigPlan(100)).toEqual(dailyDigPlan(100));
    expect(
      buildShaft(pool, dailyDigPlan(100).seed, medium, dailyDigPlan(100).world),
    ).toEqual(
      buildShaft(pool, dailyDigPlan(100).seed, medium, dailyDigPlan(100).world),
    );
  });
});

const easy = TOSS_DIFFICULTIES[0] as (typeof TOSS_DIFFICULTIES)[number];

/** Hit every safe target, frame by frame, until time runs out. */
function playToss(sim: TossSim): void {
  for (let t = 0; t < 300_000 && !sim.over; t += 100) {
    sim.step(100);
    const target = sim.targets.find((x) => x.kind !== "trap");
    if (target !== undefined) {
      sim.type(target.word);
      sim.type("");
    }
  }
}

describe("type toss rules", () => {
  it("every stall can be played and ends when time runs out", () => {
    for (const stall of STALL_IDS) {
      const sim = new TossSim({
        stall,
        words: pool,
        seed: 3,
        difficulty: easy,
      });
      playToss(sim);
      expect(sim.over).toBe(true);
      expect(sim.words).toBeGreaterThan(10);
      expect(sim.tickets).toBeGreaterThan(0);
      expect(tossStars(sim.tickets, sim.words, sim.t)).toBeGreaterThanOrEqual(
        2,
      );
    }
  });

  it("knocking down a whole can stack gives a bonus and a new stack", () => {
    const sim = new TossSim({
      stall: "cans",
      words: pool,
      seed: 1,
      difficulty: easy,
    });
    sim.step(1);
    let stack = false;
    for (let i = 0; i < 6; i++) {
      const can = sim.targets.find((t) => t.kind === "can");
      if (can === undefined) break;
      stack = sim.type(can.word).some((e) => e.type === "stack") || stack;
      sim.type("");
    }
    expect(stack).toBe(true);
    sim.step(1000);
    expect(sim.targets.filter((t) => t.kind === "can")).toHaveLength(6);
  });

  it("hot hand doubles tickets; traps cost time", () => {
    const sim = new TossSim({
      stall: "ducks",
      words: ["cat"],
      seed: 1,
      difficulty: easy,
    });
    sim.step(1);
    sim.targets = Array.from({ length: 6 }, (_, i) => ({
      id: `x${i}`,
      kind: "duck" as const,
      word: "cat",
      x: 50,
      y: 50,
    }));
    const tickets: number[] = [];
    for (let i = 0; i < 6; i++) {
      for (const e of sim.type("cat"))
        if (e.type === "hit") tickets.push(e.tickets);
      sim.type("");
    }
    expect(tickets[0]).toBe(3);
    expect(tickets[5]).toBe(6);
    sim.targets = [{ id: "t", kind: "trap", word: "cat", x: 50, y: 50 }];
    const left = sim.left;
    sim.type("cat");
    expect(sim.left).toBe(left - 5000);
    expect(sim.streak).toBe(0);
  });

  it("online: the same seed makes the same targets; others' hits remove them", () => {
    const a = new TossSim({
      stall: "moles",
      words: pool,
      seed: 9,
      difficulty: easy,
    });
    const b = new TossSim({
      stall: "moles",
      words: pool,
      seed: 9,
      difficulty: easy,
    });
    for (let i = 0; i < 30; i++) {
      a.step(100);
      b.step(100);
    }
    expect(a.targets.map((t) => t.word)).toEqual(b.targets.map((t) => t.word));
    const first = a.targets[0];
    expect(first).toBeDefined();
    b.remoteHit(first?.id ?? "");
    expect(b.targets.some((t) => t.id === first?.id)).toBe(false);
    expect(dailyTossPlan(7)).toEqual(dailyTossPlan(7));
  });
});

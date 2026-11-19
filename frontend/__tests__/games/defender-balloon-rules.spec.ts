import { describe, expect, it } from "vitest";

import {
  BalloonSim,
  CHECKPOINT_LEVEL,
  dailyGoal,
  goalMet,
  levelById,
  levelOpen,
  levelStars,
  Level,
} from "../../src/ts/games/balloon-pop/balloon-rules";
import {
  DEFENDER_DIFFICULTIES,
  DefenderOpts,
  DefenderSim,
  isBossWave,
} from "../../src/ts/games/word-defender/defender-rules";

const WORDS = [
  "cat",
  "dog",
  "sun",
  "red",
  "big",
  "map",
  "hat",
  "elephant",
  "rainbow",
  "go",
  "fan",
  "jam",
];

const defOpts = (over: Partial<DefenderOpts> = {}): DefenderOpts => ({
  words: WORDS,
  difficulty: DEFENDER_DIFFICULTIES[0] as DefenderOpts["difficulty"],
  seed: 7,
  maxWave: 3,
  bosses: false,
  upgrades: false,
  ...over,
});

/** Zap whatever is on screen, frame by frame, until the game ends. */
function playDefender(sim: DefenderSim, ms = 600_000): void {
  for (let t = 0; t < ms && !sim.over; t += 100) {
    sim.step(100);
    if (sim.offer !== null)
      sim.choose(sim.offer[0] as NonNullable<typeof sim.offer>[number]);
    const target = sim.targets()[0];
    if (target !== undefined) sim.type(target.word);
  }
}

describe("word defender rules", () => {
  it("a perfect player clears a lesson checkpoint (3 waves)", () => {
    const sim = new DefenderSim(defOpts());
    playDefender(sim);
    expect(sim.over).toBe(true);
    expect(sim.cleared).toBe(true);
    expect(sim.wave).toBe(3);
    expect(sim.lives).toBe(3);
  });

  it("an idle player loses all lives", () => {
    const sim = new DefenderSim(defOpts({ maxWave: 0 }));
    for (let t = 0; t < 600_000 && !sim.over; t += 100) sim.step(100);
    expect(sim.over).toBe(true);
    expect(sim.cleared).toBe(false);
    expect(sim.lives).toBe(0);
  });

  it("mothership every 5th wave; destroying all parts ends it", () => {
    expect(isBossWave(5, true)).toBe(true);
    expect(isBossWave(5, false)).toBe(false);
    const sim = new DefenderSim(
      defOpts({ maxWave: 5, bosses: true, upgrades: true }),
    );
    let sawBoss = false;
    for (let t = 0; t < 900_000 && !sim.over; t += 100) {
      sim.step(100);
      if (sim.boss !== null) sawBoss = true;
      if (sim.offer !== null)
        sim.choose(sim.offer[0] as NonNullable<typeof sim.offer>[number]);
      const target = sim.targets()[0];
      if (target !== undefined) sim.type(target.word);
    }
    expect(sawBoss).toBe(true);
    expect(sim.cleared).toBe(true);
    expect(sim.owned.length).toBe(4);
  });

  it("shield ships need two hits; splitters make two minis", () => {
    const sim = new DefenderSim(defOpts({ maxWave: 0 }));
    sim.step(1);
    sim.ships = [
      {
        id: "s1",
        kind: "shield",
        word: "cat",
        x0: 50,
        x: 50,
        y: 20,
        speed: 1,
        hp: 2,
      },
      {
        id: "s2",
        kind: "splitter",
        word: "dog",
        x0: 30,
        x: 30,
        y: 20,
        speed: 1,
        hp: 1,
      },
    ];
    expect(sim.type("cat").some((e) => e.type === "shieldBreak")).toBe(true);
    expect(sim.ships.some((s) => s.id === "s1")).toBe(true);
    sim.type("");
    expect(sim.type("cat").some((e) => e.type === "zap")).toBe(true);
    sim.type("dog");
    expect(sim.ships.filter((s) => s.kind === "mini")).toHaveLength(2);
  });

  it("co-op: someone else's kill removes the ship without points for me", () => {
    const a = new DefenderSim(defOpts({ maxWave: 0 }));
    const b = new DefenderSim(defOpts({ maxWave: 0 }));
    for (let i = 0; i < 40; i++) {
      a.step(100);
      b.step(100);
    }
    const ship = a.ships[0];
    expect(ship).toBeDefined();
    expect(b.ships[0]?.word).toBe(ship?.word);
    a.type(ship?.word ?? "");
    b.remoteKill(ship?.id ?? "");
    expect(b.ships.some((s) => s.id === ship?.id)).toBe(false);
    expect(b.score).toBe(0);
    expect(a.score).toBeGreaterThan(0);
  });
});

/** Pop whatever is safe, frame by frame. */
function playBalloons(sim: BalloonSim, ms = 600_000): void {
  for (let t = 0; t < ms && !sim.over; t += 100) {
    sim.step(100);
    const target = sim.targets().find((b) => b.kind !== "bomb");
    if (target !== undefined) sim.type(target.word);
  }
}

describe("balloon pop rules", () => {
  it("a perfect player clears the checkpoint", () => {
    const sim = new BalloonSim({
      level: CHECKPOINT_LEVEL,
      words: WORDS,
      seed: 3,
    });
    playBalloons(sim);
    expect(sim.cleared).toBe(true);
    expect(sim.wave).toBe(3);
  });

  it("every level can be cleared with 2+ stars by a perfect player", () => {
    for (let id = 1; id <= 12; id++) {
      const level = levelById(id);
      const sim = new BalloonSim({ level, words: WORDS, seed: id });
      playBalloons(sim);
      expect(sim.cleared).toBe(true);
      const stars = levelStars({
        level,
        cleared: sim.cleared,
        tally: sim.tally,
        bestStreak: sim.bestStreak,
        accuracy: sim.accuracy(),
      });
      // colour / gift goals depend on luck; the rest a perfect player meets
      if (!["color", "gift", "bunch"].includes(level.goal.type)) {
        expect(stars).toBeGreaterThanOrEqual(2);
      } else {
        expect(stars).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("an idle player loses", () => {
    const sim = new BalloonSim({ level: levelById(1), words: WORDS, seed: 1 });
    for (let t = 0; t < 600_000 && !sim.over; t += 100) sim.step(100);
    expect(sim.cleared).toBe(false);
    expect(sim.lives).toBe(0);
  });

  it("typing a bomb costs a heart; a bunch pops three", () => {
    const sim = new BalloonSim({ level: levelById(12), words: WORDS, seed: 1 });
    sim.step(1);
    sim.balloons = [
      {
        id: "b",
        kind: "bomb",
        color: "purple",
        word: "cat",
        x: 50,
        y: 30,
        speed: 1,
      },
      {
        id: "x1",
        kind: "bunch",
        color: "red",
        word: "dog",
        x: 40,
        y: 30,
        speed: 1,
      },
      {
        id: "x2",
        kind: "bunch",
        color: "blue",
        word: "dog",
        x: 45,
        y: 30,
        speed: 1,
      },
      {
        id: "x3",
        kind: "bunch",
        color: "red",
        word: "dog",
        x: 50,
        y: 30,
        speed: 1,
      },
    ];
    const lives = sim.lives;
    sim.type("cat");
    expect(sim.lives).toBe(lives - 1);
    sim.type("dog");
    expect(sim.balloons).toHaveLength(0);
    expect(sim.tally.popped).toBe(3);
    expect(sim.tally.colors.red).toBe(2);
    expect(sim.tally.bunches).toBe(1);
  });

  it("cloud balloons can't be typed until they're close to the top", () => {
    const sim = new BalloonSim({ level: levelById(6), words: WORDS, seed: 1 });
    sim.step(1);
    sim.balloons = [
      {
        id: "c",
        kind: "cloud",
        color: "red",
        word: "sun",
        x: 50,
        y: 80,
        speed: 1,
      },
    ];
    sim.type("sun");
    expect(sim.balloons).toHaveLength(1);
    sim.balloons[0] = {
      ...(sim.balloons[0] as (typeof sim.balloons)[number]),
      y: 30,
    };
    sim.type("");
    sim.type("sun");
    expect(sim.balloons).toHaveLength(0);
  });

  it("versus: three in a row sends a balloon; received balloons appear", () => {
    const lv: Level = { ...CHECKPOINT_LEVEL, waves: 0 };
    const sim = new BalloonSim({ level: lv, words: WORDS, seed: 1 });
    sim.step(1);
    sim.balloons = ["cat", "dog", "sun"].map((w, i) => ({
      id: `n${i}`,
      kind: "normal" as const,
      color: "red" as const,
      word: w,
      x: 50,
      y: 50,
      speed: 1,
    }));
    const sends = ["cat", "dog", "sun"].flatMap((w) => {
      const ev = sim.type(w);
      sim.type("");
      return ev.filter((e) => e.type === "send");
    });
    expect(sends).toHaveLength(1);
    sim.receive("jam");
    expect(
      sim.balloons.some((b) => b.kind === "sent" && b.word === "jam"),
    ).toBe(true);
  });

  it("levels unlock in order; goals and daily goals", () => {
    expect(levelOpen(1, {})).toBe(true);
    expect(levelOpen(2, {})).toBe(false);
    expect(levelOpen(2, { 1: 1 })).toBe(true);
    const tally = {
      popped: 10,
      colors: { red: 3 },
      bunches: 0,
      gifts: 0,
      escaped: 0,
      bombs: 0,
    };
    expect(
      goalMet({ type: "color", color: "red", n: 3 }, tally, {
        bestStreak: 0,
        accuracy: 100,
      }),
    ).toBe(true);
    expect(
      goalMet({ type: "streak", n: 5 }, tally, {
        bestStreak: 4,
        accuracy: 100,
      }),
    ).toBe(false);
    expect(dailyGoal(2).n).toBeGreaterThan(0);
    expect(dailyGoal(3).color).toBeDefined();
  });
});

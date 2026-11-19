import { describe, expect, it } from "vitest";

import {
  addGpPoints,
  betterGhost,
  cpsFor,
  cpuDistance,
  cpuFinishSec,
  CpuId,
  ghostDistance,
  gpOrder,
  NITRO_WORDS,
  newUnlocks,
  RaceRun,
  raceStars,
  safeLook,
  soloRaceOver,
  soloStandings,
  SPIN_MISSES,
  tappySeconds,
  targetFor,
  wonBig,
  nextDifficulty,
} from "../../src/ts/games/type-racer/race-rules";

const WORDS = ["cat", "dog", "sun", "red", "big", "elephant", "rainbow", "go"];

/** Type a word letter by letter (like the input box). */
function typeWord(
  run: RaceRun,
  word: string,
  t: number,
): ReturnType<RaceRun["input"]> {
  const events: ReturnType<RaceRun["input"]> = [];
  for (let i = 1; i <= word.length; i++) {
    events.push(...run.input(word.slice(0, i), t));
  }
  return events;
}

describe("type racer rules", () => {
  it("computer racers always move forward", () => {
    const ids: CpuId[] = ["turtle", "tappy", "fox", "bunny", "robot"];
    for (const id of ids) {
      let last = 0;
      for (let t = 0; t <= 90; t += 0.5) {
        const d = cpuDistance(id, 2, t, 60);
        expect(d).toBeGreaterThanOrEqual(last - 1e-9);
        last = d;
      }
    }
  });

  it("the fox starts fast and the turtle finishes last", () => {
    const cps = cpsFor(28);
    expect(cpuDistance("fox", cps, 5, 60)).toBeGreaterThan(
      cpuDistance("tappy", cps, 5, 60),
    );
    const target = targetFor(60);
    const sec = tappySeconds(target, cps);
    const turtle = cpuFinishSec("turtle", cps, target, sec);
    for (const id of ["tappy", "fox", "robot"] as CpuId[]) {
      expect(cpuFinishSec(id, cps, target, sec)).toBeLessThan(turtle);
    }
    expect(
      Math.abs(cpuFinishSec("tappy", cps, target, sec) - sec),
    ).toBeLessThan(4);
  });

  it("every difficulty uses the same track; boosts stay small", () => {
    expect(targetFor(30)).toBe(80);
    expect(targetFor(60)).toBe(160);
    // a 60 WPM typist on the long track: 32 s typing, boosts save < 20%
    const run = new RaceRun({ words: WORDS, target: targetFor(60), seed: 9 });
    const msPerChar = 60_000 / (60 * 5);
    let t = 0;
    let done = 0;
    while (done === 0 && t < 120_000) {
      const w = run.current.text;
      for (let i = 1; i <= w.length && done === 0; i++) {
        t += msPerChar;
        run.input(w.slice(0, i), t);
        if (run.distance(t) >= run.target) done = t;
      }
      t += msPerChar;
    }
    expect(done).toBeGreaterThan(32_000 * 0.8);
  });

  it("suggests a harder level after a big win", () => {
    const me = {
      id: "me",
      name: "Me",
      me: true,
      progress: 1,
      finishMs: 20_000,
    };
    expect(
      wonBig([me, { id: "fox", name: "F", progress: 1, finishMs: 40_000 }]),
    ).toBe(true);
    expect(
      wonBig([me, { id: "fox", name: "F", progress: 1, finishMs: 22_000 }]),
    ).toBe(false);
    expect(nextDifficulty("Easy")).toBe("Medium");
    expect(nextDifficulty("Hard")).toBeUndefined();
  });

  it("typing a word moves the car its length + 1", () => {
    const run = new RaceRun({ words: WORDS, target: 100, seed: 1 });
    const w = run.current.text;
    typeWord(run, w, 0);
    expect(run.words).toBe(1);
    expect(run.distance(10_000)).toBeCloseTo(w.length + 1);
    expect(run.typed).toBe("");
  });

  it("clean words fill nitro, and the nitro word boosts", () => {
    const run = new RaceRun({ words: WORDS, target: 400, seed: 2 });
    let ready = false;
    for (let i = 0; i < NITRO_WORDS; i++) {
      const ev = typeWord(run, run.current.text, i * 1000);
      if (ev.some((e) => e.type === "nitroReady")) ready = true;
    }
    expect(ready).toBe(true);
    // the nitro word is next (or now)
    const slot = run.queue.findIndex((w) => w.kind === "nitro");
    expect(slot).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < slot; i++) typeWord(run, run.current.text, 9000);
    const before = run.distance(10_000);
    const ev = typeWord(run, run.current.text, 10_000);
    expect(ev.some((e) => e.type === "boost")).toBe(true);
    // the nitro word itself + 4% of the track
    expect(run.distance(20_000) - before).toBeGreaterThan(400 * 0.04);
  });

  it("three wrong keys in a row spin you out", () => {
    const run = new RaceRun({ words: ["cat"], target: 100, seed: 3 });
    let spun = false;
    let typed = "";
    for (let i = 0; i < SPIN_MISSES; i++) {
      typed += "x";
      if (run.input(typed, 0).some((e) => e.type === "spin")) spun = true;
    }
    expect(spun).toBe(true);
    expect(run.misses).toBe(SPIN_MISSES);
    expect(run.spinning(100)).toBe(true);
  });

  it("a ramp asks for a long jump word", () => {
    const run = new RaceRun({ words: WORDS, target: 40, seed: 4 });
    let ramp = false;
    for (let i = 0; i < 20 && !ramp; i++) {
      ramp = typeWord(run, run.current.text, i * 1000).some(
        (e) => e.type === "ramp",
      );
    }
    expect(ramp).toBe(true);
    const jump = run.queue.find((w) => w.kind === "jump");
    expect(jump?.text.length).toBeGreaterThanOrEqual(7);
  });

  it("finishes at the line", () => {
    const run = new RaceRun({ words: WORDS, target: 30, seed: 5 });
    let finished = false;
    for (let i = 0; i < 40 && !finished; i++) {
      finished = typeWord(run, run.current.text, i * 500).some(
        (e) => e.type === "finish",
      );
    }
    expect(finished).toBe(true);
    expect(run.finishedAt).toBeDefined();
  });

  it("solo standings: finishing first is 1st, a slow race is last", () => {
    const cpus: CpuId[] = ["turtle", "fox", "tappy", "robot"];
    const base = { cpus, cps: 2, target: 100, raceSec: 50, myName: "Me" };
    const fast = soloStandings({
      ...base,
      endMs: 20_000,
      myDistance: 100,
      myFinishMs: 20_000,
    });
    expect(fast[0]?.me).toBe(true);
    expect(fast).toHaveLength(5);
    const slow = soloStandings({ ...base, endMs: 80_000, myDistance: 10 });
    expect(slow.at(-1)?.me).toBe(true);
    expect(
      soloRaceOver({ ...base, elapsedMs: 10_000, myFinished: false }),
    ).toBe(false);
    expect(
      soloRaceOver({ ...base, elapsedMs: 200_000, myFinished: false }),
    ).toBe(true);
  });

  it("stars by place", () => {
    expect(raceStars(1, 10)).toBe(3);
    expect(raceStars(3, 10)).toBe(2);
    expect(raceStars(5, 10)).toBe(1);
    expect(raceStars(5, 0)).toBe(0);
  });

  it("Grand Prix points and order", () => {
    const race = [
      { id: "fox", name: "Fox", progress: 1, finishMs: 1 },
      { id: "me", name: "Me", progress: 1, finishMs: 2, me: true },
      { id: "turtle", name: "T", progress: 0.5 },
    ];
    let table = addGpPoints({}, race);
    expect(table).toEqual({ fox: 10, me: 6, turtle: 4 });
    table = addGpPoints(table, [race[1], race[0], race[2]] as typeof race);
    expect(table["me"]).toBe(16);
    // tie on 16: the last race's winner (me) goes first
    expect(gpOrder(table, [race[1], race[0], race[2]] as typeof race)[0]).toBe(
      "me",
    );
  });

  it("garage: locked parts fall back, unlocks are reported", () => {
    expect(
      safeLook({ color: "c-mint", sticker: "s-star", driver: "d-cat" }, 4),
    ).toEqual({
      color: "c-blue",
      sticker: "s-star",
      driver: "d-none",
    });
    expect(newUnlocks(2, 4).map((g) => g.id)).toEqual(["c-green", "s-star"]);
  });

  it("ghost replays and only a faster race replaces it", () => {
    const g = { finishMs: 1000, target: 10, d: [0, 2, 4, 6, 10] };
    expect(ghostDistance(g, 125)).toBeCloseTo(1);
    expect(ghostDistance(g, 5000)).toBe(10);
    expect(betterGhost(g, { ...g, finishMs: 900 })).toBe(true);
    expect(betterGhost(g, { ...g, finishMs: 1100 })).toBe(false);
    expect(betterGhost(null, g)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { rankRacers } from "../../src/ts/games/type-racer/racer-result";

const p = (
  id: string,
  progress: number,
  extra: { completed?: boolean; raceMs?: number; finishedAt?: number } = {},
) => ({
  id,
  progress,
  wpm: 20,
  finished: true,
  finishedAt: extra.finishedAt ?? 0,
  completed: extra.completed,
  raceMs: extra.raceMs,
});

describe("rankRacers", () => {
  it("time-up racers rank by progress, not by when their clock stopped", () => {
    const r = rankRacers([
      p("slow", 0.2, { finishedAt: 1000 }),
      p("mid", 0.5, { finishedAt: 2000 }),
      p("fast", 0.9, { finishedAt: 3000 }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["fast", "mid", "slow"]);
  });

  it("finishers first, fastest race time wins regardless of device clock", () => {
    const r = rankRacers([
      p("partial", 0.95),
      p("second", 1, { completed: true, raceMs: 40_000, finishedAt: 1 }),
      p("first", 1, { completed: true, raceMs: 30_000, finishedAt: 999_999 }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["first", "second", "partial"]);
  });

  it("treats full progress from older clients as finished", () => {
    const r = rankRacers([p("a", 0.7), p("old", 1)]);
    expect(r[0]!.id).toBe("old");
  });
});

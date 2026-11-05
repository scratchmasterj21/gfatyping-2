import { describe, expect, it } from "vitest";

import type { RaceStanding } from "../../src/ts/race/race-types";
import {
  assignTeams,
  ropeOffset,
  teamTotals,
  tugCoins,
  tugOutcome,
  tugWinMargin,
} from "../../src/ts/race/tug";

const standing = (over: Partial<RaceStanding>): RaceStanding => ({
  uid: "a",
  name: "A",
  finalWpm: 20,
  finalAcc: 95,
  finishedAt: 1,
  progress: 1,
  rank: 1,
  words: 10,
  team: "red",
  ...over,
});

describe("tug of war", () => {
  it("splits players into even teams", () => {
    const teams = assignTeams(["a", "b", "c", "d", "e"], () => 0.5);
    const reds = Object.values(teams).filter((t) => t === "red").length;
    expect(Object.keys(teams)).toHaveLength(5);
    expect(Math.abs(reds - (5 - reds))).toBeLessThanOrEqual(1);
  });

  it("totals words per team and ignores players without a team", () => {
    const totals = teamTotals(
      [
        { uid: "a", wordIndex: 5 },
        { uid: "b", wordIndex: 3 },
        { uid: "c", wordIndex: 7 },
        { uid: "late", wordIndex: 50 },
      ],
      { a: "red", b: "blue", c: "red" },
    );
    expect(totals).toEqual({ red: 12, blue: 3 });
  });

  it("moves the rope toward the leading team and clamps at the line", () => {
    expect(ropeOffset({ red: 10, blue: 10 }, 20)).toBe(0);
    expect(ropeOffset({ red: 20, blue: 10 }, 20)).toBe(-0.5);
    expect(ropeOffset({ red: 0, blue: 99 }, 20)).toBe(1);
    expect(tugWinMargin(10)).toBe(50);
  });

  it("picks the winner, or a draw", () => {
    expect(tugOutcome({ red: 3, blue: 2 })).toBe("red");
    expect(tugOutcome({ red: 2, blue: 2 })).toBe("draw");
  });

  it("pays participation, winning team and MVP coins", () => {
    expect(tugCoins(standing({}), "red", 10)).toBe(10 + 25 + 15);
    expect(tugCoins(standing({ words: 4 }), "blue", 10)).toBe(10);
    expect(tugCoins(standing({ words: 4 }), "draw", 10)).toBe(10);
    expect(tugCoins(standing({ finishedAt: 0 }), "red", 10)).toBe(0);
  });
});

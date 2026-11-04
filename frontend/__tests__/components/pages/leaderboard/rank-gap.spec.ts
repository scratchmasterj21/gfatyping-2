import { describe, expect, it } from "vitest";

import type { TableEntry } from "../../../../src/ts/components/pages/leaderboard/table-entry";

import { gapToNextLabel } from "../../../../src/ts/components/pages/leaderboard/rank-gap";

const xp = (rank: number, name: string, totalXp: number): TableEntry =>
  ({ rank, name, uid: name, totalXp, timeTypedSeconds: 0 }) as TableEntry;
const wpm = (rank: number, name: string, value: number): TableEntry =>
  ({ rank, name, uid: name, wpm: value, acc: 100 }) as TableEntry;
const race = (rank: number, name: string, w: number, a: number): TableEntry =>
  ({
    rank,
    name,
    uid: name,
    bestRaceWpm: w,
    bestRaceAcc: a,
    totalRaces: 1,
    wins: 0,
  }) as TableEntry;

describe("gapToNextLabel", () => {
  it("needs one more than the gap to pass (xp)", () => {
    const entries = [xp(1, "Mia", 500), xp(2, "Ken", 420)];
    expect(gapToNextLabel(entries, entries[1], "xp")).toBe(
      "81 XP more to pass Mia",
    );
  });

  it("handles ties and decimals", () => {
    const tie = [wpm(1, "A", 40), wpm(2, "B", 40)];
    expect(gapToNextLabel(tie, tie[1], "speed")).toBe("1 WPM more to pass A");
    const dec = [wpm(1, "A", 40.6), wpm(2, "B", 38.2)];
    expect(gapToNextLabel(dec, dec[1], "speed")).toBe("3 WPM more to pass A");
  });

  it("uses the right field for race metrics", () => {
    const entries = [race(1, "A", 50, 98), race(2, "B", 55, 90)];
    expect(gapToNextLabel(entries, entries[1], "raceacc")).toBe(
      "9% more to pass A",
    );
  });

  it("returns undefined for #1, unranked, or missing neighbour", () => {
    const entries = [xp(1, "Mia", 500), xp(5, "Ken", 100)];
    expect(gapToNextLabel(entries, entries[0], "xp")).toBeUndefined();
    expect(gapToNextLabel(entries, undefined, "xp")).toBeUndefined();
    expect(gapToNextLabel(entries, entries[1], "xp")).toBeUndefined();
  });
});

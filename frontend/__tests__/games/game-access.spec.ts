import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({ getDb: () => ({}) }));

import {
  isMostlyGames,
  summarizeActivity,
  tokyoDate,
} from "../../src/ts/classroom/activity";
import {
  checkGameAccess,
  parseGameAccess,
  resolvePolicy,
} from "../../src/ts/games/game-access";

const today = "2026-11-05";
const access = parseGameAccess({
  classes: {
    G5A: { mode: "earn", earnLessons: 2, blocked: ["gem-dig"] },
    G5B: { mode: "off" },
  },
  students: {
    good: { mode: "on" },
    bonus: { bonusDate: today, bonusMinutes: 15 },
    oldBonus: { bonusDate: "2026-11-04", bonusMinutes: 15 },
    ownList: { blocked: [] },
  },
});

describe("game access", () => {
  it("defaults to games on", () => {
    const p = resolvePolicy(access, "G1A", "x", today);
    expect(
      checkGameAccess("word-pong", p, { lessonsPassed: 0, gameSec: 0 }),
    ).toEqual({ allowed: true });
  });

  it("earn: locked until enough lessons, blocked games stay locked", () => {
    const p = resolvePolicy(access, "G5A", "x", today);
    expect(
      checkGameAccess("word-pong", p, { lessonsPassed: 1, gameSec: 0 }),
    ).toEqual({ allowed: false, reason: "earn", lessonsLeft: 1 });
    expect(
      checkGameAccess("word-pong", p, { lessonsPassed: 2, gameSec: 0 }).allowed,
    ).toBe(true);
    expect(
      checkGameAccess("gem-dig", p, { lessonsPassed: 5, gameSec: 0 }),
    ).toEqual({ allowed: false, reason: "blocked" });
  });

  it("student override beats the class", () => {
    const p = resolvePolicy(access, "G5B", "good", today);
    expect(p.mode).toBe("on");
    const own = resolvePolicy(access, "G5A", "ownList", today);
    expect(own.blocked).toEqual([]);
    expect(own.mode).toBe("earn");
  });

  it("bonus time unlocks today only, until used up", () => {
    const p = resolvePolicy(access, "G5B", "bonus", today);
    expect(
      checkGameAccess("word-pong", p, { lessonsPassed: 0, gameSec: 300 }),
    ).toEqual({ allowed: true, bonusLeftMin: 10 });
    expect(
      checkGameAccess("word-pong", p, { lessonsPassed: 0, gameSec: 900 })
        .allowed,
    ).toBe(false);
    const old = resolvePolicy(access, "G5B", "oldBonus", today);
    expect(old.bonusMinutes).toBe(0);
  });
});

describe("activity summary", () => {
  const now = Date.parse("2026-11-05T03:00:00Z");
  const days = {
    [tokyoDate(now)]: { t: 600, l: 400, g: 1200, gp: 3, lx: ["a", "b"] },
    [tokyoDate(now - 86_400_000)]: { t: 0, l: 300, g: 0, gp: 0, lx: ["c"] },
    [tokyoDate(now - 9 * 86_400_000)]: { t: 0, l: 0, g: 9999, gp: 1 },
  };

  it("sums today and the last 7 days", () => {
    expect(summarizeActivity(days, 1, now)).toEqual({
      typingSec: 600,
      gameSec: 1200,
      gamesOpened: 3,
      lessonsPassed: 2,
    });
    const week = summarizeActivity(days, 7, now);
    expect(week.typingSec).toBe(900);
    expect(week.gameSec).toBe(1200);
    expect(isMostlyGames(week)).toBe(true);
  });

  it("does not flag a little game time", () => {
    expect(
      isMostlyGames({
        typingSec: 0,
        gameSec: 300,
        gamesOpened: 1,
        lessonsPassed: 0,
      }),
    ).toBe(false);
  });
});

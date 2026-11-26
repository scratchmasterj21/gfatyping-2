import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({ getDb: () => ({}) }));

import {
  isMostlyGames,
  summarizeActivity,
  tokyoDate,
} from "../../src/ts/classroom/activity";
import { GRADES } from "../../src/ts/constants/classes";
import {
  addDays,
  checkGameAccess,
  gameLockMessage,
  PAUSE_FOREVER,
  parseGameAccess,
  pauseUntilText,
  resolvePolicy,
} from "../../src/ts/games/game-access";
import {
  games,
  gradeRange,
  LEVEL_GAME_IDS,
} from "../../src/ts/games/games-data";
import {
  ALL_KEYS_GROUPS,
  allKeysGroupsDone,
} from "../../src/ts/lessons/achievements";
import { lessonGroups } from "../../src/ts/lessons/lessons-data";

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
    ).toEqual({
      allowed: false,
      reason: "earn",
      lessonsLeft: 1,
      typingMinLeft: 0,
    });
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
      practiceSec: 200,
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

describe("teacher pauses", () => {
  const paused = parseGameAccess({
    students: {
      fingers: {
        mode: "on",
        bonusDate: today,
        bonusMinutes: 30,
        pauseUntil: "2026-11-07",
        pauseReason: "fingers",
      },
      ended: { pauseUntil: "2026-11-04", pauseReason: "behaviour" },
      forever: { pauseUntil: PAUSE_FOREVER },
      bad: { pauseUntil: "soon", pauseReason: "naughty" },
    },
  });
  const day = { lessonsPassed: 5, gameSec: 0 };

  it("a pause beats games on and bonus time, until its last day", () => {
    const p = resolvePolicy(paused, "G1A", "fingers", today);
    const a = checkGameAccess("word-pong", p, day);
    expect(a.allowed).toBe(false);
    expect(!a.allowed && a.reason).toBe("paused");
    expect(gameLockMessage(a)).toContain("home row");
    expect(gameLockMessage(a)).toContain("until Saturday");
    // the last day still counts, the next day doesn't
    expect(
      resolvePolicy(paused, "G1A", "fingers", "2026-11-07").pause,
    ).toBeDefined();
    expect(
      resolvePolicy(paused, "G1A", "fingers", "2026-11-08").pause,
    ).toBeUndefined();
  });

  it("old pauses end; 'until I unpause' doesn't; bad data is ignored", () => {
    expect(resolvePolicy(paused, "G1A", "ended", today).pause).toBeUndefined();
    const f = resolvePolicy(paused, "G1A", "forever", today);
    expect(f.pause?.reason).toBe("other");
    expect(pauseUntilText(PAUSE_FOREVER, today)).toBe("");
    expect(resolvePolicy(paused, "G1A", "bad", today).pause).toBeUndefined();
    expect(pauseUntilText(today, today)).toBe("for today");
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
  });

  it("every free-play game says which grades it suits", () => {
    for (const g of games) {
      if (g.type !== "builtin") continue;
      expect(g.grades.length).toBeGreaterThan(0);
      expect(gradeRange(g.grades)).toMatch(/^G\d(-G\d)?$/);
    }
    for (const grade of GRADES) {
      const fit = games.filter(
        (g) => g.type === "builtin" && g.grades.includes(grade),
      );
      expect(fit.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("easy/medium/hard games need All Keys", () => {
  const keys = parseGameAccess({
    classes: { G2A: { needAllKeys: true } },
    students: { early: { needAllKeys: false }, strict: { needAllKeys: true } },
  });
  const day = { lessonsPassed: 0, gameSec: 0 };
  const notYet = { levelGame: true, allKeysDone: false };

  it("only the level-word games are in the gate", () => {
    expect([...LEVEL_GAME_IDS].sort()).toEqual(
      [
        "echo-keys",
        "four-row",
        "monster-raid",
        "rescue-ship",
        "typing-rpg",
        "word-bomb",
      ].sort(),
    );
    expect(LEVEL_GAME_IDS.has("type-racer")).toBe(false);
    expect(LEVEL_GAME_IDS.has("word-defender")).toBe(false);
  });

  it("classes are open until the teacher switches it on", () => {
    const p = resolvePolicy(keys, "G3A", "x", today);
    expect(p.needAllKeys).toBe(false);
    expect(checkGameAccess("four-row", p, day, notYet).allowed).toBe(true);
  });

  it("locks level games until All Keys is done; lesson games stay open", () => {
    const p = resolvePolicy(keys, "G2A", "x", today);
    const locked = checkGameAccess("four-row", p, day, notYet);
    expect(locked).toEqual({ allowed: false, reason: "keys" });
    expect(gameLockMessage(locked)).toContain("All Keys");
    expect(
      checkGameAccess("four-row", p, day, {
        levelGame: true,
        allKeysDone: true,
      }).allowed,
    ).toBe(true);
    expect(
      checkGameAccess("word-pong", p, day, {
        levelGame: false,
        allKeysDone: false,
      }).allowed,
    ).toBe(true);
  });

  it("a student override wins either way", () => {
    const early = resolvePolicy(keys, "G2A", "early", today);
    expect(early.ownNeedAllKeys).toBe(false);
    expect(checkGameAccess("four-row", early, day, notYet).allowed).toBe(true);
    const strict = resolvePolicy(keys, "G3A", "strict", today);
    expect(checkGameAccess("four-row", strict, day, notYet).allowed).toBe(
      false,
    );
  });

  it("counts finished key groups", () => {
    const done = (ids: string[]) =>
      new Map(ids.map((id) => [id, { completed: true, stars: 2 }]));
    expect(allKeysGroupsDone(new Map())).toBe(0);
    const homeRow =
      lessonGroups.find((g) => g.id === "home-row")?.lessons.map((l) => l.id) ??
      [];
    expect(allKeysGroupsDone(done(homeRow))).toBe(1);
    const every = lessonGroups
      .filter((g) => (ALL_KEYS_GROUPS as readonly string[]).includes(g.id))
      .flatMap((g) => g.lessons.map((l) => l.id));
    expect(allKeysGroupsDone(done(every))).toBe(ALL_KEYS_GROUPS.length);
  });
});

describe("my zoo switch", () => {
  it("is on by default, class can turn it off, student overrides", () => {
    expect(resolvePolicy(undefined, "G1A", "u1").zooOff).toBe(false);
    const access = parseGameAccess({
      classes: { G1A: { zooOff: true } },
      students: { u2: { zooOff: false }, u3: { zooOff: "yes" } },
    });
    expect(resolvePolicy(access, "G1A", "u1").zooOff).toBe(true);
    expect(resolvePolicy(access, "G1A", "u2").zooOff).toBe(false);
    expect(resolvePolicy(access, "G1A", "u3").zooOff).toBe(true);
    expect(resolvePolicy(access, "G2B", "u1").zooOff).toBe(false);
  });
});

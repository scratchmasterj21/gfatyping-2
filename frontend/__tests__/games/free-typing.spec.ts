import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({
  getDb: () => ({}),
  getAuthenticatedUser: () => null,
}));

import { tokyoWeekId } from "../../../api/_lib/time";
import { summarizeActivity, tokyoDate } from "../../src/ts/classroom/activity";
import {
  checkGameAccess,
  earnTodo,
  parseGameAccess,
  resolvePolicy,
} from "../../src/ts/games/game-access";
import {
  badgesFor,
  gardenSize,
  plantFor,
  practiceStars,
  weekId,
} from "../../src/ts/practice/practice-state";
import {
  BAND_NAME,
  bandFor,
  STORIES,
  storiesFor,
} from "../../src/ts/practice/stories";

describe("free typing extras", () => {
  it("stars: every child can reach 3 against their own best", () => {
    // a slow G5 typist (best 10) gets 3 stars at their best with care
    expect(practiceStars(10, 96, "G5", 10)).toBe(3);
    expect(practiceStars(10, 85, "G5", 10)).toBe(1);
    expect(practiceStars(8, 92, "G5", 10)).toBe(2);
    // the grade goal caps it for fast typists
    expect(practiceStars(30, 96, "G5", 60)).toBe(3);
    expect(practiceStars(0, 100, "G1", 10)).toBe(0);
  });

  it("garden and badges", () => {
    expect(gardenSize(0)).toBe(0);
    expect(gardenSize(250)).toBe(2);
    expect(plantFor(0)).toBe("🌱");
    expect(plantFor(12)).toBe(plantFor(0));
    expect(badgesFor(22)).toEqual([5, 10, 15, 20]);
  });

  it("the client's week id matches the server's", () => {
    for (const t of [
      Date.UTC(2026, 10, 16, 0),
      Date.UTC(2026, 10, 22, 16),
      Date.UTC(2026, 10, 23, 1),
    ]) {
      expect(weekId(t)).toBe(tokyoWeekId(t));
    }
  });

  it("stories fit their grade band", () => {
    for (const band of Object.keys(BAND_NAME) as (keyof typeof BAND_NAME)[]) {
      expect(storiesFor(band).length).toBeGreaterThanOrEqual(2);
    }
    for (const s of STORIES) {
      expect(s.chapters).toHaveLength(4);
      for (const ch of s.chapters) {
        expect(ch.text.length).toBeGreaterThan(40);
        expect(ch.text).not.toMatch(/\s{2,}/);
        if (s.band === "g12") expect(ch.text).toMatch(/^[a-z ]+$/);
        if (s.band === "g34") expect(ch.text).toMatch(/^[a-z ,.]+$/);
      }
    }
    expect(bandFor("G1")).toBe("g12");
    expect(bandFor("G4")).toBe("g34");
    expect(bandFor("G6")).toBe("g56");
    expect(bandFor(undefined)).toBe("g34");
  });

  it("teachers can ask for typing minutes before games", () => {
    const access = parseGameAccess({
      classes: { G3A: { mode: "earn", earnLessons: 1, earnTypingMin: 5 } },
      students: { lessonsOnly: { earnTypingMin: 0 } },
    });
    const p = resolvePolicy(access, "G3A", "kid", "2026-11-05");
    expect(p.earnTypingMin).toBe(5);
    const locked = checkGameAccess("gem-dig", p, {
      lessonsPassed: 1,
      gameSec: 0,
      practiceSec: 120,
    });
    expect(locked.allowed).toBe(false);
    expect(!locked.allowed && locked.typingMinLeft).toBe(3);
    expect(
      checkGameAccess("gem-dig", p, {
        lessonsPassed: 1,
        gameSec: 0,
        practiceSec: 300,
      }).allowed,
    ).toBe(true);
    // a student set back to lessons only
    expect(
      resolvePolicy(access, "G3A", "lessonsOnly", "2026-11-05").earnTypingMin,
    ).toBe(0);
    expect(earnTodo(1, 3)).toBe(
      "Get ⭐⭐ on 1 more lesson and type 3 more minutes in Practice today",
    );
    expect(earnTodo(0, 1)).toBe("Type 1 more minute in Practice today");
    // free typing only, no lessons needed
    const practiceOnly = parseGameAccess({
      classes: { G2A: { mode: "earn", earnLessons: 0, earnTypingMin: 3 } },
    });
    const pp = resolvePolicy(practiceOnly, "G2A", "kid", "2026-11-05");
    expect(pp.earnLessons).toBe(0);
    expect(
      checkGameAccess("gem-dig", pp, {
        lessonsPassed: 0,
        gameSec: 0,
        practiceSec: 200,
      }).allowed,
    ).toBe(true);
    // lesson time doesn't count as free typing
    const today = summarizeActivity({ [tokyoDate()]: { t: 600, l: 480 } }, 1);
    expect(today.practiceSec).toBe(120);
  });
});

describe("free typing coins + most improved (server)", async () => {
  const { correctWords, nextWeekBest } =
    await import("../../../api/submit-result");
  it("counts correct words, capped", () => {
    expect(correctWords({ charStats: [250, 3, 0, 0] } as never)).toBe(50);
    expect(correctWords({ charStats: [99999, 0, 0, 0] } as never)).toBe(400);
    expect(correctWords({} as never)).toBe(0);
  });
  it("improvement is this week's best over last week's", () => {
    const w1 = nextWeekBest(undefined, 1, 20, true);
    expect(w1.gain).toBe(0);
    const w2 = nextWeekBest(w1.best, 2, 24, true);
    expect(w2.best).toEqual({ weekId: 2, wpm: 24, prev: 20 });
    expect(w2.gain).toBe(4);
    // a mashed test doesn't count
    expect(nextWeekBest(w2.best, 2, 90, false).best.wpm).toBe(24);
  });
});

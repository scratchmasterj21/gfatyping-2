import { describe, expect, it } from "vitest";

import { tokyoDate } from "../../src/ts/classroom/activity";
import { plantLook } from "../../src/ts/house/garden-items";
import { summarizePractice } from "../../src/ts/house/practice-state";

const now = Date.parse("2026-11-10T03:00:00Z");
const day = (n: number): string => tokyoDate(now - n * 86_400_000);
const lessons = (n: number) => ({
  lx: Array.from({ length: n }, (_, i) => `l${i}`),
});

describe("practice state", () => {
  it("new student: seedlings, not drooping", () => {
    const s = summarizePractice({ activity: {}, now });
    expect(s).toMatchObject({ mood: "new", plantStage: 0, drooping: false });
  });

  it("grows one stage per practice day, blooming at 3", () => {
    const activity = { [day(0)]: lessons(1), [day(2)]: lessons(1) };
    expect(summarizePractice({ activity, now }).plantStage).toBe(2);
    activity[day(5)] = lessons(2);
    expect(summarizePractice({ activity, now })).toMatchObject({
      plantStage: 3,
      mood: "happy",
    });
  });

  it("great day with 3+ ⭐⭐ lessons", () => {
    const s = summarizePractice({ activity: { [day(0)]: lessons(3) }, now });
    expect(s.mood).toBe("great");
  });

  it("sleepy after 1-2 days, droopy after 3", () => {
    expect(
      summarizePractice({ activity: { [day(2)]: lessons(1) }, now }).mood,
    ).toBe("sleepy");
    const s = summarizePractice({ activity: { [day(3)]: lessons(1) }, now });
    expect(s).toMatchObject({ mood: "droopy", drooping: true });
  });

  it("server stamp keeps the droop after activity ages out", () => {
    const s = summarizePractice({
      activity: {},
      lastStarLessonDate: day(20),
      now,
    });
    expect(s).toMatchObject({ drooping: true, daysSince: 20 });
  });

  it("lessons passed on this device count today", () => {
    const s = summarizePractice({
      activity: { [day(4)]: lessons(1) },
      extraTodayLessons: ["a"],
      now,
    });
    expect(s).toMatchObject({ mood: "happy", drooping: false });
  });

  it("only plants change look", () => {
    expect(plantLook({ id: "garden-bench", emoji: "🪑" }, 0).emoji).toBe("🪑");
    expect(plantLook({ id: "garden-tree", emoji: "🌳" }, 0).emoji).toBe("🌱");
    expect(plantLook({ id: "garden-tree", emoji: "🌳" }, 3).emoji).toBe("🌳");
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({ getDb: vi.fn() }));

import { weekDates } from "../../src/ts/classroom/activity";
import { goalCurrent } from "../../src/ts/classroom/class-goals";
import {
  buildWeekReport,
  lastSeenText,
} from "../../src/ts/classroom/week-report";

// Thursday 2026-11-12, 15:00 in Japan
const NOW = Date.parse("2026-11-12T06:00:00Z");

describe("weekDates", () => {
  it("runs Monday to today in Japan", () => {
    expect(weekDates(NOW)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
  });
  it("gives all of last week", () => {
    const last = weekDates(NOW, 1);
    expect(last[0]).toBe("2026-11-02");
    expect(last).toHaveLength(7);
    expect(last[6]).toBe("2026-11-08");
  });
  it("uses Japan time near midnight", () => {
    // Sunday 23:30 UTC = Monday 08:30 Japan
    expect(weekDates(Date.parse("2026-11-15T23:30:00Z"))).toEqual([
      "2026-11-16",
    ]);
  });
});

describe("buildWeekReport", () => {
  const report = buildWeekReport(
    [
      {
        uid: "a",
        name: "Ann",
        activity: {
          "2026-11-03": { t: 300, lx: ["x"] },
          "2026-11-09": { t: 900, lx: ["a", "b"] },
          "2026-11-11": { t: 600, lx: ["c"] },
        },
        lastActive: NOW,
      },
      {
        uid: "b",
        name: "Ben",
        activity: { "2026-11-02": { t: 1200, lx: ["a"] } },
        lastActive: NOW - 9 * 86_400_000,
        stuckLessons: [{ name: "Home row 3", attempts: 6 }],
      },
      {
        uid: "c",
        name: "Cal",
        activity: { "2026-11-10": { t: 30 } },
      },
    ],
    { now: NOW },
  );

  it("splits who practised", () => {
    expect(report.practiced.map((s) => s.name)).toEqual(["Ann"]);
    expect(report.notYet.map((s) => s.name)).toEqual(["Cal", "Ben"]);
    expect(report.stuck.map((s) => s.name)).toEqual(["Ben"]);
  });

  it("marks days practised (1+ min)", () => {
    const ann = report.students.find((s) => s.name === "Ann");
    expect(ann?.practiced).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(report.days.map((d) => d.future)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it("compares with the same weekdays last week", () => {
    expect(report.totals).toEqual({ lessonsPassed: 3, typingSec: 1530 });
    expect(report.prevTotals).toEqual({
      lessonsPassed: 2,
      typingSec: 1500,
      practiced: 2,
    });
    expect(report.improving.map((s) => s.name)).toEqual(["Ann"]);
  });

  it("has no comparison for last week", () => {
    const last = buildWeekReport([], { now: NOW, weeksBefore: 1 });
    expect(last.prevTotals).toBeUndefined();
    expect(last.days.every((d) => !d.future)).toBe(true);
  });
});

describe("lastSeenText", () => {
  it("counts Japan days", () => {
    expect(lastSeenText(NOW, NOW)).toBe("today");
    expect(lastSeenText(NOW - 86_400_000, NOW)).toBe("yesterday");
    expect(lastSeenText(NOW - 3 * 86_400_000, NOW)).toBe("3d ago");
    expect(lastSeenText(0, NOW)).toBe("never");
  });
});

describe("goalCurrent", () => {
  const counts = { totalStars: 120, weekLessons: 14, weekTypingSec: 3_659 };
  it("reads the right count per kind", () => {
    expect(goalCurrent({ stars: 1, reward: "" }, counts)).toBe(120);
    expect(
      goalCurrent({ stars: 1, reward: "", kind: "weekLessons" }, counts),
    ).toBe(14);
    expect(
      goalCurrent({ stars: 1, reward: "", kind: "weekMinutes" }, counts),
    ).toBe(60);
  });
});

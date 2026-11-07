import { describe, expect, it } from "vitest";

import { tokyoDate } from "../../src/ts/classroom/activity";
import { buildWeeklySummary } from "../../src/ts/classroom/weekly-summary";

const NOW = Date.UTC(2026, 10, 7, 3); // Nov 7 2026, noon in Japan
const day = (back: number): string => tokyoDate(NOW - back * 86_400_000);

describe("weekly ClassDojo summary", () => {
  it("totals the week and gives shout-outs by first name", () => {
    const text = buildWeeklySummary(
      "G4A",
      [
        {
          name: "Ann Smith",
          activity: {
            [day(0)]: { t: 600, lx: ["a", "b"] },
            [day(1)]: { t: 600, lx: ["c"] },
            [day(2)]: { t: 300 },
            [day(3)]: { t: 300 },
          },
        },
        { name: "BenLee", activity: { [day(0)]: { t: 120, lx: ["a"] } } },
        { name: "Cal", activity: {} },
        // older than a week: not counted
        { name: "Dee", activity: { [day(9)]: { t: 900, lx: ["x"] } } },
      ],
      { earnLessons: 3, now: NOW },
    );
    expect(text).toContain("G4A weekly report");
    expect(text).toContain("2 of 4 students practiced");
    expect(text).toContain("passing 4 lessons");
    expect(text).toContain("Lesson stars: Ann (3) and Ben (1)");
    expect(text).toContain("Practiced 4+ days: Ann");
    expect(text).not.toContain("Smith");
    expect(text).not.toContain("Lee");
    expect(text).toContain("Great job, G4A");
    expect(text).not.toContain("Dee");
    expect(text).toContain("pass 3 lessons with 2 stars");
  });

  it("encourages a quiet class", () => {
    const text = buildWeeklySummary("G1B", [{ name: "Cal", activity: {} }], {
      now: NOW,
    });
    expect(text).toContain("quiet typing week");
    expect(text).not.toContain("Shout-outs");
    expect(text).not.toContain("unlock the games");
  });
});

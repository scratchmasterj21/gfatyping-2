import { describe, expect, it } from "vitest";

import {
  groupCompletedCount,
  groupStarTotals,
} from "../../src/ts/components/pages/lessons/lesson-group-progress";
import { lessonGroups } from "../../src/ts/lessons/lessons-data";
import { LessonProgress } from "../../src/ts/lessons/lesson-progress";

describe("groupStarTotals", () => {
  it("sums stars across lessons in a group", () => {
    const homeRow = lessonGroups.find((g) => g.id === "home-row");
    expect(homeRow).toBeDefined();
    const progressFor = (id: string): LessonProgress | undefined => {
      if (id === "home-index") {
        return {
          lessonId: id,
          bestWpm: 10,
          bestAcc: 95,
          stars: 2,
          completed: true,
          attempts: 1,
          timeSpent: 60,
          lastAt: 0,
        };
      }
      return undefined;
    };
    const totals = groupStarTotals(
      homeRow as NonNullable<typeof homeRow>,
      progressFor,
    );
    expect(totals.earned).toBe(2);
    expect(totals.max).toBe(homeRow!.lessons.length * 3);
  });
});

describe("groupCompletedCount", () => {
  it("counts completed lessons only", () => {
    const homeRow = lessonGroups.find((g) => g.id === "home-row");
    expect(homeRow).toBeDefined();
    const progressFor = (id: string): LessonProgress | undefined =>
      id === "home-index"
        ? {
            lessonId: id,
            bestWpm: 10,
            bestAcc: 95,
            stars: 1,
            completed: true,
            attempts: 1,
            timeSpent: 60,
            lastAt: 0,
          }
        : undefined;
    expect(
      groupCompletedCount(homeRow as NonNullable<typeof homeRow>, progressFor),
    ).toBe(1);
  });
});

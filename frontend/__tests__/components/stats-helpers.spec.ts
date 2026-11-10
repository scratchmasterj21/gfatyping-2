import { describe, expect, it } from "vitest";

import { tokyoDate } from "../../src/ts/classroom/activity";
import {
  ACHIEVEMENT_GROUPS,
  achievementProgress,
  lastSevenDays,
  speedSeries,
  StatValues,
  upNext,
} from "../../src/ts/components/pages/account/stats-helpers";

const V: StatValues = {
  bestWpm30: 26.4,
  bestWpm60: 22,
  completedTests: 45,
  timeTyping: 3 * 3600 + 100,
  streak: 5,
  level: 8,
  lessonsCompleted: 12,
  lessonStars: 30,
  threeStarLessons: 4,
  raceWins: 2,
};

describe("user stats helpers", () => {
  it("reads the target from the achievement id", () => {
    expect(achievementProgress("speed-30", V)).toEqual({
      current: 26,
      target: 30,
      unit: "wpm",
    });
    expect(achievementProgress("time-5h", V)?.current).toBe(3);
    expect(achievementProgress("streak-7", V)?.target).toBe(7);
    expect(achievementProgress("speed-endurance-50", V)?.current).toBe(22);
    expect(achievementProgress("accuracy-perfect", V)).toBeUndefined();
  });

  it("up next = closest unearned goals", () => {
    const list = ["speed-30", "streak-7", "tests-1000", "level-10"].map(
      (id) => ({ id }),
    );
    const next = upNext(list, (id) => id === "level-10", V, 2);
    expect(next.map((n) => n.achievement.id)).toEqual(["speed-30", "streak-7"]);
  });

  it("every group matches something", () => {
    for (const g of ACHIEVEMENT_GROUPS) {
      expect(g.match(`${g.id === "races" ? "races-" : ""}x`)).toBeDefined();
    }
    expect(ACHIEVEMENT_GROUPS.find((g) => g.match("class-champion"))?.id).toBe(
      "races",
    );
  });

  it("last seven days, oldest first", () => {
    const now = Date.UTC(2026, 10, 10, 3);
    const days = lastSevenDays({ [tokyoDate(now)]: { t: 600, g: 300 } }, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ typingMin: 10, gameMin: 5 });
    expect(days[0]?.typingMin).toBe(0);
  });

  it("speed series is the latest results, oldest first", () => {
    const r = [
      { wpm: 20.4, timestamp: 1 },
      { wpm: 30, timestamp: 3 },
      { wpm: 25, timestamp: 2 },
    ];
    expect(speedSeries(r, 2)).toEqual([25, 30]);
  });
});

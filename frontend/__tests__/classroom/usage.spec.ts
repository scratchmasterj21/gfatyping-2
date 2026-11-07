import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({
  getDb: vi.fn(),
  getRealtimeDb: vi.fn(),
}));

import { tokyoDate } from "../../src/ts/classroom/activity";
import { estimateUsage, SPARK, usageLevel } from "../../src/ts/classroom/usage";

const NOW = Date.UTC(2026, 10, 7, 3);
const today = tokyoDate(NOW);

describe("free plan usage estimate", () => {
  it("counts today's activity and live rooms", () => {
    const e = estimateUsage({
      now: NOW,
      users: [
        { activity: { [today]: { t: 600, lx: ["a", "b"], gp: 2 } } },
        { activity: { [today]: { gp: 1 } } },
        { activity: { "2020-01-01": { t: 999 } } },
      ],
      rooms: {
        pongRooms: { rooms: 1, players: 2 },
        bombRooms: { rooms: 2, players: 7 },
      },
    });
    expect(e.students).toBe(3);
    expect(e.activeToday).toBe(2);
    expect(e.lessonsToday).toBe(2);
    expect(e.gamesToday).toBe(3);
    expect(e.typingMinutesToday).toBe(10);
    expect(e.liveRooms).toBe(3);
    expect(e.playersInRooms).toBe(9);
    expect(e.lines[0]?.limit).toBe(SPARK.firestoreReadsPerDay);
    expect(e.lines.every((l) => l.level === "ok")).toBe(true);
  });

  it("flags levels at 50% and 80%", () => {
    expect(usageLevel(10, 100)).toBe("ok");
    expect(usageLevel(50, 100)).toBe("watch");
    expect(usageLevel(85, 100)).toBe("high");
  });
});

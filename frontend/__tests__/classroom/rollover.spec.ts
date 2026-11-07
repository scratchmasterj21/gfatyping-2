import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({ getDb: vi.fn() }));

import type { Student } from "../../src/ts/classroom/classroom";
import {
  lastRolloverAt,
  nextClassId,
  planRollover,
  studentsInRollover,
  UNDO_WINDOW_MS,
} from "../../src/ts/classroom/rollover";

const st = (uid: string, extra: Partial<Student> = {}): Student => ({
  uid,
  name: uid,
  xp: 0,
  ...extra,
});

describe("new school year", () => {
  it("moves each class up a grade and graduates G6", () => {
    expect(nextClassId("G1A")).toBe("G2A");
    expect(nextClassId("G5B")).toBe("G6B");
    expect(nextClassId("G6A")).toBeNull();
    expect(nextClassId("teachers")).toBeUndefined();
  });

  it("plans moves only for students in a class", () => {
    const plan = planRollover([
      st("a", { classId: "G3A" }),
      st("b", { classId: "G3A" }),
      st("c", { classId: "G6B" }),
      st("t"), // teacher / unassigned
      st("g", { graduated: true }),
    ]);
    expect(plan.moves).toHaveLength(3);
    expect(plan.graduates).toBe(1);
    expect(plan.byClass).toEqual([
      { from: "G3A", to: "G4A", count: 2 },
      { from: "G6B", to: null, count: 1 },
    ]);
  });

  it("offers undo for the latest move-up within 30 days", () => {
    const now = 1_000_000_000_000;
    const list = [
      st("a", { rollover: { from: "G3A", at: now - 1000 } }),
      st("b", { rollover: { from: "G1A", at: now - 5000 } }),
      st("c"),
    ];
    expect(lastRolloverAt(list, now)).toBe(now - 1000);
    expect(studentsInRollover(list, now - 1000).map((s) => s.uid)).toEqual([
      "a",
    ]);
    expect(lastRolloverAt(list, now + UNDO_WINDOW_MS)).toBeUndefined();
    expect(lastRolloverAt([st("c")], now)).toBeUndefined();
  });
});

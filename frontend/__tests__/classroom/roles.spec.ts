import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({ getDb: vi.fn() }));

import { isTeacherDoc, withoutTeachers } from "../../src/ts/classroom/roles";
import { planRollover } from "../../src/ts/classroom/rollover";

describe("teacher role", () => {
  it("spots teacher accounts", () => {
    expect(isTeacherDoc({ role: "teacher" })).toBe(true);
    expect(isTeacherDoc({ role: "admin" })).toBe(false);
    expect(isTeacherDoc({})).toBe(false);
    expect(isTeacherDoc(undefined)).toBe(false);
  });

  it("leaves teachers out of class lists", () => {
    const list = [
      { uid: "a", role: "teacher" },
      { uid: "b" },
      { uid: "c", role: undefined },
    ];
    expect(withoutTeachers(list).map((d) => d.uid)).toEqual(["b", "c"]);
  });

  it("the new-school-year move skips teachers", () => {
    const plan = planRollover([
      { uid: "kid", name: "Kid", xp: 0, classId: "G3A" },
      { uid: "teach", name: "Ms T", xp: 0, classId: "G3A", teacher: true },
    ]);
    expect(plan.moves.map((m) => m.uid)).toEqual(["kid"]);
  });
});

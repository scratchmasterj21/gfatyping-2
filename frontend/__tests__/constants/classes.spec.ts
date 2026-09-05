import { describe, expect, it } from "vitest";

import { gradeOf } from "../../src/ts/constants/classes";

describe("gradeOf", () => {
  it("returns the grade for an assigned class", () => {
    expect(gradeOf("G2B")).toBe("G2");
  });

  it("handles admins and unassigned students", () => {
    expect(gradeOf(null)).toBeUndefined();
    expect(gradeOf(undefined)).toBeUndefined();
  });
});

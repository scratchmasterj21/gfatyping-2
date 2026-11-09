import { describe, expect, it } from "vitest";

import { schoolYearLabel, schoolYearOf } from "../../src/ts/utils/school-year";

describe("school year", () => {
  it("starts in April (Japan time)", () => {
    expect(schoolYearOf(Date.UTC(2026, 10, 10))).toBe(2026); // Nov 2026
    expect(schoolYearOf(Date.UTC(2027, 2, 31, 12))).toBe(2026); // Mar 31 2027
    expect(schoolYearOf(Date.UTC(2027, 3, 1, 3))).toBe(2027); // Apr 1 2027
    // Mar 31 16:00 UTC is already Apr 1 in Japan
    expect(schoolYearOf(Date.UTC(2027, 2, 31, 16))).toBe(2027);
  });

  it("labels like 2026-27", () => {
    expect(schoolYearLabel(2026)).toBe("2026-27");
    expect(schoolYearLabel(2099)).toBe("2099-00");
  });
});

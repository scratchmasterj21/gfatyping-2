import { describe, expect, it } from "vitest";

import {
  tokyoDateString,
  tokyoDayId,
  tokyoWeekId,
} from "../../../api/_lib/time";

describe("tokyoDateString", () => {
  it("changes date at Japan midnight", () => {
    expect(tokyoDateString(Date.parse("2026-08-08T14:59:59.999Z"))).toBe(
      "2026-08-08",
    );
    expect(tokyoDateString(Date.parse("2026-08-08T15:00:00.000Z"))).toBe(
      "2026-08-09",
    );
  });
});

describe("Japan leaderboard periods", () => {
  it("changes daily bucket at Japan midnight", () => {
    const before = Date.parse("2026-08-09T14:59:59.999Z");
    const midnight = Date.parse("2026-08-09T15:00:00.000Z");
    expect(tokyoDayId(midnight)).toBe(tokyoDayId(before) + 1);
  });

  it("changes weekly bucket at Monday midnight in Japan", () => {
    const sundayEnd = Date.parse("2026-08-09T14:59:59.999Z");
    const mondayStart = Date.parse("2026-08-09T15:00:00.000Z");
    expect(tokyoWeekId(sundayEnd)).toBe(Date.parse("2026-08-02T15:00:00.000Z"));
    expect(tokyoWeekId(mondayStart)).toBe(mondayStart);
  });

  it("returns the previous Japan week", () => {
    const now = Date.parse("2026-08-12T03:00:00.000Z");
    expect(tokyoWeekId(now, 1)).toBe(Date.parse("2026-08-02T15:00:00.000Z"));
  });
});

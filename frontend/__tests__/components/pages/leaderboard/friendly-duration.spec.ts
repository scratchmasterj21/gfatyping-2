import { describe, expect, it } from "vitest";

import { friendlyDuration } from "../../../../src/ts/components/pages/leaderboard/friendly-duration";

describe("friendlyDuration", () => {
  it("formats days and hours", () => {
    expect(friendlyDuration(4 * 86400 + 2 * 3600 + 17 * 60)).toBe(
      "4 days 2 hours",
    );
    expect(friendlyDuration(86400 + 3600)).toBe("1 day 1 hour");
    expect(friendlyDuration(2 * 86400)).toBe("2 days");
  });
  it("formats hours and minutes", () => {
    expect(friendlyDuration(5 * 3600 + 12 * 60 + 9)).toBe("5 hours 12 min");
    expect(friendlyDuration(3600)).toBe("1 hour");
  });
  it("formats minutes and below", () => {
    expect(friendlyDuration(3 * 60 + 59)).toBe("3 min");
    expect(friendlyDuration(42)).toBe("less than a minute");
    expect(friendlyDuration(-5)).toBe("less than a minute");
  });
});

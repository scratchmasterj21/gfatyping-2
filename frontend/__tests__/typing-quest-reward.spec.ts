import { describe, expect, it } from "vitest";

import {
  typingQuestPayout,
  validTypingQuestClear,
} from "../../api/_lib/typing-quest-reward";

describe("Typing Quest rewards", () => {
  it("pays the first clear once", () => {
    expect(typingQuestPayout({}, 0)).toEqual({
      coins: 100,
      firstClear: true,
      bonusRepeatClears: 0,
    });
    expect(
      typingQuestPayout(
        {
          typingQuestFirstClear: "2026-09-12",
          typingQuestLastReward: "2026-09-12",
        },
        0,
      ),
    ).toEqual({ coins: 10, firstClear: false, bonusRepeatClears: 1 });
  });

  it("pays 10 coins for 10 repeats, then 1 per clear", () => {
    const dates = { typingQuestFirstClear: "2026-09-12" };
    expect(typingQuestPayout(dates, 9)).toEqual({
      coins: 10,
      firstClear: false,
      bonusRepeatClears: 10,
    });
    expect(typingQuestPayout(dates, 10)).toEqual({
      coins: 1,
      firstClear: false,
      bonusRepeatClears: 10,
    });
    expect(typingQuestPayout(dates, undefined as unknown as number)).toEqual({
      coins: 10,
      firstClear: false,
      bonusRepeatClears: 1,
    });
  });

  it("rejects incomplete or inconsistent clear reports", () => {
    expect(
      validTypingQuestClear({ hits: 13, elapsed: 48, mistakes: 1, score: 447 }),
    ).toBe(true);
    expect(
      validTypingQuestClear({ hits: 2, elapsed: 48, mistakes: 1, score: 447 }),
    ).toBe(false);
    expect(
      validTypingQuestClear({ hits: 13, elapsed: 48, mistakes: 1, score: 500 }),
    ).toBe(false);
  });
});

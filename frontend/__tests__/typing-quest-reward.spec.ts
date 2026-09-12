import { describe, expect, it } from "vitest";

import {
  typingQuestPayout,
  validTypingQuestClear,
} from "../../api/_lib/typing-quest-reward";

describe("Typing Quest rewards", () => {
  it("pays the first clear once", () => {
    expect(typingQuestPayout({}, "2026-09-12")).toEqual({
      coins: 25,
      firstClear: true,
    });
    expect(
      typingQuestPayout(
        {
          typingQuestFirstClear: "2026-09-12",
          typingQuestLastReward: "2026-09-12",
        },
        "2026-09-12",
      ),
    ).toEqual({ coins: 0, firstClear: false });
  });

  it("pays a smaller repeat reward on a later day", () => {
    expect(
      typingQuestPayout(
        {
          typingQuestFirstClear: "2026-09-12",
          typingQuestLastReward: "2026-09-12",
        },
        "2026-09-13",
      ),
    ).toEqual({ coins: 5, firstClear: false });
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

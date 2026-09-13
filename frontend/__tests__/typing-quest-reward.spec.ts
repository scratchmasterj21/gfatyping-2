import { describe, expect, it } from "vitest";

import {
  minimumQuestSecondsForWaves,
  questRewardMultiplier,
  qualifiesForFastMode,
  typingQuestDepthPayout,
  typingQuestPayout,
  validTypingQuestRunTiming,
  validTypingQuestClear,
} from "../../api/_lib/typing-quest-reward";
import {
  monsterCountForWave,
  turnSecondsForWave,
} from "../src/ts/games/typing-rpg/endless-rules";

describe("Typing Quest rewards", () => {
  it("pays the first clear once", () => {
    expect(typingQuestPayout({}, 0, "2026-09-13")).toEqual({
      coins: 100,
      firstClear: true,
      bonusRepeatClears: 0,
    });
    expect(
      typingQuestPayout(
        {
          typingQuestFirstClear: "2026-09-12",
          typingQuestLastReward: "2026-09-12",
          typingQuestBonusRepeatDate: "2026-09-13",
        },
        0,
        "2026-09-13",
      ),
    ).toEqual({ coins: 10, firstClear: false, bonusRepeatClears: 1 });
  });

  it("pays 10 coins for 10 repeats each day, then 1 per clear", () => {
    const dates = {
      typingQuestFirstClear: "2026-09-12",
      typingQuestBonusRepeatDate: "2026-09-13",
    };
    expect(typingQuestPayout(dates, 9, "2026-09-13")).toEqual({
      coins: 10,
      firstClear: false,
      bonusRepeatClears: 10,
    });
    expect(typingQuestPayout(dates, 10, "2026-09-13")).toEqual({
      coins: 1,
      firstClear: false,
      bonusRepeatClears: 10,
    });
    expect(
      typingQuestPayout(dates, undefined as unknown as number, "2026-09-13"),
    ).toEqual({
      coins: 10,
      firstClear: false,
      bonusRepeatClears: 1,
    });
    expect(typingQuestPayout(dates, 10, "2026-09-14")).toEqual({
      coins: 10,
      firstClear: false,
      bonusRepeatClears: 1,
    });
    expect(
      typingQuestPayout(
        { typingQuestFirstClear: "2026-09-12" },
        10,
        "2026-09-13",
      ),
    ).toEqual({
      coins: 10,
      firstClear: false,
      bonusRepeatClears: 1,
    });
  });

  it("shares daily repeat slots across modes while doubling Fast Mode coins", () => {
    const dates = {
      typingQuestFirstClear: "2026-09-12",
      typingQuestBonusRepeatDate: "2026-09-13",
    };
    const tenth = typingQuestPayout(dates, 9, "2026-09-13");
    const eleventh = typingQuestPayout(
      dates,
      tenth.bonusRepeatClears,
      "2026-09-13",
    );
    expect(tenth.coins * questRewardMultiplier("fast")).toBe(20);
    expect(eleventh.coins * questRewardMultiplier("fast")).toBe(2);
    expect(
      typingQuestDepthPayout(20, 79, "fast") * questRewardMultiplier("fast"),
    ).toBe(2);
  });

  it("rejects incomplete or inconsistent clear reports", () => {
    expect(
      validTypingQuestClear({
        hits: 13,
        elapsed: 60,
        mistakes: 1,
        score: 435,
        completedWaves: 1,
      }),
    ).toBe(true);
    expect(
      validTypingQuestClear({
        hits: 2,
        elapsed: 60,
        mistakes: 1,
        score: 435,
        completedWaves: 1,
      }),
    ).toBe(false);
    expect(
      validTypingQuestClear({
        hits: 13,
        elapsed: 60,
        mistakes: 1,
        score: 500,
        completedWaves: 1,
      }),
    ).toBe(false);
    expect(
      validTypingQuestClear({
        hits: 13,
        elapsed: 60,
        mistakes: 1,
        score: 435,
        completedWaves: 2,
      }),
    ).toBe(false);
    expect(
      validTypingQuestClear({
        hits: 30,
        elapsed: 114,
        mistakes: 0,
        score: 486,
        completedWaves: 2,
      }),
    ).toBe(true);
  });

  it("requires enough time to clear every monster in each wave", () => {
    expect(minimumQuestSecondsForWaves(1)).toBe(60);
    expect(minimumQuestSecondsForWaves(2)).toBe(114);
    expect(minimumQuestSecondsForWaves(3)).toBe(178);
    expect(minimumQuestSecondsForWaves(1, "fast")).toBe(24);
    expect(minimumQuestSecondsForWaves(2, "fast")).toBe(48);
    for (let wave = 1; wave <= 100; wave++) {
      expect(minimumQuestSecondsForWaves(wave)).toBe(
        minimumQuestSecondsForWaves(wave - 1) +
          monsterCountForWave(wave) * turnSecondsForWave(wave),
      );
    }
  });

  it("recognizes a qualifying full-length Fast Mode test", () => {
    const result = {
      mode: "time",
      mode2: "30",
      language: "english",
      wpm: 40,
      acc: 95,
      testDuration: 30,
      incompleteTestSeconds: 0,
      afkDuration: 0,
    };
    expect(qualifiesForFastMode(result)).toBe(true);
    expect(qualifiesForFastMode({ ...result, wpm: 39.9 })).toBe(false);
    expect(qualifiesForFastMode({ ...result, acc: 94 })).toBe(false);
    expect(qualifiesForFastMode({ ...result, afkDuration: 1 })).toBe(false);
    expect(qualifiesForFastMode({ ...result, mode2: "15" })).toBe(false);
  });

  it("accepts fast clear timing but rejects an impossibly quick report", () => {
    const clear = {
      hits: 20,
      elapsed: 24,
      mistakes: 0,
      score: 476,
      completedWaves: 1,
    };
    expect(validTypingQuestClear(clear, "fast")).toBe(true);
    expect(
      validTypingQuestClear({ ...clear, elapsed: 20, score: 480 }, "fast"),
    ).toBe(false);
  });

  it("rewards deeper fast runs while sharing a capped daily depth pool", () => {
    expect(typingQuestDepthPayout(1, 0)).toBe(0);
    expect(typingQuestDepthPayout(5, 0)).toBe(4);
    expect(typingQuestDepthPayout(20, 17)).toBe(10);
    expect(typingQuestDepthPayout(20, 80)).toBe(0);
    expect(typingQuestDepthPayout(6, 0, "fast")).toBe(20);
    expect(typingQuestDepthPayout(20, 0, "fast")).toBe(40);
    expect(typingQuestDepthPayout(20, 70, "fast")).toBe(10);
    expect(20 + typingQuestDepthPayout(6, 0, "fast") * 2).toBe(60);
    expect(questRewardMultiplier("normal")).toBe(1);
    expect(questRewardMultiplier("fast")).toBe(2);
  });

  it("requires a server-timed run at least 20 seconds long", () => {
    expect(validTypingQuestRunTiming(1_000, 20_999, 20)).toBe(false);
    expect(validTypingQuestRunTiming(1_000, 21_000, 20)).toBe(true);
    expect(validTypingQuestRunTiming(1_000, 21_000, 23)).toBe(false);
    expect(validTypingQuestRunTiming(1_000, 25_000, 20)).toBe(true);
    expect(validTypingQuestRunTiming(1_000, 7_201_001, 20)).toBe(true);
  });
});

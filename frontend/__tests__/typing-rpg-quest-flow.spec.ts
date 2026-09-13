import { describe, expect, it } from "vitest";

import {
  activeElapsedSeconds,
  canMoveNearPlayerDuringSafety,
  encounterIsSafe,
  remainingTurnMs,
} from "../src/ts/games/typing-rpg/quest-flow";

describe("Typing Quest interruptions and encounter safety", () => {
  it("preserves remaining turn time without changing the eight-second limit", () => {
    expect(remainingTurnMs(8000, 3100)).toBe(4900);
    expect(remainingTurnMs(8000, 9000)).toBe(0);
  });

  it("excludes interrupted time from a quest result", () => {
    expect(activeElapsedSeconds(1000, 18_000, 5000)).toBe(12);
  });

  it("blocks encounters until first movement and through a safety window", () => {
    expect(encounterIsSafe(false, 0, 5000)).toBe(true);
    expect(encounterIsSafe(true, 7500, 7000)).toBe(true);
    expect(encounterIsSafe(true, 7500, 7500)).toBe(false);
  });

  it("keeps monsters out of the safety circle but lets trapped ones leave", () => {
    expect(canMoveNearPlayerDuringSafety(1.3, 1.1, 1.15)).toBe(false);
    expect(canMoveNearPlayerDuringSafety(0.5, 0.6, 1.15)).toBe(true);
  });
});

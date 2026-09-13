import { describe, expect, it } from "vitest";

import {
  depthBonusForWaves,
  monsterCountForWave,
  playerMaxHp,
  turnSecondsForWave,
} from "../src/ts/games/typing-rpg/endless-rules";

describe("Typing Quest endless waves", () => {
  it("reduces the turn to an eight-second floor", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8].map((wave) => turnSecondsForWave(wave)),
    ).toEqual([20, 18, 16, 14, 12, 10, 8, 8]);
    expect(turnSecondsForWave(1, "fast")).toBe(8);
    expect(turnSecondsForWave(10, "fast")).toBe(8);
    expect(playerMaxHp("normal")).toBe(100);
    expect(playerMaxHp("fast")).toBe(50);
  });

  it("adds a monster every two waves up to six", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(monsterCountForWave)).toEqual([
      3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });

  it("caps the depth bonus at ten coins", () => {
    expect([0, 1, 2, 5, 11, 20].map(depthBonusForWaves)).toEqual([
      0, 0, 1, 4, 10, 10,
    ]);
  });
});

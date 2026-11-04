import { describe, expect, it } from "vitest";

import {
  applyMiniGameClaim,
  isMiniGameId,
  MINI_GAME_MAX_COINS_PER_RUN,
  MINI_GAME_PAID_RUNS_PER_DAY,
  miniGameCoins,
} from "../../../api/_lib/mini-game-reward";

describe("miniGameCoins", () => {
  it("pays nothing for zero or invalid scores", () => {
    expect(miniGameCoins("tower-climb", 0)).toBe(0);
    expect(miniGameCoins("tower-climb", -5)).toBe(0);
    expect(miniGameCoins("tower-climb", Number.NaN)).toBe(0);
  });

  it("pays at least 1 and caps per run", () => {
    expect(miniGameCoins("tower-climb", 1)).toBe(1);
    expect(miniGameCoins("tower-climb", 200)).toBe(5);
    expect(miniGameCoins("echo-keys", 1_000_000)).toBe(
      MINI_GAME_MAX_COINS_PER_RUN,
    );
  });
});

describe("applyMiniGameClaim", () => {
  it("counts paid runs per game and caps them for the day", () => {
    let state;
    for (let i = 0; i < MINI_GAME_PAID_RUNS_PER_DAY; i++) {
      const r = applyMiniGameClaim(state, "2026-11-05", "snack-shop", 300);
      expect(r.coins).toBe(5);
      expect(r.capped).toBe(false);
      state = r.next;
    }
    const capped = applyMiniGameClaim(state, "2026-11-05", "snack-shop", 300);
    expect(capped).toMatchObject({ coins: 0, capped: true });
    // other games keep their own allowance
    const other = applyMiniGameClaim(state, "2026-11-05", "echo-keys", 90);
    expect(other.coins).toBe(3);
  });

  it("resets on a new day and ignores zero-score runs", () => {
    const yesterday = {
      date: "2026-11-04",
      runs: { "tower-climb": MINI_GAME_PAID_RUNS_PER_DAY },
    };
    const r = applyMiniGameClaim(yesterday, "2026-11-05", "tower-climb", 80);
    expect(r).toMatchObject({ coins: 2, capped: false });
    expect(r.next).toEqual({ date: "2026-11-05", runs: { "tower-climb": 1 } });
    const zero = applyMiniGameClaim(r.next, "2026-11-05", "tower-climb", 0);
    expect(zero.coins).toBe(0);
    expect(zero.next.runs["tower-climb"]).toBe(1);
  });
});

describe("isMiniGameId", () => {
  it("accepts only the three mini games", () => {
    expect(isMiniGameId("echo-keys")).toBe(true);
    expect(isMiniGameId("balloon-pop")).toBe(false);
    expect(isMiniGameId(3)).toBe(false);
  });
});

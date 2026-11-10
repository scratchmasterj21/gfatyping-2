import { callApi } from "../../api-client";
import { invalidateCoinQueries } from "../../queries/coins";
import { isAuthenticated } from "../../states/core";

// Mirrors api/_lib/mini-game-reward.ts (display only - the server decides).
export type MiniGameId =
  | "tower-climb"
  | "snack-shop"
  | "echo-keys"
  | "word-pong"
  | "gem-dig"
  | "four-row"
  | "word-bomb"
  | "karuta"
  | "goldfish"
  | "shiritori"
  | "monster-raid";
export const MINI_GAME_MAX_COINS_PER_RUN = 8;
export const MINI_GAME_PAID_RUNS_PER_DAY = 3;

export type MiniGameClaim =
  | { kind: "coins"; coins: number }
  | { kind: "capped" }
  | { kind: "none" }
  | { kind: "signedOut" }
  | { kind: "error" };

/** Asks the server for this run's coins (one transaction, capped per day). */
export async function claimMiniGameReward(
  gameId: MiniGameId,
  score: number,
): Promise<MiniGameClaim> {
  if (!isAuthenticated()) return { kind: "signedOut" };
  try {
    const result = await callApi<{
      claimed: boolean;
      coins: number;
      capped?: boolean;
    }>("/api/claim-reward", { type: "miniGame", gameId, score });
    if (result.coins > 0) {
      invalidateCoinQueries();
      return { kind: "coins", coins: result.coins };
    }
    return result.capped === true ? { kind: "capped" } : { kind: "none" };
  } catch (e) {
    console.error("Failed to claim mini game reward:", e);
    return { kind: "error" };
  }
}

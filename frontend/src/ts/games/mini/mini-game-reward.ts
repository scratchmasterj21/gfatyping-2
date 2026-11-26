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
  | "monster-raid"
  | "rescue-ship"
  | "zoo-keeper";
export const MINI_GAME_MAX_COINS_PER_RUN = 8;
export const MINI_GAME_PAID_RUNS_PER_DAY = 3;
/** Mirrors api/_lib/mini-game-reward.ts: Monster Quest pays 5 quests a day. */
export const MONSTER_QUEST_PAID_RUNS_PER_DAY = 5;

export type MiniGameClaim = (
  | { kind: "coins"; coins: number }
  | { kind: "capped" }
  | { kind: "none" }
  | { kind: "signedOut" }
  | { kind: "error" }
) & {
  /** Rescue Ship: my whole pet collection after this run */
  shipPets?: Record<string, number>;
  /** Gem Dig: my whole gem collection after this run */
  digGems?: Record<string, number>;
};

/** Asks the server for this run's coins (one transaction, capped per day). */
export async function claimMiniGameReward(
  gameId: MiniGameId,
  score: number,
  extra?: { pets?: Record<string, number>; gems?: Record<string, number> },
): Promise<MiniGameClaim> {
  if (!isAuthenticated()) return { kind: "signedOut" };
  try {
    const result = await callApi<{
      claimed: boolean;
      coins: number;
      capped?: boolean;
      shipPets?: Record<string, number>;
      digGems?: Record<string, number>;
    }>("/api/claim-reward", { type: "miniGame", gameId, score, ...extra });
    const pets = {
      ...(result.shipPets === undefined ? {} : { shipPets: result.shipPets }),
      ...(result.digGems === undefined ? {} : { digGems: result.digGems }),
    };
    if (result.coins > 0) {
      invalidateCoinQueries();
      return { kind: "coins", coins: result.coins, ...pets };
    }
    return result.capped === true
      ? { kind: "capped", ...pets }
      : { kind: "none", ...pets };
  } catch (e) {
    console.error("Failed to claim mini game reward:", e);
    return { kind: "error" };
  }
}

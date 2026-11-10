/**
 * Coin rules for the solo "mini games" (Tappy's Tower Climb, Snack Shop,
 * Echo Keys). Pure so it can be unit-tested; claim-reward.ts applies it
 * inside a transaction. Mirrored for display in
 * frontend/src/ts/games/mini/mini-game-reward.ts.
 */
export const MINI_GAME_IDS = [
  "tower-climb",
  "snack-shop",
  "echo-keys",
  "word-pong",
  "gem-dig",
  "four-row",
  "word-bomb",
  "karuta",
  "goldfish",
  "shiritori",
  "monster-raid",
] as const;
export type MiniGameId = (typeof MINI_GAME_IDS)[number];

/** Score needed per coin, tuned so a decent run earns ~4-6 coins. */
export const MINI_GAME_SCORE_PER_COIN: Record<MiniGameId, number> = {
  "tower-climb": 40,
  "snack-shop": 60,
  "echo-keys": 30,
  // 10 per point won + 30 for a win: a 7-point win (100) caps at 8 coins
  "word-pong": 12,
  // 5 per block, 10 per gem, +30 for first: a full winning dig (~170) caps at 8
  "gem-dig": 22,
  // 30 per board + 30 for the match + 2 per piece: a 2-0 win (~120) caps at 8
  "four-row": 15,
  // 5 per pass + 10 per player outlasted + 40 for a win: a good win caps at 8
  "word-bomb": 15,
  // 10 per card + 30 for most cards
  karuta: 15,
  // points = kana scooped (golden fish x2) + 30 for first
  goldfish: 12,
  // same scoring as Word Bomb
  shiritori: 15,
  // damage + 5 per block + 40 for a win + 20 for MVP: a good win caps at 8
  "monster-raid": 15,
};
export const MINI_GAME_MAX_COINS_PER_RUN = 8;
export const MINI_GAME_PAID_RUNS_PER_DAY = 3;
/** Anything above this is not a real run. */
export const MINI_GAME_MAX_SCORE = 50_000;

export function isMiniGameId(id: unknown): id is MiniGameId {
  return (
    typeof id === "string" && (MINI_GAME_IDS as readonly string[]).includes(id)
  );
}

/** Coins for one run: 0 for no score, otherwise 1..MAX scaled by score. */
export function miniGameCoins(gameId: MiniGameId, score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const raw = Math.floor(score / MINI_GAME_SCORE_PER_COIN[gameId]);
  return Math.min(MINI_GAME_MAX_COINS_PER_RUN, Math.max(1, raw));
}

export type MiniGameRewardState = {
  date: string;
  runs: Partial<Record<MiniGameId, number>>;
};

/**
 * Decides one claim against today's state. Returns the coins to add and the
 * state to store (runs reset when the Tokyo date changes).
 */
export function applyMiniGameClaim(
  stored: MiniGameRewardState | undefined,
  today: string,
  gameId: MiniGameId,
  score: number,
): { coins: number; capped: boolean; next: MiniGameRewardState } {
  const runs = stored?.date === today ? { ...stored.runs } : {};
  const used = runs[gameId] ?? 0;
  if (used >= MINI_GAME_PAID_RUNS_PER_DAY) {
    return { coins: 0, capped: true, next: { date: today, runs } };
  }
  const coins = miniGameCoins(gameId, score);
  if (coins === 0) {
    return { coins: 0, capped: false, next: { date: today, runs } };
  }
  runs[gameId] = used + 1;
  return { coins, capped: false, next: { date: today, runs } };
}

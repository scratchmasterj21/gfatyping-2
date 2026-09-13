export const TYPING_QUEST_FIRST_CLEAR_REWARD = 100;
export const TYPING_QUEST_BONUS_REPEAT_REWARD = 10;
export const TYPING_QUEST_FARM_REWARD = 1;
export const TYPING_QUEST_BONUS_REPEAT_LIMIT = 10;
// Stored as unmultiplied depth units, so normal/fast runs share one daily pool.
export const TYPING_QUEST_DEPTH_DAILY_LIMIT = 80;
export type TypingQuestMode = "normal" | "fast";

export function questRewardMultiplier(mode: TypingQuestMode): number {
  return mode === "fast" ? 2 : 1;
}

export function qualifiesForFastMode(result: {
  mode: string;
  mode2: string | number;
  language: string;
  wpm: number;
  acc: number;
  testDuration: number;
  incompleteTestSeconds?: number;
  afkDuration?: number;
}): boolean {
  return (
    result.mode === "time" &&
    String(result.mode2) === "30" &&
    result.language === "english" &&
    result.wpm >= 40 &&
    result.acc >= 95 &&
    result.testDuration >= 29 &&
    result.testDuration <= 31 &&
    (result.incompleteTestSeconds ?? 0) === 0 &&
    (result.afkDuration ?? 0) === 0
  );
}

type Clear = {
  score: number;
  elapsed: number;
  hits: number;
  mistakes: number;
  completedWaves: number;
};

export function minimumQuestSecondsForWaves(
  completedWaves: number,
  mode: TypingQuestMode = "normal",
): number {
  let seconds = 0;
  for (let wave = 1; wave <= completedWaves; wave++) {
    seconds +=
      Math.min(6, 3 + Math.floor((wave - 1) / 2)) *
      (mode === "fast" ? 8 : Math.max(8, 20 - (wave - 1) * 2));
  }
  return seconds;
}

export function typingQuestDepthPayout(
  completedWaves: number,
  paidToday: number,
  mode: TypingQuestMode = "normal",
): number {
  const earned = Math.min(
    mode === "fast" ? 40 : 10,
    Math.max(0, completedWaves - 1) * (mode === "fast" ? 4 : 1),
  );
  const used = Number.isInteger(paidToday) ? Math.max(0, paidToday) : 0;
  const remaining = Math.max(0, TYPING_QUEST_DEPTH_DAILY_LIMIT - used);
  return Math.min(earned, remaining);
}

export function validTypingQuestRunTiming(
  startedAt: number,
  now: number,
  elapsed: number,
): boolean {
  const wallMs = now - startedAt;
  return (
    Number.isFinite(startedAt) &&
    wallMs >= 20_000 &&
    elapsed * 1000 <= wallMs + 2_000
  );
}

export function validTypingQuestClear(
  clear: Clear,
  mode: TypingQuestMode = "normal",
): boolean {
  return (
    Number.isInteger(clear.hits) &&
    clear.hits >= 10 &&
    Number.isInteger(clear.completedWaves) &&
    clear.completedWaves >= 1 &&
    clear.completedWaves <= 500 &&
    Number.isInteger(clear.elapsed) &&
    clear.elapsed >=
      minimumQuestSecondsForWaves(clear.completedWaves, mode) - 2 &&
    clear.elapsed <= 28_800 &&
    Number.isInteger(clear.mistakes) &&
    clear.mistakes >= 0 &&
    Number.isInteger(clear.score) &&
    clear.score ===
      Math.max(
        100,
        500 +
          100 * (clear.completedWaves - 1) -
          clear.elapsed -
          clear.mistakes * 5,
      )
  );
}

export function typingQuestPayout(
  rewardDates: Record<string, string>,
  bonusRepeatClears: number,
  today: string,
): { coins: number; firstClear: boolean; bonusRepeatClears: number } {
  const firstClear = rewardDates["typingQuestFirstClear"] === undefined;
  const used =
    rewardDates["typingQuestBonusRepeatDate"] === today &&
    Number.isInteger(bonusRepeatClears)
      ? Math.max(
          0,
          Math.min(TYPING_QUEST_BONUS_REPEAT_LIMIT, bonusRepeatClears),
        )
      : 0;
  return {
    coins: firstClear
      ? TYPING_QUEST_FIRST_CLEAR_REWARD
      : used < TYPING_QUEST_BONUS_REPEAT_LIMIT
        ? TYPING_QUEST_BONUS_REPEAT_REWARD
        : TYPING_QUEST_FARM_REWARD,
    firstClear,
    bonusRepeatClears: firstClear
      ? used
      : Math.min(TYPING_QUEST_BONUS_REPEAT_LIMIT, used + 1),
  };
}

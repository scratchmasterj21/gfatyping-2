export const TYPING_QUEST_FIRST_CLEAR_REWARD = 100;
export const TYPING_QUEST_BONUS_REPEAT_REWARD = 10;
export const TYPING_QUEST_FARM_REWARD = 1;
export const TYPING_QUEST_BONUS_REPEAT_LIMIT = 10;

type Clear = { score: number; elapsed: number; hits: number; mistakes: number };

export function validTypingQuestClear(clear: Clear): boolean {
  return (
    Number.isInteger(clear.hits) &&
    clear.hits >= 10 &&
    Number.isInteger(clear.elapsed) &&
    clear.elapsed >= 20 &&
    clear.elapsed <= 3600 &&
    Number.isInteger(clear.mistakes) &&
    clear.mistakes >= 0 &&
    Number.isInteger(clear.score) &&
    clear.score === Math.max(100, 500 - clear.elapsed - clear.mistakes * 5)
  );
}

export function typingQuestPayout(
  rewardDates: Record<string, string>,
  bonusRepeatClears: number,
): { coins: number; firstClear: boolean; bonusRepeatClears: number } {
  const firstClear = rewardDates["typingQuestFirstClear"] === undefined;
  const used = Number.isInteger(bonusRepeatClears)
    ? Math.max(0, Math.min(TYPING_QUEST_BONUS_REPEAT_LIMIT, bonusRepeatClears))
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

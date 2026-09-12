export const TYPING_QUEST_FIRST_CLEAR_REWARD = 25;
export const TYPING_QUEST_REPEAT_REWARD = 5;

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
  today: string,
): { coins: number; firstClear: boolean } {
  if (rewardDates["typingQuestLastReward"] === today) {
    return { coins: 0, firstClear: false };
  }
  const firstClear = rewardDates["typingQuestFirstClear"] === undefined;
  return {
    coins: firstClear
      ? TYPING_QUEST_FIRST_CLEAR_REWARD
      : TYPING_QUEST_REPEAT_REWARD,
    firstClear,
  };
}

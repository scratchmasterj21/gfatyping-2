import { callApi } from "../../api-client";
import { invalidateCoinQueries } from "../../queries/coins";

export type TypingQuestClear = {
  score: number;
  elapsed: number;
  hits: number;
  mistakes: number;
};

export type TypingQuestReward = {
  claimed: boolean;
  firstClear: boolean;
  coins: number;
  bonusRepeatClears?: number;
};

export async function claimTypingQuestReward(
  clear: TypingQuestClear,
  runId: string,
): Promise<TypingQuestReward> {
  const reward = await callApi<TypingQuestReward>("/api/claim-reward", {
    type: "typingQuest",
    runId,
    ...clear,
  });
  if (reward.coins > 0) invalidateCoinQueries();
  return reward;
}

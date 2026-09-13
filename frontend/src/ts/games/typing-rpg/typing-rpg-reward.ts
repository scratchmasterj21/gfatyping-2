import { callApi } from "../../api-client";
import { invalidateCoinQueries } from "../../queries/coins";
import type { QuestMode } from "./endless-rules";

export type TypingQuestClear = {
  score: number;
  elapsed: number;
  hits: number;
  mistakes: number;
  completedWaves: number;
  outcome: "left" | "defeated";
};

export type TypingQuestReward = {
  claimed: boolean;
  firstClear: boolean;
  coins: number;
  bonusRepeatClears?: number;
  baseCoins: number;
  depthCoins: number;
  bestWave?: number;
};

export async function getTypingQuestStatus(): Promise<{
  fastUnlocked: boolean;
}> {
  return callApi<{ fastUnlocked: boolean }>("/api/claim-reward", {
    type: "typingQuestStatus",
  });
}

export async function startTypingQuestRun(mode: QuestMode = "normal"): Promise<{
  runId: string;
  bestWave: number;
  mode: QuestMode;
}> {
  return callApi<{ runId: string; bestWave: number; mode: QuestMode }>(
    "/api/claim-reward",
    {
      type: "typingQuestStart",
      mode,
    },
  );
}

export async function claimTypingQuestReward(
  clear: TypingQuestClear,
  runId: string,
): Promise<TypingQuestReward> {
  const reward = await callApi<TypingQuestReward>("/api/claim-reward", {
    type: "typingQuest",
    runId,
    ...clear,
  });
  invalidateCoinQueries();
  return reward;
}

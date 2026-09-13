export type QuestMode = "normal" | "fast";

export function playerMaxHp(mode: QuestMode): number {
  return mode === "fast" ? 50 : 100;
}

export function turnSecondsForWave(
  wave: number,
  mode: QuestMode = "normal",
): number {
  return mode === "fast" ? 8 : Math.max(8, 20 - (wave - 1) * 2);
}

export function monsterCountForWave(wave: number): number {
  return Math.min(6, 3 + Math.floor((wave - 1) / 2));
}

export function depthBonusForWaves(completedWaves: number): number {
  return Math.min(10, Math.max(0, completedWaves - 1));
}

import type { TableEntry } from "./table-entry";

export type RankingType = "speed" | "xp" | "racewpm" | "raceacc";

function scoreOf(entry: TableEntry, type: RankingType): number | undefined {
  if (type === "xp" && "totalXp" in entry) return entry.totalXp;
  if (type === "speed" && "wpm" in entry) return entry.wpm;
  if (type === "racewpm" && "bestRaceWpm" in entry) return entry.bestRaceWpm;
  if (type === "raceacc" && "bestRaceAcc" in entry) return entry.bestRaceAcc;
  return undefined;
}

const UNIT: Record<RankingType, string> = {
  xp: "XP",
  speed: "WPM",
  racewpm: "WPM",
  raceacc: "%",
};

/**
 * Friendly "how far to the next spot" hint for the student's own card,
 * computed from entries that are already loaded (no extra reads).
 * Undefined when the student is #1, unranked, or the person ahead
 * isn't in the loaded page.
 */
export function gapToNextLabel(
  entries: TableEntry[],
  self: TableEntry | undefined,
  type: RankingType,
): string | undefined {
  if (self?.rank === undefined || self.rank <= 1) return undefined;
  const aheadRank = self.rank - 1;
  const ahead = entries.find((e) => e.rank === aheadRank);
  if (ahead === undefined) return undefined;
  const mine = scoreOf(self, type);
  const theirs = scoreOf(ahead, type);
  if (mine === undefined || theirs === undefined) return undefined;
  // floor + 1 so the student actually passes, not ties
  const gap = Math.max(1, Math.floor(theirs - mine) + 1);
  const unit = UNIT[type];
  const amount = unit === "%" ? `${gap}%` : `${gap} ${unit}`;
  return `${amount} more to pass ${ahead.name}`;
}

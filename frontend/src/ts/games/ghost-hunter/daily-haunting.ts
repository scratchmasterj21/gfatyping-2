import {
  DailyClassScore,
  getDailyClassBoard,
  submitDailyBest,
} from "../shared/daily-board";
import { getWordListOptions } from "../word-defender/systems/vocab-pool";
import { seededRng } from "./ghost-kinds";

/**
 * Daily Haunting: the same word list, words and ghosts for everyone today
 * (5 waves, Medium, Ghost King at the end). Best score per class lives in
 * one small doc per day (dailyGhost/{day}), written by
 * api/save-game-result.ts.
 */

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAILY_WAVES = 5;
const DAILY_WORDS = 40;
/** Word lists the daily rotates through (kid-friendly ones). */
const DAILY_LISTS = [
  "home-words",
  "all-keys-3",
  "top-words",
  "all-keys-1",
  "bottom-words",
  "all-keys-4",
];

/** Today in Japan, as a day number (matches the server). */
export const dailyDay = (now = Date.now()): number =>
  Math.floor((now + TOKYO_OFFSET_MS) / DAY_MS);

export type DailyPlan = {
  day: number;
  listId: string;
  label: string;
  /** word list group, for the normal game result */
  group: string;
  seed: number;
};

export function dailyPlan(day: number): DailyPlan {
  const listId = DAILY_LISTS[day % DAILY_LISTS.length] ?? "home-words";
  const option = getWordListOptions().find((o) => o.id === listId);
  return {
    day,
    listId,
    label: option === undefined ? listId : `${option.group} · ${option.label}`,
    group: option?.group ?? "",
    seed: day * 7919 + 13,
  };
}

/** Today's words, in the same order for everyone. */
export async function getDailyWords(plan: DailyPlan): Promise<string[]> {
  const option = getWordListOptions().find((o) => o.id === plan.listId);
  const words = [...new Set(await (option?.getWords() ?? []))].sort();
  const rng = seededRng(plan.seed);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [words[i], words[j]] = [words[j] as string, words[i] as string];
  }
  return words.slice(0, DAILY_WORDS);
}

export type { DailyClassScore } from "../shared/daily-board";

/** Best classes first. */
export const getDailyBoard = async (day: number): Promise<DailyClassScore[]> =>
  getDailyClassBoard("dailyGhost", day);

/** Send my score; true if it's my class's new best today. */
export const submitDailyScore = async (
  day: number,
  score: number,
): Promise<boolean> => submitDailyBest("dailyGhost", day, score);

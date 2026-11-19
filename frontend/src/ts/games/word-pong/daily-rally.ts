import { dailyDay, getDailyWords } from "../ghost-hunter/daily-haunting";
import { getWordListOptions } from "../word-defender/systems/vocab-pool";

/**
 * Daily Rally: hit the ball back off a wall as long as you can. Everyone
 * gets the same words today; the longest rally per class goes on the board
 * (dailyRally/{day}, see shared/daily-board.ts).
 */

const RALLY_LISTS = [
  "top-words",
  "home-words",
  "all-keys-2",
  "bottom-words",
  "all-keys-3",
  "all-keys-1",
];

export { dailyDay };

export type RallyPlan = { day: number; listId: string; label: string };

export function rallyPlan(day: number): RallyPlan {
  const listId = RALLY_LISTS[day % RALLY_LISTS.length] ?? "home-words";
  const option = getWordListOptions().find((o) => o.id === listId);
  return {
    day,
    listId,
    label: option === undefined ? listId : `${option.group} · ${option.label}`,
  };
}

/** Today's rally words, in the same order for everyone. */
export const getRallyWords = async (plan: RallyPlan): Promise<string[]> =>
  getDailyWords({
    day: plan.day,
    listId: plan.listId,
    label: plan.label,
    group: "",
    seed: plan.day * 6007 + 29,
  });

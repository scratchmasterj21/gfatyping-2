import { dailyDay, getDailyWords } from "../ghost-hunter/daily-haunting";
import { getWordListOptions } from "./systems/vocab-pool";

/**
 * Daily Mission: the same 8 waves (and mothership) for everyone today. The
 * best score per class goes on the board (dailyDefender/{day}).
 */

const MISSION_LISTS = [
  "top-words",
  "home-words",
  "all-keys-3",
  "bottom-words",
  "all-keys-1",
  "all-keys-2",
];

export { dailyDay };

export const MISSION_WAVES = 8;

export type MissionPlan = {
  day: number;
  listId: string;
  label: string;
  seed: number;
};

export function missionPlan(day: number): MissionPlan {
  const listId = MISSION_LISTS[day % MISSION_LISTS.length] ?? "home-words";
  const option = getWordListOptions().find((o) => o.id === listId);
  return {
    day,
    listId,
    label: option === undefined ? listId : `${option.group} · ${option.label}`,
    seed: day * 5003 + 17,
  };
}

/** Today's mission words, the same for everyone. */
export const getMissionWords = async (plan: MissionPlan): Promise<string[]> =>
  getDailyWords({
    day: plan.day,
    listId: plan.listId,
    label: plan.label,
    group: "",
    seed: plan.seed,
  });

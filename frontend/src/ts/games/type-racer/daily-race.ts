import { dailyDay, getDailyWords } from "../ghost-hunter/daily-haunting";
import { getWordListOptions } from "../word-defender/systems/vocab-pool";
import { RACE_DIFFICULTIES, RaceDifficulty, TrackId } from "./race-rules";

/**
 * Daily Race: the same words, track and racers for everyone today. The best
 * WPM per class goes on the board (dailyRace/{day}, see shared/daily-board).
 */

const RACE_LISTS = [
  "home-words",
  "all-keys-1",
  "top-words",
  "all-keys-2",
  "bottom-words",
  "all-keys-3",
];
const DAILY_TRACKS: TrackId[] = ["city", "desert", "snow", "space"];

export { dailyDay };

export type RacePlan = {
  day: number;
  listId: string;
  label: string;
  track: TrackId;
  seed: number;
};

/** Daily races are Medium, standard length. */
export const DAILY_DIFFICULTY = RACE_DIFFICULTIES[1] as RaceDifficulty;
export const DAILY_SECONDS = 60;

export function racePlan(day: number): RacePlan {
  const listId = RACE_LISTS[day % RACE_LISTS.length] ?? "home-words";
  const option = getWordListOptions().find((o) => o.id === listId);
  return {
    day,
    listId,
    label: option === undefined ? listId : `${option.group} · ${option.label}`,
    track: DAILY_TRACKS[day % DAILY_TRACKS.length] ?? "city",
    seed: day * 4099 + 71,
  };
}

/** Today's race words, in the same order for everyone. */
export const getRaceWords = async (plan: RacePlan): Promise<string[]> =>
  getDailyWords({
    day: plan.day,
    listId: plan.listId,
    label: plan.label,
    group: "",
    seed: plan.seed,
  });

import { callApi } from "../api-client";
import { tokyoDate } from "../classroom/activity";
import { invalidateCoinQueries } from "../queries/coins";

/** A daily house chore: type its words to get it done. */
export type HouseChore = {
  id: string;
  emoji: string;
  title: string;
  words: string[];
};

export const HOUSE_CHORES: HouseChore[] = [
  {
    id: "roof",
    emoji: "🔧",
    title: "Fix the leaky roof",
    words: ["nail", "drip", "fix", "roof", "tap"],
  },
  {
    id: "plants",
    emoji: "🪴",
    title: "Water the plants",
    words: ["water", "pour", "leaf", "grow", "sun"],
  },
  {
    id: "dishes",
    emoji: "🍽️",
    title: "Wash the dishes",
    words: ["soap", "cup", "dish", "wash", "dry"],
  },
  {
    id: "pets",
    emoji: "🐶",
    title: "Feed the pets",
    words: ["food", "bowl", "yum", "pet", "treat"],
  },
  {
    id: "sweep",
    emoji: "🧹",
    title: "Sweep the floor",
    words: ["broom", "dust", "sweep", "mop", "clean"],
  },
  {
    id: "laundry",
    emoji: "👕",
    title: "Fold the laundry",
    words: ["sock", "shirt", "fold", "pile", "neat"],
  },
  {
    id: "windows",
    emoji: "🪟",
    title: "Clean the windows",
    words: ["wipe", "glass", "shine", "clear", "rag"],
  },
];

export const HOUSE_CHORE_COINS = 5;

/** Same chore for everyone on a given Japan date. */
export function choreForDate(date = tokyoDate()): HouseChore {
  let hash = 0;
  for (const ch of date) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return HOUSE_CHORES[hash % HOUSE_CHORES.length] as HouseChore;
}

/** Pays the chore coins - once per Japan day, checked server-side. */
export async function claimHouseChore(): Promise<{
  claimed: boolean;
  coins: number;
}> {
  const result = await callApi<{ claimed: boolean; coins: number }>(
    "/api/claim-reward",
    { type: "houseChore" },
  );
  invalidateCoinQueries();
  return result;
}

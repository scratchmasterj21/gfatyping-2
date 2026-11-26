import { callApi } from "../../api-client";
import { invalidateCoinQueries } from "../../queries/coins";
import { getUserDocShared } from "../../utils/shared-user-doc";
import type { QuestLevel } from "../game-access";
import {
  FREE_HEROES,
  HERO_SETS,
  HeroClass,
  HeroSetInfo,
  setOfHero,
} from "./quest-rules";

/**
 * Monster Quest heroes you buy with coins. Prices mirror api/_lib/catalogs.ts
 * (CATALOGS.questHero, QUEST_HERO_SETS) - the server decides.
 */
export const QUEST_HERO_PRICE = 90;
/** a whole set at once (less if you own some of it already) */
export const QUEST_SET_PRICE = 300;

export function questSetPrice(missing: number): number {
  return Math.min(QUEST_SET_PRICE, missing * QUEST_HERO_PRICE);
}

/** TanStack query key (also in COIN_QUERY_KEYS). */
export const QUEST_HEROES_KEY = "questHeroState";

export type QuestHeroState = {
  coins: number;
  /** bought heroes */
  owned: HeroClass[];
};

const BOUGHT: HeroClass[] = HERO_SETS.flatMap((s) => s.heroes);

export function questHeroStateFromDoc(
  data: Record<string, unknown> | undefined,
): QuestHeroState {
  const raw = (data?.["ownedQuestHeroes"] ?? {}) as Record<string, unknown>;
  return {
    coins: (data?.["coins"] as number | undefined) ?? 0,
    owned: BOUGHT.filter((h) => raw[h] === true),
  };
}

export async function getQuestHeroState(uid: string): Promise<QuestHeroState> {
  const snap = await getUserDocShared(uid);
  return questHeroStateFromDoc(snap.exists() ? snap.data() : undefined);
}

export const isFreeHero = (cls: HeroClass): boolean =>
  (FREE_HEROES as HeroClass[]).includes(cls);

/** Free heroes always; bought ones only if owned (and not switched off). */
export function canPlayHero(
  cls: HeroClass,
  owned: readonly HeroClass[],
  heroesOff: boolean,
): boolean {
  return isFreeHero(cls) || (!heroesOff && owned.includes(cls));
}

/** Full-set bonus: you own every hero in the set. */
export function ownsFullSet(
  set: HeroSetInfo,
  owned: readonly HeroClass[],
): boolean {
  return set.heroes.every((h) => owned.includes(h));
}

/** Titles earned from full sets (shown in the hero picker). */
export function setTitles(owned: readonly HeroClass[]): string[] {
  return HERO_SETS.filter((s) => ownsFullSet(s, owned)).map((s) => s.title);
}

export const fullSetOf = (
  cls: HeroClass,
  owned: readonly HeroClass[],
): boolean => {
  const set = setOfHero(cls);
  return set !== undefined && ownsFullSet(set, owned);
};

/** Buys one hero, or a whole set with "set:<id>" - checked server-side. */
export async function buyQuestHero(
  itemId: HeroClass | `set:${string}`,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "questHero", itemId },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy a quest hero:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/**
 * Quest words follow lesson progress, not a student's pick (kids always pick
 * the easiest). Each step needs its lesson group finished.
 */
export const QUEST_LEVEL_STEPS: {
  level: QuestLevel;
  requires: string;
  requiresName: string;
}[] = [
  { level: "Medium", requires: "top-row", requiresName: "Top Row" },
  { level: "Hard", requires: "all-keys", requiresName: "All Keys" },
];

/** The teacher's fixed level wins; otherwise the highest step finished. */
export function questLevelFor(
  groupDone: (groupId: string) => boolean,
  teacher?: QuestLevel,
): QuestLevel {
  if (teacher !== undefined) return teacher;
  let level: QuestLevel = "Easy";
  for (const step of QUEST_LEVEL_STEPS) {
    if (groupDone(step.requires)) level = step.level;
  }
  return level;
}

/** Why a level isn't yours (undefined = it is). */
export function questLevelLock(
  option: QuestLevel,
  mine: QuestLevel,
  byTeacher: boolean,
): string | undefined {
  if (option === mine) return undefined;
  if (byTeacher) return "set by your teacher";
  const order: QuestLevel[] = ["Easy", "Medium", "Hard"];
  if (order.indexOf(option) < order.indexOf(mine)) return "you're past this!";
  const step = QUEST_LEVEL_STEPS.find((s) => s.level === option);
  return `finish ${step?.requiresName ?? "more"} lessons`;
}

import { callApi } from "../../api-client";
import { invalidateCoinQueries } from "../../queries/coins";
import { getUserDocShared } from "../../utils/shared-user-doc";
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

/** Quest words follow lesson progress (shared with every game). */
export {
  LEVEL_STEPS as QUEST_LEVEL_STEPS,
  levelLock as questLevelLock,
  wordLevelFor as questLevelFor,
} from "../game-level";

import {
  collection,
  deleteField,
  doc,
  DocumentReference,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
import { DEFAULT_HOUSE_THEME_ID } from "./house-themes";

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export type HouseItemPosition = { xPct: number; yPct: number };

export type HouseState = {
  coins: number;
  ownedItems: Record<string, true>;
  /** itemId -> custom position, if the student has dragged it - falls back to the catalog's default slot otherwise. */
  layout: Record<string, HouseItemPosition>;
  /** itemId -> custom size multiplier (1 = catalog default), if the student has resized it. Furniture only, not pets. */
  scale: Record<string, number>;
  /** Owned items the student has put away - still owned, just not rendered in the room. */
  storedItems: Record<string, true>;
  /** Item ids the student has dragged/resized, oldest to most recent - drawn in this order, on top of untouched items, so the last-touched item stays in front across reloads. */
  touchOrder: string[];
  /** Selected wall/floor finish - see house-themes.ts. */
  themeId: string;
};

export async function getHouseState(uid: string): Promise<HouseState> {
  const snap = await getDoc(userRef(uid));
  const data = snap.exists() ? snap.data() : undefined;
  return {
    coins: (data?.["coins"] as number | undefined) ?? 0,
    ownedItems:
      (data?.["ownedHouseItems"] as Record<string, true> | undefined) ?? {},
    layout:
      (data?.["houseLayout"] as
        | Record<string, HouseItemPosition>
        | undefined) ?? {},
    scale: (data?.["houseScale"] as Record<string, number> | undefined) ?? {},
    storedItems:
      (data?.["storedHouseItems"] as Record<string, true> | undefined) ?? {},
    touchOrder: (data?.["houseTouchOrder"] as string[] | undefined) ?? [],
    themeId:
      (data?.["houseTheme"] as string | undefined) ?? DEFAULT_HOUSE_THEME_ID,
  };
}

/** Switches the room's wall/floor finish. Ownership is enforced server-side at purchase time; this only records the choice. */
export async function selectHouseTheme(
  uid: string,
  themeId: string,
): Promise<void> {
  await setDoc(userRef(uid), { houseTheme: themeId }, { merge: true });
}

/** Toggles whether an owned item is put away (hidden from the room) or placed back out. */
export async function setItemStored(
  uid: string,
  itemId: string,
  stored: boolean,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { storedHouseItems: { [itemId]: stored ? true : deleteField() } },
    { merge: true },
  );
}

/** Saves where a student dragged one item to - merges into houseLayout so other items' positions are untouched. */
export async function saveItemPosition(
  uid: string,
  itemId: string,
  position: HouseItemPosition,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { houseLayout: { [itemId]: position } },
    { merge: true },
  );
}

/** Saves how a student resized one item - merges into houseScale so other items' sizes are untouched. Furniture only, not pets. */
export async function saveItemScale(
  uid: string,
  itemId: string,
  scale: number,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { houseScale: { [itemId]: scale } },
    { merge: true },
  );
}

/** Saves the front-to-back stacking order of touched (dragged/resized) items, so it survives a reload instead of resetting to the default y-sort. */
export async function saveTouchOrder(
  uid: string,
  order: string[],
): Promise<void> {
  await setDoc(userRef(uid), { houseTouchOrder: order }, { merge: true });
}

const DAILY_GREETING_BONUS = 2;

/** Buys one house item (emoji, sprite furniture, or small decor - anything in the "house" shop) - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyHouseItem(
  _uid: string,
  item: { id: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "house", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy house item:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/**
 * A tiny once-a-day coin reward for clicking/greeting the avatar in the
 * house - capped per day server-side, see api/claim-reward.ts.
 */
export async function claimDailyGreeting(
  _uid: string,
): Promise<{ claimed: boolean; coins: number }> {
  try {
    const result = await callApi<{ claimed: boolean; coins: number }>(
      "/api/claim-reward",
      { type: "dailyGreeting" },
    );
    if (result.claimed) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to claim daily greeting:", e);
    return { claimed: false, coins: DAILY_GREETING_BONUS };
  }
}

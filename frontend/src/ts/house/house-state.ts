import {
  collection,
  deleteField,
  doc,
  DocumentReference,
  getDoc,
  increment,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { getDb } from "../firebase";
import { localDateString } from "../utils/date-and-time";
import { HouseItem } from "./house-items";

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export type HouseItemPosition = { xPct: number; yPct: number };

export type HouseState = {
  coins: number;
  ownedItems: Record<string, true>;
  /** itemId -> custom position, if the student has dragged it - falls back to the catalog's default slot otherwise. */
  layout: Record<string, HouseItemPosition>;
  /** Owned items the student has put away - still owned, just not rendered in the room. */
  storedItems: Record<string, true>;
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
    storedItems:
      (data?.["storedHouseItems"] as Record<string, true> | undefined) ?? {},
  };
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

class HouseShopError extends Error {}

/**
 * Buys one house item. Runs as a transaction (rather than a plain
 * read-then-write), same reasoning as buyAvatarItem/buySideImageSet: a
 * double click / multiple tabs racing each other can't both pass an "enough
 * coins" check against the same stale balance.
 */
export async function buyHouseItem(
  uid: string,
  item: HouseItem,
): Promise<{ ok: boolean; reason?: string }> {
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedHouseItems"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new HouseShopError("Already owned");
      }
      if (coins < item.price) {
        throw new HouseShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-item.price),
          ownedHouseItems: { [item.id]: true },
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof HouseShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy house item:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

const DAILY_GREETING_BONUS = 2;

/**
 * A tiny once-a-day coin reward for clicking/greeting the avatar in the
 * house - capped per day (same date-bucket idea as awardTryCoin in coins.ts)
 * so it can't become a second income stream competing with actually typing.
 */
export async function claimDailyGreeting(
  uid: string,
): Promise<{ claimed: boolean; coins: number }> {
  const ref = userRef(uid);
  const today = localDateString();
  let claimed = false;
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const lastClaim = data["houseGreetingDate"] as string | undefined;
      if (lastClaim === today) return;

      tx.set(
        ref,
        {
          houseGreetingDate: today,
          coins: increment(DAILY_GREETING_BONUS),
        },
        { merge: true },
      );
      claimed = true;
    });
  } catch (e) {
    console.error("Failed to claim daily greeting:", e);
  }
  return { claimed, coins: DAILY_GREETING_BONUS };
}

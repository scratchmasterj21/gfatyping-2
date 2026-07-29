import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  increment,
  runTransaction,
  setDoc,
} from "firebase/firestore";

import { getDb } from "../firebase";
import { HandStyle, HandStyleId, isHandStyleId } from "./hand-styles";

export type HandsState = {
  coins: number;
  ownedStyles: Record<string, true>;
  selectedStyle: HandStyleId;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export async function getHandsState(uid: string): Promise<HandsState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const storedStyle = data["selectedHandStyle"] as string | undefined;
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedStyles:
          (data["ownedHandStyles"] as Record<string, true> | undefined) ?? {},
        selectedStyle:
          storedStyle !== undefined && isHandStyleId(storedStyle)
            ? storedStyle
            : "classic",
      };
    }
  } catch (e) {
    console.error("Failed to get hands state:", e);
  }
  return { coins: 0, ownedStyles: {}, selectedStyle: "classic" };
}

class HandsShopError extends Error {}

/**
 * Buys a hand style and selects it immediately. Runs as a transaction (same
 * as buyAvatarItem/buyHouseItem) so two near-simultaneous purchases can't
 * both pass the "enough coins" check against the same stale balance.
 */
export async function buyHandStyle(
  uid: string,
  item: HandStyle,
): Promise<{ ok: boolean; reason?: string }> {
  const price = item.price;
  if (price === undefined) {
    return { ok: false, reason: "This style can't be bought with coins" };
  }
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedHandStyles"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new HandsShopError("You already own this");
      }
      if (coins < price) {
        throw new HandsShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedHandStyles: { [item.id]: true },
          selectedHandStyle: item.id,
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof HandsShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy hand style:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/** Selects an already-owned (or free) hand style. No-op check on ownership is the caller's responsibility. */
export async function selectHandStyle(
  uid: string,
  styleId: HandStyleId,
): Promise<void> {
  await setDoc(userRef(uid), { selectedHandStyle: styleId }, { merge: true });
}

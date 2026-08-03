import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
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

/** Buys a hand style and selects it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyHandStyle(
  _uid: string,
  item: HandStyle,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "hands", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
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

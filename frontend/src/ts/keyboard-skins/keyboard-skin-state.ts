import { collection, doc, DocumentReference, getDoc } from "firebase/firestore";

import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
import { KeyboardSkinItem } from "./keyboard-skin-items";

export type KeyboardSkinState = {
  coins: number;
  ownedSkins: Record<string, true>;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

/**
 * Ownership only - which skin is active piggybacks on the existing free
 * localStorage `keyboardStyle` picker in AnimatedHands.tsx (see
 * setKeyboardStyle), so there's no "selected" field to track here.
 */
export async function getKeyboardSkinState(
  uid: string,
): Promise<KeyboardSkinState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedSkins:
          (data["ownedKeyboardSkins"] as Record<string, true> | undefined) ??
          {},
      };
    }
  } catch (e) {
    console.error("Failed to get keyboard skin state:", e);
  }
  return { coins: 0, ownedSkins: {} };
}

/** Buys a keyboard skin - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyKeyboardSkin(
  _uid: string,
  item: KeyboardSkinItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "keyboardSkin", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy keyboard skin:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

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
import {
  isKeypressEffectItemId,
  KeypressEffectItem,
  KeypressEffectItemId,
} from "./keypress-effect-items";

export type KeypressEffectState = {
  coins: number;
  ownedEffects: Record<string, true>;
  selectedEffect: KeypressEffectItemId;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export async function getKeypressEffectState(
  uid: string,
): Promise<KeypressEffectState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const stored = data["selectedKeypressEffect"] as string | undefined;
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedEffects:
          (data["ownedKeypressEffects"] as Record<string, true> | undefined) ??
          {},
        selectedEffect:
          stored !== undefined && isKeypressEffectItemId(stored)
            ? stored
            : "none",
      };
    }
  } catch (e) {
    console.error("Failed to get keypress effect state:", e);
  }
  return { coins: 0, ownedEffects: {}, selectedEffect: "none" };
}

/** Buys an effect and selects it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyKeypressEffect(
  _uid: string,
  item: KeypressEffectItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "keypressEffect", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy keypress effect:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

export async function selectKeypressEffect(
  uid: string,
  id: KeypressEffectItemId,
): Promise<void> {
  await setDoc(userRef(uid), { selectedKeypressEffect: id }, { merge: true });
}

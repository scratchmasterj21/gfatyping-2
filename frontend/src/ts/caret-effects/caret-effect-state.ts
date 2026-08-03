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
  CaretEffectItem,
  CaretEffectItemId,
  isCaretEffectItemId,
} from "./caret-effect-items";

export type CaretEffectState = {
  coins: number;
  ownedEffects: Record<string, true>;
  selectedEffect: CaretEffectItemId;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export async function getCaretEffectState(
  uid: string,
): Promise<CaretEffectState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const stored = data["selectedCaretEffect"] as string | undefined;
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedEffects:
          (data["ownedCaretEffects"] as Record<string, true> | undefined) ?? {},
        selectedEffect:
          stored !== undefined && isCaretEffectItemId(stored) ? stored : "none",
      };
    }
  } catch (e) {
    console.error("Failed to get caret effect state:", e);
  }
  return { coins: 0, ownedEffects: {}, selectedEffect: "none" };
}

/** Buys an effect and selects it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyCaretEffect(
  _uid: string,
  item: CaretEffectItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "caretEffect", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy caret effect:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

export async function selectCaretEffect(
  uid: string,
  id: CaretEffectItemId,
): Promise<void> {
  await setDoc(userRef(uid), { selectedCaretEffect: id }, { merge: true });
}

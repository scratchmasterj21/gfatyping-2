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
  BackdropItem,
  BackdropItemId,
  isBackdropItemId,
} from "./backdrop-items";

export type BackdropState = {
  coins: number;
  ownedBackdrops: Record<string, true>;
  selectedBackdrop: BackdropItemId;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export async function getBackdropState(uid: string): Promise<BackdropState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const stored = data["selectedBackdrop"] as string | undefined;
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedBackdrops:
          (data["ownedBackdrops"] as Record<string, true> | undefined) ?? {},
        selectedBackdrop:
          stored !== undefined && isBackdropItemId(stored) ? stored : "none",
      };
    }
  } catch (e) {
    console.error("Failed to get backdrop state:", e);
  }
  return { coins: 0, ownedBackdrops: {}, selectedBackdrop: "none" };
}

/** Buys a backdrop and selects it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyBackdrop(
  _uid: string,
  item: BackdropItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "backdrop", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy backdrop:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

export async function selectBackdrop(
  uid: string,
  id: BackdropItemId,
): Promise<void> {
  await setDoc(userRef(uid), { selectedBackdrop: id }, { merge: true });
}

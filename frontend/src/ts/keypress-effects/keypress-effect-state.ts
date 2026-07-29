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

class KeypressEffectShopError extends Error {}

export async function buyKeypressEffect(
  uid: string,
  item: KeypressEffectItem,
): Promise<{ ok: boolean; reason?: string }> {
  const price = item.price;
  if (price === undefined) {
    return { ok: false, reason: "This effect can't be bought with coins" };
  }
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedKeypressEffects"] as Record<string, true> | undefined) ??
        {};
      if (owned[item.id] === true) {
        throw new KeypressEffectShopError("You already own this");
      }
      if (coins < price) {
        throw new KeypressEffectShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedKeypressEffects: { [item.id]: true },
          selectedKeypressEffect: item.id,
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof KeypressEffectShopError) {
      return { ok: false, reason: e.message };
    }
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

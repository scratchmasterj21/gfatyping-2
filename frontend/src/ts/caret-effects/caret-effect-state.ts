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

class CaretEffectShopError extends Error {}

export async function buyCaretEffect(
  uid: string,
  item: CaretEffectItem,
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
        (data["ownedCaretEffects"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new CaretEffectShopError("You already own this");
      }
      if (coins < price) {
        throw new CaretEffectShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedCaretEffects: { [item.id]: true },
          selectedCaretEffect: item.id,
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof CaretEffectShopError) {
      return { ok: false, reason: e.message };
    }
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

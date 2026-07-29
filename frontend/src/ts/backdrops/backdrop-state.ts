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

class BackdropShopError extends Error {}

export async function buyBackdrop(
  uid: string,
  item: BackdropItem,
): Promise<{ ok: boolean; reason?: string }> {
  const price = item.price;
  if (price === undefined) {
    return { ok: false, reason: "This backdrop can't be bought with coins" };
  }
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedBackdrops"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new BackdropShopError("You already own this");
      }
      if (coins < price) {
        throw new BackdropShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedBackdrops: { [item.id]: true },
          selectedBackdrop: item.id,
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof BackdropShopError) {
      return { ok: false, reason: e.message };
    }
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

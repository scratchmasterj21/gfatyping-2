import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  increment,
  runTransaction,
} from "firebase/firestore";

import { getDb } from "../firebase";
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

class KeyboardSkinShopError extends Error {}

export async function buyKeyboardSkin(
  uid: string,
  item: KeyboardSkinItem,
): Promise<{ ok: boolean; reason?: string }> {
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedKeyboardSkins"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new KeyboardSkinShopError("You already own this");
      }
      if (coins < item.price) {
        throw new KeyboardSkinShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-item.price),
          ownedKeyboardSkins: { [item.id]: true },
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof KeyboardSkinShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy keyboard skin:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

import {
  collection,
  deleteField,
  doc,
  DocumentReference,
  getDoc,
  increment,
  runTransaction,
  setDoc,
} from "firebase/firestore";

import { getDb } from "../firebase";
import { PetItem } from "./pet-items";

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export type PetState = {
  coins: number;
  ownedPets: Record<string, true>;
  /** Owned pets the student has put away - still owned, just not roaming the room. */
  storedPets: Record<string, true>;
};

/**
 * No position field here (unlike house-state.ts's layout) - pets roam on
 * their own and dragging one is just a temporary nudge, not something worth
 * persisting.
 */
export async function getPetState(uid: string): Promise<PetState> {
  const snap = await getDoc(userRef(uid));
  const data = snap.exists() ? snap.data() : undefined;
  return {
    coins: (data?.["coins"] as number | undefined) ?? 0,
    ownedPets: (data?.["ownedPets"] as Record<string, true> | undefined) ?? {},
    storedPets:
      (data?.["storedPets"] as Record<string, true> | undefined) ?? {},
  };
}

/** Toggles whether an owned pet is put away (hidden from the room) or placed back out. */
export async function setPetStored(
  uid: string,
  petId: string,
  stored: boolean,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { storedPets: { [petId]: stored ? true : deleteField() } },
    { merge: true },
  );
}

class PetShopError extends Error {}

/** Buys one pet. Transaction-based, same reasoning as buyHouseItem/buyAvatarItem. */
export async function buyPetItem(
  uid: string,
  item: PetItem,
): Promise<{ ok: boolean; reason?: string }> {
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedPets"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new PetShopError("Already owned");
      }
      if (coins < item.price) {
        throw new PetShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-item.price),
          ownedPets: { [item.id]: true },
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof PetShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy pet:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

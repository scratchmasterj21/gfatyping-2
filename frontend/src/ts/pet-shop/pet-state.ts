import {
  collection,
  deleteField,
  doc,
  DocumentReference,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
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

/** Buys one pet - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyPetItem(
  _uid: string,
  item: PetItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "pet", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy pet:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

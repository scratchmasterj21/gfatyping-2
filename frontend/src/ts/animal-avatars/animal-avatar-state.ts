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
import { AnimalAvatarItem } from "./animal-avatar-items";

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export type AnimalAvatarState = {
  coins: number;
  ownedAnimalAvatars: Record<string, true>;
  /** id of the currently-equipped animal avatar, if any - unset means the student is using the normal customizable avatar instead. */
  equippedAnimalAvatarId?: string;
};

export async function getAnimalAvatarState(
  uid: string,
): Promise<AnimalAvatarState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedAnimalAvatars:
          (data["ownedAnimalAvatars"] as Record<string, true> | undefined) ??
          {},
        equippedAnimalAvatarId: data["equippedAnimalAvatar"] as
          | string
          | undefined,
      };
    }
  } catch (e) {
    console.error("Failed to get animal avatar state:", e);
  }
  return { coins: 0, ownedAnimalAvatars: {} };
}

/** Buys one animal avatar and equips it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyAnimalAvatar(
  _uid: string,
  item: AnimalAvatarItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "animalAvatar", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy animal avatar:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/**
 * Equips an already-owned animal avatar, or clears it (pass null) to switch
 * back to the normal customizable avatar. Free - no coins/ownership check,
 * same as picking a hairstyle already owned.
 */
export async function equipAnimalAvatar(
  uid: string,
  id: string | null,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { equippedAnimalAvatar: id ?? deleteField() },
    { merge: true },
  );
}

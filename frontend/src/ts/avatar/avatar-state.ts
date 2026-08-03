import {
  collection,
  deleteField,
  doc,
  DocumentReference,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { findAnimalAvatarItem } from "../animal-avatars/animal-avatar-items";
import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
import {
  AvatarCategory,
  AvatarItem,
  AvatarShape,
  findAvatarItem,
} from "./avatar-items";

export type AvatarState = {
  coins: number;
  ownedCostumes: Record<string, true>;
  equipped: Partial<Record<AvatarCategory, string>>;
  shape: AvatarShape;
};

export type EquippedAvatar = {
  color?: string;
  hair?: string;
  hat?: string;
  accessory?: string;
  face?: string;
  background?: string;
  /** Hex color for the equipped leaderboard-row highlight, if any. */
  highlight?: string;
  shape?: AvatarShape;
  /**
   * Image URL for an equipped animal avatar, if any - takes over the whole
   * avatar display in place of the procedural color/hair/hat/etc pieces
   * above.
   */
  animalImage?: string;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

/**
 * Lightweight read for display purposes only (no coins/ownership) - safe to
 * call for any uid. Always returns a value (defaults to an unequipped
 * avatar) since the procedural avatar is the app's default profile picture,
 * not an opt-in shown only once a student equips something.
 */
export async function getEquippedAvatar(uid: string): Promise<EquippedAvatar> {
  try {
    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) return {};
    const data = snap.data();
    const equipped =
      (data["equipped"] as
        | Partial<Record<AvatarCategory, string>>
        | undefined) ?? {};
    return {
      color:
        equipped.color === undefined
          ? undefined
          : findAvatarItem(equipped.color)?.value,
      hair: equipped.hair,
      hat: equipped.hat,
      accessory: equipped.accessory,
      face: equipped.face,
      background: equipped.background,
      highlight:
        equipped.highlight === undefined
          ? undefined
          : findAvatarItem(equipped.highlight)?.value,
      shape: data["avatarShape"] as AvatarShape | undefined,
      animalImage: (() => {
        const id = data["equippedAnimalAvatar"] as string | undefined;
        return id === undefined ? undefined : findAnimalAvatarItem(id)?.image;
      })(),
    };
  } catch (e) {
    console.error("Failed to get equipped avatar:", e);
    return {};
  }
}

export async function getAvatarState(uid: string): Promise<AvatarState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedCostumes:
          (data["ownedCostumes"] as Record<string, true> | undefined) ?? {},
        equipped:
          (data["equipped"] as Partial<Record<AvatarCategory, string>>) ?? {},
        shape: (data["avatarShape"] as AvatarShape | undefined) ?? "round",
      };
    }
  } catch (e) {
    console.error("Failed to get avatar state:", e);
  }
  return { coins: 0, ownedCostumes: {}, equipped: {}, shape: "round" };
}

/**
 * Sets the free base head shape (no coins, no ownership check). Hats/hair
 * are shape-specific (AvatarItem.shape) - if the currently-equipped hat or
 * hair doesn't match the new shape, unequips it rather than leaving an
 * ill-fitting item rendered.
 */
export async function setAvatarShape(
  uid: string,
  shape: AvatarShape,
): Promise<void> {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const equipped =
    (data["equipped"] as Partial<Record<AvatarCategory, string>> | undefined) ??
    {};

  const equippedUpdate: Partial<Record<AvatarCategory, unknown>> = {};
  for (const category of ["hat", "hair"] as const) {
    const itemId = equipped[category];
    if (itemId === undefined) continue;
    const itemShape = findAvatarItem(itemId)?.shape ?? "round";
    if (itemShape !== shape) {
      equippedUpdate[category] = deleteField();
    }
  }

  const payload: Record<string, unknown> = { avatarShape: shape };
  if (Object.keys(equippedUpdate).length > 0) {
    payload["equipped"] = equippedUpdate;
  }
  await setDoc(ref, payload, { merge: true });
}

/** Buys an item and equips it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyAvatarItem(
  _uid: string,
  item: AvatarItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "avatar", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy avatar item:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/** Grants an achievement-gated item for free once its achievement is earned - checked server-side, see api/buy-item.ts. */
export async function claimAvatarItem(
  _uid: string,
  item: AvatarItem,
): Promise<{ ok: boolean; reason?: string }> {
  if (item.requiresAchievement === undefined) {
    return { ok: false, reason: "This item isn't achievement-gated" };
  }
  try {
    return await callApi<{ ok: boolean; reason?: string }>("/api/buy-item", {
      shop: "avatar",
      itemId: item.id,
    });
  } catch (e) {
    console.error("Failed to claim avatar item:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

export async function equipAvatarItem(
  uid: string,
  category: AvatarCategory,
  itemId: string | null,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { equipped: { [category]: itemId ?? deleteField() } },
    { merge: true },
  );
}

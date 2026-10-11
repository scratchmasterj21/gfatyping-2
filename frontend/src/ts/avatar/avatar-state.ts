import { collection, doc, DocumentReference, getDoc } from "firebase/firestore";

import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
import { AvatarCategory, AvatarItem, AvatarShape } from "./avatar-items";
import { findTitle } from "../titles/titles";
import { EquippedAvatar, equippedFromDoc } from "./equipped-from-doc";

export type AvatarState = {
  coins: number;
  ownedCostumes: Record<string, true>;
  equipped: Partial<Record<AvatarCategory, string>>;
  shape: AvatarShape;
  ownedAnimalAvatars?: Record<string, true>;
  equippedAnimalAvatarId?: string;
  savedOutfits?: Partial<Record<string, SavedOutfit>>;
  /** Avatar categories whose collection reward was already paid out. */
  claimedCollections?: Record<string, true>;
  /** Keyboard/effects setups (see look/look-setups.ts), read here to share this doc read. */
  savedSetups?: Partial<Record<string, Record<string, string>>>;
  title?: string;
};

/** Snapshot of a look, stored server-side under users/{uid}.savedOutfits[slot]. */
export type SavedOutfit = {
  equipped: Partial<Record<AvatarCategory, string>>;
  shape: AvatarShape;
};

export const OUTFIT_SLOTS = ["1", "2", "3"] as const;

export type { EquippedAvatar } from "./equipped-from-doc";

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
  if (uid.trim().length === 0) return {};
  try {
    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) return {};
    return equippedFromDoc(snap.data());
  } catch (e) {
    console.error("Failed to get equipped avatar:", e);
    return {};
  }
}

export async function getAvatarState(uid: string): Promise<AvatarState> {
  if (uid.trim().length === 0) {
    return { coins: 0, ownedCostumes: {}, equipped: {}, shape: "round" };
  }
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
        ownedAnimalAvatars:
          (data["ownedAnimalAvatars"] as Record<string, true> | undefined) ??
          {},
        equippedAnimalAvatarId: data["equippedAnimalAvatar"] as
          | string
          | undefined,
        savedOutfits:
          (data["savedOutfits"] as
            | Partial<Record<string, SavedOutfit>>
            | undefined) ?? {},
        claimedCollections:
          (data["claimedCollections"] as Record<string, true> | undefined) ??
          {},
        savedSetups:
          (data["savedSetups"] as
            | Partial<Record<string, Record<string, string>>>
            | undefined) ?? {},
        title: findTitle(data["selectedTitle"])?.id,
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
  _uid: string,
  shape: AvatarShape,
): Promise<void> {
  await callApi("/api/equip-item", { target: "avatarShape", shape });
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
  _uid: string,
  category: AvatarCategory,
  itemId: string | null,
): Promise<void> {
  await callApi("/api/equip-item", { target: "avatar", category, itemId });
}

/** Equips several categories in one write ("Surprise me"). null = take off. */
export async function equipOutfit(
  equipped: Partial<Record<AvatarCategory, string | null>>,
): Promise<void> {
  await callApi("/api/equip-item", { target: "outfit", equipped });
}

/** Saves the current look (as stored server-side) into an outfit slot. */
export async function saveOutfit(slot: string): Promise<void> {
  await callApi("/api/equip-item", { target: "saveOutfit", slot });
}

/** Puts on a saved outfit; pieces no longer owned are skipped server-side. */
export async function wearOutfit(slot: string): Promise<void> {
  await callApi("/api/equip-item", { target: "wearOutfit", slot });
}

/** Shows an earned title on leaderboards; null takes it off. Checked server-side. */
export async function setTitle(titleId: string | null): Promise<void> {
  await callApi("/api/equip-item", { target: "title", itemId: titleId });
  invalidateCoinQueries();
}

/** Pays the one-time bonus for owning every item in a category. */
export async function claimCollection(
  category: AvatarCategory,
): Promise<{ claimed: boolean; coins: number }> {
  const result = await callApi<{ claimed: boolean; coins: number }>(
    "/api/claim-reward",
    { type: "avatarCollection", category },
  );
  if (result.claimed) invalidateCoinQueries();
  return result;
}

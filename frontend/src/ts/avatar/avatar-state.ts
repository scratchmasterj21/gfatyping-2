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

import { getEarnedAchievements } from "../achievements/achievements";
import { getDb } from "../firebase";
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

class AvatarShopError extends Error {}

/**
 * Buys an item and equips it immediately. Runs as a transaction (rather than
 * a plain read-then-write) so two purchases racing each other - a double
 * click, multiple tabs, clicking a second item before the first one's balance
 * refresh lands - can't both pass the "enough coins" check against the same
 * stale balance and drive coins negative.
 */
export async function buyAvatarItem(
  uid: string,
  item: AvatarItem,
): Promise<{ ok: boolean; reason?: string }> {
  const price = item.price;
  if (price === undefined) {
    return { ok: false, reason: "This item can't be bought with coins" };
  }
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedCostumes"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new AvatarShopError("You already own this");
      }
      if (coins < price) {
        throw new AvatarShopError("Not enough coins");
      }

      // Nested-object merge writes only touch the specific keys given below -
      // Firestore's client SDK merges nested map fields deeply, not as a
      // whole-field overwrite, so other owned items/equipped categories are untouched.
      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedCostumes: { [item.id]: true },
          equipped: { [item.category]: item.id },
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AvatarShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy avatar item:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/** Grants an achievement-gated item for free once its achievement is earned. */
export async function claimAvatarItem(
  uid: string,
  item: AvatarItem,
): Promise<{ ok: boolean; reason?: string }> {
  if (item.requiresAchievement === undefined) {
    return { ok: false, reason: "This item isn't achievement-gated" };
  }
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const owned =
    (data["ownedCostumes"] as Record<string, true> | undefined) ?? {};
  if (owned[item.id] === true) {
    return { ok: false, reason: "You already own this" };
  }

  const earned = await getEarnedAchievements();
  if (!earned.has(item.requiresAchievement)) {
    return { ok: false, reason: "Achievement not earned yet" };
  }

  await setDoc(
    ref,
    {
      ownedCostumes: { [item.id]: true },
      equipped: { [item.category]: item.id },
    },
    { merge: true },
  );
  return { ok: true };
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

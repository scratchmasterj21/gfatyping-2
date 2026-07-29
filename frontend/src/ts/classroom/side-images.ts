import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  increment,
  runTransaction,
} from "firebase/firestore";
import { createSignal } from "solid-js";
import { getDb } from "../firebase";

// Bumped whenever ownership changes (buySideImageSet) so long-lived
// components that already fetched sets once - like SideImagePanels, which
// this app never remounts on navigation - know to refetch instead of
// showing stale data until a full page reload.
export const [getSideImagesVersion, bumpSideImagesVersion] = createSignal(0);

export type SideImageSet = {
  label?: string;
  left: string | null;
  right: string | null;
  /**
   * Stable identity for school-wide catalog sets (see buySideImageSet /
   * ownedSideImageSets) - omitted for per-student teacher-assigned sets,
   * which are always free and never go through the shop.
   */
  id?: string;
  /** Coin price - only meaningful for school-wide catalog sets. */
  price?: number;
};

export function parseSets(data: unknown): SideImageSet[] {
  if (data === null || data === undefined) return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["sets"])) return d["sets"] as SideImageSet[];
  // legacy single-pair format (no "sets" array, just left/right at the root)
  if ("left" in d || "right" in d) {
    return [
      {
        left: (d["left"] as string | null) ?? null,
        right: (d["right"] as string | null) ?? null,
      },
    ];
  }
  return [];
}

/** Suggested default price (coins) for a newly-added catalog set. */
export const DEFAULT_SIDE_IMAGES_PRICE = 50;

export function generateSetId(): string {
  return crypto.randomUUID();
}

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export type SideImagesShopState = {
  coins: number;
  catalog: SideImageSet[];
  owned: Record<string, true>;
};

/** School-wide catalog + this student's coin balance and ownership. */
export async function getSideImagesShopState(
  uid: string,
): Promise<SideImagesShopState> {
  const [schoolSnap, userSnap] = await Promise.all([
    getDoc(doc(getDb(), "schoolConfig", "sideImages")),
    getDoc(userRef(uid)),
  ]);
  const catalog = parseSets(
    schoolSnap.exists() ? schoolSnap.data() : null,
  ).filter((s) => s.id !== undefined);
  const userData = userSnap.exists() ? userSnap.data() : undefined;
  return {
    coins: (userData?.["coins"] as number | undefined) ?? 0,
    catalog,
    owned:
      (userData?.["ownedSideImageSets"] as Record<string, true> | undefined) ??
      {},
  };
}

class SideImagesShopError extends Error {}

/**
 * Buys one catalog set. Runs as a transaction (rather than a plain
 * read-then-write), same reasoning as buyAvatarItem in avatar-state.ts: a
 * double click / multiple tabs racing each other can't both pass an "enough
 * coins" check against the same stale balance.
 */
export async function buySideImageSet(
  uid: string,
  setId: string,
  price: number,
): Promise<{ ok: boolean; reason?: string }> {
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedSideImageSets"] as Record<string, true> | undefined) ?? {};
      if (owned[setId] === true) {
        throw new SideImagesShopError("Already owned");
      }
      if (coins < price) {
        throw new SideImagesShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedSideImageSets: { [setId]: true },
        },
        { merge: true },
      );
    });
    bumpSideImagesVersion((v) => v + 1);
    return { ok: true };
  } catch (e) {
    if (e instanceof SideImagesShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy side image set:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

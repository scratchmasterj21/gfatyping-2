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
  isRgbPaletteItemId,
  RgbPaletteItem,
  RgbPaletteItemId,
} from "./rgb-palette-items";

export type RgbPaletteState = {
  coins: number;
  ownedPalettes: Record<string, true>;
  selectedPalette: RgbPaletteItemId;
};

function userRef(uid: string): DocumentReference {
  return doc(collection(getDb(), "users"), uid);
}

export async function getRgbPaletteState(
  uid: string,
): Promise<RgbPaletteState> {
  try {
    const snap = await getDoc(userRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      const stored = data["selectedRgbPalette"] as string | undefined;
      return {
        coins: (data["coins"] as number | undefined) ?? 0,
        ownedPalettes:
          (data["ownedRgbPalettes"] as Record<string, true> | undefined) ?? {},
        selectedPalette:
          stored !== undefined && isRgbPaletteItemId(stored)
            ? stored
            : "rainbow",
      };
    }
  } catch (e) {
    console.error("Failed to get rgb palette state:", e);
  }
  return { coins: 0, ownedPalettes: {}, selectedPalette: "rainbow" };
}

class RgbPaletteShopError extends Error {}

export async function buyRgbPalette(
  uid: string,
  item: RgbPaletteItem,
): Promise<{ ok: boolean; reason?: string }> {
  const price = item.price;
  if (price === undefined) {
    return { ok: false, reason: "This palette can't be bought with coins" };
  }
  const ref = userRef(uid);
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const coins = (data["coins"] as number | undefined) ?? 0;
      const owned =
        (data["ownedRgbPalettes"] as Record<string, true> | undefined) ?? {};
      if (owned[item.id] === true) {
        throw new RgbPaletteShopError("You already own this");
      }
      if (coins < price) {
        throw new RgbPaletteShopError("Not enough coins");
      }

      tx.set(
        ref,
        {
          coins: increment(-price),
          ownedRgbPalettes: { [item.id]: true },
          selectedRgbPalette: item.id,
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof RgbPaletteShopError) {
      return { ok: false, reason: e.message };
    }
    console.error("Failed to buy rgb palette:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

export async function selectRgbPalette(
  uid: string,
  id: RgbPaletteItemId,
): Promise<void> {
  await setDoc(userRef(uid), { selectedRgbPalette: id }, { merge: true });
}

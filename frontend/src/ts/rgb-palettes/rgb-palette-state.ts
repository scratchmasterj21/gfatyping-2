import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { callApi } from "../api-client";
import { getDb } from "../firebase";
import { invalidateCoinQueries } from "../queries/coins";
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

/** Buys a palette and selects it immediately - price/ownership validated server-side, see api/buy-item.ts. */
export async function buyRgbPalette(
  _uid: string,
  item: RgbPaletteItem,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "rgbPalette", itemId: item.id },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
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

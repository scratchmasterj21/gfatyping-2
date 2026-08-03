import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { verifyStudent } from "./_lib/auth.js";
import {
  CATALOGS,
  OWNED_FIELD,
  SELECTED_FIELD,
  ShopId,
} from "./_lib/catalogs.js";

const SHOP_IDS: Set<ShopId> = new Set([
  "house",
  "pet",
  "avatar",
  "hands",
  "rgbPalette",
  "keyboardSkin",
  "keypressEffect",
  "caretEffect",
  "backdrop",
  "animalAvatar",
]);

type SideImageSet = { id?: string; price?: number };

function parseSideImageSets(data: unknown): SideImageSet[] {
  if (data === null || data === undefined) return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["sets"])) return d["sets"] as SideImageSet[];
  return [];
}

class BuyError extends Error {}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const auth = await verifyStudent(req);
  if (!auth.ok) {
    res.status(auth.status).json({ message: auth.message });
    return;
  }

  const body = req.body as { shop?: unknown; itemId?: unknown };
  const shop = body.shop;
  const itemId = body.itemId;
  if (typeof itemId !== "string" || itemId === "") {
    res.status(400).json({ ok: false, reason: "Invalid item" });
    return;
  }

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);

  // side-images has admin-configurable runtime prices, not a fixed catalog -
  // resolve the real price from schoolConfig before validating, rather than
  // ever trusting a client-supplied price (the old client-side
  // buySideImageSet took price as a plain function argument, which could be
  // called with whatever value the caller wanted).
  if (shop === "sideImages") {
    try {
      const schoolSnap = await db
        .collection("schoolConfig")
        .doc("sideImages")
        .get();
      const set = parseSideImageSets(schoolSnap.data()).find(
        (s) => s.id === itemId,
      );
      if (set === undefined || set.price === undefined) {
        res.status(400).json({ ok: false, reason: "Unknown item" });
        return;
      }
      const price = set.price;

      await db.runTransaction(async (tx: admin.firestore.Transaction) => {
        const snap = await tx.get(userRef);
        const data = snap.exists ? snap.data() : {};
        const coins = (data?.["coins"] as number | undefined) ?? 0;
        const owned =
          (data?.["ownedSideImageSets"] as Record<string, true> | undefined) ??
          {};
        if (owned[itemId] === true) throw new BuyError("Already owned");
        if (coins < price) throw new BuyError("Not enough coins");

        tx.set(
          userRef,
          {
            coins: admin.firestore.FieldValue.increment(-price),
            ownedSideImageSets: { [itemId]: true },
          },
          { merge: true },
        );
      });
      res.status(200).json({ ok: true });
      return;
    } catch (e) {
      if (e instanceof BuyError) {
        res.status(200).json({ ok: false, reason: e.message });
        return;
      }
      console.error("buy-item (sideImages) failed:", e);
      res.status(500).json({ ok: false, reason: "Something went wrong" });
      return;
    }
  }

  if (typeof shop !== "string" || !SHOP_IDS.has(shop as ShopId)) {
    res.status(400).json({ ok: false, reason: "Unknown shop" });
    return;
  }
  const shopId = shop as ShopId;
  const item = CATALOGS[shopId][itemId];
  if (item === undefined) {
    res.status(400).json({ ok: false, reason: "Unknown item" });
    return;
  }

  const ownedField = OWNED_FIELD[shopId];
  const selectedField = SELECTED_FIELD[shopId];

  try {
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data() : {};
      const owned =
        (data?.[ownedField] as Record<string, true> | undefined) ?? {};
      if (owned[itemId] === true) throw new BuyError("Already owned");

      const update: Record<string, unknown> = {
        [ownedField]: { [itemId]: true },
      };
      if (selectedField !== undefined) {
        update[selectedField] = itemId;
      }
      if (shopId === "avatar" && item.category !== undefined) {
        update["equipped"] = { [item.category]: itemId };
      }

      if (item.requiresAchievement !== undefined) {
        // Free claim, gated on an earned achievement instead of coins.
        const achSnap = await tx.get(
          userRef.collection("achievements").doc(item.requiresAchievement),
        );
        if (!achSnap.exists) {
          throw new BuyError("Achievement not earned yet");
        }
        tx.set(userRef, update, { merge: true });
        return;
      }

      if (item.price === undefined) {
        throw new BuyError("This item can't be bought with coins");
      }
      const coins = (data?.["coins"] as number | undefined) ?? 0;
      if (coins < item.price) throw new BuyError("Not enough coins");

      tx.set(
        userRef,
        {
          ...update,
          coins: admin.firestore.FieldValue.increment(-item.price),
        },
        { merge: true },
      );
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    if (e instanceof BuyError) {
      res.status(200).json({ ok: false, reason: e.message });
      return;
    }
    console.error("buy-item failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

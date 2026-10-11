import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { qualifiesForAchievement } from "./_lib/achievements.js";
import { verifyStudent } from "./_lib/auth.js";
import {
  CATALOGS,
  FREE_KEYBOARD_STYLES,
  OWNED_FIELD,
  SELECTED_FIELD,
  ShopId,
  TITLE_ACHIEVEMENTS,
} from "./_lib/catalogs.js";

const AVATAR_CATEGORIES = new Set([
  "color",
  "hair",
  "hat",
  "accessory",
  "face",
  "background",
  "highlight",
]);
const AVATAR_SHAPES = new Set(["round", "square", "oval", "hexagon", "cloud"]);
const OUTFIT_SLOTS = new Set(["1", "2", "3"]);
const HOUSE_THEME_IDS = new Set([
  "plain",
  "cozy-wood",
  "mint-tile",
  "night-sky",
  "candy",
  "meadow",
]);

/** Shops whose pick a saved setup / surprise covers. */
const SETUP_SHOPS = [
  "hands",
  "rgbPalette",
  "keypressEffect",
  "caretEffect",
  "backdrop",
] as const satisfies readonly ShopId[];
type SetupShop = (typeof SETUP_SHOPS)[number];

function setupField(shop: SetupShop): string {
  const field = SELECTED_FIELD[shop];
  if (field === undefined) throw new Error(`No selected field for ${shop}`);
  return field;
}

function ownsShopItem(
  data: Record<string, unknown>,
  shop: ShopId,
  id: unknown,
): id is string {
  if (typeof id !== "string") return false;
  const item = CATALOGS[shop][id];
  if (item === undefined) return false;
  if (item.price === undefined && item.requiresAchievement === undefined) {
    return true;
  }
  const owned = data[OWNED_FIELD[shop]] as Record<string, true> | undefined;
  return owned?.[id] === true;
}

function ownsKeyboardStyle(
  data: Record<string, unknown>,
  style: unknown,
): style is string {
  if (typeof style !== "string") return false;
  return (
    FREE_KEYBOARD_STYLES.has(style) || ownsShopItem(data, "keyboardSkin", style)
  );
}

function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function avatarItemShape(id: string): string {
  for (const shape of ["square", "oval", "hexagon", "cloud"]) {
    if (id.endsWith(`-${shape}`)) return shape;
  }
  return "round";
}

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

  const body = req.body as {
    target?: unknown;
    category?: unknown;
    itemId?: unknown;
    shape?: unknown;
    slot?: unknown;
    equipped?: unknown;
  };
  const app = getAdminApp();
  const userRef = app.firestore().collection("users").doc(auth.uid);

  try {
    const result = await app.firestore().runTransaction<{
      keyboardStyle?: string;
    }>(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? (snap.data() ?? {}) : {};

      if (body.target === "title") {
        if (body.itemId === null) {
          tx.set(
            userRef,
            { selectedTitle: admin.firestore.FieldValue.delete() },
            { merge: true },
          );
          return {};
        }
        const achievement =
          typeof body.itemId === "string"
            ? TITLE_ACHIEVEMENTS[body.itemId]
            : undefined;
        if (achievement === undefined) throw new Error("Invalid title");
        if (!qualifiesForAchievement(data, achievement)) {
          throw new Error("Item not owned");
        }
        tx.set(userRef, { selectedTitle: body.itemId }, { merge: true });
        return {};
      }

      if (body.target === "saveSetup") {
        if (typeof body.slot !== "string" || !OUTFIT_SLOTS.has(body.slot)) {
          throw new Error("Invalid setup slot");
        }
        if (!snap.exists) throw new Error("Invalid setup slot");
        const setup: Record<string, string> = {};
        if (ownsKeyboardStyle(data, body.itemId)) {
          setup["keyboardStyle"] = body.itemId;
        }
        for (const shop of SETUP_SHOPS) {
          const picked = data[setupField(shop)];
          if (ownsShopItem(data, shop, picked)) setup[shop] = picked;
        }
        tx.update(userRef, { [`savedSetups.${body.slot}`]: setup });
        return {};
      }

      if (body.target === "wearSetup" || body.target === "surpriseLook") {
        let wanted: Record<string, unknown>;
        if (body.target === "wearSetup") {
          if (typeof body.slot !== "string" || !OUTFIT_SLOTS.has(body.slot)) {
            throw new Error("Invalid setup slot");
          }
          const saved = (
            data["savedSetups"] as Record<string, unknown> | undefined
          )?.[body.slot];
          if (typeof saved !== "object" || saved === null) {
            throw new Error("Invalid setup slot");
          }
          wanted = saved as Record<string, unknown>;
        } else {
          wanted = {
            keyboardStyle: pickRandom(
              [
                ...FREE_KEYBOARD_STYLES,
                ...Object.keys(CATALOGS.keyboardSkin),
              ].filter((id) => ownsKeyboardStyle(data, id)),
            ),
          };
          for (const shop of SETUP_SHOPS) {
            wanted[shop] = pickRandom(
              Object.keys(CATALOGS[shop]).filter((id) =>
                ownsShopItem(data, shop, id),
              ),
            );
          }
        }
        // Pieces sold or no longer owned are skipped, leaving that pick as is.
        const update: Record<string, string> = {};
        for (const shop of SETUP_SHOPS) {
          if (ownsShopItem(data, shop, wanted[shop])) {
            update[setupField(shop)] = wanted[shop];
          }
        }
        if (Object.keys(update).length > 0) {
          tx.set(userRef, update, { merge: true });
        }
        return ownsKeyboardStyle(data, wanted["keyboardStyle"])
          ? { keyboardStyle: wanted["keyboardStyle"] }
          : {};
      }

      if (body.target === "avatar") {
        if (
          typeof body.category !== "string" ||
          !AVATAR_CATEGORIES.has(body.category) ||
          (body.itemId !== null && typeof body.itemId !== "string")
        ) {
          throw new Error("Invalid avatar selection");
        }
        if (typeof body.itemId === "string") {
          const item = CATALOGS.avatar[body.itemId];
          const owned =
            (data["ownedCostumes"] as Record<string, true> | undefined) ?? {};
          if (item?.category !== body.category || owned[body.itemId] !== true) {
            throw new Error("Item not owned");
          }
        }
        tx.set(
          userRef,
          {
            equipped: {
              [body.category]:
                body.itemId ?? admin.firestore.FieldValue.delete(),
            },
          },
          { merge: true },
        );
        return {};
      }

      if (
        body.target === "outfit" ||
        body.target === "saveOutfit" ||
        body.target === "wearOutfit"
      ) {
        const owned =
          (data["ownedCostumes"] as Record<string, true> | undefined) ?? {};
        const shape =
          typeof data["avatarShape"] === "string"
            ? data["avatarShape"]
            : "round";

        if (body.target === "saveOutfit" || body.target === "wearOutfit") {
          if (typeof body.slot !== "string" || !OUTFIT_SLOTS.has(body.slot)) {
            throw new Error("Invalid outfit slot");
          }
        }

        if (body.target === "saveOutfit") {
          if (!snap.exists) throw new Error("Invalid outfit slot");
          // update() with a field path replaces the slot whole, so pieces
          // from an older save in this slot don't linger.
          tx.update(userRef, {
            [`savedOutfits.${body.slot as string}`]: {
              equipped:
                (data["equipped"] as Record<string, string> | undefined) ?? {},
              shape,
            },
          });
          return {};
        }

        let wanted: Record<string, unknown>;
        let wantedShape = shape;
        if (body.target === "wearOutfit") {
          const saved = (
            data["savedOutfits"] as
              | Record<string, { equipped?: unknown; shape?: unknown }>
              | undefined
          )?.[body.slot as string];
          if (saved === undefined) throw new Error("Invalid outfit slot");
          wantedShape =
            typeof saved.shape === "string" && AVATAR_SHAPES.has(saved.shape)
              ? saved.shape
              : "round";
          const savedEquipped =
            typeof saved.equipped === "object" && saved.equipped !== null
              ? (saved.equipped as Record<string, unknown>)
              : {};
          // A saved look replaces every slot, so unlisted ones come off.
          wanted = Object.fromEntries(
            [...AVATAR_CATEGORIES].map((c) => [c, savedEquipped[c] ?? null]),
          );
        } else {
          if (typeof body.equipped !== "object" || body.equipped === null) {
            throw new Error("Invalid outfit");
          }
          wanted = body.equipped as Record<string, unknown>;
        }

        const equippedUpdate: Record<string, unknown> = {};
        for (const [category, itemId] of Object.entries(wanted)) {
          if (!AVATAR_CATEGORIES.has(category)) {
            throw new Error("Invalid outfit");
          }
          if (itemId === null) {
            equippedUpdate[category] = admin.firestore.FieldValue.delete();
            continue;
          }
          if (typeof itemId !== "string") throw new Error("Invalid outfit");
          const item = CATALOGS.avatar[itemId];
          const fits =
            (category !== "hat" && category !== "hair") ||
            avatarItemShape(itemId) === wantedShape;
          // Skip (take off) pieces sold since saving or that no longer fit.
          equippedUpdate[category] =
            item?.category === category && owned[itemId] === true && fits
              ? itemId
              : admin.firestore.FieldValue.delete();
        }
        tx.set(
          userRef,
          {
            equipped: equippedUpdate,
            ...(body.target === "wearOutfit"
              ? { avatarShape: wantedShape }
              : {}),
          },
          { merge: true },
        );
        return {};
      }

      if (body.target === "animalAvatar") {
        if (body.itemId !== null && typeof body.itemId !== "string") {
          throw new Error("Invalid animal avatar selection");
        }
        if (typeof body.itemId === "string") {
          const owned =
            (data["ownedAnimalAvatars"] as Record<string, true> | undefined) ??
            {};
          if (
            CATALOGS.animalAvatar[body.itemId] === undefined ||
            owned[body.itemId] !== true
          ) {
            throw new Error("Item not owned");
          }
        }
        tx.set(
          userRef,
          {
            equippedAnimalAvatar:
              body.itemId ?? admin.firestore.FieldValue.delete(),
          },
          { merge: true },
        );
        return {};
      }

      if (body.target === "houseTheme") {
        if (
          typeof body.itemId !== "string" ||
          !HOUSE_THEME_IDS.has(body.itemId)
        ) {
          throw new Error("Invalid house theme");
        }
        const owned =
          (data["ownedHouseItems"] as Record<string, true> | undefined) ?? {};
        if (body.itemId !== "plain" && owned[body.itemId] !== true) {
          throw new Error("Item not owned");
        }
        tx.set(userRef, { houseTheme: body.itemId }, { merge: true });
        return {};
      }

      if (body.target === "avatarShape") {
        if (typeof body.shape !== "string" || !AVATAR_SHAPES.has(body.shape)) {
          throw new Error("Invalid avatar shape");
        }
        const equipped =
          (data["equipped"] as Record<string, string> | undefined) ?? {};
        const equippedUpdate: Record<string, unknown> = {};
        for (const category of ["hat", "hair"]) {
          const id = equipped[category];
          if (id !== undefined && avatarItemShape(id) !== body.shape) {
            equippedUpdate[category] = admin.firestore.FieldValue.delete();
          }
        }
        tx.set(
          userRef,
          {
            avatarShape: body.shape,
            ...(Object.keys(equippedUpdate).length > 0
              ? { equipped: equippedUpdate }
              : {}),
          },
          { merge: true },
        );
        return {};
      }

      throw new Error("Unknown equip target");
    });
    res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Something went wrong";
    if (
      reason.startsWith("Invalid") ||
      reason === "Item not owned" ||
      reason === "Unknown equip target"
    ) {
      res.status(400).json({ ok: false, reason });
      return;
    }
    console.error("equip-item failed:", e);
    res.status(500).json({ ok: false, reason: "Something went wrong" });
  }
}

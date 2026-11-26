import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import {
  countBuiltInLessonsCompleted,
  qualifiesForAchievement,
} from "./_lib/achievements.js";
import { verifyStudent } from "./_lib/auth.js";
import { lessonGroupDone } from "./_lib/zoo.js";
import {
  CATALOGS,
  OWNED_FIELD,
  QUEST_HERO_SETS,
  questSetPrice,
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
  "garden",
  "zoo",
  "zooDecor",
  "questHero",
]);

type SideImageSet = { id?: string; price?: number };

function parseSideImageSets(data: unknown): SideImageSet[] {
  if (data === null || data === undefined) return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["sets"])) return d["sets"] as SideImageSet[];
  return [];
}

class BuyError extends Error {}

/**
 * Teacher switch for bought Monster Quest heroes (schoolConfig/gameAccess,
 * student override wins over the class). Two small reads, only when buying
 * a hero.
 */
async function questHeroesOff(
  db: admin.firestore.Firestore,
  uid: string,
): Promise<boolean> {
  const [userSnap, accessSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("schoolConfig").doc("gameAccess").get(),
  ]);
  const classId: unknown = userSnap.data()?.["classId"];
  const access = (accessSnap.data() ?? {}) as {
    classes?: Record<string, { questHeroesOff?: unknown }>;
    students?: Record<string, { questHeroesOff?: unknown }>;
  };
  const own = access.students?.[uid]?.questHeroesOff;
  if (typeof own === "boolean") return own;
  const cls =
    typeof classId === "string"
      ? access.classes?.[classId]?.questHeroesOff
      : undefined;
  return cls === true;
}

/** "set:<id>": every hero of the set you don't own yet, capped price. */
async function buyQuestSet(
  db: admin.firestore.Firestore,
  userRef: admin.firestore.DocumentReference,
  setId: string,
): Promise<number> {
  const set = QUEST_HERO_SETS[setId];
  if (set === undefined) throw new BuyError("Unknown item");
  if (!(await lessonGroupDone(userRef, set.requiresLessonGroup))) {
    throw new BuyError("Finish those lessons first");
  }
  return db.runTransaction(async (tx: admin.firestore.Transaction) => {
    const snap = await tx.get(userRef);
    const data = snap.exists ? snap.data() : {};
    const owned =
      (data?.["ownedQuestHeroes"] as Record<string, true> | undefined) ?? {};
    const missing = set.heroes.filter((h) => owned[h] !== true);
    if (missing.length === 0) throw new BuyError("Already owned");
    const price = questSetPrice(missing.length);
    const coins = (data?.["coins"] as number | undefined) ?? 0;
    if (coins < price) throw new BuyError("Not enough coins");
    tx.set(
      userRef,
      {
        ownedQuestHeroes: Object.fromEntries(missing.map((h) => [h, true])),
        coins: admin.firestore.FieldValue.increment(-price),
      },
      { merge: true },
    );
    return price;
  });
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

  if (shopId === "questHero") {
    try {
      if (await questHeroesOff(db, auth.uid)) {
        throw new BuyError("Your teacher has turned bought heroes off");
      }
      if (itemId.startsWith("set:")) {
        const price = await buyQuestSet(db, userRef, itemId.slice(4));
        res.status(200).json({ ok: true, price });
        return;
      }
    } catch (e) {
      if (e instanceof BuyError) {
        res.status(200).json({ ok: false, reason: e.message });
        return;
      }
      console.error("buy-item (questHero) failed:", e);
      res.status(500).json({ ok: false, reason: "Something went wrong" });
      return;
    }
  }

  const item = CATALOGS[shopId][itemId];
  if (item === undefined) {
    res.status(400).json({ ok: false, reason: "Unknown item" });
    return;
  }

  const ownedField = OWNED_FIELD[shopId];
  const selectedField = SELECTED_FIELD[shopId];

  try {
    // lesson-count unlocks need a subcollection count, done outside the
    // transaction (only for those items - one read per completed lesson)
    const lessonsCompleted = item.requiresAchievement?.startsWith("lessons-")
      ? await countBuiltInLessonsCompleted(userRef)
      : undefined;
    // My Zoo areas open lesson group by group (a few doc reads, zoo only)
    if (
      item.requiresLessonGroup !== undefined &&
      !(await lessonGroupDone(userRef, item.requiresLessonGroup))
    ) {
      throw new BuyError("Finish those lessons first");
    }
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
        // Badges are displayed client-side, but the free claim is authorized
        // from protected PB/streak fields so a forged badge grants nothing.
        if (
          !qualifiesForAchievement(data ?? {}, item.requiresAchievement, {
            lessonsCompleted,
          })
        ) {
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

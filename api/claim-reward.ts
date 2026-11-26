import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";

import { getAdminApp } from "./_lib/admin.js";
import { isAdminEmail, verifyStudent } from "./_lib/auth.js";
import { CATALOGS, OWNED_FIELD, ShopId } from "./_lib/catalogs.js";
import {
  applyMiniGameClaim,
  isMiniGameId,
  MINI_GAME_MAX_SCORE,
  type MiniGameId,
  type MiniGameRewardState,
} from "./_lib/mini-game-reward.js";
import { tokyoDateString } from "./_lib/time.js";
import {
  typingQuestDepthPayout,
  questRewardMultiplier,
  qualifiesForFastMode,
  typingQuestPayout,
  type TypingQuestMode,
  validTypingQuestRunTiming,
  validTypingQuestClear,
} from "./_lib/typing-quest-reward.js";

const DAILY_GREETING_BONUS = 2;
const DAILY_PRACTICE_REWARD = 10;
const RECOMMENDED_GAME_IDS = new Set([
  "word-defender",
  "balloon-pop",
  "type-racer",
  "ghost-hunter",
  "fruit-ninja",
  "type-toss",
  "typing-rpg",
  "tower-climb",
  "snack-shop",
  "echo-keys",
  "word-pong",
  "gem-dig",
  "four-row",
  "word-bomb",
  "karuta",
  "goldfish",
  "shiritori",
  "zoo-keeper",
]);

/** Mirrors frontend COLLECTION_CATEGORIES / COLLECTION_REWARD in avatar-items.ts. */
const COLLECTION_CATEGORIES = new Set([
  "color",
  "accessory",
  "face",
  "background",
  "highlight",
]);
const COLLECTION_REWARD = 40;
/** Mirrors frontend COLLECTION_SHOPS in utils/shop-collections.ts. */
const COLLECTION_SHOPS: ReadonlySet<ShopId> = new Set([
  "hands",
  "rgbPalette",
  "keyboardSkin",
  "keypressEffect",
  "caretEffect",
  "backdrop",
]);

/** One-time coin bonus for owning every year-round, coin-priced item in a set. */
async function claimCollection(
  uid: string,
  claimKey: string,
  ownedField: string,
  required: string[],
  res: VercelResponse,
): Promise<void> {
  const userRef = getAdminApp().firestore().collection("users").doc(uid);
  try {
    let claimed = false;
    await getAdminApp()
      .firestore()
      .runTransaction(async (tx: admin.firestore.Transaction) => {
        claimed = false;
        const data = (await tx.get(userRef)).data() ?? {};
        const owned =
          (data[ownedField] as Record<string, true> | undefined) ?? {};
        const done =
          (data["claimedCollections"] as Record<string, true> | undefined) ??
          {};
        if (done[claimKey] === true) return;
        if (!required.every((id) => owned[id] === true)) return;
        tx.set(
          userRef,
          {
            claimedCollections: { [claimKey]: true },
            coins: admin.firestore.FieldValue.increment(COLLECTION_REWARD),
          },
          { merge: true },
        );
        claimed = true;
      });
    res.status(200).json({ claimed, coins: claimed ? COLLECTION_REWARD : 0 });
  } catch (e) {
    console.error("claim-reward (collection) failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

/** Coins for today's house chore (typing a few themed words). */
const HOUSE_CHORE_COINS = 5;

/**
 * Once per Tokyo day: the daily typing chore in My House. One read + one
 * write; houseChoreDate is an economy field so it can't be reset by hand.
 */
async function claimHouseChore(
  uid: string,
  res: VercelResponse,
): Promise<void> {
  const db = getAdminApp().firestore();
  const userRef = db.collection("users").doc(uid);
  const today = tokyoDateString();
  try {
    const claimed = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const data = (await tx.get(userRef)).data() ?? {};
        if (data["houseChoreDate"] === today) return false;
        tx.set(
          userRef,
          {
            houseChoreDate: today,
            houseChoresDone: admin.firestore.FieldValue.increment(1),
            coins: admin.firestore.FieldValue.increment(HOUSE_CHORE_COINS),
          },
          { merge: true },
        );
        return true;
      },
    );
    res.status(200).json({ claimed, coins: claimed ? HOUSE_CHORE_COINS : 0 });
  } catch (e) {
    console.error("claim-reward (houseChore) failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

/** My Zoo daily care jobs. Mirrors frontend games/zoo/zoo-areas.ts. */
const ZOO_CARE_JOBS = new Set(["feed", "clean", "vet"]);
const ZOO_CARE_COINS = 4;

/**
 * My Zoo care job: pays once per Japan day per job. Like the house chore the
 * typing itself isn't checked; zooCareDates is an economy field.
 */
async function claimZooCare(
  uid: string,
  rawJob: unknown,
  res: VercelResponse,
): Promise<void> {
  if (typeof rawJob !== "string" || !ZOO_CARE_JOBS.has(rawJob)) {
    res.status(400).json({ claimed: false, coins: 0 });
    return;
  }
  const job = rawJob;
  const db = getAdminApp().firestore();
  const userRef = db.collection("users").doc(uid);
  const today = tokyoDateString();
  try {
    const claimed = await db.runTransaction(
      async (tx: admin.firestore.Transaction) => {
        const data = (await tx.get(userRef)).data() ?? {};
        const dates = (data["zooCareDates"] ?? {}) as Record<string, unknown>;
        if (dates[job] === today) return false;
        tx.set(
          userRef,
          {
            zooCareDates: { [job]: today },
            zooCareDone: admin.firestore.FieldValue.increment(1),
            coins: admin.firestore.FieldValue.increment(ZOO_CARE_COINS),
          },
          { merge: true },
        );
        return true;
      },
    );
    res.status(200).json({ claimed, coins: claimed ? ZOO_CARE_COINS : 0 });
  } catch (e) {
    console.error("claim-reward (zooCare) failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

/** Type Toss prize booth: plushies and their ticket prices. */
const TOSS_PRIZES: Record<string, number> = {
  teddy: 100,
  chick: 150,
  frog: 200,
  panda: 250,
  dino: 300,
  octopus: 350,
  unicorn: 400,
  fox: 450,
  whale: 500,
  dragon: 600,
  lion: 700,
  trophy: 1000,
};
/** Most tickets one Type Toss round can bank. */
const MAX_TOSS_TICKETS = 1500;

/**
 * Type Toss prize booth: bank a round's tickets and/or buy a prize with
 * banked tickets. Cosmetic only (no coins). One read, plus one write.
 */
async function claimTossBooth(
  uid: string,
  rawTickets: unknown,
  rawBuy: unknown,
  res: VercelResponse,
): Promise<void> {
  const add = Math.floor(Number(rawTickets ?? 0));
  const buy = typeof rawBuy === "string" ? rawBuy : undefined;
  if (
    !Number.isFinite(add) ||
    add < 0 ||
    add > MAX_TOSS_TICKETS ||
    (buy !== undefined && TOSS_PRIZES[buy] === undefined)
  ) {
    res.status(400).json({ tickets: 0, prizes: [] });
    return;
  }
  const userRef = getAdminApp().firestore().collection("users").doc(uid);
  try {
    let tickets = 0;
    let prizes: string[] = [];
    let bought = false;
    await getAdminApp()
      .firestore()
      .runTransaction(async (tx: admin.firestore.Transaction) => {
        const data = ((await tx.get(userRef)).data() ?? {}) as Record<
          string,
          unknown
        >;
        const booth = (data["tossBooth"] ?? {}) as {
          tickets?: unknown;
          prizes?: Record<string, unknown>;
        };
        tickets = (typeof booth.tickets === "number" ? booth.tickets : 0) + add;
        const owned: Record<string, unknown> = { ...booth.prizes };
        bought = false;
        if (buy !== undefined && owned[buy] !== true) {
          const price = TOSS_PRIZES[buy] ?? Infinity;
          if (tickets >= price) {
            tickets -= price;
            owned[buy] = true;
            bought = true;
          }
        }
        prizes = Object.keys(owned).filter((k) => owned[k] === true);
        if (add > 0 || bought) {
          tx.set(
            userRef,
            { tossBooth: { tickets, prizes: owned } },
            { mergeFields: ["tossBooth"] },
          );
        }
      });
    res.status(200).json({ tickets, prizes, bought });
  } catch (e) {
    console.error("claim-reward (tossBooth) failed:", e);
    res.status(500).json({ tickets: 0, prizes: [] });
  }
}

/**
 * Balloon Pop levels: keep my best stars (0-3) for a level (1-12) and return
 * all of them. level 0 just reads. One read, plus one write on a new best.
 */
async function claimBalloonStars(
  uid: string,
  rawLevel: unknown,
  rawStars: unknown,
  res: VercelResponse,
): Promise<void> {
  const level = Math.floor(Number(rawLevel ?? 0));
  const stars = Math.floor(Number(rawStars ?? 0));
  if (
    !Number.isFinite(level) ||
    !Number.isFinite(stars) ||
    level < 0 ||
    level > 12 ||
    stars < 0 ||
    stars > 3
  ) {
    res.status(400).json({ stars: {} });
    return;
  }
  const userRef = getAdminApp().firestore().collection("users").doc(uid);
  try {
    let out: Record<string, number> = {};
    await getAdminApp()
      .firestore()
      .runTransaction(async (tx: admin.firestore.Transaction) => {
        const data = ((await tx.get(userRef)).data() ?? {}) as Record<
          string,
          unknown
        >;
        const old = (data["balloonStars"] ?? {}) as Record<string, unknown>;
        out = {};
        for (const [k, v] of Object.entries(old)) {
          if (typeof v === "number") out[k] = v;
        }
        const key = `l${level}`;
        if (level > 0 && stars > (out[key] ?? 0)) {
          out[key] = stars;
          tx.set(
            userRef,
            { balloonStars: { [key]: stars } },
            { mergeFields: [`balloonStars.${key}`] },
          );
        }
      });
    res.status(200).json({ stars: out });
  } catch (e) {
    console.error("claim-reward (balloonStars) failed:", e);
    res.status(500).json({ stars: {} });
  }
}

/** Type Racer garage points from one race (1st-3rd, Grand Prix win). */
const MAX_RACER_POINTS = 8;

/**
 * Type Racer garage: add this race's points (0 just reads the total) and
 * return the total, which unlocks car colours, stickers and drivers.
 * Cosmetic only - no coins. One read, plus one write when points > 0.
 */
async function claimRacerGarage(
  uid: string,
  raw: unknown,
  res: VercelResponse,
): Promise<void> {
  const points = Math.floor(Number(raw ?? 0));
  if (!Number.isFinite(points) || points < 0 || points > MAX_RACER_POINTS) {
    res.status(400).json({ points: 0 });
    return;
  }
  const userRef = getAdminApp().firestore().collection("users").doc(uid);
  try {
    let total = 0;
    await getAdminApp()
      .firestore()
      .runTransaction(async (tx: admin.firestore.Transaction) => {
        const data = ((await tx.get(userRef)).data() ?? {}) as Record<
          string,
          unknown
        >;
        const old = data["racerPoints"];
        total = (typeof old === "number" ? old : 0) + points;
        if (points > 0) {
          tx.set(
            userRef,
            { racerPoints: admin.firestore.FieldValue.increment(points) },
            { mergeFields: ["racerPoints"] },
          );
        }
      });
    res.status(200).json({ points: total });
  } catch (e) {
    console.error("claim-reward (racerGarage) failed:", e);
    res.status(500).json({ points: 0 });
  }
}

const SHIP_PET_KEYS = new Set([
  "bunny",
  "pup",
  "kitty",
  "hamster",
  "duck",
  "turtle",
  "golden",
]);

const DIG_GEM_KEYS = new Set([
  "ruby",
  "emerald",
  "amethyst",
  "diamond",
  "fireopal",
  "obsidian",
  "fossil",
  "amber",
]);

/** Items found in one run (pets, gems): known kinds, 1-40 each. */
function readItems(
  raw: unknown,
  keys: Set<string>,
): Record<string, number> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!keys.has(k) || typeof v !== "number") continue;
    const n = Math.floor(v);
    if (n >= 1 && n <= 40) out[k] = n;
  }
  return out;
}

/** Collections that grow from mini game runs: user field + what may be in it. */
const COLLECTIONS: Partial<
  Record<
    MiniGameId,
    { field: string; body: "pets" | "gems"; keys: Set<string> }
  >
> = {
  "rescue-ship": { field: "shipPets", body: "pets", keys: SHIP_PET_KEYS },
  "gem-dig": { field: "digGems", body: "gems", keys: DIG_GEM_KEYS },
};

/**
 * Per-run coins for the solo mini games, capped to a few paid runs per game
 * per Tokyo day (see _lib/mini-game-reward.ts). One read + one write.
 */
async function claimMiniGame(
  uid: string,
  gameId: MiniGameId,
  score: number,
  res: VercelResponse,
  found?: { field: string; items: Record<string, number> },
): Promise<void> {
  const userRef = getAdminApp().firestore().collection("users").doc(uid);
  try {
    let coins = 0;
    let capped = false;
    let petTotals: Record<string, number> | undefined;
    await getAdminApp()
      .firestore()
      .runTransaction(async (tx: admin.firestore.Transaction) => {
        const data = (await tx.get(userRef)).data() ?? {};
        const result = applyMiniGameClaim(
          data["miniGameRewards"] as MiniGameRewardState | undefined,
          tokyoDateString(),
          gameId,
          score,
        );
        coins = result.coins;
        capped = result.capped;
        // pets rescued / gems dug join my collection (same write)
        const petEntries = Object.entries(found?.items ?? {});
        if (found !== undefined) {
          const old = (data[found.field] ?? {}) as Record<string, unknown>;
          petTotals = {};
          for (const [k, v] of Object.entries(old)) {
            if (typeof v === "number") petTotals[k] = v;
          }
          for (const [k, n] of petEntries) {
            petTotals[k] = (petTotals[k] ?? 0) + n;
          }
        }
        if (coins === 0 && petEntries.length === 0) return;
        const fields: Record<string, unknown> = {};
        const paths: string[] = [];
        if (coins > 0) {
          // mergeFields replaces miniGameRewards whole, so yesterday's
          // run counts don't linger after the date rolls over.
          fields["miniGameRewards"] = result.next;
          fields["coins"] = admin.firestore.FieldValue.increment(coins);
          paths.push("miniGameRewards", "coins");
        }
        if (petEntries.length > 0 && found !== undefined) {
          fields[found.field] = Object.fromEntries(
            petEntries.map(([k, n]) => [
              k,
              admin.firestore.FieldValue.increment(n),
            ]),
          );
          paths.push(...petEntries.map(([k]) => `${found.field}.${k}`));
        }
        tx.set(userRef, fields, { mergeFields: paths });
      });
    res.status(200).json({
      claimed: coins > 0,
      coins,
      capped,
      ...(petTotals === undefined || found === undefined
        ? {}
        : { [found.field]: petTotals }),
    });
  } catch (e) {
    console.error("claim-reward (miniGame) failed:", e);
    res.status(500).json({ claimed: false, coins: 0, capped: false });
  }
}

/**
 * Standalone rewards not tied to a completed typing test: the house greeting
 * a transaction-capped recommended-game bonus, and Typing Quest clears.
 */
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
    type?: unknown;
    gameId?: unknown;
    score?: unknown;
    wave?: unknown;
    hits?: unknown;
    elapsed?: unknown;
    mistakes?: unknown;
    completedWaves?: unknown;
    runId?: unknown;
    mode?: unknown;
    category?: unknown;
    pets?: unknown;
    gems?: unknown;
    job?: unknown;
  };
  if (body.type === "avatarCollection") {
    const category = body.category;
    if (typeof category !== "string" || !COLLECTION_CATEGORIES.has(category)) {
      res.status(400).json({ claimed: false, coins: 0 });
      return;
    }
    const required = Object.entries(CATALOGS.avatar)
      .filter(
        ([, item]) =>
          item.category === category &&
          item.price !== undefined &&
          item.seasonal !== true,
      )
      .map(([id]) => id);
    await claimCollection(auth.uid, category, "ownedCostumes", required, res);
    return;
  }
  if (body.type === "tossBooth") {
    await claimTossBooth(auth.uid, body.score, body.category, res);
    return;
  }
  if (body.type === "balloonStars") {
    await claimBalloonStars(auth.uid, body.wave, body.score, res);
    return;
  }
  if (body.type === "racerGarage") {
    await claimRacerGarage(auth.uid, body.score, res);
    return;
  }
  if (body.type === "houseChore") {
    await claimHouseChore(auth.uid, res);
    return;
  }
  if (body.type === "zooCare") {
    await claimZooCare(auth.uid, body.job, res);
    return;
  }
  if (body.type === "miniGame") {
    const score = Number(body.score);
    if (
      !isMiniGameId(body.gameId) ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > MINI_GAME_MAX_SCORE
    ) {
      res.status(400).json({ claimed: false, coins: 0, capped: false });
      return;
    }
    const col = COLLECTIONS[body.gameId];
    const items =
      col === undefined
        ? undefined
        : readItems(col.body === "pets" ? body.pets : body.gems, col.keys);
    await claimMiniGame(
      auth.uid,
      body.gameId,
      Math.floor(score),
      res,
      col === undefined || items === undefined
        ? undefined
        : { field: col.field, items },
    );
    return;
  }
  if (body.type === "shopCollection") {
    const shop = body.category as ShopId;
    if (typeof shop !== "string" || !COLLECTION_SHOPS.has(shop)) {
      res.status(400).json({ claimed: false, coins: 0 });
      return;
    }
    const required = Object.entries(CATALOGS[shop])
      .filter(([, item]) => item.price !== undefined && item.seasonal !== true)
      .map(([id]) => id);
    await claimCollection(
      auth.uid,
      `shop-${shop}`,
      OWNED_FIELD[shop],
      required,
      res,
    );
    return;
  }
  if (
    body.type !== "dailyGreeting" &&
    body.type !== "recommendedGame" &&
    body.type !== "typingQuest" &&
    body.type !== "typingQuestStart" &&
    body.type !== "typingQuestStatus"
  ) {
    res.status(400).json({ ok: false, reason: "Unknown reward type" });
    return;
  }
  const isRecommendedGame = body.type === "recommendedGame";
  const isTypingQuest = body.type === "typingQuest";
  const isTypingQuestStart = body.type === "typingQuestStart";
  const score = Number(body.score);
  const wave = Number(body.wave);
  const hits = Number(body.hits);
  const elapsed = Number(body.elapsed);
  const mistakes = Number(body.mistakes);
  const completedWaves = Number(body.completedWaves);
  if (
    isRecommendedGame &&
    (typeof body.gameId !== "string" ||
      !RECOMMENDED_GAME_IDS.has(body.gameId) ||
      !Number.isFinite(score) ||
      score <= 0 ||
      !Number.isFinite(wave) ||
      wave < 1)
  ) {
    res.status(400).json({ ok: false, reason: "Invalid game result" });
    return;
  }
  if (
    isTypingQuest &&
    (typeof body.runId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.runId,
      ))
  ) {
    res.status(400).json({ ok: false, reason: "Invalid quest run" });
    return;
  }

  const app = getAdminApp();
  const db = app.firestore();
  const userRef = db.collection("users").doc(auth.uid);
  const today = tokyoDateString();

  try {
    if (
      body.type === "typingQuestStatus" ||
      (isTypingQuestStart && body.mode === "fast")
    ) {
      const profile = await userRef.get();
      let fastUnlocked =
        (Number(profile.get("typingQuestFastQualifiers")) || 0) >= 2;
      if (!fastUnlocked) {
        // Include qualifying tests saved before Fast Mode was introduced.
        const recentResults = await userRef
          .collection("results")
          .orderBy("timestamp", "desc")
          .limit(200)
          .get();
        fastUnlocked =
          recentResults.docs.filter((doc) =>
            qualifiesForFastMode(
              doc.data() as Parameters<typeof qualifiesForFastMode>[0],
            ),
          ).length >= 2;
        if (fastUnlocked) {
          await userRef.set({ typingQuestFastQualifiers: 2 }, { merge: true });
        }
      }
      if (body.type === "typingQuestStatus") {
        res.status(200).json({ fastUnlocked });
        return;
      }
      const requestedMode: TypingQuestMode =
        body.mode === "fast" ? "fast" : "normal";
      if (requestedMode === "fast" && !fastUnlocked) {
        res.status(403).json({
          ok: false,
          reason: "Fast Mode requires two 40 WPM, 95% accuracy 30-second tests",
        });
        return;
      }
    }
    if (
      (isTypingQuest || isTypingQuestStart) &&
      !isAdminEmail(auth.email) &&
      // teacher accounts skip the student unlock rules
      (await userRef.get()).data()?.["role"] !== "teacher"
    ) {
      const prerequisite = await userRef
        .collection("lessonProgress")
        .doc("bottom-words")
        .get();
      if (prerequisite.data()?.["completed"] !== true) {
        res.status(403).json({ ok: false, reason: "All Keys is locked" });
        return;
      }
    }
    if (isTypingQuestStart) {
      const runId = randomUUID();
      const profile = await userRef.get();
      const mode: TypingQuestMode = body.mode === "fast" ? "fast" : "normal";
      const bestWave = Math.max(
        0,
        Number(profile.get("typingQuestBestWave")) || 0,
      );
      await userRef.collection("typingQuestClaims").doc(runId).create({
        startedAt: Date.now(),
        mode,
      });
      res.status(200).json({ runId, bestWave, mode });
      return;
    }
    let claimed = false;
    let firstClear = false;
    let coinsAwarded = 0;
    let bonusRepeatClears = 0;
    let baseCoins = 0;
    let depthCoins = 0;
    let bestWave = 0;
    let invalidRun = false;
    let questMode: TypingQuestMode = "normal";
    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      claimed = false;
      firstClear = false;
      coinsAwarded = 0;
      bonusRepeatClears = 0;
      baseCoins = 0;
      depthCoins = 0;
      bestWave = 0;
      invalidRun = false;
      questMode = "normal";
      const snap = await tx.get(userRef);
      const runRef = isTypingQuest
        ? userRef.collection("typingQuestClaims").doc(body.runId as string)
        : null;
      const runSnap = runRef ? await tx.get(runRef) : null;
      if (isTypingQuest) {
        if (!runSnap?.exists) {
          invalidRun = true;
          return;
        }
        if (runSnap.get("claimedAt") !== undefined) return;
        questMode = runSnap.get("mode") === "fast" ? "fast" : "normal";
        if (
          !validTypingQuestClear(
            { hits, elapsed, mistakes, score, completedWaves },
            questMode,
          )
        ) {
          invalidRun = true;
          return;
        }
        if (
          !validTypingQuestRunTiming(
            runSnap.get("startedAt") as number,
            Date.now(),
            elapsed,
          )
        ) {
          invalidRun = true;
          return;
        }
      }
      const data = snap.exists ? snap.data() : {};
      const rewardDates =
        (data?.["practiceRewardDates"] as Record<string, string> | undefined) ??
        {};
      const lastClaim = isRecommendedGame
        ? rewardDates["recommendation"]
        : (data?.["houseGreetingDate"] as string | undefined);
      if (!isTypingQuest && lastClaim === today) return;

      const questPayout = isTypingQuest
        ? typingQuestPayout(
            rewardDates,
            data?.["typingQuestBonusRepeatClears"] as number,
            today,
          )
        : { coins: 0, firstClear: false, bonusRepeatClears: 0 };
      firstClear = questPayout.firstClear;
      bonusRepeatClears = questPayout.bonusRepeatClears;
      const paidDepthToday =
        isTypingQuest && data?.["typingQuestDepthBonusDate"] === today
          ? Math.max(0, Number(data?.["typingQuestDepthBonusCoins"]) || 0)
          : 0;
      const depthUnits = isTypingQuest
        ? typingQuestDepthPayout(completedWaves, paidDepthToday, questMode)
        : 0;
      const multiplier = questRewardMultiplier(questMode);
      depthCoins = depthUnits * multiplier;
      baseCoins = questPayout.coins * multiplier;
      bestWave = isTypingQuest
        ? Math.max(Number(data?.["typingQuestBestWave"]) || 0, completedWaves)
        : 0;
      const coins = isTypingQuest
        ? baseCoins + depthCoins
        : isRecommendedGame
          ? DAILY_PRACTICE_REWARD
          : DAILY_GREETING_BONUS;
      coinsAwarded = coins;
      tx.set(
        userRef,
        {
          ...(isTypingQuest
            ? {
                practiceRewardDates: {
                  ...rewardDates,
                  typingQuestLastReward: today,
                  typingQuestBonusRepeatDate: today,
                  ...(firstClear ? { typingQuestFirstClear: today } : {}),
                },
                typingQuestBonusRepeatClears: bonusRepeatClears,
                typingQuestDepthBonusDate: today,
                typingQuestDepthBonusCoins: paidDepthToday + depthUnits,
                typingQuestBestWave: bestWave,
              }
            : isRecommendedGame
              ? {
                  practiceRewardDates: {
                    ...rewardDates,
                    recommendation: today,
                  },
                }
              : { houseGreetingDate: today }),
          coins: admin.firestore.FieldValue.increment(coins),
        },
        { merge: true },
      );
      if (runRef) {
        tx.update(runRef, {
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      claimed = true;
    });
    if (invalidRun) {
      res.status(400).json({
        claimed: false,
        coins: 0,
        reason: "Invalid quest run or elapsed time",
      });
      return;
    }
    res.status(200).json({
      claimed,
      firstClear: claimed && firstClear,
      coins: claimed ? coinsAwarded : 0,
      baseCoins: claimed ? baseCoins : 0,
      depthCoins: claimed ? depthCoins : 0,
      bestWave: claimed ? bestWave : undefined,
      bonusRepeatClears: claimed ? bonusRepeatClears : undefined,
    });
  } catch (e) {
    console.error("claim-reward failed:", e);
    res.status(500).json({ claimed: false, coins: 0 });
  }
}

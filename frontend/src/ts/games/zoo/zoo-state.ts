import { collection, doc, setDoc } from "firebase/firestore";

import { callApi } from "../../api-client";
import { tokyoDate } from "../../classroom/activity";
import { getDb } from "../../firebase";
import { invalidateCoinQueries } from "../../queries/coins";
import { getUserDocShared } from "../../utils/shared-user-doc";
import { ZOO_SPECIES, ZooSpecies } from "./zoo-animals";
import { STARTER_ANIMAL, ZOO_CARE_JOBS, ZooCareJob } from "./zoo-areas";
import { isZooDecorId, ZOO_DECOR, ZooDecorId } from "./zoo-decor";

export type ZooPenPosition = { xPct: number; yPct: number };

export type ZooState = {
  coins: number;
  /** owned animals, starter included, in catalog order */
  animals: ZooSpecies[];
  /** owned decorations, in catalog order */
  decor: ZooDecorId[];
  /** species or decoration id -> where it was dragged (else a default spot) */
  layout: Partial<Record<ZooSpecies | ZooDecorId, ZooPenPosition>>;
  /** days in a row with all care done (count is 0 once a day is missed) */
  streak: number;
  /** care job -> Japan date it was last done */
  careDates: Partial<Record<ZooCareJob, string>>;
};

const isSpecies = (s: string): s is ZooSpecies =>
  (ZOO_SPECIES as readonly string[]).includes(s);

/** Zoo fields from a loaded user doc (also used for visits later). */
export function zooStateFromDoc(
  data: Record<string, unknown> | undefined,
  today = tokyoDate(),
  yesterday = tokyoDate(Date.now() - 24 * 60 * 60 * 1000),
): ZooState {
  const owned = (data?.["ownedZooAnimals"] ?? {}) as Record<string, unknown>;
  const rawLayout = (data?.["zooLayout"] ?? {}) as Record<string, unknown>;
  const rawCare = (data?.["zooCareDates"] ?? {}) as Record<string, unknown>;
  const ownedDecor = (data?.["ownedZooDecor"] ?? {}) as Record<string, unknown>;
  const layout: ZooState["layout"] = {};
  for (const [k, v] of Object.entries(rawLayout)) {
    const p = v as Partial<ZooPenPosition> | undefined;
    if (
      (isSpecies(k) || isZooDecorId(k)) &&
      typeof p?.xPct === "number" &&
      typeof p.yPct === "number"
    ) {
      layout[k] = { xPct: p.xPct, yPct: p.yPct };
    }
  }
  const careDates: ZooState["careDates"] = {};
  for (const job of ZOO_CARE_JOBS) {
    const d = rawCare[job];
    if (typeof d === "string") careDates[job] = d;
  }
  return {
    coins: (data?.["coins"] as number | undefined) ?? 0,
    animals: ZOO_SPECIES.filter(
      (s) => s === STARTER_ANIMAL || owned[s] === true,
    ),
    decor: ZOO_DECOR.map((d) => d.id).filter((id) => ownedDecor[id] === true),
    layout,
    careDates,
    streak: liveStreak(data?.["zooStreak"], today, yesterday),
  };
}

/** The saved streak, or 0 if its last full care day was before yesterday. */
function liveStreak(raw: unknown, today: string, yesterday: string): number {
  const s = raw as { count?: unknown; lastDate?: unknown } | undefined;
  if (typeof s?.count !== "number") return 0;
  return s.lastDate === today || s.lastDate === yesterday ? s.count : 0;
}

export async function getZooState(uid: string): Promise<ZooState> {
  const snap = await getUserDocShared(uid);
  return zooStateFromDoc(snap.exists() ? snap.data() : undefined);
}

/**
 * Buys an animal (with its pen) or a decoration - price and lesson gate are
 * checked server-side.
 */
export async function buyZooItem(
  shop: "zoo" | "zooDecor",
  itemId: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop, itemId },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy zoo animal:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/** Saves where a pen or decoration was dragged to (cosmetic, own doc only). */
export async function setZooPosition(
  uid: string,
  id: ZooSpecies | ZooDecorId,
  pos: ZooPenPosition,
): Promise<void> {
  await setDoc(
    doc(collection(getDb(), "users"), uid),
    { zooLayout: { [id]: pos } },
    { merge: true },
  );
}

/** Pays a care job's coins - once per Japan day per job, checked server-side. */
export type ZooCareClaim = {
  claimed: boolean;
  /** care coins plus any streak bonus */
  coins: number;
  bonus?: number;
  streak?: number;
  /** this was the day's last job */
  dayDone?: boolean;
};

export async function claimZooCare(job: ZooCareJob): Promise<ZooCareClaim> {
  const result = await callApi<ZooCareClaim>("/api/claim-reward", {
    type: "zooCare",
    job,
  });
  invalidateCoinQueries();
  return result;
}

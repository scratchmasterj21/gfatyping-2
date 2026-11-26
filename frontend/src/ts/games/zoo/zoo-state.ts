import { collection, doc, setDoc } from "firebase/firestore";

import { callApi } from "../../api-client";
import { getDb } from "../../firebase";
import { invalidateCoinQueries } from "../../queries/coins";
import { getUserDocShared } from "../../utils/shared-user-doc";
import { ZOO_SPECIES, ZooSpecies } from "./zoo-animals";
import { STARTER_ANIMAL, ZOO_CARE_JOBS, ZooCareJob } from "./zoo-areas";

export type ZooPenPosition = { xPct: number; yPct: number };

export type ZooState = {
  coins: number;
  /** owned animals, starter included, in catalog order */
  animals: ZooSpecies[];
  /** species -> where its pen was dragged to (else its default slot) */
  layout: Partial<Record<ZooSpecies, ZooPenPosition>>;
  /** care job -> Japan date it was last done */
  careDates: Partial<Record<ZooCareJob, string>>;
};

const isSpecies = (s: string): s is ZooSpecies =>
  (ZOO_SPECIES as readonly string[]).includes(s);

/** Zoo fields from a loaded user doc (also used for visits later). */
export function zooStateFromDoc(
  data: Record<string, unknown> | undefined,
): ZooState {
  const owned = (data?.["ownedZooAnimals"] ?? {}) as Record<string, unknown>;
  const rawLayout = (data?.["zooLayout"] ?? {}) as Record<string, unknown>;
  const rawCare = (data?.["zooCareDates"] ?? {}) as Record<string, unknown>;
  const layout: ZooState["layout"] = {};
  for (const [k, v] of Object.entries(rawLayout)) {
    const p = v as Partial<ZooPenPosition> | undefined;
    if (
      isSpecies(k) &&
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
    layout,
    careDates,
  };
}

export async function getZooState(uid: string): Promise<ZooState> {
  const snap = await getUserDocShared(uid);
  return zooStateFromDoc(snap.exists() ? snap.data() : undefined);
}

/** Buys an animal (and its pen) - price and lesson gate checked server-side. */
export async function buyZooAnimal(
  species: ZooSpecies,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await callApi<{ ok: boolean; reason?: string }>(
      "/api/buy-item",
      { shop: "zoo", itemId: species },
    );
    if (result.ok) invalidateCoinQueries();
    return result;
  } catch (e) {
    console.error("Failed to buy zoo animal:", e);
    return { ok: false, reason: "Something went wrong" };
  }
}

/** Saves where a pen was dragged to (cosmetic, own doc only). */
export async function setZooPenPosition(
  uid: string,
  species: ZooSpecies,
  pos: ZooPenPosition,
): Promise<void> {
  await setDoc(
    doc(collection(getDb(), "users"), uid),
    { zooLayout: { [species]: pos } },
    { merge: true },
  );
}

/** Pays a care job's coins - once per Japan day per job, checked server-side. */
export async function claimZooCare(
  job: ZooCareJob,
): Promise<{ claimed: boolean; coins: number }> {
  const result = await callApi<{ claimed: boolean; coins: number }>(
    "/api/claim-reward",
    { type: "zooCare", job },
  );
  invalidateCoinQueries();
  return result;
}

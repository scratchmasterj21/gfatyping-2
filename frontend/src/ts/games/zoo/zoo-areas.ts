import { ZOO_INFO, ZooSpecies } from "./zoo-animals";

/**
 * My Zoo areas: each opens when a lesson group is finished. Prices are
 * mirrored in api/_lib/catalogs.ts (CATALOGS.zoo) and the lesson gates in
 * api/_lib/zoo.ts - the server decides.
 */
export type ZooArea = {
  id: string;
  name: string;
  /** lesson group to finish first (undefined = open from the start) */
  requires?: "home-row" | "top-row" | "bottom-row" | "all-keys";
  requiresName?: string;
  species: ZooSpecies[];
};

export const ZOO_AREAS: ZooArea[] = [
  { id: "petting", name: "Petting Corner", species: ["rabbit", "chick"] },
  {
    id: "farm",
    name: "Farm",
    requires: "home-row",
    requiresName: "Home Row",
    species: ["goat", "duck", "pig"],
  },
  {
    id: "jungle",
    name: "Jungle",
    requires: "top-row",
    requiresName: "Top Row",
    species: ["monkey", "parrot"],
  },
  {
    id: "savanna",
    name: "Savanna",
    requires: "bottom-row",
    requiresName: "Bottom Row",
    species: ["zebra", "giraffe", "elephant"],
  },
  {
    id: "big-zoo",
    name: "Big Zoo",
    requires: "all-keys",
    requiresName: "All Keys",
    species: ["penguin", "lion", "panda"],
  },
];

/** Everyone starts with this one (not sold). */
export const STARTER_ANIMAL: ZooSpecies = "rabbit";

/** Coins per animal (its pen comes with it). Mirrors CATALOGS.zoo. */
export const ZOO_PRICES: Partial<Record<ZooSpecies, number>> = {
  chick: 40,
  goat: 60,
  duck: 60,
  pig: 70,
  monkey: 100,
  parrot: 110,
  zebra: 130,
  giraffe: 150,
  elephant: 180,
  penguin: 170,
  lion: 200,
  panda: 220,
};

export const areaOf = (species: ZooSpecies): ZooArea =>
  ZOO_AREAS.find((a) => a.species.includes(species)) ??
  (ZOO_AREAS[0] as ZooArea);

// ---------------------------------------------------------------------------
// Daily care
// ---------------------------------------------------------------------------

export const ZOO_CARE_JOBS = ["feed", "clean", "vet"] as const;
export type ZooCareJob = (typeof ZOO_CARE_JOBS)[number];

/** Coins per care job, once a Japan day each. Mirrors api/claim-reward.ts. */
export const ZOO_CARE_COINS = 4;

export const CARE_JOB_INFO: Record<
  ZooCareJob,
  { title: string; icon: "fa-carrot" | "fa-broom" | "fa-stethoscope" }
> = {
  feed: { title: "Feed the animals", icon: "fa-carrot" },
  clean: { title: "Clean the pens", icon: "fa-broom" },
  vet: { title: "Vet check", icon: "fa-stethoscope" },
};

const CLEAN_WORDS = ["sweep", "rake", "mop", "hose", "scrub", "tidy", "dust"];
const VET_WORDS = ["check", "hug", "brush", "ears", "teeth", "paws", "smile"];

/** Deterministic shuffle for a date, so the words don't change on reload. */
function seeded<T>(list: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Words for a care job. Feeding uses each owned animal's easy food word
 * (topped up to 3); cleaning and the vet check use 5 short words.
 */
export function careWords(
  job: ZooCareJob,
  owned: readonly ZooSpecies[],
  date: string,
): string[] {
  if (job === "feed") {
    const foods = [
      ...new Set(owned.map((s) => ZOO_INFO[s].food[0][0] ?? "hay")),
    ];
    const extra = ["hay", "seed", "corn"].filter((w) => !foods.includes(w));
    return seeded(
      [...foods, ...extra].slice(0, Math.max(3, foods.length)),
      date,
    ).slice(0, 6);
  }
  return seeded(
    job === "clean" ? CLEAN_WORDS : VET_WORDS,
    `${job}${date}`,
  ).slice(0, 5);
}

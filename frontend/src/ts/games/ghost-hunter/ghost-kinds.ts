/**
 * Special ghosts that change how you type them. "mini" is the little ghost
 * a twin splits into - it never spawns on its own.
 */
export type GhostKind =
  | "normal"
  | "shy"
  | "twin"
  | "armored"
  | "speedy"
  | "mini";

export type SpecialKind = "shy" | "twin" | "armored" | "speedy";

export const KIND_INFO: Record<
  SpecialKind,
  { emoji: string; name: string; tip: string }
> = {
  speedy: {
    emoji: "⚡",
    name: "Speedy ghost",
    tip: "small and fast - extra points!",
  },
  armored: {
    emoji: "🛡️",
    name: "Armored ghost",
    tip: "type its word twice",
  },
  twin: {
    emoji: "👯",
    name: "Twin ghost",
    tip: "splits into two little ghosts",
  },
  shy: {
    emoji: "👀",
    name: "Shy ghost",
    tip: "its word only shows up close",
  },
};

/** Wave each special ghost first shows up (Easy waits one more for shy). */
const FIRST_WAVE: Record<SpecialKind, number> = {
  speedy: 2,
  armored: 2,
  twin: 3,
  shy: 4,
};

/** Bonus points for catching a speedy ghost. */
export const SPEEDY_BONUS = 10;
/** Speedy ghosts move this much faster. */
export const SPEEDY_FACTOR = 1.6;
/** Points for knocking an armored ghost's armor off. */
export const ARMOR_POINTS = 5;
/** A shy ghost shows its word once it's this many seconds from its log... */
export const SHY_REVEAL_SECONDS = 5;
/** ...but never closer than this, px. */
export const SHY_REVEAL_MIN_PX = 220;

/** The kind of the next normal ghost. */
export function pickKind(
  rng: () => number,
  wave: number,
  easy: boolean,
): GhostKind {
  const chance = easy ? 0.2 : 0.3;
  if (rng() >= chance) return "normal";
  const open = (Object.keys(FIRST_WAVE) as SpecialKind[]).filter(
    (k) => wave >= FIRST_WAVE[k] + (easy && k === "shy" ? 1 : 0),
  );
  if (open.length === 0) return "normal";
  return open[Math.floor(rng() * open.length)] ?? "normal";
}

/** Small seeded random numbers (same seed, same game). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

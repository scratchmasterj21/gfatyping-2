import type { DifficultyOption } from "../components/DifficultySegmented";

/**
 * Gem Dig: everyone digs down their own shaft. Each block has a word; type it
 * to dig the block. Some blocks hide a gem. First to the treasure chest at
 * the bottom wins; if time runs out, the deepest digger wins.
 */

export type DigDifficulty = DifficultyOption & {
  /** shortest word at the top */
  minLen: number;
  /** longest word near the bottom */
  maxLen: number;
  /** Tappy's time per block (solo), ms */
  botBlockMs: number;
};

export const DIG_DIFFICULTIES: DigDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    minLen: 2,
    maxLen: 5,
    botBlockMs: 3400,
  },
  { label: "Medium", minLen: 3, maxLen: 6, botBlockMs: 2600 },
  { label: "Hard", hint: "long words", minLen: 4, maxLen: 8, botBlockMs: 2000 },
];

/** Blocks to the treasure. */
export const DIG_DEPTH = 20;
/** Match length. */
export const DIG_TIME_MS = 150_000;

export type DigBlock = {
  word: string;
  gem: boolean;
  /** rock: a longer word */
  rock: boolean;
};

/** Small seeded RNG so every player gets the same shaft. */
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

/**
 * The shaft, top to bottom. Words get longer with depth; every 5th block is a
 * rock (2 letters longer); about 1 in 4 other blocks has a gem.
 */
export function buildShaft(
  pool: string[],
  seed: number,
  d: DigDifficulty,
): DigBlock[] {
  const clean = [
    ...new Set(pool.filter((w) => w.length > 0 && !w.includes(" "))),
  ];
  const rng = seededRng(seed);
  const blocks: DigBlock[] = [];
  for (let i = 0; i < DIG_DEPTH; i++) {
    const rock = i % 5 === 4;
    const base =
      d.minLen + Math.floor(((d.maxLen - d.minLen) * i) / (DIG_DEPTH - 1));
    const len = Math.min(d.maxLen + 1, base + (rock ? 2 : 0));
    let band = clean.filter((w) => w.length === len);
    if (band.length === 0) {
      band = clean.filter((w) => Math.abs(w.length - len) <= 1);
    }
    if (band.length === 0) band = clean;
    const word =
      band.length === 0
        ? "dig"
        : (band[Math.floor(rng() * band.length)] ?? "dig");
    const gem = !rock && rng() < 0.28;
    blocks.push({ word, gem, rock });
  }
  return blocks;
}

/** Gems found in the first `depth` blocks. */
export function gemsAt(shaft: DigBlock[], depth: number): number {
  return shaft.slice(0, depth).filter((b) => b.gem).length;
}

export type Digger = {
  id: string;
  depth: number;
  gems: number;
  /** ms from the start when they reached the treasure */
  finishedMs?: number;
};

/** Finished first, then deepest, then most gems. */
export function rankDiggers<T extends Digger>(diggers: T[]): T[] {
  return [...diggers].sort((a, b) => {
    const af = a.finishedMs ?? Infinity;
    const bf = b.finishedMs ?? Infinity;
    if (af !== bf) return af - bf;
    if (a.depth !== b.depth) return b.depth - a.depth;
    return b.gems - a.gems;
  });
}

/** 5 per block, 10 per gem, +30 for first place. */
export function digScore(depth: number, gems: number, won: boolean): number {
  return depth * 5 + gems * 10 + (won ? 30 : 0);
}

export function digStars(depth: number, won: boolean): number {
  if (won) return 3;
  if (depth >= DIG_DEPTH / 2) return 2;
  if (depth > 0) return 1;
  return 0;
}

/** Tappy's time to dig one block: base ± 25%, rocks take 40% longer. */
export function botBlockDelay(
  d: DigDifficulty,
  block: DigBlock,
  rng: () => number,
): number {
  const jitter = 0.75 + rng() * 0.5;
  return Math.round(d.botBlockMs * jitter * (block.rock ? 1.4 : 1));
}

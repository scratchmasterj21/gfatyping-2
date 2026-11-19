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

export type BlockKind = "dirt" | "stone" | "ice" | "lava" | "treasure";

export type DigBlock = {
  word: string;
  gem: boolean;
  /** stone: a longer word */
  rock: boolean;
  /** dirt, stone, ice (type twice), lava (be quick!), treasure (2 gems) */
  kind?: BlockKind;
  /** which gem, for the collection */
  gemId?: GemId;
};

export const BLOCK_INFO: Record<BlockKind, { name: string; tip: string }> = {
  dirt: { name: "Dirt", tip: "" },
  stone: { name: "Stone", tip: "a longer word" },
  ice: { name: "Ice", tip: "type the word twice to break it" },
  lava: { name: "Lava", tip: "type it fast or get pushed back up!" },
  treasure: { name: "Treasure", tip: "two gems inside!" },
};

// ---------------------------------------------------------------- worlds

export type WorldId = "garden" | "crystal" | "lava" | "dino";
export type GemId =
  | "ruby"
  | "emerald"
  | "amethyst"
  | "diamond"
  | "fireopal"
  | "obsidian"
  | "fossil"
  | "amber";

export const GEMS: Record<
  GemId,
  { name: string; emoji: string; world: WorldId }
> = {
  ruby: { name: "Ruby", emoji: "🔴", world: "garden" },
  emerald: { name: "Emerald", emoji: "🟢", world: "garden" },
  amethyst: { name: "Amethyst", emoji: "🟣", world: "crystal" },
  diamond: { name: "Diamond", emoji: "💎", world: "crystal" },
  fireopal: { name: "Fire opal", emoji: "🔥", world: "lava" },
  obsidian: { name: "Obsidian", emoji: "⚫", world: "lava" },
  fossil: { name: "Fossil", emoji: "🦴", world: "dino" },
  amber: { name: "Amber", emoji: "🟠", world: "dino" },
};
export const GEM_IDS = Object.keys(GEMS) as GemId[];

export type World = {
  id: WorldId;
  name: string;
  emoji: string;
  /** common gem, rare gem */
  gems: [GemId, GemId];
  /** chance a block (not stone) is ice / lava */
  ice: number;
  lava: number;
};

export const WORLDS: World[] = [
  {
    id: "garden",
    name: "Garden Dig",
    emoji: "🌻",
    gems: ["ruby", "emerald"],
    ice: 0,
    lava: 0,
  },
  {
    id: "crystal",
    name: "Crystal Cave",
    emoji: "💠",
    gems: ["amethyst", "diamond"],
    ice: 0.18,
    lava: 0,
  },
  {
    id: "lava",
    name: "Lava Cave",
    emoji: "🌋",
    gems: ["fireopal", "obsidian"],
    ice: 0,
    lava: 0.15,
  },
  {
    id: "dino",
    name: "Dino Bones",
    emoji: "🦖",
    gems: ["fossil", "amber"],
    ice: 0.08,
    lava: 0.08,
  },
];
export const worldById = (id: WorldId): World =>
  WORLDS.find((w) => w.id === id) ?? (WORLDS[0] as World);

/** Time to dig a lava block before it pushes you back up. */
export const lavaMs = (word: string): number => 3000 + word.length * 500;

// ---------------------------------------------------------------- tools

export type ToolId = "dynamite" | "drill" | "lantern";
export const TOOLS: Record<
  ToolId,
  { emoji: string; name: string; tip: string }
> = {
  dynamite: { emoji: "🧨", name: "Dynamite", tip: "blasts 2 blocks at once" },
  drill: {
    emoji: "🔩",
    name: "Drill boost",
    tip: "the next 3 words are short",
  },
  lantern: { emoji: "🔦", name: "Lantern", tip: "shows the gems ahead" },
};
export const TOOL_IDS = Object.keys(TOOLS) as ToolId[];
/** Clean blocks (no mistakes) to earn a tool. */
export const TOOL_CHARGE = 4;
/** Drill boost: this many blocks, shortened to this many letters. */
export const DRILL_BLOCKS = 3;
export const DRILL_LETTERS = 2;
/** Without a lantern, gems show only this many blocks ahead. */
export const GEM_SIGHT = 1;

/** The word to type for this block (shorter while drilling). */
export const wordToType = (block: DigBlock, drilling: boolean): string =>
  drilling && block.word.length > DRILL_LETTERS
    ? block.word.slice(0, DRILL_LETTERS)
    : block.word;

/** Gems in a block: treasure holds two. */
export const gemCount = (block: DigBlock | undefined): number =>
  block === undefined ? 0 : block.kind === "treasure" ? 2 : block.gem ? 1 : 0;

/** Explore: no rival, lots of time. */
export const EXPLORE_TIME_MS = 300_000;

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
  worldId: WorldId = "garden",
): DigBlock[] {
  const world = worldById(worldId);
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
    // world blocks use their own rolls, so the classic shaft stays the same
    const roll = seededRng(seed ^ Math.imul(i + 1, 0x9e3779b1))();
    const kind: BlockKind = rock
      ? "stone"
      : i > 1 && i % 7 === 3
        ? "treasure"
        : roll < world.ice
          ? "ice"
          : roll < world.ice + world.lava && i > 0
            ? "lava"
            : "dirt";
    const gemId: GemId = roll > 0.75 ? world.gems[1] : world.gems[0];
    blocks.push({
      word,
      gem: gem || kind === "treasure",
      rock,
      kind,
      ...(gem || kind === "treasure" ? { gemId } : {}),
    });
  }
  return blocks;
}

/** Gems found in the first `depth` blocks. */
export function gemsAt(shaft: DigBlock[], depth: number): number {
  return shaft.slice(0, depth).reduce((n, b) => n + gemCount(b), 0);
}

/** Gems by kind found in the first `depth` blocks (for the collection). */
export function gemsByKind(
  shaft: DigBlock[],
  depth: number,
): Partial<Record<GemId, number>> {
  const out: Partial<Record<GemId, number>> = {};
  for (const b of shaft.slice(0, depth)) {
    if (b.gemId === undefined) continue;
    out[b.gemId] = (out[b.gemId] ?? 0) + gemCount(b);
  }
  return out;
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
  const slow = block.rock
    ? 1.4
    : block.kind === "ice"
      ? 1.8
      : block.kind === "treasure"
        ? 1.1
        : 1;
  return Math.round(d.botBlockMs * jitter * slow);
}

// ---------------------------------------------------------------- daily dig

/** Daily Dig: the same shaft (world, words, seed) for everyone today. */
export function dailyDigPlan(day: number): {
  world: WorldId;
  seed: number;
  listId: string;
} {
  const lists = [
    "home-words",
    "top-words",
    "all-keys-1",
    "bottom-words",
    "all-keys-2",
    "all-keys-3",
  ];
  return {
    world: WORLDS[day % WORLDS.length]?.id ?? "garden",
    seed: day * 3001 + 7,
    listId: lists[day % lists.length] ?? "home-words",
  };
}

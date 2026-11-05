import { HouseItem } from "./house-items";

/**
 * Outdoor decorations. The flower is free and already placed.
 * Ids are prefixed so they never collide with room furniture.
 */
export const GARDEN_ITEMS: HouseItem[] = [
  {
    id: "garden-flower",
    name: "Flower",
    price: 0,
    emoji: "🌸",
    sizePx: 72,
    slot: { xPct: 24, yPct: 72 },
  },
  {
    id: "garden-bush",
    name: "Bush",
    price: 20,
    emoji: "🌿",
    sizePx: 72,
    slot: { xPct: 12, yPct: 62 },
  },
  {
    id: "garden-fence",
    name: "Fence",
    price: 25,
    emoji: "🪵",
    sizePx: 80,
    slot: { xPct: 50, yPct: 48 },
  },
  {
    id: "garden-butterfly",
    name: "Butterfly",
    price: 25,
    emoji: "🦋",
    sizePx: 52,
    slot: { xPct: 32, yPct: 24 },
  },
  {
    id: "garden-bench",
    name: "Bench",
    price: 30,
    emoji: "🪑",
    sizePx: 80,
    slot: { xPct: 64, yPct: 64 },
  },
  {
    id: "garden-carrots",
    name: "Carrots",
    price: 30,
    emoji: "🥕",
    sizePx: 60,
    slot: { xPct: 40, yPct: 70 },
  },
  {
    id: "garden-bird",
    name: "Bird",
    price: 35,
    emoji: "🐦",
    sizePx: 56,
    slot: { xPct: 72, yPct: 22 },
  },
  {
    id: "garden-tree",
    name: "Tree",
    price: 40,
    emoji: "🌳",
    sizePx: 140,
    slot: { xPct: 84, yPct: 52 },
  },
  {
    id: "garden-pond",
    name: "Pond",
    price: 50,
    emoji: "🪷",
    sizePx: 100,
    slot: { xPct: 46, yPct: 82 },
  },
];

/** Garden items that grow (and droop) with practice - see practice-state.ts. */
const GROWING_GARDEN_IDS = new Set([
  "garden-flower",
  "garden-bush",
  "garden-carrots",
  "garden-tree",
  "garden-pond",
]);

export function isGrowingPlant(id: string): boolean {
  return GROWING_GARDEN_IDS.has(id);
}

/** What a growing plant looks like at a growth stage (0 seedling - 3 bloom). */
export function plantLook(
  item: { id: string; emoji: string },
  stage: 0 | 1 | 2 | 3,
): { emoji: string; sizeFactor: number } {
  if (!GROWING_GARDEN_IDS.has(item.id)) {
    return { emoji: item.emoji, sizeFactor: 1 };
  }
  if (stage === 0) return { emoji: "🌱", sizeFactor: 0.45 };
  if (stage === 1) return { emoji: "🌱", sizeFactor: 0.7 };
  if (stage === 2) return { emoji: item.emoji, sizeFactor: 0.75 };
  return { emoji: item.emoji, sizeFactor: 1 };
}

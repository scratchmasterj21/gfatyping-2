export type HouseItem = {
  id: string;
  name: string;
  price: number;
  emoji: string;
  /** Font size in px when placed in the room - varies per item so a couch reads bigger than a plant. */
  sizePx: number;
  /** Fixed position within the room, percentage of room width/height. */
  slot: { xPct: number; yPct: number };
};

// Emoji "stickers" on fixed spots, not illustrated art - matches the scope
// of a first version, and reads much friendlier than a flat icon-in-a-box.
// Positions are laid out around the room's edges so the roaming avatar
// (which moves through the middle) doesn't overlap them.
export const HOUSE_ITEMS: HouseItem[] = [
  {
    id: "rug",
    name: "Rug",
    price: 20,
    emoji: "🟧",
    sizePx: 90,
    slot: { xPct: 50, yPct: 85 },
  },
  {
    id: "couch",
    name: "Couch",
    price: 40,
    emoji: "🛋️",
    sizePx: 110,
    slot: { xPct: 15, yPct: 70 },
  },
  {
    id: "bed",
    name: "Bed",
    price: 45,
    emoji: "🛏️",
    sizePx: 120,
    slot: { xPct: 85, yPct: 25 },
  },
  {
    id: "chair",
    name: "Chair",
    price: 25,
    emoji: "🪑",
    sizePx: 70,
    slot: { xPct: 85, yPct: 70 },
  },
  {
    id: "plant",
    name: "Plant",
    price: 20,
    emoji: "🪴",
    sizePx: 60,
    slot: { xPct: 10, yPct: 20 },
  },
  {
    id: "tree",
    name: "Potted tree",
    price: 35,
    emoji: "🌳",
    sizePx: 130,
    slot: { xPct: 92, yPct: 45 },
  },
  {
    id: "toybox",
    name: "Toy box",
    price: 30,
    emoji: "🧸",
    sizePx: 65,
    slot: { xPct: 20, yPct: 45 },
  },
  {
    id: "bookshelf",
    name: "Bookshelf",
    price: 40,
    emoji: "📚",
    sizePx: 100,
    slot: { xPct: 50, yPct: 12 },
  },
  {
    id: "window",
    name: "Window",
    price: 30,
    emoji: "🪟",
    sizePx: 90,
    slot: { xPct: 15, yPct: 12 },
  },
  {
    id: "clock",
    name: "Clock",
    price: 25,
    emoji: "🕐",
    sizePx: 50,
    slot: { xPct: 35, yPct: 10 },
  },
  {
    id: "frame",
    name: "Picture frame",
    price: 25,
    emoji: "🖼️",
    sizePx: 55,
    slot: { xPct: 65, yPct: 10 },
  },
  {
    id: "lights",
    name: "String lights",
    price: 30,
    emoji: "✨",
    sizePx: 70,
    slot: { xPct: 80, yPct: 8 },
  },
  {
    id: "blue-rug",
    name: "Blue rug",
    price: 20,
    emoji: "🟦",
    sizePx: 90,
    slot: { xPct: 78, yPct: 88 },
  },
  {
    id: "cat",
    name: "Cat",
    price: 40,
    emoji: "🐱",
    sizePx: 55,
    slot: { xPct: 45, yPct: 55 },
  },
  {
    id: "guitar",
    name: "Guitar",
    price: 35,
    emoji: "🎸",
    sizePx: 65,
    slot: { xPct: 5, yPct: 55 },
  },
  {
    id: "fishtank",
    name: "Fish tank",
    price: 35,
    emoji: "🐠",
    sizePx: 65,
    slot: { xPct: 60, yPct: 90 },
  },
  {
    id: "gaming-setup",
    name: "Gaming setup",
    price: 90,
    emoji: "🖥️",
    sizePx: 100,
    slot: { xPct: 35, yPct: 65 },
  },
  {
    id: "trophy-shelf",
    name: "Trophy shelf",
    price: 110,
    emoji: "🏆",
    sizePx: 95,
    slot: { xPct: 65, yPct: 60 },
  },
];

export function findHouseItem(id: string): HouseItem | undefined {
  return HOUSE_ITEMS.find((i) => i.id === id);
}

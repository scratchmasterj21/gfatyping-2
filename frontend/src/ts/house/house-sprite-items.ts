import { HouseSpriteItem } from "./house-items";

function buildImageMap(files: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const match = /([^/]+\.png)$/.exec(path);
    if (match?.[1] !== undefined) map[match[1]] = url;
  }
  return map;
}

const images = buildImageMap(
  import.meta.glob("../../assets/furnitures/sprites/*.png", {
    eager: true,
    import: "default",
  }),
);

// Extracted from a "Top Down House" furniture spritesheet by segmenting
// connected non-transparent regions (not a fixed grid - pieces vary in
// size). A few ids ending in "set" are multiple pieces that were fused
// together in the source art (e.g. a whole kitchen counter run) and kept as
// one placeable item rather than being cut apart.
export const HOUSE_SPRITE_ITEMS: HouseSpriteItem[] = [
  {
    id: "armchair-olive",
    name: "Armchair Olive",
    price: 60,
    image: images["armchair-olive.png"] ?? "",
    sizePx: 57,
    slot: { xPct: 11.6, yPct: 21.4 },
  },
  {
    id: "armchair-single",
    name: "Armchair Single",
    price: 60,
    image: images["armchair-single.png"] ?? "",
    sizePx: 53,
    slot: { xPct: 22.9, yPct: 21.4 },
  },
  {
    id: "bar-cabinet",
    name: "Bar Cabinet",
    price: 60,
    image: images["bar-cabinet.png"] ?? "",
    sizePx: 74,
    slot: { xPct: 45.4, yPct: 21.4 },
  },
  {
    id: "bathtub",
    name: "Bathtub",
    price: 60,
    image: images["bathtub.png"] ?? "",
    sizePx: 101,
    slot: { xPct: 67.9, yPct: 21.4 },
  },
  {
    id: "single-bed",
    name: "Card Table",
    price: 60,
    image: images["bed.png"] ?? "",
    sizePx: 74,
    slot: { xPct: 79.1, yPct: 21.4 },
  },
  {
    id: "bookshelf-drawers",
    name: "Bookshelf Drawers",
    price: 85,
    image: images["bookshelf-drawers.png"] ?? "",
    sizePx: 110,
    slot: { xPct: 90.4, yPct: 21.4 },
  },
  {
    id: "bookshelf-full",
    name: "Bookshelf Full",
    price: 85,
    image: images["bookshelf-full.png"] ?? "",
    sizePx: 110,
    slot: { xPct: 11.6, yPct: 34.2 },
  },
  {
    id: "cabinet-medium",
    name: "Cabinet Medium",
    price: 60,
    image: images["cabinet-medium.png"] ?? "",
    sizePx: 62,
    slot: { xPct: 22.9, yPct: 34.2 },
  },
  {
    id: "cabinet-tall-plain",
    name: "Cabinet Tall Plain",
    price: 45,
    image: images["cabinet-tall-plain.png"] ?? "",
    sizePx: 41,
    slot: { xPct: 34.1, yPct: 34.2 },
  },
  {
    id: "chair-1",
    name: "Chair 1",
    price: 45,
    image: images["chair-1.png"] ?? "",
    sizePx: 39,
    slot: { xPct: 45.4, yPct: 34.2 },
  },
  {
    id: "chair-2",
    name: "Chair 2",
    price: 30,
    image: images["chair-2.png"] ?? "",
    sizePx: 37,
    slot: { xPct: 56.6, yPct: 34.2 },
  },
  {
    id: "coat-hooks",
    name: "Coat Hooks",
    price: 45,
    image: images["coat-hooks.png"] ?? "",
    sizePx: 60,
    slot: { xPct: 90.4, yPct: 34.2 },
  },
  {
    id: "coat-rack",
    name: "Coat Rack",
    price: 45,
    image: images["coat-rack.png"] ?? "",
    sizePx: 28,
    slot: { xPct: 11.6, yPct: 47.1 },
  },
  {
    id: "dresser",
    name: "Dresser",
    price: 60,
    image: images["dresser.png"] ?? "",
    sizePx: 51,
    slot: { xPct: 22.9, yPct: 47.1 },
  },
  {
    id: "floor-lamp",
    name: "Floor Lamp",
    price: 45,
    image: images["floor-lamp.png"] ?? "",
    sizePx: 39,
    slot: { xPct: 34.1, yPct: 47.1 },
  },
  {
    id: "fridge",
    name: "Fridge",
    price: 60,
    image: images["fridge.png"] ?? "",
    sizePx: 67,
    slot: { xPct: 45.4, yPct: 47.1 },
  },
  {
    id: "ironing-board",
    name: "Ironing Board",
    price: 45,
    image: images["ironing-board.png"] ?? "",
    sizePx: 62,
    slot: { xPct: 56.6, yPct: 47.1 },
  },
  {
    id: "nightstand",
    name: "Nightstand",
    price: 45,
    image: images["nightstand.png"] ?? "",
    sizePx: 51,
    slot: { xPct: 79.1, yPct: 47.1 },
  },
  {
    id: "pedestal-sink",
    name: "Pedestal Sink",
    price: 45,
    image: images["pedestal-sink.png"] ?? "",
    sizePx: 48,
    slot: { xPct: 90.4, yPct: 47.1 },
  },
  {
    id: "potted-flower",
    name: "Potted Flower",
    price: 30,
    image: images["potted-flower.png"] ?? "",
    sizePx: 28,
    slot: { xPct: 11.6, yPct: 59.9 },
  },
  {
    id: "round-table",
    name: "Round Table",
    price: 45,
    image: images["round-table.png"] ?? "",
    sizePx: 39,
    slot: { xPct: 22.9, yPct: 59.9 },
  },
  {
    id: "rug-oval-dark",
    name: "Rug Oval Dark",
    price: 45,
    image: images["rug-oval-dark.png"] ?? "",
    sizePx: 67,
    slot: { xPct: 34.1, yPct: 59.9 },
  },
  {
    id: "rug-oval-small",
    name: "Rug Oval Small",
    price: 30,
    image: images["rug-oval-small.png"] ?? "",
    sizePx: 55,
    slot: { xPct: 56.6, yPct: 59.9 },
  },
  {
    id: "rug-striped",
    name: "Rug Striped",
    price: 45,
    image: images["rug-striped.png"] ?? "",
    sizePx: 37,
    slot: { xPct: 67.9, yPct: 59.9 },
  },
  {
    id: "side-table-small",
    name: "Side Table Small",
    price: 45,
    image: images["side-table-small.png"] ?? "",
    sizePx: 60,
    slot: { xPct: 79.1, yPct: 59.9 },
  },
  {
    id: "small-drawer-table",
    name: "Small Drawer Table",
    price: 45,
    image: images["small-drawer-table.png"] ?? "",
    sizePx: 39,
    slot: { xPct: 90.4, yPct: 59.9 },
  },
  {
    id: "sofa-plain",
    name: "Wooden Table",
    price: 60,
    image: images["sofa-plain.png"] ?? "",
    sizePx: 113,
    slot: { xPct: 11.6, yPct: 72.8 },
  },
  {
    id: "standing-mirror",
    name: "Standing Mirror",
    price: 60,
    image: images["standing-mirror.png"] ?? "",
    sizePx: 60,
    slot: { xPct: 34.1, yPct: 72.8 },
  },
  {
    id: "table-lamp",
    name: "Table Lamp",
    price: 30,
    image: images["table-lamp.png"] ?? "",
    sizePx: 34,
    slot: { xPct: 45.4, yPct: 72.8 },
  },
  {
    id: "vanity-mirror",
    name: "Record Player",
    price: 45,
    image: images["vanity-mirror.png"] ?? "",
    sizePx: 74,
    slot: { xPct: 67.9, yPct: 72.8 },
  },
  {
    id: "wardrobe-dark",
    name: "Wardrobe Dark",
    price: 45,
    image: images["wardrobe-dark.png"] ?? "",
    sizePx: 39,
    slot: { xPct: 79.1, yPct: 72.8 },
  },
  {
    id: "wardrobe-double",
    name: "Wardrobe Double",
    price: 60,
    image: images["wardrobe-double.png"] ?? "",
    sizePx: 78,
    slot: { xPct: 90.4, yPct: 72.8 },
  },
  {
    id: "wardrobe-mirror",
    name: "Wooden Chair",
    price: 45,
    image: images["wardrobe-mirror.png"] ?? "",
    sizePx: 37,
    slot: { xPct: 11.6, yPct: 85.6 },
  },
  {
    id: "wood-stove",
    name: "Wood Stove",
    price: 60,
    image: images["wood-stove.png"] ?? "",
    sizePx: 60,
    slot: { xPct: 22.9, yPct: 85.6 },
  },
];

export function findHouseSpriteItem(id: string): HouseSpriteItem | undefined {
  return HOUSE_SPRITE_ITEMS.find((i) => i.id === id);
}

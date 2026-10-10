export type BackdropItemId =
  | "none"
  | "ocean"
  | "wood"
  | "space"
  | "jungle"
  | "candy"
  | "sunny"
  | "rainbow";

export type BackdropItem = {
  id: BackdropItemId;
  name: string;
  description: string;
  /** Coin price. Omitted for the free default. */
  price?: number;
};

export const BACKDROP_ITEMS: BackdropItem[] = [
  {
    id: "none",
    name: "None",
    description: "No backdrop behind the keyboard.",
  },
  {
    id: "ocean",
    name: "Ocean Desk",
    description: "A cool blue gradient backdrop.",
    price: 30,
  },
  {
    id: "wood",
    name: "Wood Desk",
    description: "A warm wooden desk backdrop.",
    price: 30,
  },
  {
    id: "space",
    name: "Space",
    description: "A starry night sky backdrop.",
    price: 50,
  },
  {
    id: "jungle",
    name: "Jungle",
    description: "Leafy greens from deep in the jungle.",
    price: 30,
  },
  {
    id: "candy",
    name: "Candy Land",
    description: "Sweet pink and purple swirls.",
    price: 30,
  },
  {
    id: "sunny",
    name: "Sunny Day",
    description: "A bright sky with warm sunshine.",
    price: 30,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    description: "Every color of the rainbow.",
    price: 50,
  },
];

/** CSS background for each backdrop (keyboard area and shop preview). */
export const BACKDROP_BACKGROUNDS: Record<BackdropItemId, string> = {
  none: "transparent",
  ocean: "linear-gradient(135deg, #0f2942, #1c6ea4, #4fc0d0)",
  wood: "linear-gradient(135deg, #3b2415, #6b4423, #8b5a2b)",
  space: "linear-gradient(135deg, #05010d, #1a0b2e, #3d1a5e)",
  jungle: "linear-gradient(135deg, #0b3d1f, #1f7a3a, #7cc35a)",
  candy: "linear-gradient(135deg, #f78fb3, #c56cf0, #7ed6df)",
  sunny: "linear-gradient(180deg, #74b9ff, #a0d8ff 55%, #ffe08a)",
  rainbow:
    "linear-gradient(135deg, #ff6b6b, #ffa94d, #ffd43b, #69db7c, #4dabf7, #9775fa)",
};

export function isBackdropItemId(id: string): id is BackdropItemId {
  return BACKDROP_ITEMS.some((b) => b.id === id);
}

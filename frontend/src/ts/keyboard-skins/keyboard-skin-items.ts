export type KeyboardSkinItemId =
  | "wood"
  | "glass"
  | "candy"
  | "jungle"
  | "neon"
  | "space"
  | "pumpkin";

export type KeyboardSkinItem = {
  id: KeyboardSkinItemId;
  name: string;
  description: string;
  price: number;
  /** Months (1-12, Japan time) it's sold in; always kept once owned. */
  seasonMonths?: number[];
};

export const KEYBOARD_SKIN_ITEMS: KeyboardSkinItem[] = [
  {
    id: "wood",
    name: "Wood Grain",
    description: "A warm walnut-finish keyboard.",
    price: 50,
  },
  {
    id: "glass",
    name: "Glass",
    description: "A frosted, translucent keyboard.",
    price: 60,
  },
  {
    id: "candy",
    name: "Candy",
    description: "Sweet pink and mint keys.",
    price: 60,
  },
  {
    id: "jungle",
    name: "Jungle",
    description: "Leafy green keys with a vine-dark board.",
    price: 60,
  },
  {
    id: "neon",
    name: "Neon",
    description: "Bright glowing keys on a midnight board.",
    price: 80,
  },
  {
    id: "space",
    name: "Space",
    description: "Deep purple keys from outer space.",
    price: 80,
  },
  {
    id: "pumpkin",
    name: "Pumpkin",
    description: "Spooky orange keys. October only!",
    price: 60,
    seasonMonths: [10],
  },
];

export function isKeyboardSkinItemId(id: string): id is KeyboardSkinItemId {
  return KEYBOARD_SKIN_ITEMS.some((s) => s.id === id);
}

export type KeyboardSkinItemId = "wood" | "glass";

export type KeyboardSkinItem = {
  id: KeyboardSkinItemId;
  name: string;
  description: string;
  price: number;
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
];

export function isKeyboardSkinItemId(id: string): id is KeyboardSkinItemId {
  return KEYBOARD_SKIN_ITEMS.some((s) => s.id === id);
}

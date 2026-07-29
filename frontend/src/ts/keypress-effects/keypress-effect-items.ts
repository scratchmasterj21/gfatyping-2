export type KeypressEffectItemId = "none" | "spark" | "ripple" | "confetti";

export type KeypressEffectItem = {
  id: KeypressEffectItemId;
  name: string;
  description: string;
  /** Coin price. Omitted for the free default. */
  price?: number;
};

export const KEYPRESS_EFFECT_ITEMS: KeypressEffectItem[] = [
  {
    id: "none",
    name: "None",
    description: "No extra flourish on the next key.",
  },
  {
    id: "spark",
    name: "Spark",
    description: "A quick burst of light on the next key.",
    price: 30,
  },
  {
    id: "ripple",
    name: "Ripple",
    description: "A soft ring expands outward from the next key.",
    price: 30,
  },
  {
    id: "confetti",
    name: "Confetti",
    description: "Tiny confetti pieces scatter from the next key.",
    price: 50,
  },
];

export function isKeypressEffectItemId(id: string): id is KeypressEffectItemId {
  return KEYPRESS_EFFECT_ITEMS.some((e) => e.id === id);
}

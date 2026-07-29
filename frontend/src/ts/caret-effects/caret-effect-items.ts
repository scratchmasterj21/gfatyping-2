export type CaretEffectItemId = "none" | "glow" | "comet" | "sparkle";

export type CaretEffectItem = {
  id: CaretEffectItemId;
  name: string;
  description: string;
  /** Coin price. Omitted for the free default. */
  price?: number;
};

export const CARET_EFFECT_ITEMS: CaretEffectItem[] = [
  {
    id: "none",
    name: "None",
    description: "No extra effect on your caret.",
  },
  {
    id: "glow",
    name: "Glow",
    description: "A soft, steady glow around your caret.",
    price: 30,
  },
  {
    id: "comet",
    name: "Comet",
    description: "A trailing tail follows your caret as it moves.",
    price: 40,
  },
  {
    id: "sparkle",
    name: "Sparkle",
    description: "A twinkling shimmer around your caret.",
    price: 40,
  },
];

export function isCaretEffectItemId(id: string): id is CaretEffectItemId {
  return CARET_EFFECT_ITEMS.some((e) => e.id === id);
}

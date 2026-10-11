export type CaretEffectItemId =
  | "none"
  | "glow"
  | "comet"
  | "sparkle"
  | "rainbow"
  | "heartbeat"
  | "fire"
  | "sakura";

export type CaretEffectItem = {
  id: CaretEffectItemId;
  name: string;
  description: string;
  /** Coin price. Omitted for the free default. */
  price?: number;
  /** Months (1-12, Japan time) it's sold in; always kept once owned. */
  seasonMonths?: number[];
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
  {
    id: "rainbow",
    name: "Rainbow",
    description: "A glow that cycles through every color.",
    price: 50,
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    description: "Your caret's glow beats like a heart.",
    price: 40,
  },
  {
    id: "fire",
    name: "Fire",
    description: "A flickering orange flame on your caret.",
    price: 50,
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Pink petals drift off your caret. Spring only!",
    price: 40,
    seasonMonths: [3, 4],
  },
];

export function isCaretEffectItemId(id: string): id is CaretEffectItemId {
  return CARET_EFFECT_ITEMS.some((e) => e.id === id);
}

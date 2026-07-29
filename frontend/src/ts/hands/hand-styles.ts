// "robot"/"kingfish"/"dark" reuse theme classes already baked into
// assets/hands.svg (`.theme-X .st1/.st2/.st5` color overrides) - just need
// the class name applied to an ancestor of the hand paths. "warmtone" and
// "golden" don't exist in the SVG, so AnimatedHands.tsx injects matching
// `.theme-warmtone`/`.theme-golden` rules itself, following the same pattern.
export type HandStyleId =
  | "classic"
  | "robot"
  | "kingfish"
  | "dark"
  | "warmtone"
  | "golden";

export type HandStyle = {
  id: HandStyleId;
  name: string;
  description: string;
  /** Coin price. Omitted for the free default. */
  price?: number;
};

export const HAND_STYLES: HandStyle[] = [
  {
    id: "classic",
    name: "Classic",
    description: "The default hand guide.",
  },
  {
    id: "robot",
    name: "Bionic",
    description: "Steel-grey plating with a violet accent line.",
    price: 50,
  },
  {
    id: "kingfish",
    name: "Cobalt",
    description: "Cool grey tones with a bright blue accent line.",
    price: 50,
  },
  {
    id: "dark",
    name: "Shadow",
    description: "Charcoal tones with a deep violet accent line.",
    price: 40,
  },
  {
    id: "warmtone",
    name: "Warmtone",
    description: "Warm, realistic skin-tone shading.",
    price: 40,
  },
  {
    id: "golden",
    name: "Golden",
    description: "Gold-plated hands with a soft shimmer.",
    price: 120,
  },
];

export function findHandStyle(id: string): HandStyle | undefined {
  return HAND_STYLES.find((s) => s.id === id);
}

export function isHandStyleId(id: string): id is HandStyleId {
  return HAND_STYLES.some((s) => s.id === id);
}

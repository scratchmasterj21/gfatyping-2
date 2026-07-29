export type BackdropItemId = "none" | "ocean" | "wood" | "space";

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
];

export function isBackdropItemId(id: string): id is BackdropItemId {
  return BACKDROP_ITEMS.some((b) => b.id === id);
}

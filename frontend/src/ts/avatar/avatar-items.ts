export type AvatarCategory =
  | "color"
  | "hair"
  | "hat"
  | "accessory"
  | "face"
  | "background"
  | "highlight";

/** Base head silhouette - free to pick, not part of the shop/coin system. */
export type AvatarShape = "round" | "square" | "oval" | "hexagon" | "cloud";

export type AvatarItem = {
  id: string;
  category: AvatarCategory;
  name: string;
  /** Coin price. Omitted for achievement-gated items (see requiresAchievement). */
  price?: number;
  /** hex color for "color"/"highlight" items - unused for other categories, which Avatar.tsx renders by id */
  value?: string;
  /** Achievement id (from achievements-data.ts) required to claim this item instead of buying it. */
  requiresAchievement?: string;
  /** 1-12 (JS getMonth()+1); item only shows in the shop during these months. Owned items stay wearable year-round. */
  seasonMonths?: number[];
  /** For "hat"/"hair" items only - which base shape this was drawn to fit. Omitted means "round" (every pre-existing hat/hair item). Hats/hair are shape-specific: a square-face item is a separate unlock from its round counterpart. */
  shape?: AvatarShape;
};

export const AVATAR_ITEMS: AvatarItem[] = [
  { id: "red", category: "color", name: "Red", price: 20, value: "#ff6b6b" },
  { id: "blue", category: "color", name: "Blue", price: 20, value: "#4dabf7" },
  {
    id: "green",
    category: "color",
    name: "Green",
    price: 20,
    value: "#51cf66",
  },
  {
    id: "purple",
    category: "color",
    name: "Purple",
    price: 30,
    value: "#cc5de8",
  },
  {
    id: "yellow",
    category: "color",
    name: "Yellow",
    price: 30,
    value: "#ffd43b",
  },
  {
    id: "orange",
    category: "color",
    name: "Orange",
    price: 30,
    value: "#ff922b",
  },
  { id: "pink", category: "color", name: "Pink", price: 30, value: "#f783ac" },
  { id: "teal", category: "color", name: "Teal", price: 35, value: "#20c997" },
  {
    id: "dark",
    category: "color",
    name: "Midnight",
    price: 35,
    value: "#343a40",
  },
  { id: "short-hair", category: "hair", name: "Short Hair", price: 35 },
  { id: "long-hair", category: "hair", name: "Long Hair", price: 40 },
  { id: "ponytail", category: "hair", name: "Ponytail", price: 40 },
  { id: "spiky-hair", category: "hair", name: "Spiky Hair", price: 45 },
  { id: "cap", category: "hat", name: "Cap", price: 40 },
  { id: "beanie", category: "hat", name: "Beanie", price: 40 },
  { id: "party", category: "hat", name: "Party Hat", price: 50 },
  { id: "headband", category: "hat", name: "Headband", price: 30 },
  {
    id: "halo",
    category: "hat",
    name: "Halo",
    requiresAchievement: "accuracy-perfect",
  },
  {
    id: "wizard",
    category: "hat",
    name: "Wizard Hat",
    requiresAchievement: "speed-50",
  },
  {
    id: "crown",
    category: "hat",
    name: "Crown",
    requiresAchievement: "streak-30",
  },
  {
    id: "pumpkin",
    category: "hat",
    name: "Pumpkin Hat",
    price: 60,
    seasonMonths: [10],
  },
  {
    id: "santa",
    category: "hat",
    name: "Santa Hat",
    price: 60,
    seasonMonths: [12],
  },
  { id: "glasses", category: "accessory", name: "Glasses", price: 30 },
  { id: "bow", category: "accessory", name: "Bow Tie", price: 30 },
  { id: "mustache", category: "accessory", name: "Mustache", price: 40 },
  { id: "earrings", category: "accessory", name: "Earrings", price: 30 },
  { id: "necklace", category: "accessory", name: "Necklace", price: 40 },
  { id: "heart", category: "accessory", name: "Heart Badge", price: 50 },
  { id: "star", category: "accessory", name: "Star Badge", price: 60 },
  { id: "freckles", category: "accessory", name: "Freckles", price: 25 },
  { id: "headphones", category: "accessory", name: "Headphones", price: 45 },
  { id: "scarf", category: "accessory", name: "Scarf", price: 40 },
  { id: "sleepy", category: "face", name: "Sleepy", price: 25 },
  { id: "wink", category: "face", name: "Wink", price: 25 },
  { id: "surprised", category: "face", name: "Surprised", price: 25 },
  { id: "angry", category: "face", name: "Angry", price: 25 },
  { id: "laughing", category: "face", name: "Laughing", price: 30 },
  { id: "starstruck", category: "face", name: "Starstruck", price: 30 },
  { id: "dots-bg", category: "background", name: "Dotted", price: 35 },
  { id: "stars-bg", category: "background", name: "Starry Night", price: 45 },
  { id: "sunburst-bg", category: "background", name: "Sunburst", price: 55 },
  { id: "grid-bg", category: "background", name: "Grid", price: 35 },
  { id: "waves-bg", category: "background", name: "Waves", price: 45 },
  { id: "rainbow-bg", category: "background", name: "Rainbow", price: 55 },
  {
    id: "hearts-bg",
    category: "background",
    name: "Heart Confetti",
    price: 45,
    seasonMonths: [2],
  },
  {
    id: "gold-highlight",
    category: "highlight",
    name: "Gold Glow",
    price: 60,
    value: "#ffd43b",
  },
  {
    id: "ice-highlight",
    category: "highlight",
    name: "Ice Glow",
    price: 60,
    value: "#4dabf7",
  },
  {
    id: "fire-highlight",
    category: "highlight",
    name: "Fire Glow",
    price: 60,
    value: "#ff6b6b",
  },
  {
    id: "royal-highlight",
    category: "highlight",
    name: "Royal Glow",
    requiresAchievement: "streak-60",
    value: "#9775fa",
  },
  {
    id: "emerald-highlight",
    category: "highlight",
    name: "Emerald Glow",
    price: 60,
    value: "#20c997",
  },
  {
    id: "rose-highlight",
    category: "highlight",
    name: "Rose Glow",
    price: 60,
    value: "#f783ac",
  },
  {
    id: "short-hair-square",
    category: "hair",
    name: "Short Hair",
    price: 35,
    shape: "square",
  },
  {
    id: "long-hair-square",
    category: "hair",
    name: "Long Hair",
    price: 40,
    shape: "square",
  },
  {
    id: "ponytail-square",
    category: "hair",
    name: "Ponytail",
    price: 40,
    shape: "square",
  },
  {
    id: "spiky-hair-square",
    category: "hair",
    name: "Spiky Hair",
    price: 45,
    shape: "square",
  },
  {
    id: "cap-square",
    category: "hat",
    name: "Cap",
    price: 40,
    shape: "square",
  },
  {
    id: "beanie-square",
    category: "hat",
    name: "Beanie",
    price: 40,
    shape: "square",
  },
  {
    id: "party-square",
    category: "hat",
    name: "Party Hat",
    price: 50,
    shape: "square",
  },
  {
    id: "headband-square",
    category: "hat",
    name: "Headband",
    price: 30,
    shape: "square",
  },
  {
    id: "short-hair-oval",
    category: "hair",
    name: "Short Hair",
    price: 35,
    shape: "oval",
  },
  {
    id: "spiky-hair-oval",
    category: "hair",
    name: "Spiky Hair",
    price: 45,
    shape: "oval",
  },
  { id: "cap-oval", category: "hat", name: "Cap", price: 40, shape: "oval" },
  {
    id: "headband-oval",
    category: "hat",
    name: "Headband",
    price: 30,
    shape: "oval",
  },
  {
    id: "short-hair-hexagon",
    category: "hair",
    name: "Short Hair",
    price: 35,
    shape: "hexagon",
  },
  {
    id: "spiky-hair-hexagon",
    category: "hair",
    name: "Spiky Hair",
    price: 45,
    shape: "hexagon",
  },
  {
    id: "cap-hexagon",
    category: "hat",
    name: "Cap",
    price: 40,
    shape: "hexagon",
  },
  {
    id: "headband-hexagon",
    category: "hat",
    name: "Headband",
    price: 30,
    shape: "hexagon",
  },
  {
    id: "short-hair-cloud",
    category: "hair",
    name: "Short Hair",
    price: 35,
    shape: "cloud",
  },
  {
    id: "spiky-hair-cloud",
    category: "hair",
    name: "Spiky Hair",
    price: 45,
    shape: "cloud",
  },
  { id: "cap-cloud", category: "hat", name: "Cap", price: 40, shape: "cloud" },
  {
    id: "headband-cloud",
    category: "hat",
    name: "Headband",
    price: 30,
    shape: "cloud",
  },
];

export function findAvatarItem(id: string): AvatarItem | undefined {
  return AVATAR_ITEMS.find((i) => i.id === id);
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  "color",
  "hair",
  "hat",
  "accessory",
  "face",
  "background",
  "highlight",
];

export const AVATAR_CATEGORY_LABELS: Record<AvatarCategory, string> = {
  color: "Colors",
  hair: "Hair",
  hat: "Hats",
  accessory: "Accessories",
  face: "Faces",
  background: "Backgrounds",
  highlight: "Highlights",
};

// Each palette is 7 hue stops (matching the original rainbow's spacing) so
// swapping palettes is a pure recolor of the RGB keyboard's gradient - same
// animation mechanism as the default rainbow, just a narrower hue band.
// Consumed by generateMechanicalKeyboardSvg (mechanical-keyboard-svg.ts) and
// AnimatedHands.tsx's buildRgbOverrideCss.
export const RGB_PALETTE_HUES = {
  rainbow: [0, 60, 120, 180, 240, 300, 360],
  ocean: [170, 185, 200, 215, 230, 245, 260],
  sunset: [330, 345, 0, 15, 30, 45, 60],
  forest: [80, 100, 120, 140, 160, 180, 200],
  royal: [255, 265, 275, 285, 295, 305, 315],
} as const;

export type RgbPaletteItemId = keyof typeof RGB_PALETTE_HUES;

export type RgbPaletteItem = {
  id: RgbPaletteItemId;
  name: string;
  description: string;
  /** Coin price. Omitted for the free default. */
  price?: number;
};

export const RGB_PALETTE_ITEMS: RgbPaletteItem[] = [
  {
    id: "rainbow",
    name: "Rainbow",
    description: "The default full-spectrum cycle.",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool cyans and blues.",
    price: 40,
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm pinks and oranges.",
    price: 40,
  },
  {
    id: "forest",
    name: "Forest",
    description: "Greens and teals.",
    price: 40,
  },
  {
    id: "royal",
    name: "Royal",
    description: "Deep purples and magenta.",
    price: 60,
  },
];

export function isRgbPaletteItemId(id: string): id is RgbPaletteItemId {
  return RGB_PALETTE_ITEMS.some((p) => p.id === id);
}

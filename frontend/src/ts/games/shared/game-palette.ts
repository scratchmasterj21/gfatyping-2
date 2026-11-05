/**
 * The fixed kid-game palette for Phaser scenes. Same values as the
 * `--color-game-*` tokens in styles/tailwind.css - keep the two in sync.
 */
export const PALETTE = {
  ink: "#2b2140",
  cream: "#fff8ec",
  sky: "#8fd8ff",
  skyTop: "#4fb3f6",
  sunset: "#ffb37a",
  dusk: "#b07ad8",
  night: "#241a52",
  cloud: "#ffffff",
  grass: "#7bdc6b",
  grassDark: "#4fb04a",
  pink: "#ff7eb6",
  yellow: "#ffd23f",
  green: "#5ed37a",
  blue: "#5aa9ff",
  purple: "#a77bff",
  orange: "#ff9a4d",
  red: "#ff5a5f",
  gold: "#ffc61a",
  brown: "#b9774a",
  brownDark: "#7d4b2c",
  tan: "#f2d2a9",
  blush: "#ffb3c7",
  grey: "#9aa3b5",
  navy: "#33406b",
  frog: "#6cc96a",
  mint: "#c8f2dc",
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Palette colour as a Phaser number (0xRRGGBB). */
export const hex = (name: PaletteName): number =>
  parseInt(PALETTE[name].slice(1), 16);

/** Mix two #rrggbb colours; t=0 gives a, t=1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(color: string): number[] {
  let h = color.trim().replace("#", "");
  if (h.length === 3 || h.length === 4) {
    h = [...h.slice(0, 3)].map((ch) => ch + ch).join("");
  }
  h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return [255, 126, 182];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

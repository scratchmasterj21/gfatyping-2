import { KeyboardSkinItemId } from "../../../keyboard-skins/keyboard-skin-items";
import {
  RGB_PALETTE_HUES,
  RgbPaletteItemId,
} from "../../../rgb-palettes/rgb-palette-items";

type KeyDef = { id: string; label: string; w: number };

// Standard QWERTY layout. All rows sum to exactly 15 units wide.
const ROWS: KeyDef[][] = [
  // Number row (15u)
  [
    { id: "tilda", label: "`", w: 1 },
    { id: "key-1", label: "1", w: 1 },
    { id: "key-2", label: "2", w: 1 },
    { id: "key-3", label: "3", w: 1 },
    { id: "key-4", label: "4", w: 1 },
    { id: "key-5", label: "5", w: 1 },
    { id: "key-6", label: "6", w: 1 },
    { id: "key-7", label: "7", w: 1 },
    { id: "key-8", label: "8", w: 1 },
    { id: "key-9", label: "9", w: 1 },
    { id: "key-0", label: "0", w: 1 },
    { id: "minus", label: "-", w: 1 },
    { id: "equal", label: "=", w: 1 },
    { id: "backspace", label: "⌫", w: 2 },
  ],
  // QWERTY row (15u)
  [
    { id: "tab", label: "Tab", w: 1.5 },
    { id: "q", label: "Q", w: 1 },
    { id: "w", label: "W", w: 1 },
    { id: "e", label: "E", w: 1 },
    { id: "r", label: "R", w: 1 },
    { id: "t", label: "T", w: 1 },
    { id: "y", label: "Y", w: 1 },
    { id: "u", label: "U", w: 1 },
    { id: "i", label: "I", w: 1 },
    { id: "o", label: "O", w: 1 },
    { id: "p", label: "P", w: 1 },
    { id: "open-bracket", label: "[", w: 1 },
    { id: "close-bracket", label: "]", w: 1 },
    { id: "backslash", label: "\\", w: 1.5 },
  ],
  // Home row (15u)
  [
    { id: "caps", label: "Cap", w: 1.75 },
    { id: "a", label: "A", w: 1 },
    { id: "s", label: "S", w: 1 },
    { id: "d", label: "D", w: 1 },
    { id: "f", label: "F", w: 1 },
    { id: "g", label: "G", w: 1 },
    { id: "h", label: "H", w: 1 },
    { id: "j", label: "J", w: 1 },
    { id: "k", label: "K", w: 1 },
    { id: "l", label: "L", w: 1 },
    { id: "semicolon", label: ";", w: 1 },
    { id: "quote", label: "'", w: 1 },
    { id: "enter", label: "↵", w: 2.25 },
  ],
  // Shift row (15u)
  [
    { id: "lshift", label: "Shift", w: 2.25 },
    { id: "z", label: "Z", w: 1 },
    { id: "x", label: "X", w: 1 },
    { id: "c", label: "C", w: 1 },
    { id: "v", label: "V", w: 1 },
    { id: "b", label: "B", w: 1 },
    { id: "n", label: "N", w: 1 },
    { id: "m", label: "M", w: 1 },
    { id: "comma", label: ",", w: 1 },
    { id: "dot", label: ".", w: 1 },
    { id: "slash", label: "/", w: 1 },
    { id: "rshift", label: "Shift", w: 2.75 },
  ],
  // Bottom row (15u)
  [
    { id: "lctrl", label: "Ctrl", w: 1.25 },
    { id: "lwin", label: "Win", w: 1.25 },
    { id: "lalt", label: "Alt", w: 1.25 },
    { id: "space", label: "", w: 6.25 },
    { id: "ralt", label: "Alt", w: 1.25 },
    { id: "rwin", label: "Win", w: 1.25 },
    { id: "rctrl", label: "Ctrl", w: 2.5 },
  ],
];

function px(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateMechanicalKeyboardSvg(
  palette: RgbPaletteItemId = "rainbow",
): string {
  const U = 42; // one key unit in px
  const GAP = 3; // gap between keys
  const PAD = 14; // board padding
  const BW = 15 * U + PAD * 2; // 658
  const BH = 5 * U + PAD * 2; // 238

  const glows: string[] = [];
  const keys: string[] = [];

  for (let ri = 0; ri < ROWS.length; ri++) {
    const row = ROWS[ri];
    if (row === undefined) continue;
    let slotX = PAD;

    for (const key of row) {
      const sw = key.w * U;

      // Key bounding box (inset half-gap from slot edges)
      const kx = slotX + 1.5;
      const ky = PAD + ri * U + 1.5;
      const kw = sw - GAP;
      const kh = U - GAP; // 39

      // Top surface (receives active highlight via .key-top)
      const tx = kx + 1;
      const ty = ky + 1;
      const tw = kw - 2;
      const th = kh - 8; // 31 — leaves 7px for side face below

      // Label position: centered on top surface
      const lx = kx + kw / 2;
      const ly = ky + 1 + th / 2;
      const isMod = key.label.length > 2;
      const fs = isMod ? (kw > 70 ? 9 : 7) : 12;

      // Per-key RGB glow rect (bottom of key slot, picked up by gradient)
      glows.push(
        `<rect x="${px(kx)}" y="${px(ky + kh - 6)}" ` +
          `width="${px(kw)}" height="8" fill="url(#rgb-g)"/>`,
      );

      // Home-row bump on F and J
      const bump =
        key.id === "f" || key.id === "j"
          ? `<rect x="${px(lx - 4)}" y="${px(ky + kh - 9)}" ` +
            `width="8" height="3" rx="1.5" fill="#555"/>`
          : "";

      const labelEl = key.label
        ? `<text x="${px(lx)}" y="${px(ly)}" font-family="monospace" font-size="${fs}" fill="#aaa" text-anchor="middle" dominant-baseline="middle">${escXml(key.label)}</text>`
        : "";

      keys.push(
        `<g id="${key.id}"><rect x="${px(kx + 1.5)}" y="${px(ky + 1.5)}" width="${px(kw)}" height="${px(kh)}" rx="3" fill="#0a0a0a" opacity="0.55"/><rect x="${px(kx)}" y="${px(ky)}" width="${px(kw)}" height="${px(kh)}" rx="3" fill="#1e1e1e"/><rect x="${px(kx)}" y="${px(ky + kh - 7)}" width="${px(kw)}" height="7" rx="2" fill="#181818"/><rect x="${px(tx)}" y="${px(ty)}" width="${px(tw)}" height="${px(th)}" rx="2" fill="#2b2b2b" class="key-top"/><rect x="${px(kx + 3)}" y="${px(ky + 2)}" width="${px(Math.max(kw - 10, 4))}" height="2" rx="1" fill="#fff" opacity="0.08"/>${bump}${labelEl}</g>`,
      );

      slotX += sw;
    }
  }

  const gradStops = RGB_PALETTE_HUES[palette]
    .map(
      (h, i) =>
        `<stop offset="${((i / 6) * 100).toFixed(1)}%" stop-color="hsl(${h},88%,57%)"/>`,
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}">`,
    `<defs>`,
    `<style>`,
    `@keyframes mech-rgb-wave{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}`,
    `.mech-rgb{animation:mech-rgb-wave 3s linear infinite}`,
    `</style>`,
    `<linearGradient id="rgb-g" x1="${PAD}" y1="0" x2="${BW - PAD}" y2="0" gradientUnits="userSpaceOnUse">`,
    gradStops,
    `</linearGradient>`,
    `</defs>`,
    // Board body — dark charcoal
    `<rect x="0" y="0" width="${BW}" height="${BH}" rx="10" fill="#111"/>`,
    `<rect x="3" y="3" width="${BW - 6}" height="${BH - 6}" rx="8" fill="#1b1b1b" stroke="#252525" stroke-width="1"/>`,
    // Underglow strip — blurred rainbow below board
    `<g class="mech-rgb-under" style="filter:blur(9px)" opacity="0.7">`,
    `<rect x="16" y="${BH - 18}" width="${BW - 32}" height="12" rx="6" fill="url(#rgb-g)" class="mech-rgb"/>`,
    `</g>`,
    // Per-key glow layer
    `<g class="mech-rgb-key-glow" style="filter:blur(3px)" opacity="0.45">`,
    `<g class="mech-rgb">`,
    ...glows,
    `</g>`,
    `</g>`,
    // Key caps
    ...keys,
    `</svg>`,
  ].join("\n");
}

type SkinColors = {
  board: string;
  boardInner: string;
  boardStroke: string;
  keyShadow: string;
  keyBody: string;
  keySide: string;
  keyTop: string;
  highlightOpacity: number;
  label: string;
};

const SKIN_COLORS: Record<KeyboardSkinItemId, SkinColors> = {
  wood: {
    board: "#3b2415",
    boardInner: "#4a2d16",
    boardStroke: "#5c3a1e",
    keyShadow: "#1a0f08",
    keyBody: "#6b4423",
    keySide: "#4a2d16",
    keyTop: "#8b5a2b",
    highlightOpacity: 0.15,
    label: "#f0dcc0",
  },
  glass: {
    board: "#0d1b2a",
    boardInner: "#132639",
    boardStroke: "#1e3a52",
    keyShadow: "#050b12",
    keyBody: "#3a5d78",
    keySide: "#274558",
    keyTop: "#7fb3d5",
    highlightOpacity: 0.35,
    label: "#eaf4fb",
  },
};

// Same 15x5-unit layout/geometry as generateMechanicalKeyboardSvg (so hand
// overlay positioning can be reused as-is) but a plain recolor - no RGB
// glow/underglow layers, just a themed keycap palette.
export function generateSkinKeyboardSvg(skin: KeyboardSkinItemId): string {
  const U = 42;
  const GAP = 3;
  const PAD = 14;
  const BW = 15 * U + PAD * 2;
  const BH = 5 * U + PAD * 2;
  const c = SKIN_COLORS[skin];

  const keys: string[] = [];

  for (let ri = 0; ri < ROWS.length; ri++) {
    const row = ROWS[ri];
    if (row === undefined) continue;
    let slotX = PAD;

    for (const key of row) {
      const sw = key.w * U;
      const kx = slotX + 1.5;
      const ky = PAD + ri * U + 1.5;
      const kw = sw - GAP;
      const kh = U - GAP;

      const tx = kx + 1;
      const ty = ky + 1;
      const tw = kw - 2;
      const th = kh - 8;

      const lx = kx + kw / 2;
      const ly = ky + 1 + th / 2;
      const isMod = key.label.length > 2;
      const fs = isMod ? (kw > 70 ? 9 : 7) : 12;

      const bump =
        key.id === "f" || key.id === "j"
          ? `<rect x="${px(lx - 4)}" y="${px(ky + kh - 9)}" ` +
            `width="8" height="3" rx="1.5" fill="${c.keySide}"/>`
          : "";

      const labelEl = key.label
        ? `<text x="${px(lx)}" y="${px(ly)}" font-family="monospace" font-size="${fs}" fill="${c.label}" text-anchor="middle" dominant-baseline="middle">${escXml(key.label)}</text>`
        : "";

      keys.push(
        `<g id="${key.id}"><rect x="${px(kx + 1.5)}" y="${px(ky + 1.5)}" width="${px(kw)}" height="${px(kh)}" rx="3" fill="${c.keyShadow}" opacity="0.55"/><rect x="${px(kx)}" y="${px(ky)}" width="${px(kw)}" height="${px(kh)}" rx="3" fill="${c.keyBody}"/><rect x="${px(kx)}" y="${px(ky + kh - 7)}" width="${px(kw)}" height="7" rx="2" fill="${c.keySide}"/><rect x="${px(tx)}" y="${px(ty)}" width="${px(tw)}" height="${px(th)}" rx="2" fill="${c.keyTop}" class="key-top"/><rect x="${px(kx + 3)}" y="${px(ky + 2)}" width="${px(Math.max(kw - 10, 4))}" height="2" rx="1" fill="#fff" opacity="${c.highlightOpacity}"/>${bump}${labelEl}</g>`,
      );

      slotX += sw;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}">`,
    `<rect x="0" y="0" width="${BW}" height="${BH}" rx="10" fill="${c.board}"/>`,
    `<rect x="3" y="3" width="${BW - 6}" height="${BH - 6}" rx="8" fill="${c.boardInner}" stroke="${c.boardStroke}" stroke-width="1"/>`,
    ...keys,
    `</svg>`,
  ].join("\n");
}

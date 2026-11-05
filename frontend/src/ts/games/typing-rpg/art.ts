import { PALETTE as P, mixHex } from "../shared/game-palette";
import type { MonsterKind } from "./wave-appearance";

/** Monster body colour per floor (Moss, Crystal, Ember, Moonlit). */
const FLOOR_TINTS: Record<MonsterKind, string[]> = {
  slime: [P.green, P.sky, P.orange, P.purple],
  imp: [P.tan, P.mint, P.yellow, P.blush],
  guardian: [P.pink, P.blue, P.red, P.navy],
};

const face = (cx: number, cy: number, cross = false): string => `
  <ellipse cx="${cx - 9}" cy="${cy}" rx="4.5" ry="6" fill="${P.ink}"/>
  <ellipse cx="${cx + 9}" cy="${cy}" rx="4.5" ry="6" fill="${P.ink}"/>
  <circle cx="${cx - 8}" cy="${cy - 2}" r="1.6" fill="#fff"/>
  <circle cx="${cx + 10}" cy="${cy - 2}" r="1.6" fill="#fff"/>
  ${cross ? `<path d="M${cx - 15} ${cy - 10} L${cx - 4} ${cy - 7} M${cx + 15} ${cy - 10} L${cx + 4} ${cy - 7}" stroke="${P.ink}" stroke-width="3" stroke-linecap="round"/>` : ""}
  <ellipse cx="${cx - 15}" cy="${cy + 8}" rx="4" ry="2.5" fill="${P.blush}"/>
  <ellipse cx="${cx + 15}" cy="${cy + 8}" rx="4" ry="2.5" fill="${P.blush}"/>
  <path d="M${cx - 5} ${cy + 10} Q${cx} ${cy + 14} ${cx + 5} ${cy + 10}" stroke="${P.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

function slime(color: string): string {
  const dark = mixHex(color, "#000000", 0.25);
  return `
    <ellipse cx="40" cy="70" rx="30" ry="6" fill="${P.ink}" opacity="0.2"/>
    <path d="M8 66 Q6 30 40 16 Q74 30 72 66 Q56 72 40 68 Q24 72 8 66 Z" fill="${color}"/>
    <path d="M60 30 Q72 44 72 66 Q64 68 58 66 Q66 48 60 30 Z" fill="${dark}" opacity="0.35"/>
    <ellipse cx="26" cy="32" rx="7" ry="10" fill="#fff" opacity="0.5" transform="rotate(-25 26 32)"/>
    ${face(40, 46)}`;
}

function imp(color: string): string {
  const dark = mixHex(color, "#000000", 0.3);
  return `
    <ellipse cx="40" cy="72" rx="24" ry="5" fill="${P.ink}" opacity="0.2"/>
    <path d="M10 40 Q2 24 14 18 Q14 34 22 40 Z" fill="${dark}"/>
    <path d="M70 40 Q78 24 66 18 Q66 34 58 40 Z" fill="${dark}"/>
    <path d="M24 22 L18 4 L34 16 Z" fill="${P.orange}"/>
    <path d="M56 22 L62 4 L46 16 Z" fill="${P.orange}"/>
    <circle cx="40" cy="42" r="26" fill="${color}"/>
    <path d="M28 66 L26 74 M52 66 L54 74" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
    ${face(40, 40)}`;
}

function guardian(color: string): string {
  const dark = mixHex(color, "#000000", 0.3);
  const light = mixHex(color, "#ffffff", 0.35);
  return `
    <ellipse cx="40" cy="74" rx="30" ry="5" fill="${P.ink}" opacity="0.2"/>
    <rect x="6" y="34" width="14" height="26" rx="7" fill="${dark}"/>
    <rect x="60" y="34" width="14" height="26" rx="7" fill="${dark}"/>
    <path d="M40 6 L68 18 L66 52 Q60 70 40 74 Q20 70 14 52 L12 18 Z" fill="${color}"/>
    <path d="M40 6 L68 18 L66 26 L14 26 L12 18 Z" fill="${light}"/>
    <circle cx="40" cy="16" r="4" fill="${P.gold}"/>
    ${face(40, 44, true)}`;
}

const DRAW: Record<MonsterKind, (c: string) => string> = {
  slime,
  imp,
  guardian,
};

/** Full SVG for a monster on a given floor (used by Phaser and the battle card). */
export function monsterSvg(kind: MonsterKind, floorIndex: number): string {
  const tints = FLOOR_TINTS[kind];
  const color = tints[floorIndex % tints.length] ?? P.green;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">${DRAW[kind](color)}</svg>`;
}

export const monsterKey = (kind: MonsterKind, floorIndex: number): string =>
  `rpg-${kind}-${floorIndex % 4}`;

export function rpgTextureDefs(): Record<
  string,
  { svg: string; width: number; height: number }
> {
  const defs: Record<string, { svg: string; width: number; height: number }> =
    {};
  for (const kind of ["slime", "imp", "guardian"] as const) {
    for (let f = 0; f < 4; f++) {
      defs[monsterKey(kind, f)] = {
        svg: monsterSvg(kind, f),
        width: 80,
        height: 80,
      };
    }
  }
  return defs;
}

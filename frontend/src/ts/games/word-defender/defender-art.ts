import { PALETTE as P, mixHex } from "../shared/game-palette";
import type { PowerKind, ShipKind } from "./defender-rules";

/**
 * Word Defender pictures (the illustrated aliens from the old Phaser game,
 * plus the player's hero ship), as image URLs for <img>.
 */

const url = (w: number, h: number, body: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`,
  )}`;

const cache = new Map<string, string>();
const memo = (key: string, make: () => string): string => {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const made = make();
  cache.set(key, made);
  return made;
};

/** A friendly alien in a flying saucer. */
function ufo(color: string): string {
  const dark = mixHex(color, "#000000", 0.3);
  const light = mixHex(color, "#ffffff", 0.45);
  return url(
    100,
    80,
    `
    <path d="M38 22 Q38 6 50 6 Q62 6 62 22" fill="none" stroke="${P.frog}" stroke-width="3"/>
    <circle cx="50" cy="5" r="4" fill="${P.yellow}"/>
    <ellipse cx="50" cy="36" rx="26" ry="24" fill="${P.mint}" opacity="0.55"/>
    <ellipse cx="50" cy="38" rx="16" ry="14" fill="${P.frog}"/>
    <circle cx="44" cy="36" r="4" fill="${P.ink}"/>
    <circle cx="56" cy="36" r="4" fill="${P.ink}"/>
    <circle cx="45.3" cy="34.6" r="1.4" fill="#fff"/>
    <circle cx="57.3" cy="34.6" r="1.4" fill="#fff"/>
    <path d="M45 44 Q50 48 55 44" stroke="${P.ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="56" rx="48" ry="16" fill="${dark}"/>
    <ellipse cx="50" cy="52" rx="48" ry="15" fill="${color}"/>
    <ellipse cx="50" cy="47" rx="30" ry="6" fill="${light}"/>
    <circle cx="20" cy="54" r="4" fill="${P.yellow}"/>
    <circle cx="38" cy="58" r="4" fill="${P.cream}"/>
    <circle cx="62" cy="58" r="4" fill="${P.yellow}"/>
    <circle cx="80" cy="54" r="4" fill="${P.cream}"/>
    <path d="M36 66 L30 78 M64 66 L70 78" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`,
  );
}

/** A fast flaming space rock (scouts). */
const meteor = (): string =>
  url(
    48,
    60,
    `
  <path d="M14 22 Q24 -4 34 22 Z" fill="${P.orange}"/>
  <path d="M18 22 Q24 4 30 22 Z" fill="${P.yellow}"/>
  <circle cx="24" cy="38" r="18" fill="${P.brown}"/>
  <circle cx="17" cy="33" r="4" fill="${P.brownDark}"/>
  <circle cx="31" cy="42" r="5" fill="${P.brownDark}"/>
  <circle cx="22" cy="47" r="2.5" fill="${P.brownDark}"/>`,
  );

const SHIP_COLOR: Record<ShipKind, string> = {
  basic: P.pink,
  shield: P.blue,
  splitter: P.green,
  zigzag: P.yellow,
  scout: P.orange,
  cloak: P.purple,
  mini: P.green,
};

export const shipUrl = (kind: ShipKind): string =>
  memo(`ship-${kind}`, () =>
    kind === "scout" ? meteor() : ufo(SHIP_COLOR[kind]),
  );

export const mothershipUrl = (): string =>
  memo("mothership", () =>
    url(
      160,
      110,
      `
  <ellipse cx="80" cy="44" rx="44" ry="40" fill="${P.mint}" opacity="0.55"/>
  <ellipse cx="80" cy="50" rx="28" ry="24" fill="${P.frog}"/>
  <path d="M60 36 L74 42 M100 36 L86 42" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="70" cy="50" r="6" fill="${P.ink}"/>
  <circle cx="90" cy="50" r="6" fill="${P.ink}"/>
  <circle cx="72" cy="48" r="2" fill="#fff"/>
  <circle cx="92" cy="48" r="2" fill="#fff"/>
  <path d="M70 64 Q80 58 90 64" stroke="${P.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="80" cy="80" rx="78" ry="24" fill="${mixHex(P.purple, "#000000", 0.35)}"/>
  <ellipse cx="80" cy="74" rx="78" ry="22" fill="${P.purple}"/>
  <ellipse cx="80" cy="66" rx="50" ry="8" fill="${mixHex(P.purple, "#ffffff", 0.45)}"/>
  <g fill="${P.yellow}">
    <circle cx="18" cy="76" r="5"/><circle cx="44" cy="84" r="5"/><circle cx="80" cy="88" r="5"/>
    <circle cx="116" cy="84" r="5"/><circle cx="142" cy="76" r="5"/>
  </g>`,
    ),
  );

/** The player's ship: a rocket with a laser cannon on its nose. */
export const heroUrl = (): string =>
  memo("hero", () =>
    url(
      100,
      120,
      `
  <path d="M30 78 L10 104 L32 98 Z" fill="${P.red}"/>
  <path d="M70 78 L90 104 L68 98 Z" fill="${P.red}"/>
  <path d="M50 4 Q74 30 72 86 L28 86 Q26 30 50 4 Z" fill="${P.cream}"/>
  <path d="M50 4 Q62 18 66 34 L34 34 Q38 18 50 4 Z" fill="${P.blue}"/>
  <rect x="46" y="0" width="8" height="12" rx="3" fill="${P.grey}"/>
  <circle cx="50" cy="54" r="12" fill="${P.navy}" stroke="${P.blue}" stroke-width="4"/>
  <circle cx="46" cy="50" r="3.5" fill="#fff" opacity="0.7"/>
  <path d="M28 86 L72 86 L66 98 L34 98 Z" fill="${P.grey}"/>
  <path d="M40 98 Q50 122 60 98 Z" fill="${P.orange}"/>
  <path d="M44 98 Q50 114 56 98 Z" fill="${P.yellow}"/>`,
    ),
  );

export const planetUrl = (): string =>
  memo("planet", () =>
    url(
      160,
      120,
      `
  <circle cx="80" cy="60" r="44" fill="${P.orange}"/>
  <path d="M40 48 Q80 40 120 50" stroke="${mixHex(P.orange, "#ffffff", 0.35)}" stroke-width="8" fill="none"/>
  <path d="M38 70 Q80 62 122 72" stroke="${mixHex(P.orange, "#000000", 0.15)}" stroke-width="7" fill="none"/>
  <ellipse cx="80" cy="64" rx="76" ry="16" fill="none" stroke="${P.tan}" stroke-width="7" transform="rotate(-12 80 64)"/>`,
    ),
  );

export const moonUrl = (): string =>
  memo("moon", () =>
    url(
      60,
      60,
      `
  <circle cx="30" cy="30" r="28" fill="${P.grey}"/>
  <circle cx="20" cy="22" r="6" fill="${mixHex(P.grey, "#000000", 0.18)}"/>
  <circle cx="38" cy="36" r="8" fill="${mixHex(P.grey, "#000000", 0.18)}"/>
  <circle cx="26" cy="44" r="4" fill="${mixHex(P.grey, "#000000", 0.18)}"/>`,
    ),
  );

const ORB_COLOR: Record<PowerKind, string> = {
  emp: P.blue,
  nuke: P.green,
  shield: P.mint,
  freeze: P.sky,
  multi: P.pink,
};

/** Glowing bubble behind a power-up's icon. */
export const orbUrl = (kind: PowerKind): string =>
  memo(`orb-${kind}`, () =>
    url(
      64,
      64,
      `
  <circle cx="32" cy="32" r="30" fill="${ORB_COLOR[kind]}" opacity="0.35"/>
  <circle cx="32" cy="32" r="22" fill="${ORB_COLOR[kind]}"/>
  <circle cx="25" cy="24" r="6" fill="#fff" opacity="0.55"/>`,
    ),
  );

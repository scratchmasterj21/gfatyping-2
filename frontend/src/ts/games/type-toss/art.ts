import { PALETTE as P, mixHex } from "../shared/game-palette";

type Def = { svg: string; width: number; height: number };

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

const eyes = (y: number, gap = 8): string => `
  <circle cx="${32 - gap}" cy="${y}" r="3" fill="${P.ink}"/>
  <circle cx="${32 + gap}" cy="${y}" r="3" fill="${P.ink}"/>
  <circle cx="${33 - gap}" cy="${y - 1}" r="1" fill="#fff"/>
  <circle cx="${33 + gap}" cy="${y - 1}" r="1" fill="#fff"/>`;

const duck = svg(`
  <ellipse cx="34" cy="44" rx="24" ry="14" fill="${P.yellow}"/>
  <path d="M54 38 Q62 34 58 44 Z" fill="${P.yellow}"/>
  <circle cx="26" cy="24" r="14" fill="${P.yellow}"/>
  <path d="M8 24 Q14 20 16 26 Q12 30 8 26 Z" fill="${P.orange}"/>
  <circle cx="22" cy="21" r="2.6" fill="${P.ink}"/>
  <ellipse cx="30" cy="29" rx="3" ry="2" fill="${P.blush}"/>
  <path d="M28 44 Q38 52 48 42" stroke="${mixHex(P.yellow, "#000000", 0.2)}" stroke-width="3" fill="none" stroke-linecap="round"/>
`);

const panda = svg(`
  <circle cx="14" cy="14" r="9" fill="${P.ink}"/>
  <circle cx="50" cy="14" r="9" fill="${P.ink}"/>
  <circle cx="32" cy="34" r="25" fill="${P.cream}"/>
  <ellipse cx="22" cy="31" rx="7" ry="9" fill="${P.ink}" transform="rotate(-20 22 31)"/>
  <ellipse cx="42" cy="31" rx="7" ry="9" fill="${P.ink}" transform="rotate(20 42 31)"/>
  <circle cx="23" cy="30" r="2.6" fill="#fff"/>
  <circle cx="41" cy="30" r="2.6" fill="#fff"/>
  <ellipse cx="32" cy="42" rx="4" ry="3" fill="${P.ink}"/>
  <path d="M27 47 Q32 51 37 47" stroke="${P.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="16" cy="42" rx="4" ry="2.5" fill="${P.blush}"/>
  <ellipse cx="48" cy="42" rx="4" ry="2.5" fill="${P.blush}"/>
`);

const bullseye = svg(`
  <circle cx="32" cy="32" r="28" fill="${P.red}"/>
  <circle cx="32" cy="32" r="21" fill="${P.cream}"/>
  <circle cx="32" cy="32" r="14" fill="${P.red}"/>
  <circle cx="32" cy="32" r="7" fill="${P.cream}"/>
  <circle cx="32" cy="32" r="3" fill="${P.red}"/>
`);

const star = svg(`
  <path d="M32 3 l8.5 17.2 19 2.8 -13.7 13.4 3.2 18.9 -17 -8.9 -17 8.9 3.2 -18.9 -13.7 -13.4 19 -2.8 Z" fill="${P.gold}" stroke="${mixHex(P.gold, "#000000", 0.25)}" stroke-width="2" stroke-linejoin="round"/>
  ${eyes(32, 6)}
  <path d="M28 39 Q32 43 36 39" stroke="${P.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>
`);

const teddy = svg(`
  <circle cx="14" cy="16" r="10" fill="${P.brown}"/>
  <circle cx="50" cy="16" r="10" fill="${P.brown}"/>
  <circle cx="14" cy="16" r="5" fill="${P.tan}"/>
  <circle cx="50" cy="16" r="5" fill="${P.tan}"/>
  <circle cx="32" cy="34" r="24" fill="${P.brown}"/>
  <ellipse cx="32" cy="43" rx="11" ry="8" fill="${P.tan}"/>
  ${eyes(30)}
  <ellipse cx="32" cy="40" rx="4" ry="3" fill="${P.ink}"/>
  <path d="M28 46 Q32 49 36 46" stroke="${P.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>
`);

const clock = svg(`
  <circle cx="32" cy="34" r="26" fill="${P.green}"/>
  <circle cx="32" cy="34" r="20" fill="${P.cream}"/>
  <path d="M32 34 V20 M32 34 L42 40" stroke="${P.ink}" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="26" y="2" width="12" height="7" rx="3" fill="${P.green}"/>
`);

const sparkle2x = svg(`
  <path d="M32 2 L38 24 L60 30 L38 36 L32 60 L26 36 L4 30 L26 24 Z" fill="${P.purple}"/>
  <text x="32" y="37" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="${P.cream}">2×</text>
`);

const bomb = svg(`
  <path d="M40 16 Q48 6 54 10" stroke="${P.tan}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M55 4 l2 4 4 1 -4 2 -1 4 -2 -4 -4 -1 4 -2 Z" fill="${P.yellow}"/>
  <circle cx="30" cy="38" r="22" fill="${P.ink}"/>
  <ellipse cx="21" cy="28" rx="6" ry="4" fill="#fff" opacity="0.45" transform="rotate(-30 21 28)"/>
  <path d="M20 36 L28 40 M40 36 L32 40" stroke="${P.red}" stroke-width="3" stroke-linecap="round"/>
`);

const ball = svg(`
  <circle cx="32" cy="32" r="28" fill="${P.red}"/>
  <path d="M8 22 Q32 34 56 22" stroke="${P.cream}" stroke-width="6" fill="none"/>
  <ellipse cx="22" cy="18" rx="7" ry="5" fill="#fff" opacity="0.5" transform="rotate(-30 22 18)"/>
`);

/** Prize pictures for normal targets, picked by typeIdx (0-4). */
export const PRIZES = ["duck", "panda", "bullseye", "star", "teddy"] as const;

export function tossTextureDefs(): Record<string, Def> {
  const art: Record<string, string> = {
    duck,
    panda,
    bullseye,
    star,
    teddy,
    clock,
    sparkle2x,
    bomb,
    ball,
  };
  return Object.fromEntries(
    Object.entries(art).map(([k, v]) => [
      `tt-${k}`,
      { svg: v, width: 64, height: 64 },
    ]),
  );
}

import { PALETTE as P, PaletteName, mixHex } from "../shared/game-palette";

type Def = { svg: string; width: number; height: number };

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

/** Cute face shared by every fruit. */
const face = (cx: number, cy: number): string => `
  <circle cx="${cx - 7}" cy="${cy}" r="3" fill="${P.ink}"/>
  <circle cx="${cx + 7}" cy="${cy}" r="3" fill="${P.ink}"/>
  <circle cx="${cx - 6}" cy="${cy - 1}" r="1" fill="#fff"/>
  <circle cx="${cx + 8}" cy="${cy - 1}" r="1" fill="#fff"/>
  <path d="M${cx - 4} ${cy + 5} Q${cx} ${cy + 9} ${cx + 4} ${cy + 5}" stroke="${P.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="${cx - 12}" cy="${cy + 5}" rx="3.5" ry="2" fill="${P.blush}" opacity="0.9"/>
  <ellipse cx="${cx + 12}" cy="${cy + 5}" rx="3.5" ry="2" fill="${P.blush}" opacity="0.9"/>
`;

const shine = (x: number, y: number): string =>
  `<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="#fff" opacity="0.45" transform="rotate(-30 ${x} ${y})"/>`;

const banana = svg(`
  <path d="M10 18 Q12 52 48 54 Q58 54 58 48 Q30 46 20 16 Z" fill="${P.yellow}" stroke="${mixHex(P.yellow, "#000000", 0.25)}" stroke-width="2"/>
  <path d="M9 12 L13 19 L19 16 Z" fill="${P.brown}"/>
  <path d="M56 47 L61 50 L57 52 Z" fill="${P.brownDark}"/>
  ${face(34, 40)}
`);

const apple = svg(`
  <path d="M32 18 Q20 8 10 22 Q2 40 16 54 Q24 62 32 56 Q40 62 48 54 Q62 40 54 22 Q44 8 32 18 Z" fill="${P.red}"/>
  <path d="M32 18 Q32 10 36 5" stroke="${P.brownDark}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M35 10 Q46 2 50 10 Q42 16 35 10 Z" fill="${P.green}"/>
  ${shine(20, 26)}
  ${face(32, 36)}
`);

const watermelon = svg(`
  <circle cx="32" cy="34" r="27" fill="${P.green}"/>
  <g stroke="${mixHex(P.green, "#000000", 0.3)}" stroke-width="4" fill="none" stroke-linecap="round">
    <path d="M20 10 Q14 34 20 58"/><path d="M32 7 Q28 34 32 61"/><path d="M44 10 Q50 34 44 58"/>
  </g>
  ${shine(20, 22)}
  ${face(32, 36)}
`);

const orange = svg(`
  <circle cx="32" cy="35" r="25" fill="${P.orange}"/>
  <g fill="${mixHex(P.orange, "#000000", 0.12)}">
    <circle cx="18" cy="40" r="1.4"/><circle cx="46" cy="44" r="1.4"/><circle cx="40" cy="22" r="1.4"/><circle cx="24" cy="52" r="1.4"/>
  </g>
  <path d="M32 11 Q40 2 48 8 Q40 14 32 11 Z" fill="${P.green}"/>
  ${shine(21, 24)}
  ${face(32, 37)}
`);

const grape = svg(`
  <path d="M32 6 Q33 12 32 14" stroke="${P.brownDark}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M33 8 Q44 2 48 10 Q40 14 33 8 Z" fill="${P.green}"/>
  <g fill="${P.purple}" stroke="${mixHex(P.purple, "#000000", 0.2)}" stroke-width="1.5">
    <circle cx="20" cy="22" r="9"/><circle cx="32" cy="20" r="9"/><circle cx="44" cy="22" r="9"/>
    <circle cx="26" cy="34" r="9"/><circle cx="38" cy="34" r="9"/>
    <circle cx="20" cy="44" r="8"/><circle cx="44" cy="44" r="8"/>
    <circle cx="32" cy="47" r="9"/><circle cx="32" cy="57" r="6"/>
  </g>
  ${face(32, 36)}
`);

const bomb = svg(`
  <path d="M40 16 Q48 6 54 10" stroke="${P.tan}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M55 4 l2 4 4 1 -4 2 -1 4 -2 -4 -4 -1 4 -2 Z" fill="${P.yellow}"/>
  <rect x="34" y="12" width="12" height="9" rx="2" fill="${P.grey}" transform="rotate(30 40 16)"/>
  <circle cx="30" cy="38" r="22" fill="${P.ink}"/>
  ${shine(21, 28)}
  <path d="M20 36 L28 40 M40 36 L32 40" stroke="${P.red}" stroke-width="3" stroke-linecap="round"/>
  <path d="M24 48 Q30 44 36 48" stroke="${P.red}" stroke-width="3" fill="none" stroke-linecap="round"/>
`);

/** Fruit kinds in typeIdx order (0-4). */
export const FRUIT_KINDS = [
  "banana",
  "apple",
  "watermelon",
  "orange",
  "grape",
] as const;

/** Juice colour per fruit kind, for splats and particles. */
export const JUICE: PaletteName[] = [
  "yellow",
  "red",
  "pink",
  "orange",
  "purple",
];

export function fruitTextureDefs(): Record<string, Def> {
  const sv = { banana, apple, watermelon, orange, grape };
  const defs: Record<string, Def> = {
    "fn-bomb": { svg: bomb, width: 64, height: 64 },
  };
  for (const k of FRUIT_KINDS) {
    defs[`fn-${k}`] = { svg: sv[k], width: 64, height: 64 };
  }
  return defs;
}

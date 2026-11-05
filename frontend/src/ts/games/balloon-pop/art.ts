import { PALETTE as P, PaletteName, mixHex } from "../shared/game-palette";

type Def = { svg: string; width: number; height: number };

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Resting balloon colours (purely for variety). */
export const BALLOON_COLORS: PaletteName[] = [
  "blue",
  "pink",
  "green",
  "purple",
  "orange",
  "red",
];

function balloon(color: string): string {
  const dark = mixHex(color, "#000000", 0.25);
  return svg(
    80,
    112,
    `
    <path d="M40 80 Q34 90 42 96 Q50 102 40 112" stroke="${P.ink}" stroke-opacity="0.45" stroke-width="2" fill="none"/>
    <ellipse cx="40" cy="40" rx="36" ry="40" fill="${color}"/>
    <path d="M40 2 Q74 4 76 40 Q74 70 46 79 Q70 60 66 34 Q62 10 40 2 Z" fill="${dark}" opacity="0.35"/>
    <ellipse cx="26" cy="22" rx="8" ry="12" fill="#fff" opacity="0.5" transform="rotate(-25 26 22)"/>
    <circle cx="21" cy="40" r="3" fill="#fff" opacity="0.45"/>
    <path d="M34 78 L46 78 L42 84 L38 84 Z" fill="${dark}"/>
  `,
  );
}

const gustCloud = svg(
  96,
  72,
  `
  <g fill="${P.cloud}">
    <circle cx="30" cy="38" r="22"/><circle cx="52" cy="28" r="24"/><circle cx="72" cy="40" r="20"/>
    <rect x="16" y="38" width="66" height="22" rx="11"/>
  </g>
  <circle cx="42" cy="36" r="3.5" fill="${P.ink}"/>
  <circle cx="58" cy="36" r="3.5" fill="${P.ink}"/>
  <ellipse cx="36" cy="44" rx="4" ry="2.5" fill="${P.blush}"/>
  <ellipse cx="64" cy="44" rx="4" ry="2.5" fill="${P.blush}"/>
  <ellipse cx="50" cy="48" rx="5" ry="6" fill="${P.ink}"/>
  <g stroke="${P.sky}" stroke-width="4" stroke-linecap="round">
    <path d="M4 50 L14 50"/><path d="M0 60 L16 58"/><path d="M6 40 L14 42"/>
  </g>
`,
);

const goldenBalloon = svg(
  80,
  112,
  `
  <path d="M40 80 Q34 90 42 96 Q50 102 40 112" stroke="${P.ink}" stroke-opacity="0.45" stroke-width="2" fill="none"/>
  <ellipse cx="40" cy="40" rx="36" ry="40" fill="${P.gold}"/>
  <path d="M40 16 l6.5 13.2 14.5 2.1 -10.5 10.3 2.5 14.5 -13 -6.8 -13 6.8 2.5 -14.5 -10.5 -10.3 14.5 -2.1 Z" fill="${P.cream}"/>
  <ellipse cx="22" cy="20" rx="6" ry="10" fill="#fff" opacity="0.55" transform="rotate(-25 22 20)"/>
  <path d="M34 78 L46 78 L42 84 L38 84 Z" fill="${mixHex(P.gold, "#000000", 0.25)}"/>
`,
);

const confetti = svg(12, 8, `<rect width="12" height="8" rx="2" fill="#fff"/>`);

export function balloonTextureDefs(): Record<string, Def> {
  const defs: Record<string, Def> = {
    "bp-gust": { svg: gustCloud, width: 96, height: 72 },
    "bp-golden": { svg: goldenBalloon, width: 80, height: 112 },
    "bp-confetti": { svg: confetti, width: 12, height: 8 },
  };
  for (const c of BALLOON_COLORS) {
    defs[`bp-balloon-${c}`] = { svg: balloon(P[c]), width: 80, height: 112 };
  }
  return defs;
}

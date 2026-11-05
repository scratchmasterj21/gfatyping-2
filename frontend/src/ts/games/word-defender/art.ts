import { PALETTE as P, mixHex } from "../shared/game-palette";

type Def = { svg: string; width: number; height: number };

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Saucer colours for the regular alien ships. */
export const UFO_COLORS = [P.pink, P.blue, P.yellow, P.purple] as const;

function ufo(color: string): string {
  const dark = mixHex(color, "#000000", 0.3);
  const light = mixHex(color, "#ffffff", 0.45);
  return svg(
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
    <path d="M36 66 L30 78 M64 66 L70 78" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>
  `,
  );
}

const mothership = svg(
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
  </g>
`,
);

const base = svg(
  130,
  66,
  `
  <rect x="60" y="0" width="10" height="18" rx="4" fill="${P.grey}"/>
  <rect x="58" y="0" width="14" height="6" rx="3" fill="${P.red}"/>
  <path d="M14 52 Q14 10 65 10 Q116 10 116 52 Z" fill="${P.blue}"/>
  <path d="M24 46 Q26 18 65 18 Q104 18 106 46" fill="none" stroke="${mixHex(P.blue, "#ffffff", 0.4)}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="65" cy="33" r="17" fill="${P.navy}" stroke="${P.cream}" stroke-width="4"/>
  <rect x="0" y="48" width="130" height="16" rx="8" fill="${P.grey}"/>
  <rect x="0" y="48" width="130" height="6" rx="3" fill="${mixHex(P.grey, "#ffffff", 0.35)}"/>
  <circle cx="16" cy="58" r="3" fill="${P.yellow}"/>
  <circle cx="114" cy="58" r="3" fill="${P.yellow}"/>
`,
);

const planet = svg(
  160,
  120,
  `
  <circle cx="80" cy="60" r="44" fill="${P.orange}"/>
  <path d="M40 48 Q80 40 120 50" stroke="${mixHex(P.orange, "#ffffff", 0.35)}" stroke-width="8" fill="none"/>
  <path d="M38 70 Q80 62 122 72" stroke="${mixHex(P.orange, "#000000", 0.15)}" stroke-width="7" fill="none"/>
  <ellipse cx="80" cy="64" rx="76" ry="16" fill="none" stroke="${P.tan}" stroke-width="7" transform="rotate(-12 80 64)"/>
`,
);

const moon = svg(
  60,
  60,
  `
  <circle cx="30" cy="30" r="28" fill="${P.grey}"/>
  <circle cx="20" cy="22" r="6" fill="${mixHex(P.grey, "#000000", 0.18)}"/>
  <circle cx="38" cy="36" r="8" fill="${mixHex(P.grey, "#000000", 0.18)}"/>
  <circle cx="26" cy="44" r="4" fill="${mixHex(P.grey, "#000000", 0.18)}"/>
`,
);

const rock = svg(
  48,
  60,
  `
  <path d="M14 22 Q24 -4 34 22 Z" fill="${P.orange}"/>
  <path d="M18 22 Q24 4 30 22 Z" fill="${P.yellow}"/>
  <circle cx="24" cy="38" r="18" fill="${P.brown}"/>
  <circle cx="17" cy="33" r="4" fill="${P.brownDark}"/>
  <circle cx="31" cy="42" r="5" fill="${P.brownDark}"/>
  <circle cx="22" cy="47" r="2.5" fill="${P.brownDark}"/>
`,
);

const orb = (fill: string, icon: string): string =>
  svg(
    64,
    64,
    `
  <circle cx="32" cy="32" r="30" fill="${fill}" opacity="0.35"/>
  <circle cx="32" cy="32" r="22" fill="${fill}"/>
  <circle cx="25" cy="24" r="6" fill="#fff" opacity="0.55"/>
  ${icon}
`,
  );

const empOrb = orb(
  P.blue,
  `<path d="M35 14 L22 35 L31 35 L27 50 L42 28 L33 28 Z" fill="${P.yellow}" stroke="${P.ink}" stroke-width="1.5" stroke-linejoin="round"/>`,
);
const nukeOrb = orb(
  P.green,
  `<path d="M32 14 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5 Z" fill="${P.yellow}" stroke="${P.ink}" stroke-width="1.5" stroke-linejoin="round"/>`,
);

const star = svg(
  32,
  32,
  `<path d="M16 1 l4.4 9.6 10.6 1.2 -7.9 7.2 2.2 10.4 -9.3 -5.3 -9.3 5.3 2.2 -10.4 -7.9 -7.2 10.6 -1.2 Z" fill="#fff"/>`,
);

const dot = svg(8, 8, `<circle cx="4" cy="4" r="4" fill="#fff"/>`);

/** All Word Defender textures, keyed for Phaser. */
export function defenderTextureDefs(): Record<string, Def> {
  const defs: Record<string, Def> = {
    "wd-mothership": { svg: mothership, width: 160, height: 110 },
    "wd-base": { svg: base, width: 130, height: 66 },
    "wd-planet": { svg: planet, width: 160, height: 120 },
    "wd-moon": { svg: moon, width: 60, height: 60 },
    "wd-rock": { svg: rock, width: 48, height: 60 },
    "wd-orb-emp": { svg: empOrb, width: 64, height: 64 },
    "wd-orb-nuke": { svg: nukeOrb, width: 64, height: 64 },
    "wd-star": { svg: star, width: 32, height: 32 },
    "wd-dot": { svg: dot, width: 8, height: 8 },
  };
  UFO_COLORS.forEach((c, i) => {
    defs[`wd-ufo-${i}`] = { svg: ufo(c), width: 100, height: 80 };
  });
  return defs;
}

import { PALETTE as P, mixHex } from "../shared/game-palette";

type Def = { svg: string; width: number; height: number };

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Body tints for the (friendly!) ghosts. */
export const GHOST_TINTS = [P.cream, P.mint, "#e8dcff"] as const;

/** A round, friendly ghost looking to the right (flip for the other side). */
function ghost(body: string): string {
  const shade = mixHex(body, P.purple, 0.25);
  return svg(
    70,
    80,
    `
    <path d="M6 40 Q6 4 35 4 Q64 4 64 40 L64 70 Q57 62 50 72 Q43 62 35 72 Q27 62 20 72 Q13 62 6 70 Z" fill="${body}"/>
    <path d="M50 10 Q64 18 64 40 L64 70 Q57 62 50 72 Q56 50 50 10 Z" fill="${shade}" opacity="0.5"/>
    <ellipse cx="22" cy="20" rx="6" ry="9" fill="#fff" opacity="0.6" transform="rotate(-20 22 20)"/>
    <ellipse cx="34" cy="36" rx="5" ry="7" fill="${P.ink}"/>
    <ellipse cx="50" cy="36" rx="5" ry="7" fill="${P.ink}"/>
    <circle cx="36" cy="33" r="1.8" fill="#fff"/>
    <circle cx="52" cy="33" r="1.8" fill="#fff"/>
    <ellipse cx="28" cy="46" rx="5" ry="3" fill="${P.blush}"/>
    <ellipse cx="56" cy="46" rx="5" ry="3" fill="${P.blush}"/>
    <ellipse cx="42" cy="49" rx="4" ry="5" fill="${P.ink}"/>
  `,
  );
}

const freezeOrb = svg(
  64,
  64,
  `
  <circle cx="32" cy="32" r="30" fill="${P.sky}" opacity="0.35"/>
  <circle cx="32" cy="32" r="22" fill="${P.blue}"/>
  <g stroke="${P.cream}" stroke-width="3.5" stroke-linecap="round">
    <path d="M32 16 V48"/><path d="M18 24 L46 40"/><path d="M18 40 L46 24"/>
    <path d="M28 19 L32 23 L36 19"/><path d="M28 45 L32 41 L36 45"/>
  </g>
`,
);

const fireworkOrb = svg(
  64,
  64,
  `
  <circle cx="32" cy="32" r="30" fill="${P.orange}" opacity="0.35"/>
  <circle cx="32" cy="32" r="22" fill="${P.red}"/>
  <g stroke="${P.yellow}" stroke-width="3" stroke-linecap="round">
    <path d="M32 14 V22"/><path d="M32 42 V50"/><path d="M14 32 H22"/><path d="M42 32 H50"/>
    <path d="M20 20 L25 25"/><path d="M39 39 L44 44"/><path d="M44 20 L39 25"/><path d="M25 39 L20 44"/>
  </g>
  <circle cx="32" cy="32" r="6" fill="${P.yellow}"/>
`,
);

const house = svg(
  200,
  130,
  `
  <g fill="#3a2a6a">
    <rect x="40" y="50" width="120" height="80"/>
    <path d="M30 54 L100 4 L170 54 Z"/>
    <rect x="130" y="16" width="16" height="30"/>
    <rect x="16" y="76" width="34" height="54"/>
    <path d="M10 80 L33 58 L56 80 Z"/>
  </g>
  <g fill="${P.yellow}" opacity="0.85">
    <rect x="62" y="68" width="18" height="20" rx="3"/>
    <rect x="120" y="68" width="18" height="20" rx="3"/>
    <circle cx="100" cy="38" r="8"/>
    <rect x="26" y="92" width="12" height="14" rx="2"/>
  </g>
  <rect x="90" y="96" width="20" height="34" rx="10" fill="#2a1d52"/>
`,
);

const pumpkin = svg(
  48,
  44,
  `
  <path d="M24 8 Q26 2 30 2" stroke="${P.grassDark}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="14" cy="26" rx="12" ry="16" fill="${mixHex(P.orange, "#000000", 0.12)}"/>
  <ellipse cx="34" cy="26" rx="12" ry="16" fill="${mixHex(P.orange, "#000000", 0.12)}"/>
  <ellipse cx="24" cy="26" rx="13" ry="17" fill="${P.orange}"/>
  <path d="M15 22 L19 18 L23 22 Z M25 22 L29 18 L33 22 Z" fill="${P.yellow}"/>
  <path d="M15 30 Q24 38 33 30 Q24 34 15 30 Z" fill="${P.yellow}"/>
`,
);

const bat = svg(
  40,
  20,
  `
  <path d="M20 8 Q14 0 4 4 Q8 8 6 12 Q12 10 16 14 Q18 10 20 12 Q22 10 24 14 Q28 10 34 12 Q32 8 36 4 Q26 0 20 8 Z" fill="#2a1d52"/>
  <circle cx="18" cy="8" r="1.2" fill="${P.yellow}"/><circle cx="22" cy="8" r="1.2" fill="${P.yellow}"/>
`,
);

/** The Ghost King: a purple ghost with a gold crown (boss wave). */
function kingGhost(): string {
  const body = "#c9a3ff";
  const inner = ghost(body)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
  return svg(
    70,
    96,
    `
    <g transform="translate(0 16)">${inner}</g>
    <path d="M17 22 L19 4 L28 14 L35 0 L42 14 L51 4 L53 22 Z" fill="${P.yellow}" stroke="${P.ink}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="35" cy="14" r="3" fill="${P.red}"/>
    <circle cx="24" cy="17" r="2" fill="${P.blue}"/>
    <circle cx="46" cy="17" r="2" fill="${P.blue}"/>
  `,
  );
}

const sparkle = svg(
  24,
  24,
  `<path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="#fff"/>`,
);

export function ghostTextureDefs(): Record<string, Def> {
  const defs: Record<string, Def> = {
    "gh-orb-freeze": { svg: freezeOrb, width: 64, height: 64 },
    "gh-orb-tnt": { svg: fireworkOrb, width: 64, height: 64 },
    "gh-house": { svg: house, width: 200, height: 130 },
    "gh-pumpkin": { svg: pumpkin, width: 48, height: 44 },
    "gh-bat": { svg: bat, width: 40, height: 20 },
    "gh-sparkle": { svg: sparkle, width: 24, height: 24 },
    "gh-king": { svg: kingGhost(), width: 70, height: 96 },
  };
  GHOST_TINTS.forEach((c, i) => {
    defs[`gh-ghost-${i}`] = { svg: ghost(c), width: 70, height: 80 };
  });
  return defs;
}

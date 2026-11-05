import { PALETTE as P, mixHex } from "../shared/game-palette";

type Def = { svg: string; width: number; height: number };

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Side-view go-kart facing right. The seat is left open for a driver. */
function kart(color: string, helmet: boolean): string {
  const dark = mixHex(color, "#000000", 0.3);
  const light = mixHex(color, "#ffffff", 0.4);
  const driver = helmet
    ? `<circle cx="54" cy="18" r="13" fill="${P.orange}"/>
       <rect x="52" y="12" width="16" height="9" rx="4" fill="${P.ink}" opacity="0.75"/>`
    : "";
  return svg(
    120,
    64,
    `
    <rect x="6" y="14" width="10" height="20" rx="3" fill="${dark}"/>
    <rect x="2" y="12" width="22" height="6" rx="3" fill="${color}"/>
    ${driver}
    <path d="M10 30 Q12 24 24 24 L40 24 Q46 30 66 30 L96 30 Q112 30 116 40 L116 44 Q116 48 110 48 L14 48 Q8 48 8 42 Z" fill="${color}"/>
    <path d="M40 24 Q46 30 66 30 L96 30 Q106 30 112 36 L20 36 Q20 28 24 26 Z" fill="${light}" opacity="0.55"/>
    <circle cx="82" cy="40" r="7" fill="${P.cream}"/>
    <rect x="98" y="34" width="12" height="4" rx="2" fill="${P.yellow}"/>
    <circle cx="28" cy="50" r="12" fill="${P.ink}"/>
    <circle cx="28" cy="50" r="5" fill="${P.grey}"/>
    <circle cx="96" cy="50" r="12" fill="${P.ink}"/>
    <circle cx="96" cy="50" r="5" fill="${P.grey}"/>
  `,
  );
}

const flag = svg(
  40,
  48,
  `
  <rect x="2" y="2" width="4" height="46" rx="2" fill="${P.grey}"/>
  <g>
    ${[0, 1, 2, 3]
      .map((r) =>
        [0, 1, 2, 3]
          .map(
            (c) =>
              `<rect x="${6 + c * 8}" y="${4 + r * 7}" width="8" height="7" fill="${(r + c) % 2 === 0 ? P.ink : P.cream}"/>`,
          )
          .join(""),
      )
      .join("")}
  </g>
`,
);

export function racerTextureDefs(): Record<string, Def> {
  return {
    "rc-kart-player": { svg: kart(P.blue, false), width: 120, height: 64 },
    "rc-kart-cpu": { svg: kart(P.red, false), width: 120, height: 64 },
    "rc-kart-rival": { svg: kart(P.red, true), width: 120, height: 64 },
    "rc-flag": { svg: flag, width: 40, height: 48 },
  };
}

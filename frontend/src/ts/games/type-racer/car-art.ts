import { mixHex, PALETTE } from "../shared/game-palette";
import type { GameColor } from "./race-rules";

const svgUrl = (body: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 64">${body}</svg>`,
  )}`;

const cache = new Map<string, string>();

/** Side-view go-kart facing right (seat left open for the driver). */
export function kartUrl(color: GameColor, ghost = false): string {
  const key = `${color}${ghost ? "-g" : ""}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = PALETTE[color];
  const dark = mixHex(c, "#000000", 0.3);
  const light = mixHex(c, "#ffffff", 0.4);
  const url = svgUrl(`
    <rect x="6" y="14" width="10" height="20" rx="3" fill="${dark}"/>
    <rect x="2" y="12" width="22" height="6" rx="3" fill="${c}"/>
    <path d="M10 30 Q12 24 24 24 L40 24 Q46 30 66 30 L96 30 Q112 30 116 40 L116 44 Q116 48 110 48 L14 48 Q8 48 8 42 Z" fill="${c}"/>
    <path d="M40 24 Q46 30 66 30 L96 30 Q106 30 112 36 L20 36 Q20 28 24 26 Z" fill="${light}" opacity="0.55"/>
    <circle cx="82" cy="40" r="7" fill="${PALETTE.cream}"/>
    <rect x="98" y="34" width="12" height="4" rx="2" fill="${PALETTE.yellow}"/>
    <circle cx="28" cy="50" r="12" fill="${PALETTE.ink}"/>
    <circle cx="28" cy="50" r="5" fill="${PALETTE.grey}"/>
    <circle cx="96" cy="50" r="12" fill="${PALETTE.ink}"/>
    <circle cx="96" cy="50" r="5" fill="${PALETTE.grey}"/>`);
  cache.set(key, url);
  return url;
}

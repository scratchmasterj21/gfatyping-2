import { mixHex } from "./game-palette";

export type TappyMood = "happy" | "cheer" | "sad";

/** Theme main colour, so Tappy matches the rest of the app. */
export function themeMainColor(): string {
  if (typeof document === "undefined") return "#ff7eb6";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--main-color")
    .trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v.slice(0, 7) : "#ff7eb6";
}

/** Tappy the keycap buddy as plain SVG (mirrors components/common/Mascot). */
export function tappySvg(mood: TappyMood, main: string): string {
  const ledge = mixHex(main, "#000000", 0.3);
  const face = mixHex(main, "#ffffff", 0.7);
  const ink = mixHex(main, "#1a1a1a", 0.85);
  const cheek = "#ff9bb0";
  const arms =
    mood === "cheer"
      ? `<path d="M20 60 Q8 48 10 32"/><path d="M100 60 Q112 48 110 32"/>`
      : `<path d="M20 70 Q10 76 9 86"/><path d="M100 70 Q110 76 111 86"/>`;
  const eyes =
    mood === "sad"
      ? `<circle cx="46" cy="58" r="6.5" fill="${ink}"/><circle cx="74" cy="58" r="6.5" fill="${ink}"/>
         <g stroke="${ink}" stroke-width="3" stroke-linecap="round"><path d="M38 46 L50 49"/><path d="M82 46 L70 49"/></g>`
      : `<g stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M40 58 Q46 49 52 58"/><path d="M68 58 Q74 49 80 58"/></g>`;
  const mouth =
    mood === "sad"
      ? `<path d="M51 78 Q60 70 69 78" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none"/>`
      : `<path d="M48 70 Q60 86 72 70 Z" fill="${ink}"/><path d="M53 76 Q60 81 67 76" fill="${cheek}"/>`;
  const sparkle =
    mood === "cheer"
      ? `<g fill="#ffc61a"><path d="M8 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"/><path d="M108 10 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/></g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 124">
    <ellipse cx="44" cy="114" rx="11" ry="6" fill="${ledge}"/>
    <ellipse cx="76" cy="114" rx="11" ry="6" fill="${ledge}"/>
    <g stroke="${ledge}" stroke-width="7" stroke-linecap="round" fill="none">${arms}</g>
    <rect x="16" y="30" width="88" height="80" rx="22" fill="${ledge}"/>
    <rect x="16" y="22" width="88" height="78" rx="22" fill="${main}"/>
    <rect x="27" y="31" width="66" height="58" rx="15" fill="${face}"/>
    <ellipse cx="38" cy="70" rx="6" ry="4" fill="${cheek}" opacity="0.7"/>
    <ellipse cx="82" cy="70" rx="6" ry="4" fill="${cheek}" opacity="0.7"/>
    ${eyes}${mouth}${sparkle}
  </svg>`;
}

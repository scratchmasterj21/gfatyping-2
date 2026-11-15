import { ThemeName } from "@monkeytype/schemas/configs";

import {
  KID_THEME_NAMES,
  Theme,
  themes,
  ThemesList,
} from "../constants/themes";

/**
 * Which themes students may use. Everyone gets the readability check (enough
 * contrast to read the words); a teacher can tighten a class to the kids'
 * themes or one fixed theme (lessonSettings.themes, see lesson-settings.ts).
 * The teacher account is exempt. Pure - no Firebase here.
 */

export type ClassThemeMode = "readable" | "kids" | "locked";
export type ClassThemePolicy = { mode: ClassThemeMode; theme?: ThemeName };

export const DEFAULT_THEME_POLICY: ClassThemePolicy = { mode: "readable" };
export const FALLBACK_THEME: ThemeName = "jungle";

/** typed text (text) and untyped words (sub) against the background */
const MIN_TEXT = 4.5;
const MIN_SUB = 2.2;
const MIN_MAIN = 2;

function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1-21. Bad colours count as unreadable (1). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (!Number.isFinite(la) || !Number.isFinite(lb)) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isReadableTheme(
  t: Pick<Theme, "bg" | "text" | "sub" | "main">,
): boolean {
  return (
    contrast(t.bg, t.text) >= MIN_TEXT &&
    contrast(t.bg, t.sub) >= MIN_SUB &&
    contrast(t.bg, t.main) >= MIN_MAIN
  );
}

export const READABLE_THEME_NAMES: ReadonlySet<ThemeName> = new Set(
  ThemesList.filter((t) => isReadableTheme(t)).map((t) => t.name),
);

/** May a student use this preset? */
export function presetAllowed(
  policy: ClassThemePolicy,
  name: ThemeName,
): boolean {
  if (!READABLE_THEME_NAMES.has(name)) return false;
  if (policy.mode === "kids") return KID_THEME_NAMES.includes(name);
  if (policy.mode === "locked") return name === lockedTheme(policy);
  return true;
}

/** Custom colours: only in "readable" mode, and only if readable. */
export function customAllowed(
  policy: ClassThemePolicy,
  colors: Pick<Theme, "bg" | "text" | "sub" | "main">,
): boolean {
  return policy.mode === "readable" && isReadableTheme(colors);
}

function lockedTheme(policy: ClassThemePolicy): ThemeName {
  return policy.theme !== undefined && READABLE_THEME_NAMES.has(policy.theme)
    ? policy.theme
    : FALLBACK_THEME;
}

/** What to switch a student to. */
export function fallbackTheme(policy: ClassThemePolicy): ThemeName {
  return policy.mode === "locked" ? lockedTheme(policy) : FALLBACK_THEME;
}

export function parseThemePolicy(raw: unknown): ClassThemePolicy | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const r = raw as { mode?: unknown; theme?: unknown };
  if (r.mode !== "kids" && r.mode !== "locked") return undefined;
  const theme =
    typeof r.theme === "string" && r.theme in themes
      ? (r.theme as ThemeName)
      : undefined;
  return theme === undefined ? { mode: r.mode } : { mode: r.mode, theme };
}

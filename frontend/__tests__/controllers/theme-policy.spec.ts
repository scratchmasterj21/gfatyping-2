import { describe, expect, it } from "vitest";

import { KID_THEME_NAMES } from "../../src/ts/constants/themes";
import {
  contrast,
  customAllowed,
  fallbackTheme,
  isReadableTheme,
  parseThemePolicy,
  presetAllowed,
  READABLE_THEME_NAMES,
} from "../../src/ts/controllers/theme-policy";

describe("theme policy", () => {
  it("measures contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#fff", "#fff")).toBe(1);
    expect(contrast("#000000ff", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("keeps the kids' themes, hides low-contrast ones", () => {
    for (const name of KID_THEME_NAMES) {
      expect(READABLE_THEME_NAMES.has(name)).toBe(true);
    }
    expect(READABLE_THEME_NAMES.has("pink_lemonade")).toBe(false);
    expect(READABLE_THEME_NAMES.has("vaporwave")).toBe(false);
  });

  it("applies class modes", () => {
    const readable = { mode: "readable" } as const;
    expect(presetAllowed(readable, "jungle")).toBe(true);
    expect(presetAllowed(readable, "pink_lemonade")).toBe(false);
    expect(presetAllowed({ mode: "kids" }, "candy")).toBe(true);
    expect(presetAllowed({ mode: "kids" }, "8008")).toBe(false);
    const locked = { mode: "locked", theme: "ocean" } as const;
    expect(presetAllowed(locked, "ocean")).toBe(true);
    expect(presetAllowed(locked, "jungle")).toBe(false);
    expect(fallbackTheme(locked)).toBe("ocean");
    expect(fallbackTheme(readable)).toBe("jungle");
    // a locked theme that isn't readable falls back
    expect(fallbackTheme({ mode: "locked", theme: "pink_lemonade" })).toBe(
      "jungle",
    );
  });

  it("checks custom colours", () => {
    const good = {
      bg: "#111111",
      text: "#eeeeee",
      sub: "#888888",
      main: "#ffcc00",
    };
    const bad = {
      bg: "#ffccdd",
      text: "#ffddee",
      sub: "#ffeeee",
      main: "#ffbbcc",
    };
    expect(isReadableTheme(good)).toBe(true);
    expect(customAllowed({ mode: "readable" }, good)).toBe(true);
    expect(customAllowed({ mode: "readable" }, bad)).toBe(false);
    expect(customAllowed({ mode: "kids" }, good)).toBe(false);
  });

  it("parses stored policies", () => {
    expect(parseThemePolicy({ mode: "kids" })).toEqual({ mode: "kids" });
    expect(parseThemePolicy({ mode: "locked", theme: "ocean" })).toEqual({
      mode: "locked",
      theme: "ocean",
    });
    expect(parseThemePolicy({ mode: "locked", theme: "nope" })).toEqual({
      mode: "locked",
    });
    expect(parseThemePolicy({ mode: "weird" })).toBeUndefined();
  });
});

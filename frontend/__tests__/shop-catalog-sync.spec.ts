import { describe, expect, it } from "vitest";

import {
  CATALOGS,
  FREE_KEYBOARD_STYLES,
  ShopId,
  TITLE_ACHIEVEMENTS,
} from "../../api/_lib/catalogs";
import { BACKDROP_ITEMS } from "../src/ts/backdrops/backdrop-items";
import { CARET_EFFECT_ITEMS } from "../src/ts/caret-effects/caret-effect-items";
import { FREE_KEYBOARD_STYLES as CLIENT_FREE_STYLES } from "../src/ts/components/pages/test/guided-keyboard-prefs";
import { HAND_STYLES } from "../src/ts/hands/hand-styles";
import { KEYBOARD_SKIN_ITEMS } from "../src/ts/keyboard-skins/keyboard-skin-items";
import { KEYPRESS_EFFECT_ITEMS } from "../src/ts/keypress-effects/keypress-effect-items";
import { RGB_PALETTE_ITEMS } from "../src/ts/rgb-palettes/rgb-palette-items";
import { TITLES } from "../src/ts/titles/titles";
import { collectibleIds } from "../src/ts/utils/shop-collections";

const SHOPS: [
  ShopId,
  { id: string; price?: number; seasonMonths?: number[] }[],
][] = [
  ["hands", HAND_STYLES],
  ["rgbPalette", RGB_PALETTE_ITEMS],
  ["keyboardSkin", KEYBOARD_SKIN_ITEMS],
  ["keypressEffect", KEYPRESS_EFFECT_ITEMS],
  ["caretEffect", CARET_EFFECT_ITEMS],
  ["backdrop", BACKDROP_ITEMS],
];

describe("shop catalog sync", () => {
  it.each(SHOPS)("%s ids and prices match the server", (shop, items) => {
    const server = CATALOGS[shop];
    expect(Object.keys(server).sort()).toEqual(items.map((i) => i.id).sort());
    for (const item of items) {
      expect(server[item.id]?.price, item.id).toBe(item.price);
      expect(server[item.id]?.seasonal === true, item.id).toBe(
        item.seasonMonths !== undefined,
      );
    }
  });

  it.each(SHOPS)("%s collection has items to collect", (_shop, items) => {
    expect(collectibleIds(items).length).toBeGreaterThan(0);
  });

  it("free keyboard styles match the server", () => {
    expect([...CLIENT_FREE_STYLES].sort()).toEqual(
      [...FREE_KEYBOARD_STYLES].sort(),
    );
  });

  it("titles unlock from the same achievements on both sides", () => {
    expect(
      Object.fromEntries(TITLES.map((t) => [t.id, t.achievement])),
    ).toEqual(TITLE_ACHIEVEMENTS);
  });
});

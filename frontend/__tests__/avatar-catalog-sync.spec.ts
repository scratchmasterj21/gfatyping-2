import { describe, expect, it } from "vitest";

import { CATALOGS } from "../../api/_lib/catalogs";
import {
  AVATAR_ITEMS,
  COLLECTION_CATEGORIES,
  collectionItems,
} from "../src/ts/avatar/avatar-items";

describe("avatar catalog sync", () => {
  it("server catalog matches every frontend avatar item", () => {
    const server = CATALOGS.avatar;
    expect(Object.keys(server).sort()).toEqual(
      AVATAR_ITEMS.map((i) => i.id).sort(),
    );
    for (const item of AVATAR_ITEMS) {
      const s = server[item.id];
      expect(s?.category, item.id).toBe(item.category);
      expect(s?.price, item.id).toBe(item.price);
      expect(s?.requiresAchievement, item.id).toBe(item.requiresAchievement);
      expect(s?.seasonal === true, item.id).toBe(
        item.seasonMonths !== undefined,
      );
    }
  });

  it("hat/hair ids end with their shape so equip-item can check fit", () => {
    for (const item of AVATAR_ITEMS) {
      if (item.category !== "hat" && item.category !== "hair") continue;
      const shape = item.shape ?? "round";
      if (shape === "round") {
        expect(item.id, item.id).not.toMatch(/-(square|oval|hexagon|cloud)$/);
      } else {
        expect(item.id.endsWith(`-${shape}`), item.id).toBe(true);
      }
    }
  });

  it("every collection has items to collect", () => {
    for (const cat of COLLECTION_CATEGORIES) {
      expect(collectionItems(cat).length, cat).toBeGreaterThan(0);
    }
  });
});

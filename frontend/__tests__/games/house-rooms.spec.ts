import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/firebase", () => ({ getDb: () => ({}) }));

import {
  HOUSE_ROOMS,
  isRoomId,
  isRoomUnlocked,
  roomOfItem,
} from "../../src/ts/house/house-rooms";

const room = (id: string) => HOUSE_ROOMS.find((r) => r.id === id)!;

describe("house rooms", () => {
  it("living room is always open, others need their lesson trophy", () => {
    expect(isRoomUnlocked(room("living"), [])).toBe(true);
    expect(isRoomUnlocked(room("bedroom"), [])).toBe(false);
    expect(isRoomUnlocked(room("bedroom"), ["home-row-done"])).toBe(true);
    expect(isRoomUnlocked(room("kitchen"), ["home-row-done"])).toBe(false);
    expect(isRoomUnlocked(room("playroom"), ["all-letters"])).toBe(true);
  });

  it("furniture stays in the living room unless moved", () => {
    expect(roomOfItem({}, "sofa")).toBe("living");
    expect(roomOfItem({ bed: "bedroom" }, "bed")).toBe("bedroom");
  });

  it("validates room ids", () => {
    expect(isRoomId("kitchen")).toBe(true);
    expect(isRoomId("attic")).toBe(false);
  });
});

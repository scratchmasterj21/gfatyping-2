import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/states/modals", () => ({ showModal: vi.fn() }));
vi.mock("../../src/ts/firebase", () => ({
  getDb: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));
vi.mock("../../src/ts/queries", () => ({ queryClient: {} }));

import { homeRowReady } from "../../src/ts/lessons/home-row-check";
import {
  homeRowCheckOn,
  parseLessonSettings,
} from "../../src/ts/lessons/lesson-settings";

describe("home-row check", () => {
  it("needs both F and J held", () => {
    expect(homeRowReady(new Set(["KeyF"]))).toBe(false);
    expect(homeRowReady(new Set(["KeyJ", "KeyK"]))).toBe(false);
    expect(homeRowReady(new Set(["KeyF", "KeyJ"]))).toBe(true);
    expect(homeRowReady(new Set(["KeyA", "KeyF", "KeyJ", "Semicolon"]))).toBe(
      true,
    );
  });
});

describe("home-row check setting", () => {
  const settings = parseLessonSettings({
    homeRowOff: {
      classes: { G1A: true, G2A: "junk" },
      students: { ann: false, ben: true },
    },
  });
  it("is on by default", () => {
    expect(homeRowCheckOn(undefined, "G1A", "x")).toBe(true);
    expect(homeRowCheckOn(settings, "G2A", "x")).toBe(true);
    expect(homeRowCheckOn(settings, undefined, undefined)).toBe(true);
  });
  it("follows the class", () => {
    expect(homeRowCheckOn(settings, "G1A", "x")).toBe(false);
  });
  it("student override beats the class", () => {
    expect(homeRowCheckOn(settings, "G1A", "ann")).toBe(true);
    expect(homeRowCheckOn(settings, "G2A", "ben")).toBe(false);
  });
});

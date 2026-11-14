import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/states/modals", () => ({ showModal: vi.fn() }));

import { homeRowReady } from "../../src/ts/lessons/home-row-check";

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

import { describe, expect, it } from "vitest";

import { turnDamage } from "../src/ts/games/typing-rpg/battle-rules";

describe("Typing Quest turn damage", () => {
  it("grows with every completed word", () => {
    expect(turnDamage(0, 0)).toBe(0);
    expect(turnDamage(1, 1)).toBe(2);
    expect(turnDamage(4, 1)).toBe(8);
  });

  it("rewards a mistake-free turn", () => {
    expect(turnDamage(3, 0)).toBe(8);
    expect(turnDamage(3, 1)).toBe(6);
  });
});

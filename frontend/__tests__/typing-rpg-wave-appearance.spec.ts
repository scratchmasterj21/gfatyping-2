import { describe, expect, it } from "vitest";

import { appearanceForWave } from "../src/ts/games/typing-rpg/wave-appearance";

describe("Typing Quest wave appearance", () => {
  it("changes floor and monster roster each wave", () => {
    const floors = Array.from({ length: 4 }, (_, index) =>
      appearanceForWave(index + 1),
    );
    expect(new Set(floors.map((floor) => floor.name)).size).toBe(4);
    expect(new Set(floors.map((floor) => floor.monsters[0]?.name)).size).toBe(
      4,
    );
    expect(floors[1]?.monsters.map((monster) => monster.kind)).toEqual([
      "slime",
      "imp",
      "guardian",
    ]);
  });

  it("distinguishes deeper cycles without changing monster roles", () => {
    const first = appearanceForWave(1);
    const deeper = appearanceForWave(5);
    expect(deeper.name).not.toBe(first.name);
    expect(deeper.monsters[0]?.name).not.toBe(first.monsters[0]?.name);
    expect(deeper.monsters.map((monster) => monster.kind)).toEqual(
      first.monsters.map((monster) => monster.kind),
    );
  });
});

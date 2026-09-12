import { describe, expect, it } from "vitest";

import { prepareRpgWords } from "../src/ts/games/typing-rpg/rpg-words";

describe("prepareRpgWords", () => {
  it("keeps readable words from the dictionary sample", () => {
    expect(prepareRpgWords(["forest", "river", "Light"])).toEqual([
      "forest",
      "river",
      "light",
    ]);
  });

  it("deduplicates and rejects drills, spaces and punctuation", () => {
    expect(
      prepareRpgWords(["", "jj", "one two", "apple!", "apple", "APPLE"]),
    ).toEqual(["apple"]);
  });

  it("rejects empty combat pools", () => {
    expect(() => prepareRpgWords(["", "jj", "one two"])).toThrow();
  });
});

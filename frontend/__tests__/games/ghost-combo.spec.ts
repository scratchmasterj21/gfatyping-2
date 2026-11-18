import { describe, expect, it } from "vitest";

import { handleKeyWithCombo } from "../../src/ts/games/ghost-hunter/combo-priority";
import { WordMatcher } from "../../src/ts/games/word-defender/systems/word-matcher";

const typeAll = (
  m: WordMatcher,
  text: string,
  combo: string | null,
  words: string[],
): string[] =>
  [...text].map((ch) => {
    const r = handleKeyWithCombo(m, ch, combo, words);
    return r.status === "complete" ? `done:${r.word}` : r.status;
  });

describe("Chain Beam combo phrase", () => {
  it("can be typed even when its first word is a ghost's word", () => {
    const m = new WordMatcher(() => undefined);
    const ghosts = ["kjd", "fff"];
    for (const w of ghosts) m.register(w);
    m.register("kjd jdd");
    const out = typeAll(m, "kjd jdd", "kjd jdd", ghosts);
    expect(out.at(-1)).toBe("done:kjd jdd");
    expect(out).not.toContain("done:kjd");
    // the ghost is still there to catch afterwards
    expect(typeAll(m, "kjd", null, ghosts).at(-1)).toBe("done:kjd");
  });

  it("works when a shorter ghost word is a prefix of the phrase", () => {
    const m = new WordMatcher(() => undefined);
    const ghosts = ["fl", "dad"];
    for (const w of ghosts) m.register(w);
    m.register("flags falls");
    expect(typeAll(m, "flags falls", "flags falls", ghosts).at(-1)).toBe(
      "done:flags falls",
    );
  });

  it("leaves normal typing alone when there's no combo", () => {
    const m = new WordMatcher(() => undefined);
    m.register("kjd");
    expect(typeAll(m, "kjd", null, ["kjd"]).at(-1)).toBe("done:kjd");
  });
});

import { describe, expect, it } from "vitest";

import { WordMatcher } from "../../src/ts/games/word-defender/systems/word-matcher";

describe("WordMatcher", () => {
  it("accepts repeated two-key lesson words indefinitely", () => {
    const matcher = new WordMatcher(() => undefined);

    for (let repetition = 0; repetition < 10; repetition++) {
      matcher.register("jjf");
      expect(matcher.handleKey("j").status).toBe("locked");
      expect(matcher.handleKey("j").status).toBe("locked");
      expect(matcher.handleKey("f")).toEqual({
        status: "complete",
        word: "jjf",
      });
    }
  });

  it("still rejects a wrong key without advancing the buffer", () => {
    const matcher = new WordMatcher(() => undefined);
    matcher.register("jjf");

    expect(matcher.handleKey("j").status).toBe("locked");
    expect(matcher.handleKey("x").status).toBe("miss");
    expect(matcher.getBuffer()).toBe("j");
    expect(matcher.handleKey("j").status).toBe("locked");
    expect(matcher.handleKey("f").status).toBe("complete");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  getWordListOptions,
  plainWords,
} from "../../src/ts/games/word-defender/systems/vocab-pool";

// lessons load word files from /languages (fetch is pinned on import):
// serve them from static/ before anything imports json-data
vi.hoisted(() => {
  // oxlint-disable-next-line typescript/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // oxlint-disable-next-line typescript/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  window.fetch = async (url: RequestInfo | URL): Promise<Response> => {
    const file = new URL(String(url), "http://x").pathname;
    const body = fs.readFileSync(
      path.join(__dirname, "../../static", file),
      "utf8",
    );
    return new Response(body, {
      headers: { "content-type": "application/json" },
    });
  };
});

describe("game word lists", () => {
  it("keeps plain lowercase words only", () => {
    expect(
      plainWords(["Hello,", '"quote"', "(paren)", "don't", "f;f", "ok", "ok"]),
    ).toEqual(["hello", "quote", "paren", "ok"]);
  });

  it("finger drills keep their row keys", () => {
    expect(plainWords(["z/z", "c,", "Hi!", "x.x"], ",./")).toEqual([
      "z/z",
      "c,",
      "hi",
      "x.x",
    ]);
  });

  it("has no punctuation, number or symbol lists", () => {
    const groups = new Set(getWordListOptions().map((o) => o.group));
    for (const g of ["Punctuation", "Numbers", "Symbols", "Capitals & shift"]) {
      expect(groups.has(g)).toBe(false);
    }
  });

  it("every list gives enough plain words", async () => {
    for (const o of getWordListOptions()) {
      const words = await o.getWords();
      const drill = /^(home-pinky|home-all|home-row|bottom-.*)$/.test(o.id);
      const plain = drill ? /^[a-z;,./]+$/ : /^[a-z]+$/;
      expect(
        words.filter((w) => !plain.test(w)),
        o.id,
      ).toEqual([]);
      expect(words.length, o.id).toBeGreaterThan(5);
    }
  });
});

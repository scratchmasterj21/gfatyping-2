import { describe, expect, it } from "vitest";

import {
  kanaAccuracy,
  kanaUnits,
  KanaRunState,
  newKanaRun,
  typeKey,
} from "../../src/ts/lessons/kana-romaji";

function typeAll(words: string[], keys: string): KanaRunState {
  let s = newKanaRun(words);
  for (const k of keys) s = typeKey(s, k);
  return s;
}

const accepts = (word: string, romaji: string): boolean => {
  const s = typeAll([word], romaji);
  return s.finished && s.wrongKana === 0;
};

describe("kana units", () => {
  it("splits combos and small tsu", () => {
    expect(kanaUnits("きゃっと").map((u) => u.kana)).toEqual(["きゃ", "っと"]);
    expect(kanaUnits("がっこう").map((u) => u.kana)).toEqual([
      "が",
      "っこ",
      "う",
    ]);
  });
  it("reads katakana too", () => {
    expect(accepts("カタカナ", "katakana")).toBe(true);
  });
});

describe("romaji spellings", () => {
  it.each([
    ["すし", "sushi"],
    ["すし", "susi"],
    ["つくえ", "tukue"],
    ["ちず", "tizu"],
    ["ふね", "hune"],
    ["じしょ", "zisyo"],
    ["じゃま", "jama"],
    ["じゃま", "jyama"],
    ["きゃく", "kixyaku"],
    ["がっこう", "gakkou"],
    ["がっこう", "gaxtukou"],
    ["まっちゃ", "matcha"],
    ["まっちゃ", "maccha"],
    ["ほっきょくせい", "hokkyokusei"],
    ["おべんとうばこ", "obentoubako"],
    ["おべんとうばこ", "obenntoubako"],
    ["きんようび", "kinnyoubi"],
    ["ほんや", "honnya"],
    ["げんいん", "genninn"],
    ["ぎゅうにゅう", "gyuunyuu"],
    ["ふぉんと", "fonto"],
    ["うぇぶ", "webu"],
    ["ちょうし", "tyousi"],
  ])("%s ← %s", (word, romaji) => {
    expect(accepts(word, romaji)).toBe(true);
  });

  it("needs nn before a vowel or y", () => {
    // "kinyoubi" would read as き にょ う び, so ん isn't typed
    const s = typeAll(["きんようび"], "kinyoubi");
    expect(s.wrongKana).toBeGreaterThan(0);
  });

  it("ignores the extra n after a word-final ん", () => {
    const s = typeAll(["ほん", "いぬ"], "honninu");
    expect(s.finished).toBe(true);
    expect(s.wrongKana).toBe(0);
  });
});

describe("mistakes (contest style: fix it before moving on)", () => {
  it("a wrong key counts as a mistake and stays on the same kana", () => {
    let s = newKanaRun(["さくら"]);
    s = typeKey(s, "x"); // wrong for さ
    expect(s.wrongKana).toBe(1);
    expect(s.unitIndex).toBe(0);
    expect(s.states[0]).toEqual(["wrong", "todo", "todo"]);
    for (const k of "sakura") s = typeKey(s, k);
    expect(s.finished).toBe(true);
    expect(s.correctKana).toBe(3);
    // fixed, so it's back to normal - but the mistake still counts
    expect(s.states[0]).toEqual(["correct", "correct", "correct"]);
    expect(s.wrongKana).toBe(1);
    expect(Math.round(kanaAccuracy(s))).toBe(75);
  });

  it("a typo in the middle of shi waits for the right key", () => {
    const s = typeAll(["しか"], "shxika");
    expect(s.wrongKana).toBe(1);
    expect(s.correctKana).toBe(2);
    expect(s.finished).toBe(true);
  });

  it("counts combos and small tsu as 2 kana", () => {
    const s = typeAll(["きょう", "きって"], "kyoukitte");
    expect(s.correctKana).toBe(6);
  });
});

describe("space between words", () => {
  const run = (keys: string): KanaRunState => {
    let s = newKanaRun(["いぬ", "ねこ"], { requireSpace: true });
    for (const k of keys) s = typeKey(s, k);
    return s;
  };

  it("waits for space after a finished word", () => {
    const s = run("inu");
    expect(s.awaitingSpace).toBe(true);
    expect(s.wordIndex).toBe(0);
    const next = typeKey(s, " ");
    expect(next.wordIndex).toBe(1);
    expect(next.awaitingSpace).toBe(false);
  });

  it("typing on without space is a mistake", () => {
    const s = run("inune");
    expect(s.wordIndex).toBe(0);
    expect(s.wrongKana).toBe(2);
  });

  it("space in the middle of a word is a mistake and doesn't move on", () => {
    const s = run("i ");
    expect(s.wordIndex).toBe(0);
    expect(s.unitIndex).toBe(1);
    expect(s.wrongKana).toBe(1);
  });

  it("the last word finishes without space", () => {
    const s = run("inu neko");
    expect(s.finished).toBe(true);
    expect(s.wrongKana).toBe(0);
  });

  it("the extra n after a word-final ん is fine before the space", () => {
    let s = newKanaRun(["ほん", "いぬ"], { requireSpace: true });
    for (const k of "honn inu") s = typeKey(s, k);
    expect(s.finished).toBe(true);
    expect(s.wrongKana).toBe(0);
  });
});

describe("matching one of several words", () => {
  it("tracks progress and completion", async () => {
    const { kanaPrefixMatch, romajiFor } =
      await import("../../src/ts/lessons/kana-romaji");
    expect(kanaPrefixMatch("いぬ", "i")).toEqual({
      ok: true,
      done: false,
      kanaDone: 1,
    });
    expect(kanaPrefixMatch("いぬ", "inu").done).toBe(true);
    expect(kanaPrefixMatch("ねこ", "i").ok).toBe(false);
    expect(romajiFor("しんぶん")).toBe("shinbun");
    expect(kanaPrefixMatch("しんぶん", romajiFor("しんぶん")).done).toBe(true);
  });
});

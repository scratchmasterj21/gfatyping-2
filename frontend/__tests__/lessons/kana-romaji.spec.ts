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

describe("mistakes", () => {
  it("a wrong key marks the kana wrong and moves on", () => {
    let s = newKanaRun(["さくら"]);
    s = typeKey(s, "x"); // wrong for さ
    expect(s.states[0]).toEqual(["wrong", "todo", "todo"]);
    expect(s.unitIndex).toBe(1);
    for (const k of "kura") s = typeKey(s, k);
    expect(s.finished).toBe(true);
    expect(s.correctKana).toBe(2);
    expect(s.wrongKana).toBe(1);
    expect(Math.round(kanaAccuracy(s))).toBe(67);
  });

  it("one typo is one mistake, even if the student finishes the kana", () => {
    // "te" + typo "x" + finishes "ku" anyway + "bi"
    const s = typeAll(["てくび", "ふくろ"], "texkubifukuro");
    expect(s.finished).toBe(true);
    expect(s.wrongKana).toBe(1);
    expect(s.states[0]).toEqual(["correct", "wrong", "correct"]);
  });

  it("a typo in the middle of shi is ignored once shi is finished", () => {
    const s = typeAll(["しか"], "shxika");
    expect(s.wrongKana).toBe(1);
    expect(s.correctKana).toBe(1);
    expect(s.finished).toBe(true);
  });

  it("counts combos and small tsu as 2 kana", () => {
    const s = typeAll(["きょう", "きって"], "kyoukitte");
    expect(s.correctKana).toBe(6);
  });

  it("moves to the next word without typing a space", () => {
    let s = newKanaRun(["いぬ", "ねこ"]);
    for (const k of "inu") s = typeKey(s, k);
    expect(s.wordIndex).toBe(1);
    s = typeKey(s, " ");
    expect(s.wordIndex).toBe(1);
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

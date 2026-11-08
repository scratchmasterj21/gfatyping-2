/**
 * Hiragana on screen, romaji from the keyboard (like the Maipaso romaji
 * contest). Every common spelling is accepted: shi/si, chi/ti, tsu/tu,
 * fu/hu, ji/zi, ja/jya/zya, nn/n'/n before a consonant, doubled consonants
 * for small っ (kitte, matcha/macha), and kya or ki+xya for combos.
 *
 * A wrong key marks the current kana as a mistake and moves on to the next
 * kana (the teacher's choice). Pure - the screen just renders the state.
 */

const BASE: Record<string, string[]> = {
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu", "whu"],
  え: ["e"],
  お: ["o"],
  か: ["ka", "ca"],
  き: ["ki"],
  く: ["ku", "cu", "qu"],
  け: ["ke"],
  こ: ["ko", "co"],
  さ: ["sa"],
  し: ["shi", "si", "ci"],
  す: ["su"],
  せ: ["se", "ce"],
  そ: ["so"],
  た: ["ta"],
  ち: ["chi", "ti"],
  つ: ["tsu", "tu"],
  て: ["te"],
  と: ["to"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  ゐ: ["wi"],
  ゑ: ["we"],
  を: ["wo"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["ji", "zi"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  ゔ: ["vu"],
  ぁ: ["xa", "la"],
  ぃ: ["xi", "li"],
  ぅ: ["xu", "lu"],
  ぇ: ["xe", "le"],
  ぉ: ["xo", "lo"],
  ゃ: ["xya", "lya"],
  ゅ: ["xyu", "lyu"],
  ょ: ["xyo", "lyo"],
  ゎ: ["xwa", "lwa"],
  っ: ["xtu", "ltu", "xtsu", "ltsu"],
  ー: ["-"],
  "、": [","],
  "。": ["."],
};

/** Two-kana combos with their own spellings (the split spelling also works). */
const COMBOS: Record<string, string[]> = {
  きゃ: ["kya"],
  きゅ: ["kyu"],
  きょ: ["kyo"],
  ぎゃ: ["gya"],
  ぎゅ: ["gyu"],
  ぎょ: ["gyo"],
  しゃ: ["sha", "sya"],
  しゅ: ["shu", "syu"],
  しぇ: ["she", "sye"],
  しょ: ["sho", "syo"],
  じゃ: ["ja", "jya", "zya"],
  じゅ: ["ju", "jyu", "zyu"],
  じぇ: ["je", "jye", "zye"],
  じょ: ["jo", "jyo", "zyo"],
  ちゃ: ["cha", "tya", "cya"],
  ちゅ: ["chu", "tyu", "cyu"],
  ちぇ: ["che", "tye", "cye"],
  ちょ: ["cho", "tyo", "cyo"],
  ぢゃ: ["dya"],
  ぢゅ: ["dyu"],
  ぢょ: ["dyo"],
  にゃ: ["nya"],
  にゅ: ["nyu"],
  にょ: ["nyo"],
  ひゃ: ["hya"],
  ひゅ: ["hyu"],
  ひょ: ["hyo"],
  びゃ: ["bya"],
  びゅ: ["byu"],
  びょ: ["byo"],
  ぴゃ: ["pya"],
  ぴゅ: ["pyu"],
  ぴょ: ["pyo"],
  みゃ: ["mya"],
  みゅ: ["myu"],
  みょ: ["myo"],
  りゃ: ["rya"],
  りゅ: ["ryu"],
  りょ: ["ryo"],
  ふぁ: ["fa"],
  ふぃ: ["fi"],
  ふぇ: ["fe"],
  ふぉ: ["fo"],
  てぃ: ["thi"],
  でぃ: ["dhi"],
  うぃ: ["wi"],
  うぇ: ["we"],
  うぉ: ["who"],
  ゔぁ: ["va"],
  ゔぃ: ["vi"],
  ゔぇ: ["ve"],
  ゔぉ: ["vo"],
  つぁ: ["tsa"],
};

const N_SPELLINGS = ["nn", "xn", "n'"];

export type KanaUnit = {
  /** the kana shown (1-3 characters) */
  kana: string;
  /** accepted romaji, the first is the hint */
  spellings: string[];
};

/** Katakana -> hiragana, so either script works. */
export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

function product(a: string[], b: string[]): string[] {
  return a.flatMap((x) => b.map((y) => x + y));
}

function plainUnit(text: string, i: number): KanaUnit | undefined {
  const pair = text.slice(i, i + 2);
  const combo = COMBOS[pair];
  if (combo !== undefined && pair.length === 2) {
    const split = product(
      BASE[pair[0] as string] ?? [],
      BASE[pair[1] as string] ?? [],
    );
    return { kana: pair, spellings: [...combo, ...split] };
  }
  const ch = text[i] as string;
  const base = BASE[ch];
  if (base !== undefined) return { kana: ch, spellings: base };
  return undefined;
}

const VOWEL_LIKE = /^[aiueoyn]/;

/** Split a hiragana word into typeable units. Unknown characters are skipped. */
export function kanaUnits(word: string): KanaUnit[] {
  const text = toHiragana(word);
  const units: KanaUnit[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === "ん") {
      units.push({ kana: "ん", spellings: [...N_SPELLINGS] });
      i += 1;
      continue;
    }
    if (ch === "っ") {
      const next = plainUnit(text, i + 1);
      const first = next?.spellings[0]?.[0];
      if (
        next !== undefined &&
        first !== undefined &&
        !VOWEL_LIKE.test(first)
      ) {
        const doubled = new Set<string>();
        for (const s of next.spellings) {
          const c = s[0] as string;
          if (!VOWEL_LIKE.test(c)) doubled.add(c + s);
          if (s.startsWith("ch")) doubled.add(`t${s}`);
        }
        const spelled = product(BASE["っ"] ?? [], next.spellings);
        units.push({
          kana: `っ${next.kana}`,
          spellings: [...doubled, ...spelled],
        });
        i += 1 + next.kana.length;
        continue;
      }
    }
    const unit = plainUnit(text, i);
    if (unit !== undefined) {
      units.push(unit);
      i += unit.kana.length;
    } else {
      i += 1;
    }
  }
  // ん: a single "n" is fine before a consonant or at the end of the word
  for (let u = 0; u < units.length; u++) {
    const unit = units[u] as KanaUnit;
    if (unit.kana !== "ん") continue;
    const next = units[u + 1];
    const nextStartsSoft =
      next?.spellings.some((s) => VOWEL_LIKE.test(s)) === true;
    if (!nextStartsSoft) unit.spellings = ["n", ...N_SPELLINGS];
  }
  return units;
}

/** Romaji hint for a unit (the most common spelling). */
export function hintFor(unit: KanaUnit): string {
  return unit.spellings[0] ?? "";
}

export type UnitState = "todo" | "correct" | "wrong";

export type KanaRunState = {
  words: KanaUnit[][];
  /** per word, per unit */
  states: UnitState[][];
  wordIndex: number;
  unitIndex: number;
  /** romaji typed so far for the current unit */
  buffer: string;
  /** kana typed correctly / missed (combos count as 2, っか as 2) */
  correctKana: number;
  wrongKana: number;
  /** correct romaji keystrokes (for words per minute) */
  correctKeys: number;
  finished: boolean;
  /** last unit was ん typed as a single "n": one extra n or ' is ignored */
  softN: boolean;
  /**
   * The kana just skipped by a wrong key, and what was typed of it. The
   * student usually finishes typing it anyway - those keys are ignored, so
   * one typo counts as one mistake instead of a chain of them.
   */
  skipped?: { spellings: string[]; buffer: string };
};

export function newKanaRun(words: string[]): KanaRunState {
  const units = words.map(kanaUnits).filter((w) => w.length > 0);
  return {
    words: units,
    states: units.map((w) => w.map((): UnitState => "todo")),
    wordIndex: 0,
    unitIndex: 0,
    buffer: "",
    correctKana: 0,
    wrongKana: 0,
    correctKeys: 0,
    finished: units.length === 0,
    softN: false,
  };
}

export function currentUnit(s: KanaRunState): KanaUnit | undefined {
  return s.words[s.wordIndex]?.[s.unitIndex];
}

function advance(s: KanaRunState, result: UnitState): KanaRunState {
  const states = s.states.map((w, i) =>
    i === s.wordIndex ? w.map((st, j) => (j === s.unitIndex ? result : st)) : w,
  );
  const unit = currentUnit(s);
  const size = unit?.kana.length ?? 1;
  let wordIndex = s.wordIndex;
  let unitIndex = s.unitIndex + 1;
  if (unitIndex >= (s.words[wordIndex]?.length ?? 0)) {
    wordIndex += 1;
    unitIndex = 0;
  }
  return {
    ...s,
    states,
    wordIndex,
    unitIndex,
    buffer: "",
    correctKana: s.correctKana + (result === "correct" ? size : 0),
    wrongKana: s.wrongKana + (result === "wrong" ? size : 0),
    finished: wordIndex >= s.words.length,
  };
}

/** One key from the keyboard. */
export function typeKey(s: KanaRunState, rawKey: string): KanaRunState {
  if (s.finished) return s;
  const key = rawKey.toLowerCase();
  if (key.length !== 1 || key === " ") return s;
  const unit = currentUnit(s);
  if (unit === undefined) return s;

  if (s.softN && s.buffer === "" && (key === "n" || key === "'")) {
    const startsN = unit.spellings.some((sp) => sp.startsWith(key));
    if (!startsN) return { ...s, softN: false };
  }

  const next = s.buffer + key;
  if (!unit.spellings.some((sp) => sp.startsWith(next))) {
    // still finishing the kana that was skipped? ignore those keys
    const sk = s.skipped;
    if (sk !== undefined && s.buffer === "") {
      const rest = sk.buffer + key;
      if (sk.spellings.some((sp) => sp.startsWith(rest))) {
        const done = sk.spellings.includes(rest);
        const { skipped: _drop, ...without } = s;
        void _drop;
        return done ? without : { ...s, skipped: { ...sk, buffer: rest } };
      }
    }
    const { skipped: _old, ...base } = s;
    void _old;
    return {
      ...advance(base, "wrong"),
      softN: false,
      skipped: { spellings: unit.spellings, buffer: s.buffer },
    };
  }
  const { skipped: _clear, ...clean } = s;
  void _clear;
  const typed = { ...clean, buffer: next, correctKeys: s.correctKeys + 1 };
  if (unit.spellings.includes(next)) {
    return {
      ...advance(typed, "correct"),
      softN: unit.kana === "ん" && next === "n",
    };
  }
  return { ...typed, softN: false };
}

/** Words per minute on romaji keystrokes (5 keys = 1 word), like the lessons. */
export function kanaWpm(s: KanaRunState, seconds: number): number {
  if (seconds <= 0) return 0;
  return s.correctKeys / 5 / (seconds / 60);
}

export function kanaAccuracy(s: KanaRunState): number {
  const total = s.correctKana + s.wrongKana;
  return total === 0 ? 0 : (s.correctKana / total) * 100;
}

/**
 * How far `typed` romaji gets into `word` with no mistakes. Used by games
 * where several words are on screen and the student types any one of them.
 */
export function kanaPrefixMatch(
  word: string,
  typed: string,
): { ok: boolean; done: boolean; kanaDone: number } {
  let s = newKanaRun([word]);
  for (const ch of typed) {
    s = typeKey(s, ch);
    if (s.wrongKana > 0) return { ok: false, done: false, kanaDone: 0 };
  }
  return { ok: true, done: s.finished, kanaDone: s.correctKana };
}

/** Romaji for a whole word using the most common spellings (bots, hints). */
export function romajiFor(word: string): string {
  return kanaUnits(word)
    .map((u) => hintFor(u))
    .join("");
}

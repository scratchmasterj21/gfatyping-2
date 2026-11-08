import { getLanguage } from "../utils/json-data";
import { LessonGroup } from "./lessons-data";

/**
 * Japanese lessons: hiragana on screen, romaji from the keyboard (like the
 * Maipaso romaji contest). They run on the hiragana screen
 * (KanaPracticeModal), not the typing test - see isKanaLesson().
 */

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * `count` practice "words", each `min`..`max` random kana from the set
 * (e.g. ["か","き"] -> "かき", "き", "きか").
 */
function kanaDrill(
  kana: string[],
  { count, min, max }: { count: number; min: number; max: number },
): string[] {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = randInt(min, max);
    let word = "";
    for (let j = 0; j < len; j++) {
      word += kana[randInt(0, kana.length - 1)] as string;
    }
    words.push(word);
  }
  return words;
}

const VOWELS = ["あ", "い", "う", "え", "お"];
const K_ROW = ["か", "き", "く", "け", "こ"];
const S_ROW = ["さ", "し", "す", "せ", "そ"];
const T_ROW = ["た", "ち", "つ", "て", "と"];
const N_ROW = ["な", "に", "ぬ", "ね", "の"];
const H_ROW = ["は", "ひ", "ふ", "へ", "ほ"];
const M_ROW = ["ま", "み", "む", "め", "も"];
const Y_ROW = ["や", "ゆ", "よ"];
const R_ROW = ["ら", "り", "る", "れ", "ろ"];
const W_N = ["わ", "を", "ん"];
const VOICED = [
  "が",
  "ぎ",
  "ぐ",
  "げ",
  "ご",
  "ざ",
  "じ",
  "ず",
  "ぜ",
  "ぞ",
  "だ",
  "で",
  "ど",
  "ば",
  "び",
  "ぶ",
  "べ",
  "ぼ",
  "ぱ",
  "ぴ",
  "ぷ",
  "ぺ",
  "ぽ",
];
const COMBOS = [
  "きゃ",
  "きゅ",
  "きょ",
  "しゃ",
  "しゅ",
  "しょ",
  "ちゃ",
  "ちゅ",
  "ちょ",
  "にゃ",
  "にゅ",
  "にょ",
  "りゃ",
  "りゅ",
  "りょ",
  "じゃ",
  "じゅ",
  "じょ",
];
const SMALL_TSU = [
  "がっこう",
  "きって",
  "ざっし",
  "まっすぐ",
  "いっぱい",
  "きっぷ",
  "せっけん",
  "はっぱ",
  "ねっこ",
  "らっぱ",
  "こっぷ",
  "まっちゃ",
  "しっぽ",
  "みっつ",
  "よっつ",
  "やっつ",
  "ろっく",
  "さっか",
  "けっか",
  "がっき",
];

/** Words that aren't right for children, and grammar bits that aren't words. */
const SKIP_WORDS = new Set([
  "しぬ",
  "なぐる",
  "げり",
  "しり",
  "ける",
  "きも",
  "おれ",
  "そうだ",
  "だろう",
  "および",
  "かも",
  "それとも",
  "だの",
  "つつ",
  "ながら",
  "ならびに",
  "なり",
  "ので",
  "または",
  "かしら",
  "こそ",
  "さえ",
  "すら",
  "くらい",
  "ぐらい",
  "だけ",
  "だって",
  "どころ",
  "など",
  "なら",
  "なんか",
  "なんて",
  "ばかり",
  "ばっかり",
  "ます",
  "たい",
  "せる",
  "れる",
  "ない",
  "から",
  "より",
  "しか",
  "でも",
  "まで",
  "それに",
  "なぜなら",
  "しかし",
  "そして",
]);

/** The hiragana word list, child-friendly, 2+ kana. */
export async function hiraganaWords(
  filter: (word: string) => boolean = () => true,
): Promise<string[]> {
  const data = await getLanguage("japanese_hiragana");
  const words = data.words.filter(
    (w) =>
      w.length >= 2 &&
      !w.startsWith("っ") &&
      !SKIP_WORDS.has(w) &&
      /^[ぁ-ゟ]+$/.test(w) &&
      filter(w),
  );
  return shuffle([...new Set(words)]);
}

async function wordLesson(
  count: number,
  filter?: (word: string) => boolean,
): Promise<string[]> {
  const words = await hiraganaWords(filter);
  const out = words.slice(0, count);
  while (out.length > 0 && out.length < count) {
    out.push(...out.slice(0, count - out.length));
  }
  return out;
}

/** Words for the 60-second Maipaso-style practice (plenty, so they never run out). */
export async function contestWords(): Promise<string[]> {
  const words = await hiraganaWords((w) => w.length <= 7);
  return [...words, ...shuffle(words)].slice(0, 300);
}

export const japaneseLessonGroups: LessonGroup[] = [
  {
    id: "jp-hiragana-1",
    name: "Hiragana 1",
    icon: "fa-language",
    description: "Vowels and the か / さ rows",
    lessons: [
      {
        id: "jp-vowels",
        name: "Vowels (あいうえお)",
        generate: () => kanaDrill(VOWELS, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-k-row",
        name: "か row (かきくけこ)",
        generate: () => kanaDrill(K_ROW, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-s-row",
        name: "さ row (さしすせそ)",
        generate: () => kanaDrill(S_ROW, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-aks",
        name: "Mix: あ + か + さ",
        generate: () =>
          kanaDrill([...VOWELS, ...K_ROW, ...S_ROW], {
            count: 22,
            min: 2,
            max: 3,
          }),
      },
    ],
  },
  {
    id: "jp-hiragana-2",
    name: "Hiragana 2",
    icon: "fa-language",
    description: "The た / な / は / ま rows",
    lessons: [
      {
        id: "jp-t-row",
        name: "た row (たちつてと)",
        generate: () => kanaDrill(T_ROW, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-n-row",
        name: "な row (なにぬねの)",
        generate: () => kanaDrill(N_ROW, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-h-row",
        name: "は row (はひふへほ)",
        generate: () => kanaDrill(H_ROW, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-m-row",
        name: "ま row (まみむめも)",
        generate: () => kanaDrill(M_ROW, { count: 20, min: 2, max: 3 }),
      },
      {
        id: "jp-tnhm",
        name: "Mix: た + な + は + ま",
        generate: () =>
          kanaDrill([...T_ROW, ...N_ROW, ...H_ROW, ...M_ROW], {
            count: 24,
            min: 2,
            max: 3,
          }),
      },
    ],
  },
  {
    id: "jp-hiragana-3",
    name: "Hiragana 3",
    icon: "fa-language",
    description: "や / ら / わ rows, ん, dakuten, combos and small っ",
    lessons: [
      {
        id: "jp-yrw",
        name: "や / ら / わ rows and ん",
        generate: () =>
          kanaDrill([...Y_ROW, ...R_ROW, ...W_N], {
            count: 22,
            min: 2,
            max: 3,
          }),
      },
      {
        id: "jp-voiced",
        name: "Dakuten (が ざ だ ば ぱ)",
        generate: () => kanaDrill(VOICED, { count: 22, min: 2, max: 3 }),
      },
      {
        id: "jp-yoon",
        name: "Combos (きゃ しゅ ちょ)",
        generate: () => kanaDrill(COMBOS, { count: 20, min: 1, max: 2 }),
      },
      {
        id: "jp-small-tsu",
        name: "Small っ (がっこう)",
        generate: () => shuffle(SMALL_TSU),
      },
      {
        id: "jp-all-sounds",
        name: "All sounds mix",
        generate: () =>
          kanaDrill(
            [
              ...VOWELS,
              ...K_ROW,
              ...S_ROW,
              ...T_ROW,
              ...N_ROW,
              ...H_ROW,
              ...M_ROW,
              ...Y_ROW,
              ...R_ROW,
              ...W_N,
              ...VOICED,
            ],
            { count: 26, min: 2, max: 3 },
          ),
      },
    ],
  },
  {
    id: "jp-words",
    name: "Japanese words",
    icon: "fa-book",
    description: "Real words in hiragana - like the Maipaso contest",
    lessons: [
      {
        id: "jp-words-1",
        name: "Short words",
        generate: async () => wordLesson(25, (w) => w.length <= 3),
      },
      {
        id: "jp-words-2",
        name: "Longer words",
        generate: async () => wordLesson(25, (w) => w.length >= 4),
      },
      {
        id: "jp-words-3",
        name: "Mixed words",
        generate: async () => wordLesson(30),
      },
    ],
  },
];

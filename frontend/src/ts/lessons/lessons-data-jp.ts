import { LessonGroup, realWords } from "./lessons-data";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Build `count` romaji tokens, each made of `min`..`max` random syllables from
 * the given set (e.g. ["ka","ki"] -> "kaki", "ki", "kika"). Practices typing
 * romaji syllables in flowing combinations rather than in isolation.
 */
function syllableDrill(
  syllables: string[],
  { count, min, max }: { count: number; min: number; max: number },
): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = randInt(min, max);
    let token = "";
    for (let j = 0; j < len; j++) {
      token += syllables[randInt(0, syllables.length - 1)] as string;
    }
    tokens.push(token);
  }
  return tokens;
}

const VOWELS = ["a", "i", "u", "e", "o"];
const K_ROW = ["ka", "ki", "ku", "ke", "ko"];
const S_ROW = ["sa", "shi", "su", "se", "so"];
const T_ROW = ["ta", "chi", "tsu", "te", "to"];
const N_ROW = ["na", "ni", "nu", "ne", "no"];
const H_ROW = ["ha", "hi", "fu", "he", "ho"];
const M_ROW = ["ma", "mi", "mu", "me", "mo"];
const Y_ROW = ["ya", "yu", "yo"];
const R_ROW = ["ra", "ri", "ru", "re", "ro"];
const W_N = ["wa", "wo", "n"];
const VOICED = [
  "ga",
  "gi",
  "gu",
  "ge",
  "go",
  "za",
  "ji",
  "zu",
  "ze",
  "zo",
  "da",
  "de",
  "do",
  "ba",
  "bi",
  "bu",
  "be",
  "bo",
  "pa",
  "pi",
  "pu",
  "pe",
  "po",
];
const YOON = [
  "kya",
  "kyu",
  "kyo",
  "sha",
  "shu",
  "sho",
  "cha",
  "chu",
  "cho",
  "nya",
  "nyu",
  "nyo",
  "rya",
  "ryu",
  "ryo",
];

export const japaneseLessonGroups: LessonGroup[] = [
  {
    id: "jp-hiragana-1",
    name: "Hiragana sounds 1",
    icon: "fa-language",
    description: "Vowels and the k / s rows in romaji",
    lessons: [
      {
        id: "jp-vowels",
        name: "Vowels (a i u e o)",
        generate: () => syllableDrill(VOWELS, { count: 30, min: 2, max: 4 }),
      },
      {
        id: "jp-k-row",
        name: "K row (ka ki ku ke ko)",
        generate: () => syllableDrill(K_ROW, { count: 28, min: 2, max: 3 }),
      },
      {
        id: "jp-s-row",
        name: "S row (sa shi su se so)",
        generate: () => syllableDrill(S_ROW, { count: 28, min: 2, max: 3 }),
      },
      {
        id: "jp-aks",
        name: "Mix: vowels + k + s",
        generate: () =>
          syllableDrill([...VOWELS, ...K_ROW, ...S_ROW], {
            count: 32,
            min: 2,
            max: 3,
          }),
      },
    ],
  },
  {
    id: "jp-hiragana-2",
    name: "Hiragana sounds 2",
    icon: "fa-language",
    description: "The t / n / h / m rows in romaji",
    lessons: [
      {
        id: "jp-t-row",
        name: "T row (ta chi tsu te to)",
        generate: () => syllableDrill(T_ROW, { count: 28, min: 2, max: 3 }),
      },
      {
        id: "jp-n-row",
        name: "N row (na ni nu ne no)",
        generate: () => syllableDrill(N_ROW, { count: 28, min: 2, max: 3 }),
      },
      {
        id: "jp-h-row",
        name: "H row (ha hi fu he ho)",
        generate: () => syllableDrill(H_ROW, { count: 28, min: 2, max: 3 }),
      },
      {
        id: "jp-m-row",
        name: "M row (ma mi mu me mo)",
        generate: () => syllableDrill(M_ROW, { count: 28, min: 2, max: 3 }),
      },
      {
        id: "jp-tnhm",
        name: "Mix: t + n + h + m",
        generate: () =>
          syllableDrill([...T_ROW, ...N_ROW, ...H_ROW, ...M_ROW], {
            count: 34,
            min: 2,
            max: 3,
          }),
      },
    ],
  },
  {
    id: "jp-hiragana-3",
    name: "Hiragana sounds 3",
    icon: "fa-language",
    description: "y / r / w-n rows, voiced sounds, and combos",
    lessons: [
      {
        id: "jp-yrw",
        name: "Y / R / W-N rows",
        generate: () =>
          syllableDrill([...Y_ROW, ...R_ROW, ...W_N], {
            count: 30,
            min: 2,
            max: 3,
          }),
      },
      {
        id: "jp-voiced",
        name: "Voiced (ga za da ba pa)",
        generate: () => syllableDrill(VOICED, { count: 32, min: 2, max: 3 }),
      },
      {
        id: "jp-yoon",
        name: "Combos (kya shu cho)",
        generate: () => syllableDrill(YOON, { count: 28, min: 1, max: 2 }),
      },
      {
        id: "jp-all-sounds",
        name: "All sounds mix",
        generate: () =>
          syllableDrill(
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
            ],
            { count: 36, min: 2, max: 3 },
          ),
      },
    ],
  },
  {
    id: "jp-words",
    name: "Japanese words",
    icon: "fa-book",
    description: "Real Japanese words written in romaji",
    lessons: [
      {
        id: "jp-words-1",
        name: "Common words",
        generate: async () => realWords("japanese_romaji", 40),
      },
      {
        id: "jp-words-2",
        name: "Expanded 1k",
        generate: async () => realWords("japanese_romaji_1k", 45),
      },
    ],
  },
];

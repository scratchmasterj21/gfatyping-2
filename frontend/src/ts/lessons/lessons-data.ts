import { Language } from "@monkeytype/schemas/languages";
import { QuoteData } from "@monkeytype/schemas/quotes";
import { getSnapshot } from "../states/snapshot";
import { FaSolidIcon } from "../types/font-awesome";
import { cachedFetchJson, getLanguage } from "../utils/json-data";

export type Lesson = {
  /** stable identifier, also used as the Firestore progress key */
  id: string;
  name: string;
  /** produces the drill tokens (each token is one "word" in the test) */
  generate: () => string[] | Promise<string[]>;
  /**
   * When true the tokens must be typed in the order produced (staged
   * muscle-memory ramp). When false/undefined the launcher may shuffle them.
   */
  preserveOrder?: boolean;
  /**
   * The new keys this lesson introduces (e.g. "fj"). When set, a pre-lesson
   * intro can show these keys and which finger presses each. Omitted for
   * lessons with no specific new keys (assignments, word lists, Japanese).
   */
  newKeys?: string;
};

export type LessonGroup = {
  id: string;
  name: string;
  /** FontAwesome icon class, e.g. "fa-keyboard" */
  icon: FaSolidIcon;
  description: string;
  lessons: Lesson[];
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(chars: string): string {
  return chars[randInt(0, chars.length - 1)] as string;
}

/** Build `count` random tokens, each of random length within [min, max], from `chars`. */
function drill(
  chars: string,
  { count, min, max }: { count: number; min: number; max: number },
): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    const len = randInt(min, max);
    let token = "";
    for (let j = 0; j < len; j++) token += pick(chars);
    tokens.push(token);
  }
  return tokens;
}

/** Shuffle a copy of the array (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/**
 * Pull `count` real words from a language word list, optionally filtered by a
 * predicate, lowercased and deduped.
 */
export async function realWords(
  language: Language,
  count: number,
  filter?: (word: string) => boolean,
): Promise<string[]> {
  const data = await getLanguage(language);
  let words = data.words
    .map((w) => w.toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w));
  if (filter !== undefined) words = words.filter(filter);
  words = [...new Set(words)];
  const shuffled = shuffle(words).slice(0, count);
  // ensure the test is long enough even if the filtered pool is tiny
  while (shuffled.length > 0 && shuffled.length < count) {
    shuffled.push(...shuffled.slice(0, count - shuffled.length));
  }
  return shuffled;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The student's grade (1-6) parsed from their class id (e.g. "G1A" -> 1).
 * Returns undefined for teachers / unassigned users so they get medium defaults.
 */
export function getStudentGrade(): number | undefined {
  const classId = getSnapshot()?.classId;
  if (classId === undefined) return undefined;
  const m = /^G(\d)/i.exec(classId);
  if (m === null) return undefined;
  const grade = Number(m[1]);
  return grade >= 1 && grade <= 6 ? grade : undefined;
}

type Difficulty = {
  /** characters per rhythm-rep token (e.g. 3 -> "fff") */
  repLen: number;
  /** rep tokens generated per new key */
  repsPerKey: number;
  bigramCount: number;
  ladderCount: number;
  wordCount: number;
  maxWordLen: number;
  /** hard cap on total tokens so young kids get short drills */
  totalCap: number;
};

// Younger grades: more rhythm/reps, shorter & fewer real words, shorter drills.
// Older grades: fewer reps, longer and more word-heavy. undefined -> medium.
const DIFFICULTY_BY_GRADE: Record<number, Difficulty> = {
  1: {
    repLen: 3,
    repsPerKey: 4,
    bigramCount: 6,
    ladderCount: 4,
    wordCount: 6,
    maxWordLen: 3,
    totalCap: 24,
  },
  2: {
    repLen: 3,
    repsPerKey: 3,
    bigramCount: 6,
    ladderCount: 4,
    wordCount: 9,
    maxWordLen: 4,
    totalCap: 28,
  },
  3: {
    repLen: 3,
    repsPerKey: 3,
    bigramCount: 5,
    ladderCount: 4,
    wordCount: 12,
    maxWordLen: 5,
    totalCap: 32,
  },
  4: {
    repLen: 2,
    repsPerKey: 2,
    bigramCount: 5,
    ladderCount: 4,
    wordCount: 14,
    maxWordLen: 6,
    totalCap: 36,
  },
  5: {
    repLen: 2,
    repsPerKey: 2,
    bigramCount: 4,
    ladderCount: 4,
    wordCount: 16,
    maxWordLen: 7,
    totalCap: 38,
  },
  6: {
    repLen: 2,
    repsPerKey: 2,
    bigramCount: 4,
    ladderCount: 4,
    wordCount: 18,
    maxWordLen: 7,
    totalCap: 40,
  },
};

const MEDIUM_DIFFICULTY: Difficulty = DIFFICULTY_BY_GRADE[4] as Difficulty;

export function difficultyForGrade(grade: number | undefined): Difficulty {
  if (grade === undefined) return MEDIUM_DIFFICULTY;
  return DIFFICULTY_BY_GRADE[grade] ?? MEDIUM_DIFFICULTY;
}

/**
 * Build a staged muscle-memory drill: rhythm reps of the new keys, alternating
 * bigrams, trigram ladders, then real micro-words drawn only from the keys
 * learned so far. Falls back to pseudo-tokens when no real words fit the key set
 * (e.g. the very first "f j" lesson). Tokens stay in order (use preserveOrder).
 */
export async function muscleDrill({
  newKeys,
  learnedKeys,
}: {
  newKeys: string;
  learnedKeys: string;
}): Promise<string[]> {
  const d = difficultyForGrade(getStudentGrade());
  const keys = [...newKeys];
  const warmup: string[] = [];

  // Stage 1: rhythm reps of each new key (e.g. "fff", "jjj").
  for (const key of keys) {
    for (let i = 0; i < d.repsPerKey; i++) warmup.push(key.repeat(d.repLen));
  }

  // Stage 2: alternating bigrams across the new keys (e.g. "fj", "jf", "ff").
  const bigramSource = keys.length >= 2 ? newKeys : newKeys + learnedKeys;
  for (let i = 0; i < d.bigramCount; i++) {
    warmup.push(pick(bigramSource) + pick(bigramSource));
  }

  // Stage 3: trigram ladders mixing new keys with already-learned anchors.
  const ladderSource = newKeys + learnedKeys;
  for (let i = 0; i < d.ladderCount; i++) {
    warmup.push(pick(ladderSource) + pick(ladderSource) + pick(ladderSource));
  }

  // Stage 4: real words using only learned and new keys - the engagement payoff.
  const learnedSet = new Set(
    [...newKeys, ...learnedKeys].map((c) => c.toLowerCase()),
  );
  let words = await realWords(
    "english_10k",
    d.wordCount,
    (w) => w.length <= d.maxWordLen && [...w].every((c) => learnedSet.has(c)),
  );
  if (words.length === 0) {
    // No real words possible yet (e.g. just "f j"): extend the rhythmic ramp.
    words = Array.from({ length: d.wordCount }, () =>
      pick(ladderSource).concat(pick(ladderSource)),
    );
  }

  // Reserve room for the word stage so the cap trims warmup, never the payoff.
  const warmupBudget = Math.max(0, d.totalCap - words.length);
  return [...warmup.slice(0, warmupBudget), ...words];
}

export async function generateWeakKeysDrill(
  weakKeysStr: string,
): Promise<string[]> {
  const allKeys = "abcdefghijklmnopqrstuvwxyz,./;'[]";
  return muscleDrill({ newKeys: weakKeysStr, learnedKeys: allKeys });
}

const HOME = "asdfghjkl;";
const TOP = "qwertyuiop";
const BOTTOM = "zxcvbnm";
const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz";
const LEFT_HAND = "qwertasdfgzxcvb";
const RIGHT_HAND = "yuiophjklnm";
const PUNCT = ".,;:'\"!?-";
const DIGITS = "0123456789";

// A fixed, closed set rather than generated - contractions aren't a
// filterable subset of a normal word list, they're their own small vocabulary.
const CONTRACTIONS = [
  "don't",
  "won't",
  "can't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "haven't",
  "hasn't",
  "hadn't",
  "wouldn't",
  "couldn't",
  "shouldn't",
  "didn't",
  "doesn't",
  "i'm",
  "you're",
  "he's",
  "she's",
  "it's",
  "we're",
  "they're",
  "i've",
  "you've",
  "we've",
  "they've",
  "i'll",
  "you'll",
  "he'll",
  "she'll",
  "we'll",
  "they'll",
  "i'd",
  "you'd",
  "he'd",
  "she'd",
  "we'd",
  "they'd",
  "let's",
  "that's",
  "what's",
  "who's",
  "here's",
  "there's",
];

// Common all-caps acronyms - real mixed-case content (unlike random
// per-letter case toggling, which never occurs in actual writing).
const ACRONYMS = [
  "USA",
  "NASA",
  "FBI",
  "CEO",
  "DIY",
  "ASAP",
  "FYI",
  "TV",
  "DVD",
  "ATM",
  "PDF",
  "URL",
  "FAQ",
  "VIP",
  "GPS",
];

// Cumulative learned-key sets in curriculum order. muscleDrill draws its
// real-word stage only from these, so words never use a key the student hasn't
// met yet. Punctuation in a set is harmless (realWords keeps only a-z).
const L_HOME_INDEX = "fj";
const L_HOME_MIDDLE = "fjdk";
const L_HOME_RING = "fjdksl";
const L_HOME_PINKY = "fjdksla;";
const L_TOP_INDEX = `${HOME}rtyu`;
const L_TOP_MIDDLE = `${HOME}rtyuei`;
const L_TOP_RING = `${HOME}rtyueiwo`;
const L_TOP_PINKY = `${HOME}rtyueiwoqp`;
const L_TOP = `${HOME}${TOP}`;
const L_BOTTOM_INDEX = `${HOME}${TOP}vbnm`;
const L_BOTTOM_MIDDLE = `${HOME}${TOP}vbnmc,`;
const L_BOTTOM_RING = `${HOME}${TOP}vbnmc,x.`;
const L_BOTTOM_PINKY = `${HOME}${TOP}vbnmc,x.z/`;

function digits(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += pick(DIGITS);
  return s;
}

/** A realistic-looking phone/decimal/time/sum token, mixing digits with punctuation. */
function numberFormatToken(): string {
  switch (randInt(0, 3)) {
    case 0:
      return `${digits(3)}-${digits(3)}-${digits(4)}`;
    case 1:
      return `${digits(randInt(1, 3))}.${digits(randInt(1, 2))}`;
    case 2:
      return `${digits(randInt(1, 2))}:${digits(2)}`;
    default:
      return `${digits(randInt(1, 2))}+${digits(randInt(1, 2))}`;
  }
}

/** A realistic-looking email/price/hashtag/handle token, mixing symbols with real words or digits. */
function symbolToken(words: string[]): string {
  const word = (): string => words[randInt(0, words.length - 1)] as string;
  switch (randInt(0, 3)) {
    case 0:
      return `${word()}@${word()}`;
    case 1:
      return `$${digits(randInt(1, 3))}.${digits(2)}`;
    case 2:
      return `#${word()}`;
    default:
      return `@${word()}`;
  }
}

function splitIntoTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Pulls a few real quotes whose character length falls in [min, max] (the
 * same short/medium/long buckets the quote-mode length picker uses) and
 * tokenizes them word-by-word, punctuation and capitalization intact - a
 * capstone step up from isolated word/character drills.
 */
async function connectedText(
  min: number,
  max: number,
  quoteCount: number,
): Promise<string[]> {
  // Fetches the quote JSON directly (rather than going through
  // QuotesController) since that controller pulls in ../db, which would
  // create an import cycle back to lessons-data.ts via achievements.ts ->
  // lesson-progress.ts.
  const data = await cachedFetchJson<QuoteData>("quotes/english.json");
  let pool = data.quotes.filter((q) => q.length >= min && q.length <= max);
  if (pool.length === 0) pool = data.quotes;
  const picked = shuffle(pool).slice(0, quoteCount);
  return picked.flatMap((q) => splitIntoTokens(q.text));
}

export const lessonGroups: LessonGroup[] = [
  {
    id: "home-row",
    name: "Home row",
    icon: "fa-grip-lines",
    description: "asdf jkl; — where your fingers rest",
    lessons: [
      {
        id: "home-index",
        name: "Index (f j)",
        preserveOrder: true,
        newKeys: "fj",
        generate: async () =>
          muscleDrill({ newKeys: "fj", learnedKeys: L_HOME_INDEX }),
      },
      {
        id: "home-middle",
        name: "Middle (d k)",
        preserveOrder: true,
        newKeys: "dk",
        generate: async () =>
          muscleDrill({ newKeys: "dk", learnedKeys: L_HOME_MIDDLE }),
      },
      {
        id: "home-ring",
        name: "Ring (s l)",
        preserveOrder: true,
        newKeys: "sl",
        generate: async () =>
          muscleDrill({ newKeys: "sl", learnedKeys: L_HOME_RING }),
      },
      {
        id: "home-pinky",
        name: "Pinky (a ;)",
        preserveOrder: true,
        newKeys: "a;",
        generate: async () =>
          muscleDrill({ newKeys: "a;", learnedKeys: L_HOME_PINKY }),
      },
      {
        id: "home-reach",
        name: "Index reach (g h)",
        preserveOrder: true,
        newKeys: "gh",
        generate: async () => muscleDrill({ newKeys: "gh", learnedKeys: HOME }),
      },
      {
        id: "home-all",
        name: "Full home row",
        preserveOrder: true,
        newKeys: HOME,
        generate: async () => muscleDrill({ newKeys: HOME, learnedKeys: HOME }),
      },
      {
        id: "home-words",
        name: "Word review",
        generate: async () => {
          const homeSet = new Set([..."asdfghjkl"]);
          return realWords(
            "english_10k",
            40,
            (w) => w.length <= 7 && [...w].every((c) => homeSet.has(c)),
          );
        },
      },
    ],
  },
  {
    id: "top-row",
    name: "Top row",
    icon: "fa-arrow-up",
    description: "qwerty uiop — reaching up",
    lessons: [
      {
        id: "top-index",
        name: "Index (r t y u)",
        preserveOrder: true,
        newKeys: "rtyu",
        generate: async () =>
          muscleDrill({ newKeys: "rtyu", learnedKeys: L_TOP_INDEX }),
      },
      {
        id: "top-middle",
        name: "Middle (e i)",
        preserveOrder: true,
        newKeys: "ei",
        generate: async () =>
          muscleDrill({ newKeys: "ei", learnedKeys: L_TOP_MIDDLE }),
      },
      {
        id: "top-ring",
        name: "Ring (w o)",
        preserveOrder: true,
        newKeys: "wo",
        generate: async () =>
          muscleDrill({ newKeys: "wo", learnedKeys: L_TOP_RING }),
      },
      {
        id: "top-pinky",
        name: "Pinky (q p)",
        preserveOrder: true,
        newKeys: "qp",
        generate: async () =>
          muscleDrill({ newKeys: "qp", learnedKeys: L_TOP_PINKY }),
      },
      {
        id: "top-all",
        name: "Full top row",
        preserveOrder: true,
        newKeys: TOP,
        generate: async () => muscleDrill({ newKeys: TOP, learnedKeys: L_TOP }),
      },
      {
        id: "top-home",
        name: "Top + home row",
        preserveOrder: true,
        generate: async () => muscleDrill({ newKeys: TOP, learnedKeys: L_TOP }),
      },
      {
        id: "top-words",
        name: "Word review",
        generate: async () => {
          const topHomeSet = new Set([..."asdfghjklqwertyuiop"]);
          return realWords(
            "english_10k",
            40,
            (w) => w.length <= 7 && [...w].every((c) => topHomeSet.has(c)),
          );
        },
      },
    ],
  },
  {
    id: "bottom-row",
    name: "Bottom row",
    icon: "fa-arrow-down",
    description: "zxcvbnm — reaching down",
    lessons: [
      {
        id: "bottom-index",
        name: "Index (v b n m)",
        preserveOrder: true,
        newKeys: "vbnm",
        generate: async () =>
          muscleDrill({ newKeys: "vbnm", learnedKeys: L_BOTTOM_INDEX }),
      },
      {
        id: "bottom-middle",
        name: "Middle (c ,)",
        preserveOrder: true,
        newKeys: "c,",
        generate: async () =>
          muscleDrill({ newKeys: "c,", learnedKeys: L_BOTTOM_MIDDLE }),
      },
      {
        id: "bottom-ring",
        name: "Ring (x .)",
        preserveOrder: true,
        newKeys: "x.",
        generate: async () =>
          muscleDrill({ newKeys: "x.", learnedKeys: L_BOTTOM_RING }),
      },
      {
        id: "bottom-pinky",
        name: "Pinky (z /)",
        preserveOrder: true,
        newKeys: "z/",
        generate: async () =>
          muscleDrill({ newKeys: "z/", learnedKeys: L_BOTTOM_PINKY }),
      },
      {
        id: "bottom-all",
        name: "Full bottom row",
        preserveOrder: true,
        newKeys: BOTTOM,
        generate: async () =>
          muscleDrill({ newKeys: BOTTOM, learnedKeys: ALL_LETTERS }),
      },
      {
        id: "bottom-home",
        name: "Bottom + home row",
        preserveOrder: true,
        generate: async () =>
          muscleDrill({ newKeys: BOTTOM, learnedKeys: ALL_LETTERS }),
      },
      {
        id: "bottom-words",
        name: "Word review",
        generate: async () =>
          realWords("english_10k", 45, (w) => w.length >= 4 && w.length <= 7),
      },
    ],
  },
  {
    id: "all-keys",
    name: "All keys",
    icon: "fa-keyboard",
    description: "Every letter on the keyboard",
    lessons: [
      {
        id: "all-keys-1",
        name: "Warm up + words",
        preserveOrder: true,
        generate: async () =>
          muscleDrill({ newKeys: "", learnedKeys: ALL_LETTERS }),
      },
      {
        id: "all-keys-2",
        name: "Longer letter groups",
        generate: () => drill(ALL_LETTERS, { count: 40, min: 4, max: 7 }),
      },
      {
        id: "all-keys-3",
        name: "Real words",
        generate: async () => realWords("english", 40),
      },
      {
        id: "all-keys-4",
        name: "10k word mix",
        generate: async () => realWords("english_10k", 40),
      },
      {
        id: "all-keys-5",
        name: "Long words",
        generate: async () =>
          realWords("english_10k", 35, (w) => w.length >= 6),
      },
      {
        id: "all-keys-6",
        name: "Rapid fire",
        generate: async () =>
          realWords("english_10k", 55, (w) => w.length <= 4),
      },
    ],
  },
  {
    id: "capitals",
    name: "Capitals & shift",
    icon: "fa-font",
    description: "Practice the shift key",
    lessons: [
      {
        id: "capitals-1",
        name: "Mixed case letters",
        generate: async () => {
          // Real mixed-case patterns: camelCase compounds and all-caps
          // acronyms - not random per-letter case toggling, which never
          // occurs in actual writing.
          const words = await realWords("english", 40, (w) => w.length <= 6);
          const tokens: string[] = [];
          for (let i = 0; i + 1 < words.length; i += 2) {
            tokens.push(
              (words[i] as string) + capitalize(words[i + 1] as string),
            );
          }
          for (let i = 0; i < 10; i++) {
            tokens.push(ACRONYMS[randInt(0, ACRONYMS.length - 1)] as string);
          }
          return shuffle(tokens);
        },
      },
      {
        id: "capitals-2",
        name: "Capitalized words",
        generate: async () =>
          (await realWords("english", 40)).map((w) => capitalize(w)),
      },
    ],
  },
  {
    id: "punctuation",
    name: "Punctuation",
    icon: "fa-comment",
    description: ". , ; : ' \" ! ? -",
    lessons: [
      {
        id: "punctuation-1",
        name: "Punctuation marks",
        generate: async () => {
          const enders = [".", ",", "!", "?"];
          const words = await realWords("english", 30, (w) => w.length <= 5);
          return words.map(
            (w) => w + (enders[randInt(0, enders.length - 1)] as string),
          );
        },
      },
      {
        id: "punctuation-2",
        name: "Words with punctuation",
        generate: async () =>
          (await realWords("english", 36)).map((w) =>
            Math.random() < 0.5 ? w + pick(PUNCT) : w,
          ),
      },
      {
        id: "punctuation-3",
        name: "Quotes & parentheses",
        generate: async () => {
          const wrappers: [string, string][] = [
            ['"', '"'],
            ["(", ")"],
            ["'", "'"],
          ];
          const words = await realWords("english", 30, (w) => w.length <= 6);
          return words.map((w) => {
            const [open, close] = wrappers[randInt(0, wrappers.length - 1)] as [
              string,
              string,
            ];
            return `${open}${w}${close}`;
          });
        },
      },
      {
        id: "punctuation-4",
        name: "Contractions",
        generate: () => shuffle(CONTRACTIONS).slice(0, 30),
      },
      {
        id: "punctuation-5",
        name: "Lists & clauses",
        generate: async () => {
          const marks = [",", ",", ",", ":", ";"];
          const words = await realWords("english", 32, (w) => w.length <= 7);
          return words.map(
            (w) => w + (marks[randInt(0, marks.length - 1)] as string),
          );
        },
      },
    ],
  },
  {
    id: "common-words",
    name: "Common words",
    icon: "fa-book",
    description: "Real English words for fluency",
    lessons: [
      {
        id: "common-words-1",
        name: "Short words",
        generate: async () => realWords("english", 40, (w) => w.length <= 4),
      },
      {
        id: "common-words-2",
        name: "Common 200",
        generate: async () => realWords("english", 40),
      },
      {
        id: "common-words-3",
        name: "Expanded 1k",
        generate: async () => realWords("english_1k", 45),
      },
    ],
  },
  {
    id: "hand-drills",
    name: "Hand drills",
    icon: "fa-hand-paper",
    description: "Isolate one hand at a time",
    lessons: [
      {
        id: "hand-drills-left",
        name: "Left hand only",
        preserveOrder: true,
        newKeys: LEFT_HAND,
        generate: async () =>
          muscleDrill({ newKeys: LEFT_HAND, learnedKeys: LEFT_HAND }),
      },
      {
        id: "hand-drills-right",
        name: "Right hand only",
        preserveOrder: true,
        newKeys: RIGHT_HAND,
        generate: async () =>
          muscleDrill({ newKeys: RIGHT_HAND, learnedKeys: RIGHT_HAND }),
      },
    ],
  },
  {
    id: "connected-text",
    name: "Connected text",
    icon: "fa-book-open",
    description: "Real sentences and passages, punctuation and all",
    lessons: [
      {
        id: "connected-text-1",
        name: "Short sentences",
        preserveOrder: true,
        generate: async () => connectedText(0, 100, 4),
      },
      {
        id: "connected-text-2",
        name: "Paragraphs",
        preserveOrder: true,
        generate: async () => connectedText(101, 300, 2),
      },
      {
        id: "connected-text-3",
        name: "Longer passages",
        preserveOrder: true,
        generate: async () => connectedText(301, 600, 1),
      },
    ],
  },
  {
    id: "numbers",
    name: "Numbers",
    icon: "fa-hashtag",
    description: "0 1 2 3 4 5 6 7 8 9",
    lessons: [
      {
        id: "numbers-1",
        name: "Short numbers",
        generate: () => drill(DIGITS, { count: 30, min: 2, max: 4 }),
      },
      {
        id: "numbers-2",
        name: "Longer numbers",
        generate: () => drill(DIGITS, { count: 35, min: 4, max: 6 }),
      },
      {
        id: "numbers-3",
        name: "Mixed formats",
        generate: () => Array.from({ length: 30 }, () => numberFormatToken()),
      },
    ],
  },
  {
    id: "symbols",
    name: "Symbols",
    icon: "fa-at",
    description: "! @ # $ % & * ( ) and more",
    lessons: [
      {
        id: "symbols-1",
        name: "Common symbols",
        generate: async () => {
          // Real everyday uses of !@#$%^&*() rather than random soup - an
          // excited word, a hashtag, a percentage, or a standalone & / *
          // (parentheses are already covered by punctuation-3's wrapping).
          const words = await realWords("english", 20, (w) => w.length <= 6);
          const tokens = words.map((w, i) => (i % 2 === 0 ? `${w}!` : `#${w}`));
          const extras = [
            "10%",
            "25%",
            "50%",
            "100%",
            "&",
            "&",
            "*",
            "*",
            "*",
            "*",
          ];
          return shuffle([...tokens, ...extras]);
        },
      },
      {
        id: "symbols-3",
        name: "Everyday symbols in context",
        generate: async () => {
          const words = await realWords("english", 20, (w) => w.length <= 8);
          return Array.from({ length: 30 }, () => symbolToken(words));
        },
      },
    ],
  },
  {
    id: "tab-enter",
    name: "Tab & Enter",
    icon: "fa-indent",
    description: "Move between fields and start new lines without looking down",
    lessons: [
      {
        id: "tab-enter-1",
        name: "Tab key",
        generate: async () => {
          const words = await realWords("english", 30, (w) => w.length <= 6);
          return words.map((w) => `${w}\t`);
        },
      },
      {
        id: "tab-enter-2",
        name: "Enter key",
        generate: async () => {
          const words = await realWords("english", 30, (w) => w.length <= 6);
          return words.map((w) => `${w}\n`);
        },
      },
      {
        id: "tab-enter-3",
        name: "Tab + Enter together",
        preserveOrder: true,
        generate: async () => {
          // Simulates filling out a short form: two tabbed fields per row,
          // then Enter to move to the next row.
          const words = await realWords("english", 36, (w) => w.length <= 6);
          const tokens: string[] = [];
          for (let i = 0; i + 2 < words.length; i += 3) {
            tokens.push(`${words[i]}\t`);
            tokens.push(`${words[i + 1]}\t`);
            tokens.push(`${words[i + 2]}\n`);
          }
          return tokens;
        },
      },
    ],
  },
];

export function findLesson(id: string): Lesson | undefined {
  for (const group of lessonGroups) {
    const lesson = group.lessons.find((l) => l.id === id);
    if (lesson !== undefined) return lesson;
  }
  return undefined;
}

/** The group id a lesson belongs to, or undefined if not part of the built-in curriculum. */
export function groupIdForLesson(id: string): string | undefined {
  return lessonGroups.find((g) => g.lessons.some((l) => l.id === id))?.id;
}

/**
 * Built-in lessons in curriculum order (Japanese lessons are free-practice and
 * intentionally excluded). Used for unlock gating and "next lesson".
 */
export const lessonOrder: string[] = lessonGroups.flatMap((g) =>
  g.lessons.map((l) => l.id),
);

/**
 * The lesson after `id` in curriculum order, or undefined if `id` is the last
 * built-in lesson or not part of the curriculum (e.g. assignments / word lists).
 */
export function findNextLesson(id: string): Lesson | undefined {
  const idx = lessonOrder.indexOf(id);
  if (idx === -1 || idx >= lessonOrder.length - 1) return undefined;
  return findLesson(lessonOrder[idx + 1] as string);
}

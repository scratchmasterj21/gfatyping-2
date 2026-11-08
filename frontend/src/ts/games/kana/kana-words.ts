import type { DifficultyOption } from "../components/DifficultySegmented";

import { hiraganaWords } from "../../lessons/lessons-data-jp";

/**
 * Word data for the romaji games (hiragana on screen, romaji typed).
 */

export type KarutaCard = { kana: string; emoji: string; en: string };

/** Picture cards: easy, everyday words children know. */
export const KARUTA_CARDS: KarutaCard[] = [
  { kana: "いぬ", emoji: "🐶", en: "dog" },
  { kana: "ねこ", emoji: "🐱", en: "cat" },
  { kana: "さかな", emoji: "🐟", en: "fish" },
  { kana: "とり", emoji: "🐦", en: "bird" },
  { kana: "うさぎ", emoji: "🐰", en: "rabbit" },
  { kana: "くま", emoji: "🐻", en: "bear" },
  { kana: "ぞう", emoji: "🐘", en: "elephant" },
  { kana: "さる", emoji: "🐒", en: "monkey" },
  { kana: "うし", emoji: "🐮", en: "cow" },
  { kana: "うま", emoji: "🐴", en: "horse" },
  { kana: "ぶた", emoji: "🐷", en: "pig" },
  { kana: "ひつじ", emoji: "🐑", en: "sheep" },
  { kana: "かえる", emoji: "🐸", en: "frog" },
  { kana: "へび", emoji: "🐍", en: "snake" },
  { kana: "かめ", emoji: "🐢", en: "turtle" },
  { kana: "たこ", emoji: "🐙", en: "octopus" },
  { kana: "えび", emoji: "🦐", en: "shrimp" },
  { kana: "くじら", emoji: "🐳", en: "whale" },
  { kana: "いるか", emoji: "🐬", en: "dolphin" },
  { kana: "りんご", emoji: "🍎", en: "apple" },
  { kana: "みかん", emoji: "🍊", en: "orange" },
  { kana: "いちご", emoji: "🍓", en: "strawberry" },
  { kana: "ばなな", emoji: "🍌", en: "banana" },
  { kana: "すいか", emoji: "🍉", en: "watermelon" },
  { kana: "ぶどう", emoji: "🍇", en: "grapes" },
  { kana: "ぱん", emoji: "🍞", en: "bread" },
  { kana: "たまご", emoji: "🥚", en: "egg" },
  { kana: "ごはん", emoji: "🍚", en: "rice" },
  { kana: "おにぎり", emoji: "🍙", en: "rice ball" },
  { kana: "すし", emoji: "🍣", en: "sushi" },
  { kana: "ぎゅうにゅう", emoji: "🥛", en: "milk" },
  { kana: "みず", emoji: "💧", en: "water" },
  { kana: "くるま", emoji: "🚗", en: "car" },
  { kana: "でんしゃ", emoji: "🚃", en: "train" },
  { kana: "ひこうき", emoji: "✈️", en: "airplane" },
  { kana: "ふね", emoji: "🚢", en: "ship" },
  { kana: "じてんしゃ", emoji: "🚲", en: "bicycle" },
  { kana: "ほん", emoji: "📕", en: "book" },
  { kana: "えんぴつ", emoji: "✏️", en: "pencil" },
  { kana: "かさ", emoji: "☂️", en: "umbrella" },
  { kana: "くつ", emoji: "👟", en: "shoes" },
  { kana: "ぼうし", emoji: "🧢", en: "hat" },
  { kana: "めがね", emoji: "👓", en: "glasses" },
  { kana: "とけい", emoji: "⏰", en: "clock" },
  { kana: "いす", emoji: "🪑", en: "chair" },
  { kana: "いえ", emoji: "🏠", en: "house" },
  { kana: "がっこう", emoji: "🏫", en: "school" },
  { kana: "やま", emoji: "⛰️", en: "mountain" },
  { kana: "うみ", emoji: "🌊", en: "sea" },
  { kana: "はな", emoji: "🌸", en: "flower" },
  { kana: "つき", emoji: "🌙", en: "moon" },
  { kana: "ほし", emoji: "⭐", en: "star" },
  { kana: "たいよう", emoji: "☀️", en: "sun" },
  { kana: "あめ", emoji: "🌧️", en: "rain" },
  { kana: "ゆき", emoji: "❄️", en: "snow" },
  { kana: "かみなり", emoji: "⚡", en: "thunder" },
  { kana: "くも", emoji: "☁️", en: "cloud" },
  { kana: "てがみ", emoji: "✉️", en: "letter" },
  { kana: "でんわ", emoji: "📞", en: "phone" },
  { kana: "かぎ", emoji: "🔑", en: "key" },
  { kana: "はさみ", emoji: "✂️", en: "scissors" },
  { kana: "ふうせん", emoji: "🎈", en: "balloon" },
  { kana: "たいこ", emoji: "🥁", en: "drum" },
  { kana: "て", emoji: "✋", en: "hand" },
  { kana: "め", emoji: "👀", en: "eyes" },
  { kana: "みみ", emoji: "👂", en: "ear" },
  { kana: "くち", emoji: "👄", en: "mouth" },
];

export function findCard(kana: string): KarutaCard | undefined {
  return KARUTA_CARDS.find((c) => c.kana === kana);
}

export type KanaDifficulty = DifficultyOption & {
  /** longest word (kana) used */
  maxLen: number;
  /** Tappy: thinking time + time per kana, ms */
  botThinkMs: number;
  botKanaMs: number;
};

export const KANA_DIFFICULTIES: KanaDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    maxLen: 3,
    botThinkMs: 2200,
    botKanaMs: 900,
  },
  { label: "Medium", maxLen: 4, botThinkMs: 1500, botKanaMs: 650 },
  {
    label: "Hard",
    hint: "long words",
    maxLen: 7,
    botThinkMs: 1000,
    botKanaMs: 450,
  },
];

export function kanaDifficultyFor(label: string): KanaDifficulty {
  return (
    KANA_DIFFICULTIES.find((d) => d.label === label) ??
    (KANA_DIFFICULTIES[0] as KanaDifficulty)
  );
}

/** How long Tappy takes to type a word, ms. */
export function botTypeMs(
  d: KanaDifficulty,
  word: string,
  rng: () => number,
): number {
  return (
    d.botThinkMs * (0.6 + rng() * 0.8) +
    word.length * d.botKanaMs * (0.8 + rng() * 0.5)
  );
}

let poolCache: string[] | undefined;

/**
 * The game word pool in a fixed order (so every player in a room builds the
 * same fish / options from the same seed): child-friendly hiragana words,
 * 2-7 kana, plus the karuta words.
 */
export async function kanaWordPool(): Promise<string[]> {
  if (poolCache !== undefined) return poolCache;
  const words = await hiraganaWords((w) => w.length <= 7);
  const all = [...new Set([...words, ...KARUTA_CARDS.map((c) => c.kana)])];
  poolCache = all.sort();
  return poolCache;
}

/** Small seeded random numbers (mulberry32) - same seed, same numbers. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

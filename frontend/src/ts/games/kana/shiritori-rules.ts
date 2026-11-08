import {
  applyBoom,
  applyPass,
  bombDifficultyFor,
  BombState,
  newBombMatch,
} from "../word-bomb/bomb-rules";
import { KanaDifficulty } from "./kana-words";

/**
 * Shiritori Bomb: Word Bomb's bomb, lives and secret fuse, but the words
 * make a chain - the next word must start with the last kana of the one
 * before (りんご → ごりら → らっぱ). The holder picks one of 3 words that fit
 * and types it in romaji to pass the bomb. Words ending in ん (which lose in
 * real shiritori) are never offered. Pure.
 */

export type ShiritoriState = BombState & {
  /** the 3 words the holder can choose from */
  options: string[];
};

/** Extra holding time on top of Word Bomb's, for reading the choices, ms. */
const EXTRA_HOLD_MS = 2000;

const SMALL_TO_BIG: Record<string, string> = {
  ゃ: "や",
  ゅ: "ゆ",
  ょ: "よ",
  ぁ: "あ",
  ぃ: "い",
  ぅ: "う",
  ぇ: "え",
  ぉ: "お",
  ゎ: "わ",
  っ: "つ",
};

/** The kana the next word must start with. */
export function chainKana(word: string): string {
  let i = word.length - 1;
  while (i > 0 && word[i] === "ー") i--;
  const ch = word[i] ?? "";
  return SMALL_TO_BIG[ch] ?? ch;
}

const playable = (w: string): boolean => w.length >= 2 && !w.endsWith("ん");

/** Up to 3 words that continue the chain from `word`. */
export function chainOptions(
  word: string,
  pool: string[],
  d: KanaDifficulty,
  rng: () => number,
): string[] {
  const start = chainKana(word);
  const fits = pool.filter(
    (w) => w !== word && w.startsWith(start) && playable(w),
  );
  const short = fits.filter((w) => w.length <= d.maxLen);
  const source = short.length >= 3 ? short : fits;
  const picked: string[] = [];
  const bag = [...source];
  while (picked.length < 3 && bag.length > 0) {
    const i = Math.floor(rng() * bag.length);
    picked.push(bag.splice(i, 1)[0] as string);
  }
  return picked;
}

/** A fresh chain start whose ending has words to continue with. */
export function startWord(
  pool: string[],
  d: KanaDifficulty,
  rng: () => number,
): string {
  const candidates = pool.filter((w) => playable(w) && w.length <= d.maxLen);
  for (let tries = 0; tries < 40; tries++) {
    const w = candidates[Math.floor(rng() * candidates.length)];
    if (w !== undefined && chainOptions(w, pool, d, rng).length >= 2) return w;
  }
  return "しりとり";
}

/** If the chain hits a dead end, start a fresh word (same holder). */
function withOptions(
  s: BombState,
  word: string,
  pool: string[],
  d: KanaDifficulty,
  rng: () => number,
): ShiritoriState {
  let w = word;
  let options = chainOptions(w, pool, d, rng);
  if (options.length === 0) {
    w = startWord(pool, d, rng);
    options = chainOptions(w, pool, d, rng);
  }
  return { ...s, word: w, options };
}

export function newShiritoriMatch(
  order: string[],
  d: KanaDifficulty,
  pool: string[],
  now: number,
  rng: () => number,
): ShiritoriState {
  const base = newBombMatch(order, bombDifficultyFor(d.label), now, rng);
  return withOptions(
    { ...base, minHoldMs: base.minHoldMs + EXTRA_HOLD_MS },
    startWord(pool, d, rng),
    pool,
    d,
    rng,
  );
}

/** The holder typed one of the options: pass the bomb, extend the chain. */
export function applyShiritoriPass(
  s: ShiritoriState,
  by: string,
  option: string,
  d: KanaDifficulty,
  pool: string[],
  now: number,
  rng: () => number,
): ShiritoriState | null {
  if (!(s.options ?? []).includes(option)) return null;
  const passed = applyPass(s, by, bombDifficultyFor(d.label), now, rng);
  if (passed === null) return null;
  return withOptions(passed, option, pool, d, rng);
}

/** The fuse ran out: lose a life; a new chain starts. */
export function applyShiritoriBoom(
  s: ShiritoriState,
  d: KanaDifficulty,
  pool: string[],
  now: number,
  rng: () => number,
): ShiritoriState | null {
  const boomed = applyBoom(s, bombDifficultyFor(d.label), now, rng);
  if (boomed === null) return null;
  if (boomed.over) return { ...boomed, options: [] };
  return withOptions(boomed, startWord(pool, d, rng), pool, d, rng);
}

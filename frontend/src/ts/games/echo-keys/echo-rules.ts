import type { DifficultyOption } from "../components/DifficultySegmented";

export type EchoDifficulty = DifficultyOption & {
  keys: string[];
  /** How long each key lights up while Tappy shows the pattern. */
  showMs: number;
};

const HOME = [..."asdfghjkl"];
const TOP = [..."qwertyuiop"];
const BOTTOM = [..."zxcvbnm"];

export const ECHO_DIFFICULTIES: EchoDifficulty[] = [
  { label: "Easy", hint: "home row", keys: HOME, showMs: 750 },
  {
    label: "Medium",
    hint: "home + top row",
    keys: [...HOME, ...TOP],
    showMs: 600,
  },
  {
    label: "Hard",
    hint: "all letters",
    keys: [...HOME, ...TOP, ...BOTTOM],
    showMs: 450,
  },
];

export const START_LENGTH = 3;
export const ECHO_LIVES = 3;

export type Rng = () => number;

/** Random keys, never the same key twice in a row (hard to see). */
export function makeSequence(
  keys: string[],
  length: number,
  rng: Rng,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < length; i++) {
    let k = keys[Math.floor(rng() * keys.length) % keys.length] as string;
    if (keys.length > 1 && k === out[i - 1]) {
      k = keys[(keys.indexOf(k) + 1) % keys.length] as string;
    }
    out.push(k);
  }
  return out;
}

export type EchoState = {
  length: number;
  lives: number;
  score: number;
  rounds: number;
  longest: number;
};

export const initialEcho = (): EchoState => ({
  length: START_LENGTH,
  lives: ECHO_LIVES,
  score: 0,
  rounds: 0,
  longest: 0,
});

/** Repeated the whole pattern: score it and make the next one longer. */
export function echoOnRoundWin(s: EchoState): EchoState {
  return {
    ...s,
    score: s.score + s.length * 10,
    rounds: s.rounds + 1,
    longest: Math.max(s.longest, s.length),
    length: s.length + 1,
  };
}

/** Wrong key: lose a life and try a new pattern of the same length. */
export function echoOnMistake(s: EchoState): EchoState {
  return { ...s, lives: s.lives - 1 };
}

export const echoIsOver = (s: EchoState): boolean => s.lives <= 0;

/** 1-3 stars from the longest pattern repeated. */
export const echoStars = (longest: number): number =>
  longest >= 8 ? 3 : longest >= 5 ? 2 : longest > 0 ? 1 : 0;

import type { DifficultyOption } from "../components/DifficultySegmented";

export type SnackDifficulty = DifficultyOption & {
  /** Seconds each customer waits. */
  patience: number;
  /** Longest order, in words. */
  maxWords: number;
  /** Length of the shift. */
  seconds: number;
};

export const SNACK_DIFFICULTIES: SnackDifficulty[] = [
  {
    label: "Easy",
    hint: "1-word orders",
    patience: 14,
    maxWords: 1,
    seconds: 90,
  },
  {
    label: "Medium",
    hint: "up to 2 words",
    patience: 12,
    maxWords: 2,
    seconds: 90,
  },
  {
    label: "Hard",
    hint: "up to 3 words",
    patience: 10,
    maxWords: 3,
    seconds: 90,
  },
];

export const MAX_STRIKES = 3;
/** Serving this many in a row starts rush hour (double points). */
export const RUSH_AFTER = 3;

export const CUSTOMERS = ["🐻", "🐰", "🦊", "🐼", "🐸", "🐯", "🐨", "🐵", "🐧"];
export const SNACKS = ["🍩", "🍪", "🧁", "🍓", "🍌", "🥨", "🍉", "🍦", "🥐"];

export type Rng = () => number;

const pick = <T>(arr: readonly T[], rng: Rng): T =>
  arr[Math.floor(rng() * arr.length) % arr.length] as T;

/** An order is 1..maxWords words from the list (short words for longer orders). */
export function makeOrder(words: string[], maxWords: number, rng: Rng): string {
  const pool = words.filter((w) => w.length > 0 && !w.includes(" "));
  if (pool.length === 0) return "snack";
  const count = 1 + Math.floor(rng() * Math.max(1, maxWords));
  const shortPool = pool.filter((w) => w.length <= 6);
  const source = count > 1 && shortPool.length >= 3 ? shortPool : pool;
  return Array.from({ length: count }, () => pick(source, rng)).join(" ");
}

export type SnackState = {
  score: number;
  served: number;
  strikes: number;
  combo: number;
  bestCombo: number;
};

export const initialSnack = (): SnackState => ({
  score: 0,
  served: 0,
  strikes: 0,
  combo: 0,
  bestCombo: 0,
});

export const isRushHour = (s: SnackState): boolean => s.combo >= RUSH_AFTER;

/** Points: 2 per letter plus up to 10 for speed, doubled in rush hour. */
export function snackOnServe(
  s: SnackState,
  order: string,
  patienceLeft: number,
): SnackState {
  const base =
    order.length * 2 + Math.round(Math.min(1, Math.max(0, patienceLeft)) * 10);
  const points = isRushHour(s) ? base * 2 : base;
  const combo = s.combo + 1;
  return {
    ...s,
    score: s.score + points,
    served: s.served + 1,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
  };
}

/** A customer gave up waiting. */
export function snackOnMiss(s: SnackState): SnackState {
  return { ...s, strikes: s.strikes + 1, combo: 0 };
}

export const snackIsOver = (s: SnackState): boolean => s.strikes >= MAX_STRIKES;

export { pick as pickRandom };

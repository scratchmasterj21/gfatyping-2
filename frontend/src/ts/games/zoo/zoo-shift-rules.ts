import type { DifficultyOption } from "../components/DifficultySegmented";
import { ZOO_INFO, ZOO_SPECIES, ZooSpecies } from "./zoo-animals";

export type ZooDifficulty = DifficultyOption & {
  /** 0 easy, 1 medium, 2 hard: which word list to use */
  level: 0 | 1 | 2;
  /** Animals (pens) in the zoo. */
  pens: number;
  /** Most animals asking for something at once. */
  maxActive: number;
  /** Seconds an animal waits before it gets sad. */
  patience: number;
  /** Seconds between new requests at the start (gets shorter). */
  gap: number;
  /** Length of the shift. */
  seconds: number;
};

export const ZOO_DIFFICULTIES: ZooDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    level: 0,
    pens: 3,
    maxActive: 2,
    patience: 16,
    gap: 4,
    seconds: 90,
  },
  {
    label: "Medium",
    hint: "longer words",
    level: 1,
    pens: 4,
    maxActive: 2,
    patience: 14,
    gap: 3.5,
    seconds: 90,
  },
  {
    label: "Hard",
    hint: "little phrases",
    level: 2,
    pens: 6,
    maxActive: 3,
    patience: 13,
    gap: 3,
    seconds: 90,
  },
];

export const ZOO_NEEDS = [
  "food",
  "water",
  "bath",
  "nap",
  "vet",
  "play",
] as const;
export type ZooNeed = (typeof ZOO_NEEDS)[number];

/** What the keeper says each need is, for the bubble. */
export const NEED_LABEL: Record<ZooNeed, string> = {
  food: "hungry",
  water: "thirsty",
  bath: "muddy",
  nap: "sleepy",
  vet: "ouch",
  play: "bored",
};

/** Words for everything but food (food words come from the animal). */
const NEED_WORDS: Record<
  Exclude<ZooNeed, "food">,
  [string[], string[], string[]]
> = {
  water: [
    ["sip", "drink", "water"],
    ["water", "drink", "puddle"],
    ["fresh cold water", "fill the bowl", "a big drink"],
  ],
  bath: [
    ["wash", "soap", "scrub"],
    ["bubbles", "shampoo", "splash", "brush"],
    ["a bubble bath", "wash off the mud", "scrub scrub"],
  ],
  nap: [
    ["nap", "rest", "bed"],
    ["sleepy", "pillow", "blanket"],
    ["time for bed", "a cozy nap", "sweet dreams"],
  ],
  vet: [
    ["hug", "help"],
    ["bandage", "doctor", "better"],
    ["feel better", "a big hug", "see the vet"],
  ],
  play: [
    ["ball", "toy", "play"],
    ["bounce", "tickle", "puzzle"],
    ["throw the ball", "play catch", "a new toy"],
  ],
};

export type Rng = () => number;

const pick = <T>(arr: readonly T[], rng: Rng): T =>
  arr[Math.floor(rng() * arr.length) % arr.length] as T;

/** All words an animal could ask for with a need at a level. */
export function needWords(
  species: ZooSpecies,
  need: ZooNeed,
  level: 0 | 1 | 2,
): string[] {
  return need === "food"
    ? ZOO_INFO[species].food[level]
    : NEED_WORDS[need][level];
}

/**
 * A word for this request whose first letter isn't already on screen, so the
 * first key typed always picks exactly one animal. Undefined if none fits.
 */
export function pickNeedWord(
  species: ZooSpecies,
  need: ZooNeed,
  level: 0 | 1 | 2,
  takenFirstLetters: ReadonlySet<string>,
  rng: Rng,
): string | undefined {
  const free = needWords(species, need, level).filter(
    (w) => !takenFirstLetters.has(w.charAt(0)),
  );
  return free.length === 0 ? undefined : pick(free, rng);
}

/** `count` different animals for the pens. */
export function pickZooSpecies(count: number, rng: Rng): ZooSpecies[] {
  const pool = [...ZOO_SPECIES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as ZooSpecies, pool[i] as ZooSpecies];
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}

/** Seconds until the next request: shrinks to 55% by the end of the shift. */
export const nextGap = (base: number, progress: number, rng: Rng): number =>
  base * (1 - 0.45 * Math.min(1, Math.max(0, progress))) * (0.75 + rng() * 0.5);

export type ZooShiftState = {
  score: number;
  cared: number;
  missed: number;
  streak: number;
  bestStreak: number;
};

export const initialZooShift = (): ZooShiftState => ({
  score: 0,
  cared: 0,
  missed: 0,
  streak: 0,
  bestStreak: 0,
});

/** This many in a row is a "happy streak" (double points). */
export const STREAK_AFTER = 4;
export const isStreak = (s: ZooShiftState): boolean => s.streak >= STREAK_AFTER;

/** Points: 2 per letter plus up to 10 for speed, doubled on a happy streak. */
export function zooOnCare(
  s: ZooShiftState,
  word: string,
  patienceLeft: number,
): ZooShiftState {
  const base =
    word.replace(/ /g, "").length * 2 +
    Math.round(Math.min(1, Math.max(0, patienceLeft)) * 10);
  const points = isStreak(s) ? base * 2 : base;
  const streak = s.streak + 1;
  return {
    ...s,
    score: s.score + points,
    cared: s.cared + 1,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
  };
}

/** An animal waited too long (it just gets sad - nobody leaves). */
export const zooOnMiss = (s: ZooShiftState): ZooShiftState => ({
  ...s,
  missed: s.missed + 1,
  streak: 0,
});

/** 1-3 stars from animals looked after in one shift. */
export const zooStars = (cared: number): number =>
  cared >= 16 ? 3 : cared >= 9 ? 2 : cared > 0 ? 1 : 0;

/** 0-100 happiness for one animal after care or a miss. */
export const nextHappiness = (h: number, cared: boolean): number =>
  cared ? Math.min(100, h + 20) : Math.max(10, h - 20);

export { pick as pickRandom };

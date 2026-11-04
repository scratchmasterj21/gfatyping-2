import type { DifficultyOption } from "../components/DifficultySegmented";

export type TowerDifficulty = DifficultyOption & {
  seconds: number;
  /** Floors Tappy slides down after too many cracks. */
  slideFloors: number;
};

export const TOWER_DIFFICULTIES: TowerDifficulty[] = [
  {
    label: "Easy",
    hint: "90 sec · gentle slides",
    seconds: 90,
    slideFloors: 1,
  },
  { label: "Medium", hint: "60 sec", seconds: 60, slideFloors: 2 },
  { label: "Hard", hint: "45 sec · big slides", seconds: 45, slideFloors: 3 },
];

export const CRACKS_TO_SLIDE = 3;
/** Every Nth perfect word in a row is a double jump. */
export const STREAK_FOR_DOUBLE = 5;

export type TowerState = {
  floor: number;
  highest: number;
  cracks: number;
  streak: number;
  words: number;
  typos: number;
  doubleJumps: number;
};

export const initialTower = (): TowerState => ({
  floor: 0,
  highest: 0,
  cracks: 0,
  streak: 0,
  words: 0,
  typos: 0,
  doubleJumps: 0,
});

/**
 * A finished word. `clean` = no typo while typing it; only clean words grow
 * the streak, and every STREAK_FOR_DOUBLE clean words in a row jumps twice.
 */
export function towerOnWord(s: TowerState, clean: boolean): TowerState {
  const streak = clean ? s.streak + 1 : 0;
  const double = clean && streak % STREAK_FOR_DOUBLE === 0;
  const floor = s.floor + (double ? 2 : 1);
  return {
    ...s,
    floor,
    highest: Math.max(s.highest, floor),
    streak,
    words: s.words + 1,
    doubleJumps: s.doubleJumps + (double ? 1 : 0),
  };
}

/** A typo cracks the block; enough cracks and Tappy slides down. */
export function towerOnTypo(
  s: TowerState,
  slideFloors: number,
): { state: TowerState; slid: boolean } {
  const cracks = s.cracks + 1;
  const base = { ...s, streak: 0, typos: s.typos + 1 };
  if (cracks >= CRACKS_TO_SLIDE) {
    return {
      state: { ...base, cracks: 0, floor: Math.max(0, s.floor - slideFloors) },
      slid: true,
    };
  }
  return { state: { ...base, cracks }, slid: false };
}

/** Height counts most; careful typing adds a bonus. */
export function towerScore(s: TowerState): number {
  const accuracy = s.words === 0 ? 0 : s.words / (s.words + s.typos);
  return s.highest * 10 + Math.round(accuracy * s.words * 2);
}

/** 1-3 stars from the highest floor, scaled to the round length. */
export function towerStars(highest: number, seconds: number): number {
  if (highest <= 0) return 0;
  if (highest >= Math.round(seconds / 4)) return 3;
  if (highest >= Math.round(seconds / 8)) return 2;
  return 1;
}

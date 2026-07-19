import { CompletedEvent, XpBreakdown } from "@monkeytype/schemas/results";
import { PersonalBest, PersonalBests } from "@monkeytype/schemas/shared";

export type PersonalBestsLike = PersonalBests;

export type StreakData = {
  length: number;
  maxLength: number;
  lastResultTimestamp: number;
  hourOffset?: number;
};

type PbCriteria = {
  punctuation: boolean;
  numbers: boolean;
  difficulty: string;
  language: string;
  lazyMode: boolean;
};

function matchesPb(pb: PersonalBest, c: PbCriteria): boolean {
  return (
    (pb.punctuation ?? false) === c.punctuation &&
    (pb.numbers ?? false) === c.numbers &&
    pb.difficulty === c.difficulty &&
    pb.language === c.language &&
    (pb.lazyMode ?? false) === c.lazyMode
  );
}

export function emptyPersonalBests(): PersonalBests {
  return {
    time: {},
    words: {},
    quote: {},
    zen: {},
    custom: {},
  } as PersonalBests;
}

/**
 * Check whether the result is a personal best and, if so, update `personalBests`
 * in place. Quote mode is never tracked as a PB (mirrors the client behaviour).
 */
export function checkAndUpdatePersonalBest(
  personalBests: PersonalBests,
  result: CompletedEvent,
): { isPb: boolean; personalBests: PersonalBests } {
  const { mode } = result;
  if (mode === "quote" || mode === "zen") {
    return { isPb: false, personalBests };
  }

  const pbs = personalBests ?? emptyPersonalBests();
  const buckets = pbs as unknown as Record<
    string,
    Record<string, PersonalBest[]>
  >;
  const modeBucket = (buckets[mode] ??= {});
  const key = String(result.mode2);
  const list: PersonalBest[] = (modeBucket[key] ??= []);

  const criteria: PbCriteria = {
    punctuation: result.punctuation,
    numbers: result.numbers,
    difficulty: result.difficulty,
    language: result.language,
    lazyMode: result.lazyMode,
  };

  const existing = list.find((pb) => matchesPb(pb, criteria));
  const isPb = existing === undefined || result.wpm > existing.wpm;
  if (!isPb) return { isPb: false, personalBests: pbs };

  const entry: PersonalBest = {
    language: result.language,
    difficulty: result.difficulty,
    lazyMode: result.lazyMode,
    punctuation: result.punctuation,
    numbers: result.numbers,
    wpm: result.wpm,
    acc: result.acc,
    raw: result.rawWpm,
    consistency: result.consistency,
    timestamp: Date.now(),
  };

  if (existing === undefined) {
    list.push(entry);
  } else {
    Object.assign(existing, entry);
  }

  return { isPb: true, personalBests: pbs };
}

/**
 * Returns the best wpm stored for a given mode/mode2/variant in `personalBests`.
 */
export function getPersonalBestWpm(
  personalBests: PersonalBests | undefined,
  mode: string,
  mode2: string,
  criteria: PbCriteria,
): number {
  if (personalBests === undefined) return 0;
  const buckets = personalBests as unknown as Record<
    string,
    Record<string, PersonalBest[]>
  >;
  const list: PersonalBest[] = buckets[mode]?.[mode2] ?? [];
  return list.find((pb) => matchesPb(pb, criteria))?.wpm ?? 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayIndex(timestamp: number, hourOffset = 0): number {
  return Math.floor((timestamp - hourOffset * 60 * 60 * 1000) / DAY_MS);
}

/**
 * Simplified streak calculation based on the day-difference between the previous
 * and current result.
 */
export function computeStreak(
  current: StreakData | undefined,
  resultTimestamp: number,
): StreakData {
  const hourOffset = current?.hourOffset;
  const prevTimestamp = current?.lastResultTimestamp ?? 0;
  const prevLength = current?.length ?? 0;
  const prevMax = current?.maxLength ?? 0;

  let length: number;
  if (prevTimestamp === 0 || prevLength === 0) {
    length = 1;
  } else {
    const diff =
      dayIndex(resultTimestamp, hourOffset) -
      dayIndex(prevTimestamp, hourOffset);
    if (diff === 0) {
      length = prevLength; // same day, unchanged
    } else if (diff === 1) {
      length = prevLength + 1;
    } else {
      length = 1; // streak broken
    }
  }

  return {
    length,
    maxLength: Math.max(prevMax, length),
    lastResultTimestamp: resultTimestamp,
    hourOffset,
  };
}

/**
 * Simplified XP calculation: a base award proportional to typing time, plus a
 * small bonus for perfect accuracy. (The full Monkeytype formula lived in the
 * Express backend which we no longer run.)
 */
export function computeXp(result: CompletedEvent): {
  xp: number;
  breakdown: XpBreakdown;
} {
  const typedTime =
    result.testDuration +
    (result.incompleteTestSeconds ?? 0) -
    (result.afkDuration ?? 0);

  const base = Math.max(1, Math.round(Math.max(0, typedTime) * 2));
  const breakdown: XpBreakdown = { base };

  let xp = base;
  if (result.acc === 100) {
    const fullAccuracy = Math.round(base * 0.15);
    breakdown.fullAccuracy = fullAccuracy;
    xp += fullAccuracy;
  }

  return { xp, breakdown };
}

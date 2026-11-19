import type { DifficultyOption } from "../components/DifficultySegmented";

export type Side = "left" | "right";

export type PongDifficulty = DifficultyOption & {
  /** Time to type the first word of a rally, ms. */
  baseMs: number;
  /** Fastest the ball ever gets, ms. */
  minMs: number;
  /** How much faster each hit in a rally makes the ball, ms. */
  stepMs: number;
  /** Tappy's chance to return a short word (solo). */
  botAccuracy: number;
  /** Tappy's "typing" time per letter (solo), ms. */
  botCharMs: number;
};

export const PONG_DIFFICULTIES: PongDifficulty[] = [
  {
    label: "Easy",
    hint: "slow ball",
    baseMs: 8000,
    minMs: 4000,
    stepMs: 400,
    botAccuracy: 0.6,
    botCharMs: 420,
  },
  {
    label: "Medium",
    baseMs: 6500,
    minMs: 3200,
    stepMs: 400,
    botAccuracy: 0.72,
    botCharMs: 330,
  },
  {
    label: "Hard",
    hint: "fast ball",
    baseMs: 5000,
    minMs: 2500,
    stepMs: 350,
    botAccuracy: 0.84,
    botCharMs: 250,
  },
];

/** First to this many points wins. */
export const WIN_POINTS = 7;
/** Tournament matches are shorter (4 matches in a row). */
export const TOURNAMENT_POINTS = 5;
/** A series (rematches online) is won with this many match wins. */
export const SERIES_WINS = 2;

/**
 * Special balls:
 *   fire   - flies much faster
 *   spin   - the word wobbles
 *   ghost  - the word fades in and out
 *   giant  - a long word (a bit more time)
 * A whole rally can also be golden: its point is worth 2.
 */
export type BallKind = "normal" | "fire" | "spin" | "ghost" | "giant";
export const SHOTS: Exclude<BallKind, "normal">[] = [
  "fire",
  "spin",
  "ghost",
  "giant",
];
export const SHOT_INFO: Record<
  Exclude<BallKind, "normal">,
  { emoji: string; name: string; tip: string }
> = {
  fire: { emoji: "🔥", name: "Fire ball", tip: "super fast!" },
  spin: { emoji: "🌀", name: "Spin ball", tip: "the word wobbles!" },
  ghost: { emoji: "👻", name: "Ghost ball", tip: "the word fades away!" },
  giant: { emoji: "🐘", name: "Giant ball", tip: "a giant word!" },
};

export type PongState = {
  score: Record<Side, number>;
  /** hits in the current rally (the ball speeds up with each) */
  hits: number;
  /** side that must type the word to return the ball */
  toSide: Side;
  /** increases with every ball sent - keeps multiplayer updates in order */
  seq: number;
  word: string;
  over: boolean;
  /** side that won the last point, for the banner */
  lastPoint?: Side;
  /** this ball (missing = normal) */
  ball?: BallKind;
  /** this ball was smashed (faster) */
  smash?: boolean;
  /** this rally's point is worth 2 */
  golden?: boolean;
  /** points needed to win (missing = WIN_POINTS) */
  target?: number;
  /** match wins across rematches (online) */
  series?: Record<Side, number>;
};

export const otherSide = (s: Side): Side => (s === "left" ? "right" : "left");

/** Every 6th rally or so is golden (decided by seq, so both players agree). */
export const goldenRally = (seq: number): boolean =>
  seq > 3 && (seq * 2654435761) % 997 < 166;

export function initialPong(
  firstWord: string,
  toSide: Side = "left",
  opts: { target?: number; seq?: number; series?: Record<Side, number> } = {},
): PongState {
  return {
    score: { left: 0, right: 0 },
    hits: 0,
    toSide,
    seq: opts.seq ?? 1,
    word: firstWord,
    over: false,
    ...(opts.target === undefined ? {} : { target: opts.target }),
    ...(opts.series === undefined ? {} : { series: opts.series }),
  };
}

const SMASH_SPEED = 0.65;
const FIRE_SPEED = 0.6;
const GIANT_SPEED = 1.3;

/** Ball travel time for this many hits into a rally. */
export function speedFor(
  d: PongDifficulty,
  hits: number,
  ball: { ball?: BallKind; smash?: boolean } = {},
): number {
  const base = Math.max(d.minMs, d.baseMs - hits * d.stepMs);
  let factor = 1;
  if (ball.smash === true) factor *= SMASH_SPEED;
  if (ball.ball === "fire") factor *= FIRE_SPEED;
  if (ball.ball === "giant") factor *= GIANT_SPEED;
  return Math.round(Math.max(d.minMs * 0.55, base * factor));
}

const cleanWords = (pool: string[]): string[] =>
  pool.filter((w) => w.length > 0 && !w.includes(" "));

/**
 * The next word: rallies start short and grow (3 letters, then longer every
 * two hits, up to 8). `seq` makes the pick deterministic.
 */
export function wordForRally(
  pool: string[],
  hits: number,
  seq: number,
): string {
  const clean = cleanWords(pool);
  if (clean.length === 0) return "pong";
  const lo = Math.min(3 + Math.floor(hits / 2), 8);
  const band = clean.filter((w) => w.length >= lo && w.length <= lo + 2);
  const source = band.length > 0 ? band : clean;
  return source[(seq * 7919) % source.length] ?? "pong";
}

/** A giant ball's word: one of the longest in the list. */
export function giantWord(pool: string[], seq: number): string {
  const clean = [...new Set(cleanWords(pool))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  if (clean.length === 0) return "elephant";
  const top = clean.slice(0, Math.max(3, Math.ceil(clean.length / 6)));
  return top[(seq * 7919) % top.length] ?? "elephant";
}

/** Short "power words" typed while the ball is on the other side. */
export function powerWord(pool: string[], n: number): string {
  const clean = cleanWords(pool).filter((w) => w.length <= 4);
  const source = clean.length > 0 ? clean : ["zap", "pow", "zip", "bam"];
  return source[(n * 104729 + 17) % source.length] ?? "zap";
}

/** The next ball's word, for this kind of ball. */
export function nextWord(
  pool: string[],
  hits: number,
  seq: number,
  ball: BallKind = "normal",
): string {
  return ball === "giant"
    ? giantWord(pool, seq)
    : wordForRally(pool, hits, seq);
}

export type HitOpts = { smash?: boolean; shot?: BallKind };

/** The side that had to type returned the ball. */
export function onReturn(
  s: PongState,
  word: string,
  opts: HitOpts = {},
): PongState {
  const next: PongState = {
    ...s,
    hits: s.hits + 1,
    toSide: otherSide(s.toSide),
    seq: s.seq + 1,
    word,
  };
  delete next.ball;
  delete next.smash;
  delete next.lastPoint;
  if (opts.shot !== undefined && opts.shot !== "normal") next.ball = opts.shot;
  if (opts.smash === true) next.smash = true;
  return next;
}

/**
 * The receiving side missed: the other side scores (2 on a golden rally), a
 * new rally starts and the scorer gets the next ball.
 */
export function onMiss(s: PongState, word: string): PongState {
  const winner = otherSide(s.toSide);
  const score = {
    ...s.score,
    [winner]: s.score[winner] + (s.golden === true ? 2 : 1),
  };
  const target = s.target ?? WIN_POINTS;
  const over = score[winner] >= target;
  const seq = s.seq + 1;
  const next: PongState = {
    score,
    hits: 0,
    toSide: winner,
    seq,
    word,
    over,
    lastPoint: winner,
  };
  if (s.target !== undefined) next.target = s.target;
  if (!over && goldenRally(seq)) next.golden = true;
  if (s.series !== undefined || over) {
    const series = s.series ?? { left: 0, right: 0 };
    next.series = over ? { ...series, [winner]: series[winner] + 1 } : series;
  }
  return next;
}

/** Does Tappy return this word, and how long does it take? */
export function botReturn(
  d: PongDifficulty,
  word: string,
  rng: () => number,
  ball: BallKind = "normal",
): { returns: boolean; delayMs: number } {
  const trick = ball === "ghost" ? 0.15 : ball === "spin" ? 0.1 : 0;
  const chance = Math.max(
    0.25,
    d.botAccuracy - Math.max(0, word.length - 4) * 0.04 - trick,
  );
  return {
    returns: rng() < chance,
    delayMs: 500 + word.length * d.botCharMs,
  };
}

// ---------------------------------------------------------------- bots

export type PongBot = {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  difficulty: PongDifficulty;
  /** chance to smash a return */
  smash: number;
  /** sends a special shot every this many returns (0 = never) */
  shotEvery: number;
  /** sends longer words */
  longWords: boolean;
};

const diff = (
  label: string,
  tweak: Partial<PongDifficulty> = {},
): PongDifficulty => ({
  ...(PONG_DIFFICULTIES.find((d) => d.label === label) as PongDifficulty),
  ...tweak,
});

/** Tournament opponents, in order. */
export const TOURNAMENT: PongBot[] = [
  {
    id: "squirrel",
    name: "Speedy Squirrel",
    emoji: "🐿️",
    blurb: "short words, fast smashes",
    difficulty: diff("Easy", { botCharMs: 300 }),
    smash: 0.3,
    shotEvery: 0,
    longWords: false,
  },
  {
    id: "owl",
    name: "Wise Owl",
    emoji: "🦉",
    blurb: "loves long words",
    difficulty: diff("Easy", { botAccuracy: 0.7 }),
    smash: 0,
    shotEvery: 0,
    longWords: true,
  },
  {
    id: "frog",
    name: "Tricky Frog",
    emoji: "🐸",
    blurb: "special shots!",
    difficulty: diff("Medium"),
    smash: 0.1,
    shotEvery: 3,
    longWords: false,
  },
  {
    id: "champ",
    name: "Champion Tappy",
    emoji: "🏆",
    blurb: "a bit of everything",
    difficulty: diff("Medium", { botAccuracy: 0.8, botCharMs: 280 }),
    smash: 0.2,
    shotEvery: 4,
    longWords: true,
  },
];

/** Tappy in a normal match: plain returns. */
export const tappyBot = (d: PongDifficulty): PongBot => ({
  id: "tappy",
  name: "Tappy",
  emoji: "🏓",
  blurb: "",
  difficulty: d,
  smash: 0,
  shotEvery: 0,
  longWords: false,
});

/** What a bot sends back on its n-th return. */
export function botShot(bot: PongBot, returns: number, roll: number): HitOpts {
  const opts: HitOpts = {};
  if (bot.shotEvery > 0 && returns > 0 && returns % bot.shotEvery === 0) {
    opts.shot = SHOTS[Math.floor(roll * SHOTS.length) % SHOTS.length];
  }
  if (roll < bot.smash) opts.smash = true;
  return opts;
}

// ---------------------------------------------------------------- rally mode

/** Rally mode: the wall sends the ball back after this long. */
export const WALL_MS = 900;
/** Rally mode ball speed (Medium, but a little gentler to start). */
export const RALLY_DIFFICULTY: PongDifficulty = diff("Medium", {
  baseMs: 7000,
  minMs: 2600,
  stepMs: 250,
});

// ---------------------------------------------------------------- score

/** A smash: typed with no mistakes in under this share of the ball time. */
export const SMASH_SHARE = 0.4;
/** Power words to fill the meter. */
export const POWER_WORDS = 3;

/** Score for coins and the high-score table. */
export function pongScore(myPoints: number, won: boolean): number {
  return myPoints * 10 + (won ? 30 : 0);
}

/** 3 for a win, 2 for a close loss (4+ points), 1 for any point. */
export function pongStars(myPoints: number, won: boolean): number {
  if (won) return 3;
  if (myPoints >= 4) return 2;
  return myPoints > 0 ? 1 : 0;
}

/** Rally mode score: each hit 10. */
export const rallyScore = (hits: number): number => hits * 10;
export function rallyStars(hits: number): number {
  if (hits >= 25) return 3;
  if (hits >= 12) return 2;
  return hits > 0 ? 1 : 0;
}

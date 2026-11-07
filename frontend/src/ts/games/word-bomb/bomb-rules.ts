import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Word Bomb: 2-6 players in a circle pass a bomb by typing the word on it.
 * The fuse length is a secret; whoever holds the bomb when it goes off loses
 * a life. Words get longer the longer a round lasts, and fuses get shorter
 * every round. Last player with lives left wins. Pure, so solo (with Tappy
 * bots) and online rooms share it.
 */

export const START_LIVES = 3;
export const MAX_BOMB_PLAYERS = 6;
/** Pause after a boom before the next round, ms. */
export const BOOM_PAUSE_MS = 2800;
/** Pause before the very first round, ms. */
export const START_PAUSE_MS = 2500;
/** The bomb shakes this long before it goes off (a little warning), ms. */
export const DANGER_MS = 2500;

export type BombDifficulty = DifficultyOption & {
  /** secret fuse for round 1 is picked between these, ms */
  fuseMinMs: number;
  fuseMaxMs: number;
  /** whoever gets the bomb always has at least this long to pass it, ms */
  minHoldMs: number;
  /** word pools: the first, then the second after `harderAfter` passes */
  words: [string[], string[]];
  harderAfter: number;
  botThinkMs: number;
  botCharMs: number;
  /** chance a Tappy bot fumbles and takes a few extra seconds */
  botFumble: number;
};

export const BOMB_DIFFICULTIES: BombDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    fuseMinMs: 20000,
    fuseMaxMs: 32000,
    minHoldMs: 3500,
    words: [EASY_WORDS, MEDIUM_WORDS],
    harderAfter: 6,
    botThinkMs: 1600,
    botCharMs: 460,
    botFumble: 0.25,
  },
  {
    label: "Medium",
    fuseMinMs: 15000,
    fuseMaxMs: 25000,
    minHoldMs: 3000,
    words: [MEDIUM_WORDS, HARD_WORDS],
    harderAfter: 6,
    botThinkMs: 1100,
    botCharMs: 340,
    botFumble: 0.2,
  },
  {
    label: "Hard",
    hint: "long words",
    fuseMinMs: 11000,
    fuseMaxMs: 19000,
    minHoldMs: 2500,
    words: [HARD_WORDS, HARD_WORDS],
    harderAfter: 0,
    botThinkMs: 800,
    botCharMs: 260,
    botFumble: 0.15,
  },
];

export function bombDifficultyFor(label: string): BombDifficulty {
  return (
    BOMB_DIFFICULTIES.find((d) => d.label === label) ??
    (BOMB_DIFFICULTIES[0] as BombDifficulty)
  );
}

export type BombState = {
  /** increases with every change - keeps online updates in order */
  seq: number;
  /** seating order around the circle (player ids) */
  order: string[];
  lives: Record<string, number>;
  /** who has the bomb */
  holder: string;
  /** the word the holder must type */
  word: string;
  /** passes this round (words get longer) */
  passes: number;
  /** passes per player, for the score */
  totalPasses: Record<string, number>;
  roundNo: number;
  /** when this round's bomb is lit (ms, same clock as `now`) */
  roundStartAt: number;
  /** when the holder got the bomb */
  heldSince: number;
  /** when the fuse runs out (the secret) */
  fuseEndAt: number;
  minHoldMs: number;
  over: boolean;
  winner?: string;
  /** when each knocked-out player lost their last life */
  outAt?: Record<string, number>;
  lastBoom?: { id: string; at: number };
  lastPass?: { from: string; to: string };
};

export const aliveIds = (s: BombState): string[] =>
  s.order.filter((id) => (s.lives[id] ?? 0) > 0);

/** The next player round the circle who still has lives. */
export function nextAlive(s: BombState, id: string): string {
  const n = s.order.length;
  const start = s.order.indexOf(id);
  for (let step = 1; step <= n; step++) {
    const next = s.order[(start + step) % n] as string;
    if ((s.lives[next] ?? 0) > 0) return next;
  }
  return id;
}

/** When the bomb really goes off (never right after you catch it). */
export const explodeAt = (s: BombState): number =>
  Math.max(s.fuseEndAt, s.heldSince + s.minHoldMs);

/** Words get longer as a round goes on. */
export function wordForPass(
  d: BombDifficulty,
  passes: number,
  rng: () => number,
  avoid?: string,
): string {
  const pool = passes >= d.harderAfter ? d.words[1] : d.words[0];
  const fresh = pool.filter((w) => w !== avoid);
  return fresh[Math.floor(rng() * fresh.length)] ?? "boom";
}

/** Secret fuse length; shorter every round (down to 60%). */
export function fuseFor(
  d: BombDifficulty,
  roundNo: number,
  rng: () => number,
): number {
  const scale = Math.max(0.6, 1 - (roundNo - 1) * 0.08);
  return Math.round(
    (d.fuseMinMs + rng() * (d.fuseMaxMs - d.fuseMinMs)) * scale,
  );
}

function lightRound(
  s: BombState,
  holder: string,
  d: BombDifficulty,
  startAt: number,
  rng: () => number,
): BombState {
  const roundNo = s.roundNo + 1;
  return {
    ...s,
    holder,
    word: wordForPass(d, 0, rng, s.word),
    passes: 0,
    roundNo,
    roundStartAt: startAt,
    heldSince: startAt,
    fuseEndAt: startAt + fuseFor(d, roundNo, rng),
  };
}

export function newBombMatch(
  order: string[],
  d: BombDifficulty,
  now: number,
  rng: () => number,
): BombState {
  const base: BombState = {
    seq: 1,
    order,
    lives: Object.fromEntries(order.map((id) => [id, START_LIVES])),
    holder: order[0] as string,
    word: "",
    passes: 0,
    totalPasses: Object.fromEntries(order.map((id) => [id, 0])),
    roundNo: 0,
    roundStartAt: 0,
    heldSince: 0,
    fuseEndAt: 0,
    minHoldMs: d.minHoldMs,
    over: false,
  };
  const first = order[Math.floor(rng() * order.length)] as string;
  return lightRound(base, first, d, now + START_PAUSE_MS, rng);
}

/** Is the bomb lit and ticking right now? */
export const bombLive = (s: BombState, now: number): boolean =>
  !s.over && now >= s.roundStartAt && now < explodeAt(s);

/** The holder typed the word: pass the bomb on. */
export function applyPass(
  s: BombState,
  by: string,
  d: BombDifficulty,
  now: number,
  rng: () => number,
): BombState | null {
  if (by !== s.holder || !bombLive(s, now)) return null;
  const to = nextAlive(s, by);
  const passes = s.passes + 1;
  return {
    ...s,
    seq: s.seq + 1,
    holder: to,
    word: wordForPass(d, passes, rng, s.word),
    passes,
    heldSince: now,
    totalPasses: { ...s.totalPasses, [by]: (s.totalPasses[by] ?? 0) + 1 },
    lastPass: { from: by, to },
  };
}

/** The fuse ran out: the holder loses a life, a new round starts. */
export function applyBoom(
  s: BombState,
  d: BombDifficulty,
  now: number,
  rng: () => number,
): BombState | null {
  if (s.over || now < explodeAt(s)) return null;
  const id = s.holder;
  const left = Math.max(0, (s.lives[id] ?? 0) - 1);
  const lives = { ...s.lives, [id]: left };
  const outAt = left === 0 ? { ...s.outAt, [id]: now } : s.outAt;
  const after: BombState = {
    ...s,
    seq: s.seq + 1,
    lives,
    ...(outAt !== undefined ? { outAt } : {}),
    lastBoom: { id, at: now },
  };
  const alive = aliveIds(after);
  if (alive.length <= 1) {
    return {
      ...after,
      over: true,
      ...(alive[0] !== undefined ? { winner: alive[0] } : {}),
    };
  }
  return lightRound(after, nextAlive(after, id), d, now + BOOM_PAUSE_MS, rng);
}

// ---------------- Tappy bots ----------------

export const BOMB_BOTS = [
  { id: "bot-tappy", name: "Tappy" },
  { id: "bot-zippy", name: "Zippy" },
  { id: "bot-bloop", name: "Bloop" },
];

/** How long a bot takes to pass the bomb, ms. */
export function botPassMs(
  d: BombDifficulty,
  word: string,
  rng: () => number,
): number {
  const fumble = rng() < d.botFumble ? 2000 + rng() * 3500 : 0;
  return (
    d.botThinkMs * (0.6 + rng() * 0.8) +
    word.length * d.botCharMs * (0.8 + rng() * 0.5) +
    fumble
  );
}

// ---------------- results ----------------

/** 1 = winner; knocked out later = better place. */
export function bombPlace(s: BombState, id: string): number {
  if (s.winner === id) return 1;
  const mine = s.outAt?.[id] ?? Infinity;
  return (
    1 +
    s.order.filter((other) => {
      if (other === id) return false;
      return (s.outAt?.[other] ?? Infinity) > mine;
    }).length
  );
}

/** Score for coins and the high-score table. */
export function bombScore(s: BombState, id: string): number {
  const beaten = s.order.length - bombPlace(s, id);
  return (
    Math.min(s.totalPasses[id] ?? 0, 40) * 5 +
    beaten * 10 +
    (s.winner === id ? 40 : 0)
  );
}

/** 3 for a win, 2 for the top half, 1 for passing at all. */
export function bombStars(s: BombState, id: string): number {
  const place = bombPlace(s, id);
  if (place === 1) return 3;
  if (place <= Math.ceil(s.order.length / 2)) return 2;
  return (s.totalPasses[id] ?? 0) > 0 ? 1 : 0;
}

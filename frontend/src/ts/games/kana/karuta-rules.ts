import { KARUTA_CARDS, KanaDifficulty } from "./kana-words";

/**
 * Karuta Battle: hiragana picture-word cards on the table. Each round shows
 * a clue (picture + English); first to type the matching card takes it.
 * Typing a different card on the table is a fault: you sit out that round.
 * Most cards wins. Pure, so solo and online share it.
 */

export const KARUTA_TOTAL_CARDS = 16;
export const KARUTA_MAX_ROUNDS = 24;
/** A round nobody wins moves on after this long, ms. */
export const KARUTA_ROUND_MS = 20000;
export const KARUTA_START_PAUSE_MS = 2500;
export const KARUTA_ROUND_PAUSE_MS = 1800;

export type KarutaState = {
  seq: number;
  order: string[];
  /** cards face up (kana) */
  table: string[];
  /** cards still to come */
  deck: string[];
  /** the card to find this round */
  clue: string;
  round: number;
  roundStartAt: number;
  scores: Record<string, number>;
  /** player -> round they faulted in (they sit that round out) */
  faults?: Record<string, number>;
  /** what happened last, for the banner */
  last?: { id?: string; kana: string; kind: "take" | "fault" | "skip" };
  over: boolean;
};

export function tableSizeFor(d: KanaDifficulty): number {
  return d.label === "Easy" ? 6 : d.label === "Medium" ? 9 : 12;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function pickClue(table: string[], rng: () => number, avoid?: string): string {
  const choices = table.length > 1 ? table.filter((k) => k !== avoid) : table;
  return choices[Math.floor(rng() * choices.length)] ?? "";
}

/** RTDB drops empty arrays/objects - put them back after reading. */
export function normalizeKaruta(g: KarutaState): KarutaState {
  return {
    ...g,
    order: g.order ?? [],
    table: g.table ?? [],
    deck: g.deck ?? [],
    scores: g.scores ?? {},
  };
}

export function newKarutaMatch(
  order: string[],
  d: KanaDifficulty,
  now: number,
  rng: () => number,
): KarutaState {
  const cards = shuffle(
    KARUTA_CARDS.filter((c) => c.kana.length <= d.maxLen).map((c) => c.kana),
    rng,
  ).slice(0, KARUTA_TOTAL_CARDS);
  const size = tableSizeFor(d);
  const table = cards.slice(0, size);
  return {
    seq: 1,
    order,
    table,
    deck: cards.slice(size),
    clue: pickClue(table, rng),
    round: 1,
    roundStartAt: now + KARUTA_START_PAUSE_MS,
    scores: Object.fromEntries(order.map((id) => [id, 0])),
    over: false,
  };
}

export const satOut = (s: KarutaState, id: string): boolean =>
  s.faults?.[id] === s.round;

function nextRound(
  s: KarutaState,
  table: string[],
  deck: string[],
  now: number,
  rng: () => number,
  last: KarutaState["last"],
): KarutaState {
  const round = s.round + 1;
  const over = table.length === 0 || round > KARUTA_MAX_ROUNDS;
  return {
    ...s,
    seq: s.seq + 1,
    table,
    deck,
    clue: over ? "" : pickClue(table, rng, s.clue),
    round,
    roundStartAt: now + KARUTA_ROUND_PAUSE_MS,
    ...(last !== undefined ? { last } : {}),
    over,
  };
}

/** A player finished typing a card on the table. */
export function applyKarutaTake(
  s0: KarutaState,
  id: string,
  kana: string,
  now: number,
  rng: () => number,
): KarutaState | null {
  const s = normalizeKaruta(s0);
  if (s.over || now < s.roundStartAt || satOut(s, id)) return null;
  if (!s.table.includes(kana)) return null;
  if (kana !== s.clue) {
    return {
      ...s,
      seq: s.seq + 1,
      faults: { ...s.faults, [id]: s.round },
      last: { id, kana, kind: "fault" },
    };
  }
  const table = s.table.filter((k) => k !== kana);
  const [refill, ...deck] = s.deck;
  if (refill !== undefined) table.push(refill);
  return nextRound(
    { ...s, scores: { ...s.scores, [id]: (s.scores[id] ?? 0) + 1 } },
    table,
    deck,
    now,
    rng,
    { id, kana, kind: "take" },
  );
}

/** Nobody found it in time: new clue. */
export function applyKarutaSkip(
  s0: KarutaState,
  now: number,
  rng: () => number,
): KarutaState | null {
  const s = normalizeKaruta(s0);
  if (s.over || now < s.roundStartAt + KARUTA_ROUND_MS) return null;
  return nextRound(s, s.table, s.deck, now, rng, {
    kana: s.clue,
    kind: "skip",
  });
}

export function karutaRanking(s: KarutaState): { id: string; cards: number }[] {
  return s.order
    .map((id) => ({ id, cards: s.scores[id] ?? 0 }))
    .sort((a, b) => b.cards - a.cards);
}

export function karutaScore(s: KarutaState, id: string): number {
  const ranking = karutaRanking(s);
  const top = ranking[0]?.cards ?? 0;
  const mine = s.scores[id] ?? 0;
  return mine * 10 + (mine > 0 && mine === top ? 30 : 0);
}

export function karutaStars(s: KarutaState, id: string): number {
  const top = karutaRanking(s)[0]?.cards ?? 0;
  const mine = s.scores[id] ?? 0;
  if (mine > 0 && mine === top) return 3;
  if (mine * 2 >= top && mine > 0) return 2;
  return mine > 0 ? 1 : 0;
}

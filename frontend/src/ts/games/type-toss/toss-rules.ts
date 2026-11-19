/**
 * Type Toss rules (no DOM): a fair-ground stall. Type a target's word to
 * throw a ball at it and win tickets. Three stalls:
 *   ducks - ducks swim along two rows
 *   cans  - knock down every can in the stack for a bonus
 *   moles - moles pop up for a moment
 * Special targets: 🏆 golden prize, ⏱ bonus time, ✨ double tickets, and 💣
 * the trap (don't hit it!). Everything comes from the seed, so players in
 * the same online stall see the same targets.
 */

export type Stall = "ducks" | "cans" | "moles";

export const STALLS: Record<
  Stall,
  { name: string; emoji: string; tip: string }
> = {
  ducks: {
    name: "Duck Pond",
    emoji: "🦆",
    tip: "hit the ducks before they swim away",
  },
  cans: {
    name: "Can Stack",
    emoji: "🥫",
    tip: "knock down the whole stack for a bonus",
  },
  moles: {
    name: "Whack-a-word",
    emoji: "🐹",
    tip: "hit the moles before they hide",
  },
};
export const STALL_IDS = Object.keys(STALLS) as Stall[];

export type TossDifficulty = {
  label: string;
  hint?: string;
  /** round length, ms */
  timeMs: number;
  /** how fast things move / hide */
  pace: number;
};

export const TOSS_DIFFICULTIES: TossDifficulty[] = [
  { label: "Easy", hint: "slow targets", timeMs: 90_000, pace: 0.75 },
  { label: "Medium", timeMs: 60_000, pace: 1 },
  { label: "Hard", hint: "fast targets", timeMs: 45_000, pace: 1.3 },
];

export type TargetKind =
  | "duck"
  | "can"
  | "mole"
  | "golden"
  | "time"
  | "double"
  | "trap";

export const SPECIAL_INFO: Record<
  "golden" | "time" | "double" | "trap",
  { emoji: string; name: string; tip: string }
> = {
  golden: { emoji: "🏆", name: "Golden prize", tip: "5× tickets!" },
  time: { emoji: "⏱️", name: "Bonus time", tip: "+5 seconds" },
  double: {
    emoji: "✨",
    name: "Double tickets",
    tip: "2× tickets for 8 seconds",
  },
  trap: {
    emoji: "💣",
    name: "Trap",
    tip: "don't hit it - it costs 5 seconds!",
  },
};

export type Target = {
  id: string;
  kind: TargetKind;
  word: string;
  /** % of the stall */
  x: number;
  y: number;
  /** moles / specials disappear at this time */
  until?: number;
};

export type TossEvent =
  | {
      type: "hit";
      id: string;
      kind: TargetKind;
      x: number;
      y: number;
      tickets: number;
    }
  | { type: "stack"; bonus: number }
  | { type: "trap"; x: number; y: number }
  | { type: "time"; ms: number }
  | { type: "double" }
  | { type: "hot" }
  | { type: "miss" }
  | { type: "over" };

/** Clean words in a row for "hot hand" (2× tickets). */
export const HOT_HAND = 5;
const BONUS_TIME_MS = 5000;
const TRAP_MS = 5000;
const DOUBLE_MS = 8000;
const STACK_BONUS = 20;

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Can stack layout: 3 on the bottom, 2, then 1 (x, y in %). */
const CAN_SPOTS: [number, number][] = [
  [35, 72],
  [50, 72],
  [65, 72],
  [42.5, 52],
  [57.5, 52],
  [50, 32],
];
const MOLE_HOLES: [number, number][] = [
  [20, 40],
  [50, 40],
  [80, 40],
  [20, 75],
  [50, 75],
  [80, 75],
];

export class TossSim {
  readonly stall: Stall;
  readonly d: TossDifficulty;
  t = 0;
  /** ms left (bonus time and traps change it) */
  left: number;
  tickets = 0;
  words = 0;
  keys = 0;
  misses = 0;
  streak = 0;
  bestStreak = 0;
  targets: Target[] = [];
  typed = "";
  over = false;
  doubleUntil = 0;
  stacks = 0;
  private pool: string[];
  private seed: number;
  private gone = new Set<string>();
  private nextDuck = 0;
  private nextMole = 0;
  private nextSpecial = 0;
  private stackAt = 0;
  private wasWrong = false;

  constructor(opts: {
    stall: Stall;
    words: string[];
    seed: number;
    difficulty: TossDifficulty;
  }) {
    this.stall = opts.stall;
    this.d = opts.difficulty;
    this.left = opts.difficulty.timeMs;
    this.seed = opts.seed;
    const pool = opts.words.filter((w) => w.length > 0 && !w.includes(" "));
    this.pool = pool.length > 0 ? [...new Set(pool)] : ["toss", "duck", "win"];
    if (this.stall === "cans") this.newStack();
  }

  get hot(): boolean {
    return this.streak >= HOT_HAND;
  }
  get double(): boolean {
    return this.t < this.doubleUntil;
  }

  /** Same word for the same target id on every player's screen. */
  private wordFor(id: string, short = false): string {
    const from = short ? this.pool.filter((w) => w.length <= 5) : this.pool;
    const list = from.length > 0 ? from : this.pool;
    return list[hash(`${this.seed}:${id}`) % list.length] ?? "toss";
  }
  private rand(id: string): number {
    return (hash(`${this.seed}#${id}`) % 10_000) / 10_000;
  }

  private newStack(): void {
    const k = this.stacks;
    this.targets = this.targets.filter((t) => t.kind !== "can");
    CAN_SPOTS.forEach(([x, y], j) => {
      const id = `c${k}-${j}`;
      if (!this.gone.has(id)) {
        this.targets.push({ id, kind: "can", word: this.wordFor(id), x, y });
      }
    });
  }

  step(dt: number): TossEvent[] {
    if (this.over) return [];
    this.t += dt;
    this.left -= dt;
    const events: TossEvent[] = [];
    const pace = this.d.pace;
    // ducks swim right along two rows
    if (this.stall === "ducks") {
      const gap = 1700 / pace;
      while (this.t >= this.nextDuck * gap) {
        const i = this.nextDuck++;
        const id = `d${i}`;
        if (!this.gone.has(id)) {
          this.targets.push({
            id,
            kind: "duck",
            word: this.wordFor(id),
            x: -8,
            y: i % 2 === 0 ? 38 : 70,
          });
        }
      }
      const speed = (10 * pace * dt) / 1000;
      for (const t of this.targets) {
        if (t.kind === "duck") t.x += t.y < 50 ? speed : speed * 0.8;
      }
      this.targets = this.targets.filter((t) => t.kind !== "duck" || t.x < 108);
    }
    // moles pop up for a moment
    if (this.stall === "moles") {
      const gap = 1300 / pace;
      while (this.t >= this.nextMole * gap) {
        const i = this.nextMole++;
        const id = `m${i}`;
        const hole = MOLE_HOLES[
          Math.floor(this.rand(id) * MOLE_HOLES.length)
        ] ?? [50, 50];
        const busy = this.targets.some(
          (t) => t.kind === "mole" && t.x === hole[0] && t.y === hole[1],
        );
        if (!this.gone.has(id) && !busy) {
          this.targets.push({
            id,
            kind: "mole",
            word: this.wordFor(id, true),
            x: hole[0],
            y: hole[1],
            until: this.t + (3800 + this.rand(`${id}t`) * 1500) / pace,
          });
        }
      }
    }
    // a new can stack once the last one is down
    if (this.stall === "cans" && this.stackAt > 0 && this.t >= this.stackAt) {
      this.stackAt = 0;
      this.newStack();
    }
    // specials every ~9 s
    while (this.t >= 6000 + this.nextSpecial * 9000) {
      const i = this.nextSpecial++;
      const id = `s${i}`;
      const r = this.rand(id);
      const kind: TargetKind =
        r < 0.22 ? "trap" : r < 0.45 ? "time" : r < 0.7 ? "double" : "golden";
      if (!this.gone.has(id)) {
        this.targets.push({
          id,
          kind,
          word: this.wordFor(id, true),
          x: 15 + this.rand(`${id}x`) * 70,
          y: 18,
          until: this.t + 5000,
        });
      }
    }
    this.targets = this.targets.filter(
      (t) => t.until === undefined || t.until > this.t,
    );
    if (this.left <= 0) {
      this.left = 0;
      this.over = true;
      events.push({ type: "over" });
    }
    return events;
  }

  /** The typing box changed. */
  type(raw: string): TossEvent[] {
    if (this.over) return [];
    const value = raw.trim().toLowerCase();
    const events: TossEvent[] = [];
    const grew = value.length > this.typed.length;
    if (grew) this.keys += value.length - this.typed.length;
    const hit = this.targets.find((t) => t.word === value);
    if (hit !== undefined && value !== "") {
      this.typed = "";
      this.wasWrong = false;
      this.hitTarget(hit, events);
      return events;
    }
    const ok =
      value === "" || this.targets.some((t) => t.word.startsWith(value));
    if (!ok && !this.wasWrong && grew) {
      this.misses++;
      this.streak = 0;
      events.push({ type: "miss" });
    }
    this.wasWrong = !ok;
    this.typed = value;
    return events;
  }

  private hitTarget(hit: Target, events: TossEvent[]): void {
    this.remove(hit.id);
    if (hit.kind === "trap") {
      this.left = Math.max(0, this.left - TRAP_MS);
      this.streak = 0;
      events.push({ type: "trap", x: hit.x, y: hit.y });
      return;
    }
    this.words++;
    const wasHot = this.hot;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (!wasHot && this.hot) events.push({ type: "hot" });
    const mult =
      (this.hot ? 2 : 1) *
      (this.double ? 2 : 1) *
      (hit.kind === "golden" ? 5 : 1);
    const tickets = hit.word.length * mult;
    this.tickets += tickets;
    events.push({
      type: "hit",
      id: hit.id,
      kind: hit.kind,
      x: hit.x,
      y: hit.y,
      tickets,
    });
    if (hit.kind === "time") {
      this.left += BONUS_TIME_MS;
      events.push({ type: "time", ms: BONUS_TIME_MS });
    }
    if (hit.kind === "double") {
      this.doubleUntil = this.t + DOUBLE_MS;
      events.push({ type: "double" });
    }
    this.checkStack(events);
  }

  private remove(id: string): void {
    this.targets = this.targets.filter((t) => t.id !== id);
    this.gone.add(id);
  }

  private checkStack(events: TossEvent[]): void {
    if (this.stall !== "cans" || this.stackAt > 0) return;
    if (this.targets.some((t) => t.kind === "can")) return;
    this.tickets += STACK_BONUS;
    this.stacks++;
    this.stackAt = this.t + 700;
    events.push({ type: "stack", bonus: STACK_BONUS });
  }

  /** Online: someone else hit this target first. */
  remoteHit(id: string): TossEvent[] {
    const events: TossEvent[] = [];
    if (this.gone.has(id)) return events;
    this.remove(id);
    // a stack knocked down together still makes a new stack (no bonus for me)
    if (
      this.stall === "cans" &&
      this.stackAt === 0 &&
      !this.targets.some((t) => t.kind === "can")
    ) {
      this.stacks++;
      this.stackAt = this.t + 700;
    }
    return events;
  }

  accuracy(): number {
    return this.keys > 0
      ? Math.max(0, Math.round(((this.keys - this.misses) / this.keys) * 100))
      : 100;
  }

  wpm(): number {
    return this.t > 1000 ? Math.round(this.words / (this.t / 60_000)) : 0;
  }
}

/** 1-3 stars from tickets per minute of play. */
export function tossStars(
  tickets: number,
  words: number,
  timeMs: number,
): number {
  if (words <= 0) return 0;
  const perMin = tickets / Math.max(0.5, timeMs / 60_000);
  if (perMin >= 120) return 3;
  if (perMin >= 50) return 2;
  return 1;
}

// ---------------------------------------------------------------- prize booth

export type Prize = { id: string; emoji: string; name: string; price: number };

export const PRIZES: Prize[] = [
  { id: "teddy", emoji: "🧸", name: "Teddy", price: 100 },
  { id: "chick", emoji: "🐥", name: "Chick", price: 150 },
  { id: "frog", emoji: "🐸", name: "Frog", price: 200 },
  { id: "panda", emoji: "🐼", name: "Panda", price: 250 },
  { id: "dino", emoji: "🦖", name: "Dino", price: 300 },
  { id: "octopus", emoji: "🐙", name: "Octopus", price: 350 },
  { id: "unicorn", emoji: "🦄", name: "Unicorn", price: 400 },
  { id: "fox", emoji: "🦊", name: "Fox", price: 450 },
  { id: "whale", emoji: "🐳", name: "Whale", price: 500 },
  { id: "dragon", emoji: "🐉", name: "Dragon", price: 600 },
  { id: "lion", emoji: "🦁", name: "Lion", price: 700 },
  { id: "trophy", emoji: "🏆", name: "Giant trophy", price: 1000 },
];

// ---------------------------------------------------------------- daily

/** Daily Toss: the same stall, words and targets for everyone today. */
export function dailyTossPlan(day: number): {
  stall: Stall;
  seed: number;
  listId: string;
} {
  const lists = [
    "home-words",
    "top-words",
    "all-keys-2",
    "bottom-words",
    "all-keys-1",
    "all-keys-3",
  ];
  return {
    stall: STALL_IDS[day % STALL_IDS.length] ?? "ducks",
    seed: day * 2207 + 3,
    listId: lists[day % lists.length] ?? "home-words",
  };
}

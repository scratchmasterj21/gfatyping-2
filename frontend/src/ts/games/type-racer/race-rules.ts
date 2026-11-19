/**
 * Type Racer rules (no DOM): the computer racers, the player's run (words,
 * nitro, jumps, spin-outs, slipstream), standings, Grand Prix points, the
 * garage and the ghost of your best race.
 *
 * Distances are in characters: a word moves your car its length + 1 (the
 * space). The finish line is `target` characters away.
 */

export type GameColor =
  | "blue"
  | "red"
  | "green"
  | "yellow"
  | "purple"
  | "pink"
  | "orange"
  | "mint"
  | "navy"
  | "brown";

// ---------------------------------------------------------------- racers

export type CpuId = "tappy" | "turtle" | "fox" | "robot" | "bunny";

export type CpuRacer = {
  id: CpuId;
  name: string;
  emoji: string;
  color: GameColor;
  blurb: string;
};

export const CPU_RACERS: CpuRacer[] = [
  {
    id: "turtle",
    name: "Turbo Turtle",
    emoji: "🐢",
    color: "green",
    blurb: "slow and steady",
  },
  {
    id: "fox",
    name: "Zippy Fox",
    emoji: "🦊",
    color: "orange",
    blurb: "fast start, gets tired",
  },
  {
    id: "bunny",
    name: "Bouncy Bunny",
    emoji: "🐰",
    color: "pink",
    blurb: "goes in bursts",
  },
  {
    id: "tappy",
    name: "Tappy",
    emoji: "🏓",
    color: "red",
    blurb: "always the same speed",
  },
  {
    id: "robot",
    name: "Rocket Robot",
    emoji: "🤖",
    color: "navy",
    blurb: "super fast - but needs a pit stop",
  },
];

export const cpuInfo = (id: CpuId): CpuRacer =>
  CPU_RACERS.find((r) => r.id === id) as CpuRacer;

/** Robot's pit stop: when (s) and how long. */
const PIT_AT = 0.45;
const PIT_SECONDS = 3.5;

/**
 * How far (characters) a computer racer has gone after `t` seconds, at a
 * base speed of `cps` characters a second. Always grows with time.
 */
export function cpuDistance(
  id: CpuId,
  cps: number,
  t: number,
  raceSec: number,
): number {
  if (t <= 0) return 0;
  switch (id) {
    case "turtle":
      return cps * 0.82 * t;
    case "tappy":
      return cps * (t + 0.6 * Math.sin(t * 0.7) * Math.min(1, t / 3));
    case "fox":
      // 1.4x at the start, slowing to 0.75x
      return cps * (0.75 * t + 0.65 * 12 * (1 - Math.exp(-t / 12)));
    case "bunny":
      // bursts: speed 0.95 +/- 0.45
      return cps * (0.95 * t + 0.5 * (1 - Math.cos(0.9 * t)));
    case "robot": {
      const pit = raceSec * PIT_AT;
      const moving = t < pit ? t : Math.max(pit, t - PIT_SECONDS);
      return cps * 1.12 * moving;
    }
  }
}

/** Is the robot in the pits right now? */
export function inPits(id: CpuId, t: number, raceSec: number): boolean {
  const pit = raceSec * PIT_AT;
  return id === "robot" && t >= pit && t < pit + PIT_SECONDS;
}

/** Seconds until a computer racer crosses the line. */
export function cpuFinishSec(
  id: CpuId,
  cps: number,
  target: number,
  raceSec: number,
): number {
  let lo = 0;
  let hi = 1;
  while (cpuDistance(id, cps, hi, raceSec) < target && hi < 10_000) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cpuDistance(id, cps, mid, raceSec) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export type RaceDifficulty = {
  label: string;
  hint?: string;
  /** the field's base speed (Tappy's), words per minute */
  wpm: number;
};

export const RACE_DIFFICULTIES: RaceDifficulty[] = [
  { label: "Easy", hint: "slow racers", wpm: 16 },
  { label: "Medium", wpm: 28 },
  { label: "Hard", hint: "fast racers", wpm: 45 },
];

export const cpsFor = (wpm: number): number => (wpm * 5) / 60;

/** Finish line: Tappy gets there in about `raceSec` seconds. */
export const targetFor = (wpm: number, raceSec: number): number =>
  Math.max(40, Math.round(cpsFor(wpm) * raceSec));

/** Computer racers for `n` empty spots (online). */
export const botsFor = (n: number): CpuId[] =>
  (["tappy", "fox", "bunny", "turtle", "robot"] as CpuId[]).slice(
    0,
    Math.max(0, n),
  );

// ---------------------------------------------------------------- tracks

export type TrackId = "city" | "desert" | "snow" | "space";

export type TrackInfo = {
  id: TrackId;
  name: string;
  emoji: string;
};

export const TRACKS: Record<TrackId, TrackInfo> = {
  city: { id: "city", name: "City Circuit", emoji: "🏙️" },
  desert: { id: "desert", name: "Desert Dash", emoji: "🌵" },
  snow: { id: "snow", name: "Snowy Slopes", emoji: "❄️" },
  space: { id: "space", name: "Space Speedway", emoji: "🪐" },
};

/** Grand Prix: these tracks in order. */
export const GRAND_PRIX: TrackId[] = ["city", "desert", "snow"];
/** Points for 1st, 2nd, ... in a Grand Prix race. */
export const GP_POINTS = [10, 6, 4, 2, 1];

export type FeatureKind = "ramp" | "pad";
export type TrackFeature = { kind: FeatureKind; at: number };

/** Ramps (type the long word to jump) and a boost pad (nitro +2). */
export const TRACK_FEATURES: TrackFeature[] = [
  { kind: "ramp", at: 0.28 },
  { kind: "pad", at: 0.5 },
  { kind: "ramp", at: 0.7 },
];
/** "Final stretch!" from here. */
export const FINAL_STRETCH = 0.82;

export const trackForSeed = (seed: number): TrackId =>
  (["city", "desert", "snow", "space"] as TrackId[])[seed % 4] ?? "city";

// ---------------------------------------------------------------- the run

/** Clean words to fill the nitro meter. */
export const NITRO_WORDS = 5;
/** Wrong keys in a row that spin you out. */
export const SPIN_MISSES = 3;
/** Within this many characters behind a car: slipstream. */
export const SLIP_GAP = 6;

const BOOST_MS = 1800;
const JUMP_MS = 700;
const SPIN_MS = 600;

export type WordKind = "normal" | "nitro" | "jump";
export type QueuedWord = { text: string; kind: WordKind };

export type RunEvent =
  | { type: "word"; word: string; clean: boolean; slip: boolean }
  | { type: "nitroReady" }
  | { type: "boost" }
  | { type: "jump" }
  | { type: "bump" }
  | { type: "pad" }
  | { type: "spin" }
  | { type: "ramp" }
  | { type: "finish" };

type Push = { at: number; ms: number; chars: number };

const clean = (pool: string[]): string[] =>
  pool.filter((w) => w.length > 0 && !w.includes(" "));

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

/** One player's race. Feed it what's in the typing box. */
export class RaceRun {
  readonly target: number;
  readonly queue: QueuedWord[] = [];
  typed = "";
  /** letters of the current word typed right */
  good = 0;
  /** characters typed in finished words (incl. spaces) */
  chars = 0;
  words = 0;
  keys = 0;
  misses = 0;
  bestStreak = 0;
  streak = 0;
  /** clean words towards nitro */
  nitro = 0;
  finishedAt: number | undefined;
  private wordMisses = 0;
  private missRun = 0;
  private wasWrong = false;
  private pushes: Push[] = [];
  private passed = new Set<number>();
  private pool: string[];
  private order: string[] = [];
  private next = 0;
  private rng: () => number;
  private shuffle: boolean;

  constructor(opts: {
    words: string[];
    target: number;
    seed: number;
    /** online/daily: everyone gets the same words in list order */
    keepOrder?: boolean;
  }) {
    this.target = opts.target;
    const pool = clean(opts.words);
    this.pool = pool.length > 0 ? pool : ["type", "race", "fast", "win"];
    this.rng = seededRandom(opts.seed);
    this.shuffle = opts.keepOrder !== true;
    for (let i = 0; i < 8; i++) this.queue.push(this.draw());
  }

  get current(): QueuedWord {
    return this.queue[0] as QueuedWord;
  }

  get wrong(): boolean {
    return this.typed.length > this.good;
  }

  /** Where my car is (characters, incl. nitro/jumps/spins). */
  distance(now: number): number {
    let bonus = 0;
    for (const p of this.pushes) {
      bonus += p.chars * Math.min(1, Math.max(0, (now - p.at) / p.ms));
    }
    const d = this.chars + this.good + bonus;
    return Math.max(0, Math.min(this.target, d));
  }

  boosting(now: number): boolean {
    return this.pushes.some(
      (p) => p.ms === BOOST_MS && now - p.at < BOOST_MS && p.chars > 0,
    );
  }

  airborne(now: number): boolean {
    return this.pushes.some(
      (p) => p.ms === JUMP_MS && now - p.at < JUMP_MS && p.chars > 0,
    );
  }

  spinning(now: number): boolean {
    return this.pushes.some((p) => p.chars < 0 && now - p.at < SPIN_MS);
  }

  /**
   * The typing box changed. `others` = the other cars' distances (for the
   * slipstream). Returns what happened.
   */
  input(raw: string, now: number, others: number[] = []): RunEvent[] {
    if (this.finishedAt !== undefined) return [];
    const value = raw.replace(/^\s+/, "").toLowerCase();
    const events: RunEvent[] = [];
    const word = this.current.text.toLowerCase();
    const typedWord = value.trimEnd();
    if (typedWord === word && (value.endsWith(" ") || value === word)) {
      this.finishWord(now, others, events);
      return events;
    }
    // how much of the word is right
    let good = 0;
    while (
      good < value.length &&
      good < word.length &&
      value[good] === word[good]
    ) {
      good++;
    }
    const grew = value.length > this.typed.length;
    this.typed = value;
    this.good = good;
    const wrong = value.length > good;
    if (grew) {
      this.keys++;
      if (wrong && (!this.wasWrong || value.length > good + 1)) {
        this.misses++;
        this.wordMisses++;
        this.missRun++;
        if (this.missRun >= SPIN_MISSES) {
          this.missRun = 0;
          this.pushes.push({ at: now, ms: SPIN_MS, chars: -3 });
          events.push({ type: "spin" });
        }
      } else if (!wrong) {
        this.missRun = 0;
      }
    }
    this.wasWrong = wrong;
    this.checkFeatures(now, events);
    return events;
  }

  private finishWord(now: number, others: number[], events: RunEvent[]): void {
    const done = this.current;
    const isClean = this.wordMisses === 0;
    const before = this.distance(now);
    this.chars += done.text.length + 1;
    this.words++;
    this.keys += done.text.length - this.typed.length;
    // slipstream: just behind another car
    const slip = others.some((o) => o > before && o - before <= SLIP_GAP);
    if (slip) this.pushes.push({ at: now, ms: 300, chars: 1.5 });
    events.push({ type: "word", word: done.text, clean: isClean, slip });
    if (done.kind === "nitro") {
      this.pushes.push({
        at: now,
        ms: BOOST_MS,
        chars: Math.max(6, this.target * 0.07),
      });
      events.push({ type: "boost" });
    } else if (done.kind === "jump") {
      if (isClean) {
        this.pushes.push({ at: now, ms: JUMP_MS, chars: 5 });
        events.push({ type: "jump" });
      } else {
        events.push({ type: "bump" });
      }
    }
    if (isClean) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (done.kind !== "nitro") this.addNitro(1, events);
    } else {
      this.streak = 0;
      this.nitro = Math.max(0, this.nitro - 2);
    }
    this.queue.shift();
    this.queue.push(this.draw());
    this.typed = "";
    this.good = 0;
    this.wordMisses = 0;
    this.missRun = 0;
    this.wasWrong = false;
    this.checkFeatures(now, events);
    if (this.chars >= this.target && this.finishedAt === undefined) {
      this.finishedAt = now;
      events.push({ type: "finish" });
    }
  }

  private addNitro(n: number, events: RunEvent[]): void {
    if (this.queue.some((w) => w.kind === "nitro")) return;
    this.nitro = Math.min(NITRO_WORDS, this.nitro + n);
    if (this.nitro >= NITRO_WORDS) {
      this.nitro = 0;
      // the next word becomes the nitro word
      const slot = this.queue.length > 1 ? 1 : 0;
      this.queue[slot] = { text: this.nitroWord(), kind: "nitro" };
      events.push({ type: "nitroReady" });
    }
  }

  private checkFeatures(now: number, events: RunEvent[]): void {
    const at = this.distance(now) / this.target;
    TRACK_FEATURES.forEach((f, i) => {
      if (this.passed.has(i) || at < f.at - 0.06) return;
      this.passed.add(i);
      if (f.kind === "pad") {
        events.push({ type: "pad" });
        this.addNitro(2, events);
      } else {
        // the next word is the long jump word
        const slot = this.queue.length > 1 ? 1 : 0;
        if (this.queue[slot]?.kind === "normal") {
          this.queue[slot] = { text: this.jumpWord(), kind: "jump" };
          events.push({ type: "ramp" });
        }
      }
    });
  }

  private draw(): QueuedWord {
    if (this.next >= this.order.length) {
      this.order = [...this.pool];
      if (this.shuffle) {
        for (let i = this.order.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [this.order[i], this.order[j]] = [
            this.order[j] as string,
            this.order[i] as string,
          ];
        }
      }
      this.next = 0;
    }
    return { text: this.order[this.next++] ?? "go", kind: "normal" };
  }

  private nitroWord(): string {
    const short = this.pool.filter((w) => w.length <= 4);
    const source = short.length > 0 ? short : ["zoom", "vroom"];
    return source[Math.floor(this.rng() * source.length)] ?? "zoom";
  }

  private jumpWord(): string {
    const sorted = [...new Set(this.pool)].sort((a, b) => b.length - a.length);
    const top = sorted.slice(0, Math.max(3, Math.ceil(sorted.length / 5)));
    return top[Math.floor(this.rng() * top.length)] ?? "jump";
  }

  /** Words per minute so far. */
  wpm(elapsedMs: number): number {
    return elapsedMs > 1000
      ? Math.round(this.chars / 5 / (elapsedMs / 60_000))
      : 0;
  }

  accuracy(): number {
    return this.keys > 0
      ? Math.max(0, Math.round(((this.keys - this.misses) / this.keys) * 100))
      : 100;
  }
}

// ---------------------------------------------------------------- standings

export type Standing = {
  id: string;
  name: string;
  /** finish time (ms after the start), if they crossed the line */
  finishMs?: number;
  /** 0-1 */
  progress: number;
  me?: boolean;
};

/** Finished first (by time), then by how far they got. */
export function rankStandings<T extends Standing>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const fa = a.finishMs ?? Infinity;
    const fb = b.finishMs ?? Infinity;
    if (fa !== fb) return fa - fb;
    return b.progress - a.progress;
  });
}

/** Solo standings when my race ends at `endMs`. */
export function soloStandings(input: {
  cpus: CpuId[];
  cps: number;
  target: number;
  raceSec: number;
  endMs: number;
  myName: string;
  myDistance: number;
  myFinishMs?: number;
}): Standing[] {
  const rows: Standing[] = input.cpus.map((id) => {
    const finish = cpuFinishSec(id, input.cps, input.target, input.raceSec);
    const t = input.endMs / 1000;
    const done = input.myFinishMs !== undefined || finish <= t;
    return {
      id,
      name: cpuInfo(id).name,
      // once I've finished, the others' order is already decided
      ...(done ? { finishMs: Math.round(finish * 1000) } : {}),
      progress: Math.min(
        1,
        cpuDistance(id, input.cps, t, input.raceSec) / input.target,
      ),
    };
  });
  rows.push({
    id: "me",
    name: input.myName,
    me: true,
    progress: Math.min(1, input.myDistance / input.target),
    ...(input.myFinishMs === undefined ? {} : { finishMs: input.myFinishMs }),
  });
  return rankStandings(rows);
}

/** The race is over when I cross the line or every computer racer has. */
export function soloRaceOver(input: {
  cpus: CpuId[];
  cps: number;
  target: number;
  raceSec: number;
  elapsedMs: number;
  myFinished: boolean;
}): boolean {
  if (input.myFinished) return true;
  return input.cpus.every(
    (id) =>
      cpuFinishSec(id, input.cps, input.target, input.raceSec) * 1000 <=
      input.elapsedMs,
  );
}

export const placeName = (place: number): string =>
  ["1st", "2nd", "3rd"][place - 1] ?? `${place}th`;

/** 3 for 1st, 2 for 2nd-3rd, 1 for finishing the race at all. */
export function raceStars(place: number, words: number): number {
  if (place === 1) return 3;
  if (place <= 3) return 2;
  return words > 0 ? 1 : 0;
}

/** Garage points for a place (1st-3rd). */
export const placePoints = (place: number): number =>
  place === 1 ? 3 : place === 2 ? 2 : place === 3 ? 1 : 0;
/** Extra garage points for winning a Grand Prix. */
export const GP_CHAMPION_POINTS = 3;

export type GpTable = Record<string, number>;

export function addGpPoints(table: GpTable, standings: Standing[]): GpTable {
  const next = { ...table };
  standings.forEach((s, i) => {
    next[s.id] = (next[s.id] ?? 0) + (GP_POINTS[i] ?? 0);
  });
  return next;
}

/** Most points first; ties go to whoever did better in the last race. */
export function gpOrder(table: GpTable, lastRace: Standing[]): string[] {
  const lastPlace = (id: string): number =>
    lastRace.findIndex((s) => s.id === id);
  return Object.keys(table).sort(
    (a, b) => (table[b] ?? 0) - (table[a] ?? 0) || lastPlace(a) - lastPlace(b),
  );
}

// ---------------------------------------------------------------- garage

export type GarageKind = "color" | "sticker" | "driver";
export type GarageItem = {
  id: string;
  kind: GarageKind;
  name: string;
  /** garage points needed */
  points: number;
  color?: GameColor;
  /** sticker / driver emoji */
  emoji?: string;
};

export const GARAGE: GarageItem[] = [
  { id: "c-blue", kind: "color", name: "Blue", points: 0, color: "blue" },
  { id: "c-red", kind: "color", name: "Red", points: 0, color: "red" },
  { id: "c-green", kind: "color", name: "Green", points: 3, color: "green" },
  { id: "c-yellow", kind: "color", name: "Yellow", points: 6, color: "yellow" },
  {
    id: "c-purple",
    kind: "color",
    name: "Purple",
    points: 10,
    color: "purple",
  },
  { id: "c-pink", kind: "color", name: "Pink", points: 15, color: "pink" },
  {
    id: "c-orange",
    kind: "color",
    name: "Orange",
    points: 20,
    color: "orange",
  },
  { id: "c-mint", kind: "color", name: "Mint", points: 28, color: "mint" },
  { id: "s-none", kind: "sticker", name: "No sticker", points: 0 },
  { id: "s-star", kind: "sticker", name: "Star", points: 4, emoji: "⭐" },
  { id: "s-flame", kind: "sticker", name: "Flames", points: 8, emoji: "🔥" },
  { id: "s-bolt", kind: "sticker", name: "Lightning", points: 12, emoji: "⚡" },
  { id: "s-heart", kind: "sticker", name: "Heart", points: 18, emoji: "💖" },
  {
    id: "s-rainbow",
    kind: "sticker",
    name: "Rainbow",
    points: 30,
    emoji: "🌈",
  },
  { id: "d-none", kind: "driver", name: "You", points: 0 },
  { id: "d-cat", kind: "driver", name: "Cat", points: 5, emoji: "🐱" },
  { id: "d-dog", kind: "driver", name: "Puppy", points: 9, emoji: "🐶" },
  { id: "d-frog", kind: "driver", name: "Frog", points: 14, emoji: "🐸" },
  { id: "d-panda", kind: "driver", name: "Panda", points: 22, emoji: "🐼" },
  {
    id: "d-unicorn",
    kind: "driver",
    name: "Unicorn",
    points: 32,
    emoji: "🦄",
  },
  { id: "d-dragon", kind: "driver", name: "Dragon", points: 45, emoji: "🐲" },
];

export type CarLook = { color: string; sticker: string; driver: string };
export const DEFAULT_LOOK: CarLook = {
  color: "c-blue",
  sticker: "s-none",
  driver: "d-none",
};

export const garageItem = (id: string): GarageItem | undefined =>
  GARAGE.find((g) => g.id === id);

export const isUnlocked = (id: string, points: number): boolean =>
  (garageItem(id)?.points ?? Infinity) <= points;

/** Keep only unlocked parts (falls back to the defaults). */
export function safeLook(look: Partial<CarLook>, points: number): CarLook {
  const pick = (kind: keyof CarLook): string => {
    const id = look[kind];
    return id !== undefined && isUnlocked(id, points) ? id : DEFAULT_LOOK[kind];
  };
  return {
    color: pick("color"),
    sticker: pick("sticker"),
    driver: pick("driver"),
  };
}

/** Items that unlock when points go from `before` to `after`. */
export const newUnlocks = (before: number, after: number): GarageItem[] =>
  GARAGE.filter((g) => g.points > before && g.points <= after);

// ---------------------------------------------------------------- ghost

/** Distance samples every GHOST_STEP_MS, from the start. */
export const GHOST_STEP_MS = 250;
export type Ghost = { finishMs: number; target: number; d: number[] };

/** Where the ghost car is `ms` after the start (characters). */
export function ghostDistance(g: Ghost, ms: number): number {
  if (g.d.length === 0) return 0;
  const i = ms / GHOST_STEP_MS;
  const a = Math.floor(i);
  if (a >= g.d.length - 1) return g.d[g.d.length - 1] ?? 0;
  const from = g.d[a] ?? 0;
  const to = g.d[a + 1] ?? from;
  return from + (to - from) * (i - a);
}

/** A faster finish on the same length replaces the old ghost. */
export const betterGhost = (old: Ghost | null, next: Ghost): boolean =>
  old === null || old.target !== next.target || next.finishMs < old.finishMs;

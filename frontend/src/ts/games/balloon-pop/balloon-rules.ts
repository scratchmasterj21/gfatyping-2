/**
 * Balloon Pop rules (no DOM). Balloons float up (x, y in % of the field;
 * y = 100 is the ground, 0 the sky). Type a balloon's word to pop it before
 * it floats away. Played as levels (12, with goals and stars), as a lesson
 * checkpoint, or endless in a versus match.
 */

export type BalloonColor =
  | "red"
  | "blue"
  | "yellow"
  | "green"
  | "purple"
  | "pink"
  | "orange";
export const BALLOON_COLORS: BalloonColor[] = [
  "red",
  "blue",
  "yellow",
  "green",
  "purple",
  "pink",
  "orange",
];

export type BalloonKind =
  | "normal"
  | "gift"
  | "bunch"
  | "cloud"
  | "big"
  | "bomb"
  | "sent";

export const KIND_INFO: Record<BalloonKind, { name: string; tip: string }> = {
  normal: { name: "Balloon", tip: "" },
  gift: { name: "Gift balloon", tip: "pop it for a surprise!" },
  bunch: { name: "Bunch", tip: "one word pops all three" },
  cloud: { name: "Cloud balloon", tip: "the word shows up close to the top" },
  big: { name: "Big balloon", tip: "a long word worth double" },
  bomb: { name: "Bomb balloon", tip: "DON'T type it - let it float away" },
  sent: { name: "Sent balloon", tip: "from the other player!" },
};

export type Balloon = {
  id: string;
  kind: BalloonKind;
  color: BalloonColor;
  word: string;
  x: number;
  y: number;
  speed: number;
};

export type PowerKind = "pin" | "wand" | "rainbow" | "gust" | "golden";
export const POWER_INFO: Record<
  PowerKind,
  { emoji: string; name: string; tip: string }
> = {
  pin: { emoji: "📌", name: "Pin", tip: "pops the highest balloon" },
  wand: { emoji: "🫧", name: "Bubble wand", tip: "slow motion!" },
  rainbow: {
    emoji: "🌈",
    name: "Rainbow",
    tip: "double points for 10 seconds",
  },
  gust: { emoji: "💨", name: "Gust", tip: "blows every balloon back down" },
  golden: { emoji: "✨", name: "Golden pop", tip: "pops every balloon!" },
};
const POWER_KINDS = Object.keys(POWER_INFO) as PowerKind[];

// ---------------------------------------------------------------- levels

export type Theme = "garden" | "beach" | "party";
export type Goal =
  | { type: "pop"; n: number }
  | { type: "color"; color: BalloonColor; n: number }
  | { type: "bunch"; n: number }
  | { type: "gift"; n: number }
  | { type: "streak"; n: number }
  | { type: "accuracy"; pct: number }
  | { type: "noEscape" };

export type Level = {
  id: number;
  name: string;
  theme: Theme;
  /** balloon animal you win with 2+ stars */
  animal: string;
  animalName: string;
  waves: number;
  perWave: number;
  /** % of the field per second */
  speed: number;
  kinds: BalloonKind[];
  goal: Goal;
};

const L = (
  id: number,
  name: string,
  theme: Theme,
  animal: string,
  animalName: string,
  waves: number,
  perWave: number,
  speed: number,
  kinds: BalloonKind[],
  goal: Goal,
): Level => ({
  id,
  name,
  theme,
  animal,
  animalName,
  waves,
  perWave,
  speed,
  kinds,
  goal,
});

export const LEVELS: Level[] = [
  L(1, "Sunny Start", "garden", "🐶", "Puppy", 2, 6, 4, ["normal"], {
    type: "pop",
    n: 10,
  }),
  L(
    2,
    "Flower Field",
    "garden",
    "🦒",
    "Giraffe",
    2,
    7,
    4.5,
    ["normal", "gift"],
    { type: "color", color: "red", n: 3 },
  ),
  L(
    3,
    "Bee Buzz",
    "garden",
    "🐰",
    "Bunny",
    3,
    6,
    5,
    ["normal", "gift", "bunch"],
    { type: "bunch", n: 2 },
  ),
  L(
    4,
    "Garden Party",
    "garden",
    "🦢",
    "Swan",
    3,
    7,
    5.5,
    ["normal", "gift", "bunch", "big"],
    { type: "noEscape" },
  ),
  L(
    5,
    "Sandy Shore",
    "beach",
    "🐢",
    "Turtle",
    3,
    7,
    5.5,
    ["normal", "gift", "bunch", "big"],
    { type: "color", color: "blue", n: 4 },
  ),
  L(
    6,
    "Seagull Sky",
    "beach",
    "🦀",
    "Crab",
    3,
    8,
    6,
    ["normal", "gift", "big", "cloud"],
    { type: "gift", n: 3 },
  ),
  L(
    7,
    "Wavy Water",
    "beach",
    "🐬",
    "Dolphin",
    3,
    8,
    6.5,
    ["normal", "gift", "bunch", "cloud", "bomb"],
    { type: "streak", n: 8 },
  ),
  L(
    8,
    "Sunset Splash",
    "beach",
    "🐙",
    "Octopus",
    4,
    8,
    7,
    ["normal", "gift", "bunch", "big", "cloud", "bomb"],
    { type: "accuracy", pct: 90 },
  ),
  L(
    9,
    "Birthday Bash",
    "party",
    "🦁",
    "Lion",
    4,
    9,
    7,
    ["normal", "gift", "bunch", "big", "cloud", "bomb"],
    { type: "pop", n: 30 },
  ),
  L(
    10,
    "Confetti Storm",
    "party",
    "🦄",
    "Unicorn",
    4,
    9,
    7.5,
    ["normal", "gift", "bunch", "big", "cloud", "bomb"],
    { type: "color", color: "purple", n: 5 },
  ),
  L(
    11,
    "Disco Balloons",
    "party",
    "🐘",
    "Elephant",
    4,
    10,
    8,
    ["normal", "gift", "bunch", "big", "cloud", "bomb"],
    { type: "streak", n: 12 },
  ),
  L(
    12,
    "Grand Finale",
    "party",
    "🐲",
    "Dragon",
    5,
    10,
    8.5,
    ["normal", "gift", "bunch", "big", "cloud", "bomb"],
    { type: "noEscape" },
  ),
];

export const levelById = (id: number): Level =>
  LEVELS.find((l) => l.id === id) ?? (LEVELS[0] as Level);

/** Difficulty label for scores: levels 1-4 Easy, 5-8 Medium, 9-12 Hard. */
export const levelTier = (id: number): string =>
  id <= 4 ? "Easy" : id <= 8 ? "Medium" : "Hard";

export function goalText(g: Goal): string {
  switch (g.type) {
    case "pop":
      return `Pop ${g.n} balloons`;
    case "color":
      return `Pop ${g.n} ${g.color} balloons`;
    case "bunch":
      return `Pop ${g.n} bunches`;
    case "gift":
      return `Pop ${g.n} gift balloons`;
    case "streak":
      return `Pop ${g.n} in a row with no mistakes`;
    case "accuracy":
      return `${g.pct}% accuracy or better`;
    case "noEscape":
      return "Don't let any balloon float away";
  }
}

/** A lesson checkpoint: 3 gentle waves of the lesson's words. */
export const CHECKPOINT_LEVEL: Level = L(
  0,
  "Checkpoint",
  "garden",
  "🎈",
  "Balloon",
  3,
  6,
  4,
  ["normal", "gift"],
  { type: "pop", n: 1 },
);

/** Versus: endless waves, getting faster. */
export const versusLevel = (speed: number): Level =>
  L(
    -1,
    "Versus",
    "party",
    "🎈",
    "Balloon",
    0,
    7,
    speed,
    ["normal", "gift", "bunch", "big", "cloud"],
    { type: "pop", n: 1 },
  );

export const VERSUS_SPEEDS = [
  { label: "Easy", hint: "slow balloons", speed: 4.5 },
  { label: "Medium", speed: 6 },
  { label: "Hard", hint: "fast balloons", speed: 8 },
];

// ---------------------------------------------------------------- the game

export const START_LIVES = 5;
const WAVE_PAUSE_MS = 2200;
const WAND_MS = 6000;
const RAINBOW_MS = 10_000;
/** Versus: every this many pops in a row sends a balloon to the other player. */
export const SEND_EVERY = 3;
/** Versus matches last this long (or until someone runs out of hearts). */
export const VERSUS_MS = 120_000;

export type PopEvent =
  | {
      type: "pop";
      id: string;
      x: number;
      y: number;
      color: BalloonColor;
      points: number;
      kind: BalloonKind;
      count: number;
    }
  | { type: "power"; kind: PowerKind }
  | { type: "bonus"; points: number; x: number; y: number }
  | { type: "boom"; id: string; x: number; y: number }
  | { type: "escape"; id: string; x: number; color: BalloonColor }
  | { type: "phew"; id: string }
  | { type: "miss" }
  | { type: "send" }
  | { type: "wave"; wave: number }
  | { type: "waveClear"; wave: number }
  | { type: "over"; cleared: boolean };

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

type Spawn = {
  at: number;
  kind: BalloonKind;
  color: BalloonColor;
  x: number;
  word: string;
};

export type Tally = {
  popped: number;
  colors: Partial<Record<BalloonColor, number>>;
  bunches: number;
  gifts: number;
  escaped: number;
  bombs: number;
};

export class BalloonSim {
  readonly level: Level;
  t = 0;
  wave = 0;
  lives = START_LIVES;
  score = 0;
  keys = 0;
  misses = 0;
  streak = 0;
  bestStreak = 0;
  balloons: Balloon[] = [];
  over = false;
  cleared = false;
  typed = "";
  wandUntil = 0;
  rainbowUntil = 0;
  tally: Tally = {
    popped: 0,
    colors: {},
    bunches: 0,
    gifts: 0,
    escaped: 0,
    bombs: 0,
  };
  private pool: string[];
  private plan: Spawn[] = [];
  private pauseUntil = 0;
  private rng: () => number;
  private waveStart = 0;
  private wasWrong = false;
  private sentN = 0;

  constructor(opts: { level: Level; words: string[]; seed: number }) {
    this.level = opts.level;
    const pool = opts.words.filter((w) => w.length > 0 && !w.includes(" "));
    this.pool = pool.length > 0 ? [...new Set(pool)] : ["pop", "red", "sun"];
    this.rng = seededRandom(opts.seed);
    this.startWave(1);
  }

  get double(): boolean {
    return this.t < this.rainbowUntil;
  }

  /** Words you can type now (cloud balloons hide theirs until close). */
  targets(): Balloon[] {
    const seen = new Set<string>();
    return this.balloons.filter((b) => {
      if (b.kind === "cloud" && b.y > 45) return false;
      if (b.kind === "bunch" && seen.has(b.word)) return false;
      seen.add(b.word);
      return true;
    });
  }

  private pick(used: Set<string>, long: boolean): string {
    const sorted = long
      ? [...this.pool]
          .sort((a, b) => b.length - a.length)
          .slice(0, Math.max(3, Math.ceil(this.pool.length / 4)))
      : this.pool;
    for (let i = 0; i < 12; i++) {
      const w = sorted[Math.floor(this.rng() * sorted.length)] ?? "pop";
      if (!used.has(w) || i === 11) {
        used.add(w);
        return w;
      }
    }
    return "pop";
  }

  private startWave(n: number): PopEvent[] {
    this.wave = n;
    this.waveStart = this.t;
    const lv = this.level;
    const endless = lv.waves === 0;
    const count = lv.perWave + (endless ? n - 1 : Math.floor((n - 1) / 2));
    const gap = Math.max(900, 2400 - lv.speed * 120 - (endless ? n * 60 : 0));
    const used = new Set(this.balloons.map((b) => b.word));
    let giftDone = !lv.kinds.includes("gift");
    this.plan = [];
    for (let i = 0; i < count; i++) {
      let kind = lv.kinds[Math.floor(this.rng() * lv.kinds.length)] ?? "normal";
      // one gift a wave, guaranteed
      if (!giftDone && i === Math.floor(count / 2)) kind = "gift";
      if (kind === "gift") giftDone = true;
      // bombs are rare
      if (kind === "bomb" && this.rng() < 0.5) kind = "normal";
      const word = this.pick(used, kind === "big");
      const at = this.t + 800 + i * gap * (0.8 + this.rng() * 0.4);
      const x = 10 + this.rng() * 80;
      const color =
        BALLOON_COLORS[Math.floor(this.rng() * BALLOON_COLORS.length)] ?? "red";
      if (kind === "bunch") {
        for (const dx of [-5, 0, 5]) {
          this.plan.push({
            at,
            kind,
            color:
              BALLOON_COLORS[Math.floor(this.rng() * BALLOON_COLORS.length)] ??
              "red",
            x: Math.max(8, Math.min(92, x + dx)),
            word,
          });
        }
      } else {
        this.plan.push({ at, kind, color, x, word });
      }
    }
    return [{ type: "wave", wave: n }];
  }

  /** Move time on by `dt` ms. */
  step(dt: number): PopEvent[] {
    if (this.over) return [];
    this.t += dt;
    const events: PopEvent[] = [];
    if (this.pauseUntil > 0) {
      if (this.t >= this.pauseUntil) {
        this.pauseUntil = 0;
        events.push(...this.startWave(this.wave + 1));
      }
      return events;
    }
    let n = 0;
    while (this.plan.length > 0 && (this.plan[0]?.at ?? Infinity) <= this.t) {
      const s = this.plan.shift() as Spawn;
      const lv = this.level;
      const speed =
        lv.speed * (s.kind === "big" ? 0.8 : 1) +
        (lv.waves === 0 ? (this.wave - 1) * 0.4 : (this.wave - 1) * 0.3);
      this.balloons.push({
        id: `w${this.wave}b${this.plan.length}n${n++}`,
        kind: s.kind,
        color: s.kind === "bomb" ? "purple" : s.color,
        word: s.word,
        x: s.x,
        y: 98,
        speed,
      });
    }
    const slow = this.t < this.wandUntil ? 0.4 : 1;
    const sec = dt / 1000;
    for (const b of this.balloons) b.y -= b.speed * slow * sec;
    for (const b of [...this.balloons]) {
      if (b.y > -4) continue;
      this.balloons = this.balloons.filter((x) => x !== b);
      if (b.kind === "bomb") {
        events.push({ type: "phew", id: b.id });
        continue;
      }
      this.tally.escaped++;
      this.streak = 0;
      this.lives = Math.max(0, this.lives - 1);
      events.push({ type: "escape", id: b.id, x: b.x, color: b.color });
      if (this.lives <= 0) this.end(false, events);
    }
    this.checkWave(events);
    return events;
  }

  private checkWave(events: PopEvent[]): void {
    if (this.over || this.pauseUntil > 0) return;
    const busy = this.balloons.some((b) => b.kind !== "bomb");
    if (this.plan.length > 0 || busy) return;
    if (this.t - this.waveStart < 1500) return;
    // bombs left over float off on their own
    this.balloons = [];
    events.push({ type: "waveClear", wave: this.wave });
    if (this.level.waves > 0 && this.wave >= this.level.waves) {
      this.end(true, events);
      return;
    }
    this.pauseUntil = this.t + WAVE_PAUSE_MS;
  }

  private end(cleared: boolean, events: PopEvent[]): void {
    if (this.over) return;
    this.over = true;
    this.cleared = cleared;
    events.push({ type: "over", cleared });
  }

  /** The typing box changed. */
  type(raw: string): PopEvent[] {
    if (this.over) return [];
    const value = raw.trim().toLowerCase();
    const events: PopEvent[] = [];
    const targets = this.targets();
    const hit = targets.find((b) => b.word === value);
    const grew = value.length > this.typed.length;
    if (grew) this.keys += value.length - this.typed.length;
    if (hit !== undefined && value !== "") {
      this.typed = "";
      this.wasWrong = false;
      this.popTarget(hit, events);
      return events;
    }
    const ok = value === "" || targets.some((b) => b.word.startsWith(value));
    if (!ok && !this.wasWrong && grew) {
      this.misses++;
      this.streak = 0;
      events.push({ type: "miss" });
    }
    this.wasWrong = !ok;
    this.typed = value;
    return events;
  }

  private popTarget(hit: Balloon, events: PopEvent[], byPower = false): void {
    if (hit.kind === "bomb") {
      this.balloons = this.balloons.filter((b) => b !== hit);
      this.tally.bombs++;
      this.streak = 0;
      this.lives = Math.max(0, this.lives - 1);
      events.push({ type: "boom", id: hit.id, x: hit.x, y: hit.y });
      if (this.lives <= 0) this.end(false, events);
      this.checkWave(events);
      return;
    }
    const group =
      hit.kind === "bunch"
        ? this.balloons.filter((b) => b.kind === "bunch" && b.word === hit.word)
        : [hit];
    this.balloons = this.balloons.filter((b) => !group.includes(b));
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const base =
      hit.word.length * 10 * (hit.kind === "big" ? 2 : 1) * group.length;
    const points = base * (this.double ? 2 : 1);
    this.score += points;
    this.tally.popped += group.length;
    for (const b of group) {
      this.tally.colors[b.color] = (this.tally.colors[b.color] ?? 0) + 1;
    }
    if (hit.kind === "bunch") this.tally.bunches++;
    events.push({
      type: "pop",
      id: hit.id,
      x: hit.x,
      y: hit.y,
      color: hit.color,
      points,
      kind: hit.kind,
      count: group.length,
    });
    if (hit.kind === "gift" && !byPower) {
      this.tally.gifts++;
      const roll = this.rng();
      if (roll < 0.25) {
        const bonus = 50;
        this.score += bonus;
        events.push({ type: "bonus", points: bonus, x: hit.x, y: hit.y });
      } else {
        const kind =
          POWER_KINDS[Math.floor(this.rng() * POWER_KINDS.length)] ?? "wand";
        this.applyPower(kind, events);
      }
    }
    if (!byPower && this.streak % SEND_EVERY === 0) {
      events.push({ type: "send" });
    }
    this.checkWave(events);
  }

  applyPower(kind: PowerKind, events: PopEvent[] = []): PopEvent[] {
    events.push({ type: "power", kind });
    if (kind === "wand") this.wandUntil = this.t + WAND_MS;
    if (kind === "rainbow") this.rainbowUntil = this.t + RAINBOW_MS;
    if (kind === "gust") {
      for (const b of this.balloons) b.y = Math.min(104, b.y + 25);
    }
    if (kind === "pin") {
      const top = this.balloons
        .filter((b) => b.kind !== "bomb")
        .sort((a, b) => a.y - b.y)[0];
      if (top !== undefined) this.popTarget(top, events, true);
    }
    if (kind === "golden") {
      for (const b of this.balloons.filter((x) => x.kind !== "bomb")) {
        if (this.balloons.includes(b)) this.popTarget(b, events, true);
      }
    }
    return events;
  }

  /** Versus: time's up - the game ends (not lost). */
  timeUp(): PopEvent[] {
    const events: PopEvent[] = [];
    this.end(true, events);
    return events;
  }

  /** Versus: a balloon from the other player. */
  receive(word: string): void {
    this.balloons.push({
      id: `r${this.sentN++}`,
      kind: "sent",
      color: "orange",
      word: word.toLowerCase(),
      x: 10 + this.rng() * 80,
      y: 98,
      speed: this.level.speed + (this.wave - 1) * 0.4,
    });
  }

  /** A word to send to the other player. */
  sendWord(): string {
    return this.pool[Math.floor(this.rng() * this.pool.length)] ?? "pop";
  }

  accuracy(): number {
    return this.keys > 0
      ? Math.max(0, Math.round(((this.keys - this.misses) / this.keys) * 100))
      : 100;
  }

  pauseLeft(): number {
    return this.pauseUntil > 0 ? Math.max(0, this.pauseUntil - this.t) : 0;
  }
}

/** Was the level's goal met? */
export function goalMet(
  g: Goal,
  t: Tally,
  s: { bestStreak: number; accuracy: number },
): boolean {
  switch (g.type) {
    case "pop":
      return t.popped >= g.n;
    case "color":
      return (t.colors[g.color] ?? 0) >= g.n;
    case "bunch":
      return t.bunches >= g.n;
    case "gift":
      return t.gifts >= g.n;
    case "streak":
      return s.bestStreak >= g.n;
    case "accuracy":
      return s.accuracy >= g.pct;
    case "noEscape":
      return t.escaped === 0;
  }
}

/**
 * Stars: 1 for finishing the level, 2 for the goal too, 3 if nothing got
 * away (for a no-escape goal: and 90%+ accuracy).
 */
export function levelStars(input: {
  level: Level;
  cleared: boolean;
  tally: Tally;
  bestStreak: number;
  accuracy: number;
}): number {
  if (!input.cleared) return 0;
  if (!goalMet(input.level.goal, input.tally, input)) return 1;
  const perfect =
    input.level.goal.type === "noEscape"
      ? input.accuracy >= 90
      : input.tally.escaped === 0 && input.tally.bombs === 0;
  return perfect ? 3 : 2;
}

/** A level is open once the one before it has a star. */
export const levelOpen = (id: number, stars: Record<number, number>): boolean =>
  id <= 1 || (stars[id - 1] ?? 0) >= 1;

// ---------------------------------------------------------------- daily goal

export type DailyGoal = { color?: BalloonColor; n: number };

/** Today's goal: pop N balloons, or N of one colour. */
export function dailyGoal(day: number): DailyGoal {
  if (day % 2 === 0) return { n: 40 + (day % 3) * 10 };
  return {
    color: BALLOON_COLORS[day % BALLOON_COLORS.length] ?? "red",
    n: 15,
  };
}

export const dailyGoalText = (g: DailyGoal): string =>
  g.color === undefined
    ? `Pop ${g.n} balloons today`
    : `Pop ${g.n} ${g.color} balloons today`;

/** How far a run moves today's goal. */
export const dailyProgress = (g: DailyGoal, t: Tally): number =>
  g.color === undefined ? t.popped : (t.colors[g.color] ?? 0);

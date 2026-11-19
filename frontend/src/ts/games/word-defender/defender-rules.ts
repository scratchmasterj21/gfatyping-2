/**
 * Word Defender rules (no DOM). Ships fly down the screen (x, y in % of the
 * field; the base is at the bottom). Type a ship's word to zap it. Waves get
 * faster, every 5th wave a mothership attacks, power-up orbs drift down and
 * after each wave you pick an upgrade.
 *
 * Everything is decided by the seed, so co-op players see the same ships:
 * kills from other players come in with `remoteKill`, base hits from the
 * host with `remoteHit`.
 */

export type DefenderDifficulty = {
  label: string;
  hint?: string;
  /** % of the field per second in wave 1 */
  speed: number;
  /** extra speed per wave */
  step: number;
  /** ships in wave 1 (one more each wave) */
  ships: number;
};

export const DEFENDER_DIFFICULTIES: DefenderDifficulty[] = [
  { label: "Easy", hint: "slow ships", speed: 4, step: 0.6, ships: 5 },
  { label: "Medium", speed: 6.5, step: 0.9, ships: 6 },
  { label: "Hard", hint: "fast ships", speed: 9, step: 1.2, ships: 8 },
];

export type ShipKind =
  | "basic"
  | "shield"
  | "splitter"
  | "zigzag"
  | "scout"
  | "cloak"
  | "mini";

export const SHIP_INFO: Record<ShipKind, { name: string; tip: string }> = {
  basic: { name: "Ship", tip: "" },
  shield: { name: "Shield ship", tip: "type its word twice!" },
  splitter: { name: "Splitter", tip: "breaks into two small ships" },
  zigzag: { name: "Zig-zag ship", tip: "wiggles side to side" },
  scout: { name: "Scout", tip: "small and fast" },
  cloak: { name: "Cloaked ship", tip: "its word fades in and out" },
  mini: { name: "Mini ship", tip: "" },
};

export type Ship = {
  id: string;
  kind: ShipKind;
  word: string;
  /** spawn x (zig-zag ships wiggle around it) */
  x0: number;
  x: number;
  y: number;
  speed: number;
  hp: number;
};

export type PowerKind = "emp" | "nuke" | "shield" | "freeze" | "multi";

export const POWER_INFO: Record<
  PowerKind,
  { emoji: string; name: string; word: string; tip: string }
> = {
  emp: {
    emoji: "⚡",
    name: "EMP",
    word: "zap",
    tip: "ships stop for a moment",
  },
  nuke: { emoji: "☢️", name: "Nuke", word: "boom", tip: "zaps every ship" },
  shield: {
    emoji: "🛡️",
    name: "Shield",
    word: "shield",
    tip: "blocks the next hit",
  },
  freeze: { emoji: "❄️", name: "Freeze", word: "ice", tip: "ships go slow" },
  multi: {
    emoji: "🎯",
    name: "Multi-shot",
    word: "triple",
    tip: "your next word zaps every ship with the same first letter",
  },
};
const POWER_KINDS = Object.keys(POWER_INFO) as PowerKind[];

export type Orb = {
  id: string;
  kind: PowerKind;
  word: string;
  x: number;
  y: number;
};

export type BossPart = {
  id: string;
  name: "cannon" | "shield" | "core";
  word: string;
  done: boolean;
};
export type Boss = {
  id: string;
  y: number;
  parts: BossPart[];
  nextLaunch: number;
};

export type UpgradeId =
  | "repair"
  | "drone"
  | "slow"
  | "shieldgen"
  | "booster"
  | "cells";

export const UPGRADES: Record<
  UpgradeId,
  { emoji: string; name: string; word: string; tip: string }
> = {
  repair: { emoji: "🔧", name: "Repair", word: "repair", tip: "+1 life" },
  drone: {
    emoji: "🛸",
    name: "Helper drone",
    word: "drone",
    tip: "zaps a short-word ship now and then",
  },
  slow: {
    emoji: "🐌",
    name: "Slow field",
    word: "slow",
    tip: "ships 10% slower",
  },
  shieldgen: {
    emoji: "🛡️",
    name: "Shield maker",
    word: "shield",
    tip: "a free shield every wave",
  },
  booster: {
    emoji: "💰",
    name: "Score booster",
    word: "score",
    tip: "+25% points",
  },
  cells: {
    emoji: "🔋",
    name: "Power cells",
    word: "power",
    tip: "power-ups come more often and last longer",
  },
};

export type DefEvent =
  | {
      type: "zap";
      id: string;
      x: number;
      y: number;
      points: number;
      kind: ShipKind;
    }
  | { type: "shieldBreak"; id: string; x: number; y: number }
  | { type: "split"; id: string }
  | { type: "power"; kind: PowerKind; id: string }
  | { type: "bossPart"; id: string; part: BossPart["name"] }
  | { type: "bossDown"; id: string }
  | { type: "bossHit" }
  | { type: "hit"; id: string; shielded: boolean }
  | { type: "drone"; id: string }
  | { type: "miss" }
  | { type: "combo"; tier: number }
  | { type: "wave"; wave: number; boss: boolean }
  | { type: "waveClear"; wave: number; bonus: number }
  | { type: "over"; cleared: boolean };

export const START_LIVES = 3;
const MAX_LIVES = 6;
/** Ships hit the base at this y. */
export const BASE_Y = 90;
const WAVE_PAUSE_MS = 2500;
const DRONE_MS = 12_000;
const EMP_MS = 3000;
const FREEZE_MS = 6000;

/** Laser colour tier for a streak of clean words (0-3). */
export const comboTier = (streak: number): number =>
  streak >= 20 ? 3 : streak >= 10 ? 2 : streak >= 5 ? 1 : 0;

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

type Spawn = { at: number; kind: ShipKind; x: number; word: string };
type OrbSpawn = { at: number; kind: PowerKind; x: number };

/** Ship kinds that can appear in a wave. */
export function kindsFor(wave: number): ShipKind[] {
  const kinds: ShipKind[] = ["basic", "basic", "basic"];
  if (wave >= 2) kinds.push("scout", "zigzag");
  if (wave >= 3) kinds.push("shield", "splitter");
  if (wave >= 4) kinds.push("cloak");
  return kinds;
}

export const isBossWave = (wave: number, bosses: boolean): boolean =>
  bosses && wave % 5 === 0;

export type DefenderOpts = {
  words: string[];
  difficulty: DefenderDifficulty;
  seed: number;
  /** stop (cleared) after this wave; 0 = endless */
  maxWave: number;
  bosses: boolean;
  upgrades: boolean;
  /** co-op guests: the host decides base hits */
  authority?: boolean;
};

export class DefenderSim {
  readonly opts: DefenderOpts;
  t = 0;
  wave = 0;
  lives = START_LIVES;
  score = 0;
  hits = 0;
  misses = 0;
  streak = 0;
  bestStreak = 0;
  shields = 0;
  ships: Ship[] = [];
  orbs: Orb[] = [];
  boss: Boss | null = null;
  over = false;
  cleared = false;
  /** upgrades to choose from (the game waits) */
  offer: UpgradeId[] | null = null;
  owned: UpgradeId[] = [];
  typed = "";
  multiReady = false;
  empUntil = 0;
  freezeUntil = 0;
  private pool: string[];
  private plan: Spawn[] = [];
  private orbPlan: OrbSpawn[] = [];
  private waveStart = 0;
  private pauseUntil = 0;
  private gone = new Set<string>();
  private nextDrone = DRONE_MS;
  private wasWrong = false;

  constructor(opts: DefenderOpts) {
    this.opts = opts;
    const pool = opts.words.filter((w) => w.length > 0 && !w.includes(" "));
    this.pool = pool.length > 0 ? [...new Set(pool)] : ["zap", "ship", "star"];
    this.startWave(1);
  }

  get mult(): number {
    return comboTier(this.streak) + 1;
  }
  get slow(): number {
    const fields = this.owned.filter((u) => u === "slow").length;
    return Math.max(0.7, 1 - fields * 0.1);
  }
  private get cells(): boolean {
    return this.owned.includes("cells");
  }

  /** Words on screen right now (for highlighting). */
  targets(): { id: string; word: string }[] {
    const list: { id: string; word: string }[] = [
      ...this.ships.map((s) => ({ id: s.id, word: s.word })),
      ...this.orbs.map((o) => ({ id: o.id, word: o.word })),
    ];
    const part = this.bossTarget();
    for (const p of part) list.push({ id: p.id, word: p.word });
    return list;
  }

  /** Boss parts you can type now: cannons, then the shield, then the core. */
  bossTarget(): BossPart[] {
    const b = this.boss;
    if (b === null) return [];
    for (const name of ["cannon", "shield", "core"] as const) {
      const open = b.parts.filter((p) => p.name === name && !p.done);
      if (open.length > 0) return open;
    }
    return [];
  }

  // ------------------------------------------------------------ waves

  private startWave(n: number): DefEvent[] {
    this.wave = n;
    this.waveStart = this.t;
    const rng = seededRandom(this.opts.seed ^ Math.imul(n, 0x9e3779b1));
    const d = this.opts.difficulty;
    const boss = isBossWave(n, this.opts.bosses);
    const count = boss ? 2 : d.ships + n - 1;
    const kinds = kindsFor(n);
    const gap = Math.max(1100, 3200 - n * 180);
    const used = new Set<string>();
    const pick = (short: boolean): string => {
      const source = short ? this.pool.filter((w) => w.length <= 4) : this.pool;
      const from = source.length > 0 ? source : this.pool;
      for (let i = 0; i < 12; i++) {
        const w = from[Math.floor(rng() * from.length)] ?? "zap";
        if (!used.has(w) || i === 11) {
          used.add(w);
          return w;
        }
      }
      return "zap";
    };
    this.plan = Array.from({ length: count }, (_, i) => {
      const kind = kinds[Math.floor(rng() * kinds.length)] ?? "basic";
      return {
        at: this.t + 1200 + i * gap * (0.75 + rng() * 0.5),
        kind,
        x: 10 + rng() * 80,
        word: pick(kind === "scout"),
      };
    });
    // a power-up orb or two per wave
    const orbs = this.cells ? 2 : 1;
    const span = count * gap;
    this.orbPlan = Array.from({ length: orbs }, (_, i) => ({
      at: this.t + span * ((i + 1) / (orbs + 1)) + rng() * 1500,
      kind: POWER_KINDS[Math.floor(rng() * POWER_KINDS.length)] ?? "freeze",
      x: 12 + rng() * 76,
    }));
    if (boss) {
      const phrase = (k: number): string =>
        Array.from({ length: k }, () => pick(false)).join(" ");
      this.boss = {
        id: `b${n}`,
        y: 0,
        nextLaunch: this.t + 5000,
        parts: [
          { id: `b${n}c1`, name: "cannon", word: phrase(2), done: false },
          { id: `b${n}c2`, name: "cannon", word: phrase(2), done: false },
          { id: `b${n}s`, name: "shield", word: phrase(2), done: false },
          { id: `b${n}k`, name: "core", word: phrase(3), done: false },
        ],
      };
    }
    if (this.owned.includes("shieldgen")) this.shields++;
    return [{ type: "wave", wave: n, boss }];
  }

  private shipSpeed(n: number, kind: ShipKind): number {
    const d = this.opts.difficulty;
    const base = d.speed + (n - 1) * d.step;
    return kind === "scout" ? base * 1.6 : kind === "mini" ? base * 1.3 : base;
  }

  private waveDone(): boolean {
    return (
      this.plan.length === 0 && this.ships.length === 0 && this.boss === null
    );
  }

  // ------------------------------------------------------------ time

  /** Move time on by `dt` ms. */
  step(dt: number): DefEvent[] {
    if (this.over || this.offer !== null) return [];
    this.t += dt;
    const events: DefEvent[] = [];
    if (this.pauseUntil > 0) {
      if (this.t >= this.pauseUntil) {
        this.pauseUntil = 0;
        events.push(...this.startWave(this.wave + 1));
      }
      return events;
    }
    // spawns
    while (this.plan.length > 0 && (this.plan[0]?.at ?? Infinity) <= this.t) {
      const s = this.plan.shift() as Spawn;
      const id = `w${this.wave}s${this.plan.length}`;
      if (this.gone.has(id)) continue;
      this.ships.push({
        id,
        kind: s.kind,
        word: s.word,
        x0: s.x,
        x: s.x,
        y: 4,
        speed: this.shipSpeed(this.wave, s.kind),
        hp: s.kind === "shield" ? 2 : 1,
      });
    }
    while (
      this.orbPlan.length > 0 &&
      (this.orbPlan[0]?.at ?? Infinity) <= this.t
    ) {
      const o = this.orbPlan.shift() as OrbSpawn;
      const id = `w${this.wave}o${this.orbPlan.length}`;
      if (this.gone.has(id)) continue;
      this.orbs.push({
        id,
        kind: o.kind,
        word: POWER_INFO[o.kind].word,
        x: o.x,
        y: 4,
      });
    }
    // movement
    const stopped = this.t < this.empUntil;
    const factor =
      (stopped ? 0 : 1) * (this.t < this.freezeUntil ? 0.4 : 1) * this.slow;
    const sec = dt / 1000;
    for (const s of this.ships) {
      s.y += s.speed * factor * sec;
      if (s.kind === "zigzag") {
        s.x = Math.max(6, Math.min(94, s.x0 + Math.sin(s.y / 6) * 12));
      }
    }
    for (const o of this.orbs) o.y += 5 * sec;
    this.orbs = this.orbs.filter((o) => o.y < BASE_Y);
    // the mothership
    const b = this.boss;
    if (b !== null) {
      b.y += (b.y < 10 ? 6 : 0.9) * factor * sec;
      const cannonsUp = b.parts.some((p) => p.name === "cannon" && !p.done);
      if (cannonsUp && this.t >= b.nextLaunch) {
        b.nextLaunch = this.t + 5500;
        const id = `${b.id}l${Math.round(this.t)}`;
        const short = this.pool.filter((w) => w.length <= 4);
        const from = short.length > 0 ? short : this.pool;
        this.ships.push({
          id,
          kind: "scout",
          word: from[hash(id) % from.length] ?? "zap",
          x0: 30 + (hash(id) % 40),
          x: 30 + (hash(id) % 40),
          y: b.y + 8,
          speed: this.shipSpeed(this.wave, "scout") * 0.8,
          hp: 1,
        });
      }
      if (b.y >= 62) {
        this.boss = null;
        events.push({ type: "bossHit" });
        this.loseLife(events, "boss", 2);
      }
    }
    // base hits
    for (const s of [...this.ships]) {
      if (s.y < BASE_Y) continue;
      this.ships = this.ships.filter((x) => x !== s);
      this.gone.add(s.id);
      this.loseLife(events, s.id, 1);
    }
    // helper drone
    if (this.owned.includes("drone") && this.t >= this.nextDrone) {
      this.nextDrone = this.t + DRONE_MS;
      const target = this.ships
        .filter((s) => s.word.length <= 4)
        .sort((a, b2) => b2.y - a.y)[0];
      if (target !== undefined) {
        this.removeShip(target, events, false);
        events.push({ type: "drone", id: target.id });
      }
    }
    this.checkWave(events);
    return events;
  }

  private loseLife(events: DefEvent[], id: string, n: number): void {
    if (this.shields > 0) {
      this.shields--;
      events.push({ type: "hit", id, shielded: true });
      return;
    }
    events.push({ type: "hit", id, shielded: false });
    if (this.opts.authority === false) return; // the host decides
    this.lives = Math.max(0, this.lives - n);
    this.streak = 0;
    if (this.lives <= 0) this.end(false, events);
  }

  private checkWave(events: DefEvent[]): void {
    if (this.over || this.pauseUntil > 0 || !this.waveDone()) return;
    if (this.t - this.waveStart < 1500) return;
    const bonus = 25 * this.wave;
    this.score += bonus;
    events.push({ type: "waveClear", wave: this.wave, bonus });
    if (this.opts.maxWave > 0 && this.wave >= this.opts.maxWave) {
      this.end(true, events);
      return;
    }
    this.pauseUntil = this.t + WAVE_PAUSE_MS;
    if (this.opts.upgrades) this.offer = this.upgradeOffer();
  }

  private end(cleared: boolean, events: DefEvent[]): void {
    if (this.over) return;
    this.over = true;
    this.cleared = cleared;
    events.push({ type: "over", cleared });
  }

  /** Three upgrades to pick from (repair only when hurt). */
  upgradeOffer(): UpgradeId[] {
    const rng = seededRandom(this.opts.seed ^ (this.wave * 7919));
    const all = (Object.keys(UPGRADES) as UpgradeId[]).filter(
      (u) =>
        (u !== "repair" || this.lives < MAX_LIVES) &&
        (u !== "drone" || !this.owned.includes("drone")) &&
        (u !== "cells" || !this.owned.includes("cells")) &&
        (u !== "slow" || this.slow > 0.7),
    );
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [all[i], all[j]] = [all[j] as UpgradeId, all[i] as UpgradeId];
    }
    return all.slice(0, 3);
  }

  choose(u: UpgradeId): void {
    if (this.offer?.includes(u) !== true) return;
    this.owned.push(u);
    if (u === "repair") this.lives = Math.min(MAX_LIVES, this.lives + 1);
    this.offer = null;
  }

  // ------------------------------------------------------------ typing

  /** The typing box changed. Returns what happened. */
  type(raw: string): DefEvent[] {
    if (this.over) return [];
    const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
    const events: DefEvent[] = [];
    const targets = this.targets();
    const hit = targets.find((t) => t.word === value);
    if (hit !== undefined && value !== "") {
      this.typed = "";
      this.wasWrong = false;
      this.complete(hit.id, events, true);
      return events;
    }
    const ok = value === "" || targets.some((t) => t.word.startsWith(value));
    if (!ok && !this.wasWrong && value.length > this.typed.length) {
      this.misses++;
      this.streak = 0;
      events.push({ type: "miss" });
    }
    this.wasWrong = !ok;
    this.typed = value;
    return events;
  }

  /** I finished this target's word (or the drone did). */
  private complete(id: string, events: DefEvent[], mine: boolean): void {
    const ship = this.ships.find((s) => s.id === id);
    if (ship !== undefined) {
      if (ship.hp > 1) {
        ship.hp--;
        events.push({ type: "shieldBreak", id, x: ship.x, y: ship.y });
        return;
      }
      const tierBefore = comboTier(this.streak);
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (comboTier(this.streak) > tierBefore) {
        events.push({ type: "combo", tier: comboTier(this.streak) });
      }
      const first = ship.word.slice(0, 1);
      this.removeShip(ship, events, mine);
      if (this.multiReady) {
        this.multiReady = false;
        for (const s of this.ships.filter((x) => x.word.startsWith(first))) {
          this.removeShip(s, events, mine);
        }
      }
      return;
    }
    const orb = this.orbs.find((o) => o.id === id);
    if (orb !== undefined) {
      this.orbs = this.orbs.filter((o) => o !== orb);
      this.gone.add(orb.id);
      this.streak++;
      this.applyPower(orb.kind, events);
      events.push({ type: "power", kind: orb.kind, id: orb.id });
      return;
    }
    const b = this.boss;
    const part = b?.parts.find((p) => p.id === id && !p.done);
    if (b !== null && part !== undefined) {
      part.done = true;
      if (mine) {
        this.hits++;
        this.streak++;
      }
      if (mine) this.score += 100 * this.boost();
      events.push({ type: "bossPart", id, part: part.name });
      if (b.parts.every((p) => p.done)) {
        this.boss = null;
        if (mine) this.score += 300 * this.boost();
        events.push({ type: "bossDown", id: b.id });
        this.checkWave(events);
      }
    }
  }

  private boost(): number {
    return this.owned.includes("booster") ? 1.25 : 1;
  }

  private removeShip(ship: Ship, events: DefEvent[], mine: boolean): void {
    this.ships = this.ships.filter((s) => s !== ship);
    this.gone.add(ship.id);
    if (mine) this.hits++;
    const points = mine
      ? Math.round(ship.word.length * 10 * this.mult * this.boost())
      : 0;
    this.score += points;
    events.push({
      type: "zap",
      id: ship.id,
      x: ship.x,
      y: ship.y,
      points,
      kind: ship.kind,
    });
    if (ship.kind === "splitter") {
      const short = this.pool.filter((w) => w.length <= 4);
      const from = short.length > 0 ? short : this.pool;
      for (const side of ["a", "b"] as const) {
        const id = `${ship.id}${side}`;
        if (this.gone.has(id)) continue;
        const x = Math.max(6, Math.min(94, ship.x + (side === "a" ? -8 : 8)));
        this.ships.push({
          id,
          kind: "mini",
          word: from[hash(id) % from.length] ?? "zip",
          x0: x,
          x,
          y: ship.y,
          speed: this.shipSpeed(this.wave, "mini"),
          hp: 1,
        });
      }
      events.push({ type: "split", id: ship.id });
    }
  }

  /** A power-up goes off (mine, or another player's in co-op). */
  applyPower(
    kind: PowerKind,
    events: DefEvent[] = [],
    mine = true,
  ): DefEvent[] {
    const longer = this.cells ? 1.5 : 1;
    if (kind === "emp") this.empUntil = this.t + EMP_MS * longer;
    if (kind === "freeze") this.freezeUntil = this.t + FREEZE_MS * longer;
    if (kind === "shield") this.shields++;
    if (kind === "multi") this.multiReady = true;
    if (kind === "nuke") {
      for (const s of [...this.ships]) this.removeShip(s, events, mine);
    }
    this.checkWave(events);
    return events;
  }

  // ------------------------------------------------------------ co-op

  /** Someone else zapped this target first. */
  remoteKill(id: string): DefEvent[] {
    const events: DefEvent[] = [];
    if (this.gone.has(id)) return events;
    const ship = this.ships.find((s) => s.id === id);
    if (ship !== undefined) {
      ship.hp = 1;
      this.removeShip(ship, events, false);
    } else if (this.orbs.some((o) => o.id === id)) {
      this.orbs = this.orbs.filter((o) => o.id !== id);
    } else if (this.boss?.parts.some((p) => p.id === id) === true) {
      this.complete(id, events, false);
    }
    this.gone.add(id);
    this.checkWave(events);
    return events;
  }

  /** Guests: the host says these many ships got through. */
  setLives(lives: number): DefEvent[] {
    const events: DefEvent[] = [];
    this.lives = Math.max(0, lives);
    if (this.lives <= 0) this.end(false, events);
    return events;
  }

  /** How long until the next wave (ms), while paused. */
  pauseLeft(): number {
    return this.pauseUntil > 0 ? Math.max(0, this.pauseUntil - this.t) : 0;
  }
}

/** Points for the result and coins (same scale as before). */
export const defenderStars = (
  wave: number,
  cleared: boolean,
  score: number,
): number => (cleared ? 3 : score <= 0 ? 0 : wave >= 6 ? 3 : wave >= 3 ? 2 : 1);

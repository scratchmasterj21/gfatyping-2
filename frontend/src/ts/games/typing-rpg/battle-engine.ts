import type { MonsterKind } from "./wave-appearance";

/**
 * Typing Quest battles (no DOM): a turn-based duel. On your turn you pick a
 * move by typing its name, then type that move's words before the timer
 * runs out. Clean, fast typing lands a critical hit. Then the monster uses
 * one of its moves. Each monster kind has a trick:
 *   imp      - sometimes dodges a weak hit
 *   guardian - armour halves damage until a Power Strike breaks it
 *   slime    - sometimes splashes twice
 */

export type MoveId = "quick" | "power" | "guard" | "heal";

export const MOVES: Record<
  MoveId,
  { name: string; emoji: string; word: string; words: number; tip: string }
> = {
  quick: {
    name: "Quick Hit",
    emoji: "⚔️",
    word: "quick",
    words: 3,
    tip: "3 short words · safe damage",
  },
  power: {
    name: "Power Strike",
    emoji: "💥",
    word: "power",
    words: 2,
    tip: "2 long words · big damage, breaks armour",
  },
  guard: {
    name: "Guard",
    emoji: "🛡️",
    word: "guard",
    words: 1,
    tip: "1 word · halves the next attack",
  },
  heal: {
    name: "Heal",
    emoji: "💚",
    word: "heal",
    words: 3,
    tip: "3 short words · restores HP",
  },
};
export const MOVE_IDS = Object.keys(MOVES) as MoveId[];

export const MONSTER_MOVE: Record<MonsterKind, string> = {
  slime: "Sticky Splash",
  imp: "Shadow Pounce",
  guardian: "Stone Slam",
};

export const MONSTER_TRICK: Record<MonsterKind, string> = {
  slime: "Slimes sometimes splash twice!",
  imp: "Imps can dodge weak hits - hit hard!",
  guardian: "Guardians wear armour - a Power Strike breaks it!",
};

/** Damage per word for each attack. */
const QUICK_PER_WORD = 2;
const POWER_PER_WORD = 4;
const CLEAN_BONUS = 2;
const CRIT = 1.5;
/** A crit: no mistakes, finished in under this share of the time. */
export const CRIT_SHARE = 0.5;
export const HEAL_HP = 15;
/** Heals for a whole run (one more after each wave). */
export const START_POTIONS = 2;
/** Extra damage per hero level above 1. */
const LEVEL_DAMAGE = 1;
/** XP for a level: level * this. */
const XP_PER_LEVEL = 25;
const IMP_DODGE = 0.3;
const IMP_DODGE_BELOW = 6;
const SLIME_DOUBLE = 0.25;

/** Short words for quick moves, long ones for Power Strike. */
export function wordsForMove(
  move: MoveId,
  pool: string[],
  rng: () => number,
): string[] {
  const clean = pool.filter((w) => /^[a-z]+$/.test(w));
  const list = clean.length > 0 ? clean : ["hit", "zap", "pow"];
  const short = list.filter((w) => w.length <= 4);
  const long = list.filter((w) => w.length >= 6);
  const from =
    move === "power"
      ? long.length > 0
        ? long
        : list
      : short.length > 0
        ? short
        : list;
  return Array.from(
    { length: MOVES[move].words },
    () => from[Math.floor(rng() * from.length)] ?? "hit",
  );
}

export type TypedMove = {
  move: MoveId;
  /** words finished before the timer ran out */
  wordsDone: number;
  mistakes: number;
  /** share of the turn time used, 0-1 */
  timeUsed: number;
};

export type Fighter = {
  hp: number;
  maxHp: number;
};

export type BattleState = {
  hero: Fighter & { level: number; potions: number; guarding: boolean };
  monster: Fighter & {
    kind: MonsterKind;
    name: string;
    attack: number;
    armour: boolean;
  };
  over: boolean;
  won: boolean;
};

export type MoveOutcome = {
  damage: number;
  crit: boolean;
  dodged: boolean;
  armourBroke: boolean;
  healed: number;
  guarded: boolean;
  /** lines for the message box, in order */
  lines: string[];
};

export function newBattle(input: {
  hero: { hp: number; maxHp: number; level: number; potions: number };
  monster: {
    name: string;
    kind: MonsterKind;
    hp: number;
    maxHp: number;
    attack: number;
  };
}): BattleState {
  return {
    hero: { ...input.hero, guarding: false },
    monster: { ...input.monster, armour: input.monster.kind === "guardian" },
    over: false,
    won: false,
  };
}

/** Is the move usable right now? */
export const canUse = (s: BattleState, move: MoveId): boolean =>
  move !== "heal" || s.hero.potions > 0;

/** The hero's move lands (mutates the state). */
export function heroMove(
  s: BattleState,
  t: TypedMove,
  rng: () => number,
): MoveOutcome {
  const out: MoveOutcome = {
    damage: 0,
    crit: false,
    dodged: false,
    armourBroke: false,
    healed: 0,
    guarded: false,
    lines: [],
  };
  const info = MOVES[t.move];
  const finished = t.wordsDone >= info.words;
  out.lines.push(`You used ${info.name}!`);
  if (t.move === "guard") {
    s.hero.guarding = finished;
    out.guarded = finished;
    out.lines.push(
      finished ? "You raise your shield!" : "Too slow - no guard!",
    );
    return out;
  }
  if (t.move === "heal") {
    s.hero.potions = Math.max(0, s.hero.potions - 1);
    const amount = Math.round(HEAL_HP * (t.wordsDone / info.words));
    const healed = Math.min(amount, s.hero.maxHp - s.hero.hp);
    s.hero.hp += healed;
    out.healed = healed;
    out.lines.push(
      healed > 0 ? `You feel better! +${healed} HP` : "It didn't work…",
    );
    return out;
  }
  const perWord = t.move === "power" ? POWER_PER_WORD : QUICK_PER_WORD;
  let damage = t.wordsDone * perWord + (s.hero.level - 1) * LEVEL_DAMAGE;
  if (t.wordsDone === 0) damage = 0;
  if (finished && t.mistakes === 0) damage += CLEAN_BONUS;
  damage = Math.max(t.wordsDone > 0 ? 1 : 0, damage - t.mistakes);
  const crit = finished && t.mistakes === 0 && t.timeUsed <= CRIT_SHARE;
  if (crit) damage = Math.round(damage * CRIT);
  out.crit = crit;
  const m = s.monster;
  // tricks
  if (
    m.kind === "imp" &&
    damage > 0 &&
    damage < IMP_DODGE_BELOW &&
    rng() < IMP_DODGE
  ) {
    out.dodged = true;
    out.lines.push(`${m.name} dodged!`);
    return out;
  }
  if (m.armour) {
    if (t.move === "power" && finished) {
      m.armour = false;
      out.armourBroke = true;
      out.lines.push("Crack! The armour broke!");
    } else {
      damage = Math.ceil(damage / 2);
      out.lines.push("The armour blocked half!");
    }
  }
  if (damage === 0) {
    out.lines.push("It missed…");
    return out;
  }
  m.hp = Math.max(0, m.hp - damage);
  out.damage = damage;
  if (crit) out.lines.push("⭐ A critical hit!");
  out.lines.push(`${m.name} took ${damage} damage!`);
  if (m.hp === 0) {
    s.over = true;
    s.won = true;
    out.lines.push(`${m.name} fainted!`);
  }
  return out;
}

export type MonsterOutcome = {
  damage: number;
  hits: number;
  guarded: boolean;
  lines: string[];
};

/** The monster's turn (mutates the state). */
export function monsterMove(s: BattleState, rng: () => number): MonsterOutcome {
  const m = s.monster;
  const hits = m.kind === "slime" && rng() < SLIME_DOUBLE ? 2 : 1;
  const guarded = s.hero.guarding;
  const per = guarded ? Math.ceil(m.attack / 2) : m.attack;
  const damage = per * hits;
  s.hero.guarding = false;
  s.hero.hp = Math.max(0, s.hero.hp - damage);
  const lines = [`${m.name} used ${MONSTER_MOVE[m.kind]}!`];
  if (hits > 1) lines.push("It hit twice!");
  if (guarded) lines.push("Your shield blocked half!");
  lines.push(`You took ${damage} damage!`);
  if (s.hero.hp === 0) {
    s.over = true;
    s.won = false;
    lines.push("You fainted…");
  }
  return { damage, hits, guarded, lines };
}

/** XP needed to reach the next level. */
export const xpForLevel = (level: number): number => level * XP_PER_LEVEL;

/** Add XP; returns the new level/xp and how many levels were gained. */
export function gainXp(
  level: number,
  xp: number,
  add: number,
): { level: number; xp: number; levelsUp: number } {
  let l = level;
  let x = xp + add;
  let up = 0;
  while (x >= xpForLevel(l)) {
    x -= xpForLevel(l);
    l++;
    up++;
  }
  return { level: l, xp: x, levelsUp: up };
}

/** HP back on a level up. */
export const LEVEL_UP_HEAL = 10;

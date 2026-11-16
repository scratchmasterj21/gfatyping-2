import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Monster Quest: a turn-based party battle. Four heroes (players + computer
 * helpers) take turns with the monsters: pick an action, then type its word -
 * faster and cleaner = stronger. When a monster attacks a player's hero, that
 * player types a quick guard word to take less damage. Two battles, then a
 * boss who gets angry at half health.
 *
 * Everything is worked out from the party, a seed and the list of player
 * inputs, so solo and online games share it and every screen agrees.
 */

// ---------------------------------------------------------------- setup

export type HeroClass = "knight" | "mage" | "healer" | "guardian";
export const HERO_CLASSES: HeroClass[] = [
  "knight",
  "mage",
  "healer",
  "guardian",
];
export const PARTY_SIZE = 4;

export type ClassInfo = {
  name: string;
  emoji: string;
  maxHp: number;
  atk: number;
  speed: number;
  skill: string;
  skillEmoji: string;
  /** what the skill aims at */
  skillTarget: "monster" | "allMonsters" | "ally";
  blurb: string;
};

export const CLASS_INFO: Record<HeroClass, ClassInfo> = {
  knight: {
    name: "Knight",
    emoji: "🗡️",
    maxHp: 120,
    atk: 14,
    speed: 6,
    skill: "Power Strike",
    skillEmoji: "💥",
    skillTarget: "monster",
    blurb: "Big hits on one monster",
  },
  mage: {
    name: "Mage",
    emoji: "🔮",
    maxHp: 85,
    atk: 10,
    speed: 8,
    skill: "Fire Storm",
    skillEmoji: "🔥",
    skillTarget: "allMonsters",
    blurb: "Spells that hit every monster",
  },
  healer: {
    name: "Healer",
    emoji: "💚",
    maxHp: 95,
    atk: 8,
    speed: 7,
    skill: "Heal",
    skillEmoji: "💖",
    skillTarget: "ally",
    blurb: "Heals friends and wakes them up",
  },
  guardian: {
    name: "Guardian",
    emoji: "🛡️",
    maxHp: 150,
    atk: 10,
    speed: 5,
    skill: "Protect",
    skillEmoji: "🛡️",
    skillTarget: "ally",
    blurb: "Shields a friend and draws attacks",
  },
};

export type HeroSetup = {
  slot: number;
  cls: HeroClass;
  /** player uid, or null for a computer helper */
  uid: string | null;
  name: string;
};

/** Players keep their picks; computer helpers take the classes left over. */
export function buildParty(
  players: { uid: string; name: string; cls?: HeroClass }[],
): HeroSetup[] {
  const party: HeroSetup[] = [];
  const taken = new Set<HeroClass>();
  for (const p of players.slice(0, PARTY_SIZE)) {
    const cls =
      p.cls !== undefined && !taken.has(p.cls)
        ? p.cls
        : (HERO_CLASSES.find((c) => !taken.has(c)) as HeroClass);
    taken.add(cls);
    party.push({ slot: party.length, cls, uid: p.uid, name: p.name });
  }
  for (const cls of HERO_CLASSES) {
    if (party.length >= PARTY_SIZE) break;
    if (taken.has(cls)) continue;
    taken.add(cls);
    party.push({
      slot: party.length,
      cls,
      uid: null,
      name: `${CLASS_INFO[cls].name} (helper)`,
    });
  }
  return party;
}

export type QuestDifficulty = DifficultyOption & {
  words: string[];
  /** longer words for skills */
  skillWords: string[];
  /** how many words each move asks for */
  phrase: Record<HeroAction, number>;
  /** monster HP multiplier */
  hp: number;
  /** monster attack multiplier */
  atk: number;
};

export const QUEST_DIFFICULTIES: QuestDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    words: EASY_WORDS,
    skillWords: EASY_WORDS,
    phrase: { attack: 2, skill: 3, defend: 2, potion: 2 },
    hp: 0.85,
    atk: 0.8,
  },
  {
    label: "Medium",
    words: MEDIUM_WORDS,
    skillWords: MEDIUM_WORDS,
    phrase: { attack: 2, skill: 3, defend: 2, potion: 2 },
    hp: 1,
    atk: 1,
  },
  {
    label: "Hard",
    hint: "long words",
    words: HARD_WORDS,
    skillWords: HARD_WORDS,
    phrase: { attack: 3, skill: 3, defend: 2, potion: 2 },
    hp: 1.15,
    atk: 1.2,
  },
];

export function questDifficultyFor(label: string): QuestDifficulty {
  return (
    QUEST_DIFFICULTIES.find((d) => d.label === label) ??
    (QUEST_DIFFICULTIES[0] as QuestDifficulty)
  );
}

export type QuestSetup = {
  seed: number;
  difficulty: QuestDifficulty;
  party: HeroSetup[];
};

// ---------------------------------------------------------------- monsters

export type MonsterKind = "slime" | "bat" | "mushroom" | "golem" | "dragon";

type MonsterInfo = {
  name: string;
  hp: number;
  atk: number;
  speed: number;
  boss: boolean;
};

export const MONSTER_INFO: Record<MonsterKind, MonsterInfo> = {
  slime: { name: "Gloopy Slime", hp: 95, atk: 25, speed: 4, boss: false },
  bat: { name: "Batty Bat", hp: 75, atk: 22, speed: 9, boss: false },
  mushroom: {
    name: "Grumpy Mushroom",
    hp: 105,
    atk: 26,
    speed: 5,
    boss: false,
  },
  golem: { name: "Rocky the Golem", hp: 640, atk: 42, speed: 4, boss: true },
  dragon: { name: "Blaze the Dragon", hp: 560, atk: 46, speed: 7, boss: true },
};

const MINION_KINDS: MonsterKind[] = ["slime", "bat", "mushroom"];
const BOSS_KINDS: MonsterKind[] = ["golem", "dragon"];
export const BATTLE_COUNT = 3;

/** Monster kinds per battle: 2 minions, 3 minions, then a boss. */
export function questLineup(seed: number): MonsterKind[][] {
  const rng = seededRandom(seed ^ 0x5eed);
  const pick = (list: MonsterKind[]): MonsterKind =>
    list[Math.floor(rng() * list.length)] as MonsterKind;
  return [
    [pick(MINION_KINDS), pick(MINION_KINDS)],
    [pick(MINION_KINDS), pick(MINION_KINDS), pick(MINION_KINDS)],
    [pick(BOSS_KINDS)],
  ];
}

// ---------------------------------------------------------------- random

/** Small seeded generator so every player gets the same picks. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickWord(seed: number, key: number, words: string[]): string {
  return pickWords(seed, key, words, 1);
}

/** `count` different words joined by spaces. */
function pickWords(
  seed: number,
  key: number,
  words: string[],
  count: number,
): string {
  const rng = seededRandom(seed ^ Math.imul(key + 1, 0x9e3779b1));
  const out: string[] = [];
  for (let tries = 0; out.length < count && tries < count * 10; tries++) {
    const w = words[Math.floor(rng() * words.length)] ?? "go";
    if (!out.includes(w) || tries >= count * 5) out.push(w);
  }
  return out.join(" ");
}

// ---------------------------------------------------------------- typing power

/** Fast enough for a critical hit. */
export function fastMs(phrase: string): number {
  return 900 + phrase.length * 380;
}

/** Strength of a typed move: 1.5 = critical, 0.4 = ran out of time. */
export function typingPower(word: string, errors: number, ms: number): number {
  if (errors === 0) return ms <= fastMs(word) ? 1.5 : 1;
  return errors <= 2 ? 0.75 : 0.55;
}

export const TIMEOUT_POWER = 0.4;
export const CRIT_POWER = 1.5;

// ---------------------------------------------------------------- inputs

export type HeroAction = "attack" | "skill" | "defend" | "potion";

export type HeroInput = {
  kind: "hero";
  action: HeroAction;
  /** monster index (attack / single skill) or hero slot (heal / protect / potion) */
  target?: number;
  power: number;
  timeout?: boolean;
};

export type GuardInput = {
  kind: "guard";
  /** uid -> guarded in time */
  guards?: Record<string, boolean>;
};

export type QuestInput = HeroInput | GuardInput;

// ---------------------------------------------------------------- state

export type HeroState = HeroSetup & {
  hp: number;
  maxHp: number;
  defending: boolean;
  /** protected by this guardian slot until its next turn */
  protectedBy?: number;
  /** player stopped answering: a helper plays for them */
  away: boolean;
  timeouts: number;
};

export type MonsterState = {
  index: number;
  kind: MonsterKind;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  boss: boolean;
};

export type HitResult = {
  /** "h0".."h3" or "m0".. */
  id: string;
  amount: number;
  /** damage (default) or healing */
  heal?: boolean;
  revive?: boolean;
  crit?: boolean;
  guarded?: boolean;
  ko?: boolean;
};

export type QuestEvent =
  | {
      type: "battle";
      battle: number;
      monsters: MonsterState[];
    }
  | {
      type: "action";
      actor: string;
      /** e.g. "Power Strike", "Attack", "Big Stomp" */
      move: string;
      emoji: string;
      hits: HitResult[];
      note?: string;
    }
  | { type: "angry"; actor: string }
  | { type: "rest"; hp: number[] }
  | { type: "end"; won: boolean };

export type PendingHero = {
  kind: "hero";
  n: number;
  slot: number;
  uid: string;
  /** words for each action */
  words: Record<HeroAction, string>;
};

export type PendingGuard = {
  kind: "guard";
  n: number;
  monster: number;
  /** uid -> word to type */
  words: Record<string, string>;
  big: boolean;
};

export type Pending = PendingHero | PendingGuard;

export type HeroStats = {
  damage: number;
  healed: number;
  guards: number;
  crits: number;
};

export type QuestState = {
  battle: number;
  heroes: HeroState[];
  monsters: MonsterState[];
  potions: number;
  angry: boolean;
  over: boolean;
  won: boolean;
  events: QuestEvent[];
  pending: Pending | null;
  /** inputs used so far */
  used: number;
  /** events.length just before input k was applied (for timing) */
  inputStart: number[];
  stats: Record<number, HeroStats>;
  /** actor ids in the round so far, for the turn bar */
  upNext: string[];
};

export const START_POTIONS = 3;
export const POTION_HEAL = 50;
/** guarded hits keep this share of the damage */
export const GUARD_SHARE = 0.4;
/** computer helpers guard this often */
const CPU_GUARD_CHANCE = 0.6;
/** missed this many turns in a row: a helper takes over */
const AWAY_AFTER = 2;
const REST_HEAL = 0.3;
/** safety stop for the turn loop */
const MAX_STEPS = 2000;

export const heroId = (slot: number): string => `h${slot}`;
export const monsterId = (index: number): string => `m${index}`;

function makeMonsters(
  kinds: MonsterKind[],
  d: QuestDifficulty,
): MonsterState[] {
  const seen: Partial<Record<MonsterKind, number>> = {};
  return kinds.map((kind, index) => {
    const info = MONSTER_INFO[kind];
    const maxHp = Math.round(info.hp * d.hp);
    // two of the same monster: "Gloopy Slime A", "Gloopy Slime B"
    const twins = kinds.filter((k) => k === kind).length > 1;
    const nth = seen[kind] ?? 0;
    seen[kind] = nth + 1;
    return {
      index,
      kind,
      name: twins ? `${info.name} ${String.fromCharCode(65 + nth)}` : info.name,
      hp: maxHp,
      maxHp,
      atk: Math.round(info.atk * d.atk),
      speed: info.speed,
      boss: info.boss,
    };
  });
}

type Actor = { id: string; speed: number; order: number };

function roundOrder(s: QuestState): string[] {
  const actors: Actor[] = [
    ...s.heroes
      .filter((h) => h.hp > 0)
      .map((h) => ({
        id: heroId(h.slot),
        speed: CLASS_INFO[h.cls].speed,
        order: h.slot,
      })),
    ...s.monsters
      .filter((m) => m.hp > 0)
      .map((m) => ({
        id: monsterId(m.index),
        speed: m.speed,
        order: 10 + m.index,
      })),
  ];
  return actors
    .sort((a, b) => b.speed - a.speed || a.order - b.order)
    .map((a) => a.id);
}

const alive = <T extends { hp: number }>(list: T[]): T[] =>
  list.filter((x) => x.hp > 0);

function lowest<T extends { hp: number; maxHp: number }>(
  list: T[],
): T | undefined {
  return [...list].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

function rollPower(rng: () => number): number {
  if (rng() < 0.15) return CRIT_POWER;
  return 0.8 + rng() * 0.35;
}

/** What a computer helper (or an away player) does. */
function cpuChoice(
  s: QuestState,
  hero: HeroState,
  rng: () => number,
): HeroInput {
  const power = rollPower(rng);
  const monsters = alive(s.monsters);
  const weakest = lowest(monsters);
  const attack: HeroInput = {
    kind: "hero",
    action: "attack",
    target: weakest?.index ?? 0,
    power,
  };
  if (hero.cls === "healer") {
    const down = s.heroes.find((h) => h.hp <= 0);
    if (down !== undefined) {
      return { kind: "hero", action: "skill", target: down.slot, power };
    }
    const hurt = lowest(alive(s.heroes));
    if (hurt !== undefined && hurt.hp / hurt.maxHp < 0.55) {
      return { kind: "hero", action: "skill", target: hurt.slot, power };
    }
    return attack;
  }
  if (hero.cls === "guardian") {
    const hurt = lowest(
      alive(s.heroes).filter(
        (h) => h.slot !== hero.slot && h.protectedBy === undefined,
      ),
    );
    if (hurt !== undefined && hurt.hp / hurt.maxHp < 0.4) {
      return { kind: "hero", action: "skill", target: hurt.slot, power };
    }
    return attack;
  }
  if (hero.cls === "mage") {
    return monsters.length >= 2
      ? { kind: "hero", action: "skill", power }
      : attack;
  }
  // knight
  return rng() < 0.45 ? { ...attack, action: "skill" } : attack;
}

function heroMoveWords(
  seed: number,
  step: number,
  d: QuestDifficulty,
): Record<HeroAction, string> {
  return {
    attack: pickWords(seed, step * 8 + 1, d.words, d.phrase.attack),
    skill: pickWords(seed, step * 8 + 2, d.skillWords, d.phrase.skill),
    defend: pickWords(seed, step * 8 + 3, d.words, d.phrase.defend),
    potion: pickWords(seed, step * 8 + 4, d.words, d.phrase.potion),
  };
}

function guardWord(
  seed: number,
  step: number,
  slot: number,
  d: QuestDifficulty,
): string {
  return pickWord(seed, step * 8 + 5 + slot * 101, d.words);
}

const scaled = (base: number, power: number, rng: () => number): number =>
  Math.max(1, Math.round(base * power * (0.9 + rng() * 0.2)));

/** Is a player's input needed for this hero right now? */
const needsPlayer = (h: HeroState): h is HeroState & { uid: string } =>
  h.uid !== null && !h.away;

function applyHero(
  s: QuestState,
  hero: HeroState,
  input: HeroInput,
  rng: () => number,
): void {
  const info = CLASS_INFO[hero.cls];
  const crit = input.power >= CRIT_POWER;
  const stats = s.stats[hero.slot] as HeroStats;
  if (crit) stats.crits++;
  hero.defending = false;
  // a guardian's protection lasts until its next turn
  for (const h of s.heroes) {
    if (h.protectedBy === hero.slot) h.protectedBy = undefined;
  }

  const hitMonster = (m: MonsterState, base: number): HitResult => {
    const amount = Math.min(m.hp, scaled(base, input.power, rng));
    m.hp -= amount;
    stats.damage += amount;
    return { id: monsterId(m.index), amount, crit, ko: m.hp <= 0 };
  };
  const targetMonster = (): MonsterState | undefined => {
    const live = alive(s.monsters);
    return live.find((m) => m.index === input.target) ?? live[0];
  };
  const targetHero = (): HeroState =>
    s.heroes.find((h) => h.slot === input.target) ?? hero;

  const action = input.action;
  if (action === "attack") {
    const m = targetMonster();
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: "Attack",
      emoji: "⚔️",
      hits: m === undefined ? [] : [hitMonster(m, info.atk)],
      ...(input.timeout === true ? { note: "too slow!" } : {}),
    });
    return;
  }
  if (action === "defend") {
    hero.defending = true;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: "Defend",
      emoji: "🛡️",
      hits: [],
    });
    return;
  }
  if (action === "potion") {
    const target = targetHero();
    if (s.potions <= 0 || target.hp <= 0) {
      s.events.push({
        type: "action",
        actor: heroId(hero.slot),
        move: "Potion",
        emoji: "🧪",
        hits: [],
        note: s.potions <= 0 ? "no potions left!" : "it didn't work",
      });
      return;
    }
    s.potions--;
    const amount = Math.min(target.maxHp - target.hp, POTION_HEAL);
    target.hp += amount;
    stats.healed += amount;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: "Potion",
      emoji: "🧪",
      hits: [{ id: heroId(target.slot), amount, heal: true }],
    });
    return;
  }
  // skills
  if (hero.cls === "knight") {
    const m = targetMonster();
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: m === undefined ? [] : [hitMonster(m, info.atk * 1.7)],
    });
  } else if (hero.cls === "mage") {
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: alive(s.monsters).map((m) => hitMonster(m, info.atk * 1.05)),
    });
  } else if (hero.cls === "healer") {
    const target = targetHero();
    const revive = target.hp <= 0;
    const want = revive ? 35 : 45;
    const amount = Math.min(
      target.maxHp - target.hp,
      scaled(want, input.power, rng),
    );
    target.hp += amount;
    stats.healed += amount;
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: revive ? "Wake Up" : info.skill,
      emoji: revive ? "✨" : info.skillEmoji,
      hits: [{ id: heroId(target.slot), amount, heal: true, revive }],
    });
  } else {
    const target = targetHero();
    if (target.slot !== hero.slot && target.hp > 0) {
      target.protectedBy = hero.slot;
    }
    s.events.push({
      type: "action",
      actor: heroId(hero.slot),
      move: info.skill,
      emoji: info.skillEmoji,
      hits: [],
      note: `protects ${target.slot === hero.slot ? "the team" : target.name}`,
    });
  }
}

function damageHero(
  s: QuestState,
  target: HeroState,
  raw: number,
  guarded: boolean,
): HitResult[] {
  let amount = raw;
  if (guarded) amount *= GUARD_SHARE;
  if (target.defending) amount *= 0.5;
  amount = Math.max(1, Math.round(amount));
  const hits: HitResult[] = [];
  // a guardian takes the hit for a protected friend, at half strength
  const guardian =
    target.protectedBy === undefined
      ? undefined
      : s.heroes.find((h) => h.slot === target.protectedBy && h.hp > 0);
  const victim = guardian ?? target;
  if (guardian !== undefined) amount = Math.max(1, Math.round(amount * 0.5));
  amount = Math.min(victim.hp, amount);
  victim.hp -= amount;
  if (guarded) (s.stats[target.slot] as HeroStats).guards++;
  hits.push({
    id: heroId(victim.slot),
    amount,
    guarded,
    ko: victim.hp <= 0,
  });
  if (victim.hp <= 0) {
    victim.defending = false;
    victim.protectedBy = undefined;
    for (const h of s.heroes) {
      if (h.protectedBy === victim.slot) h.protectedBy = undefined;
    }
  }
  return hits;
}

/** Whom the monster goes for (decided before anyone guards). */
function monsterPlan(
  s: QuestState,
  m: MonsterState,
  rng: () => number,
): { big: boolean; targets: HeroState[] } {
  const live = alive(s.heroes);
  const bigTurn = m.boss && s.angry && rng() < 0.4;
  if (bigTurn) return { big: true, targets: live };
  const guardian = live.find((h) => h.cls === "guardian");
  if (guardian !== undefined && rng() < 0.35) {
    return { big: false, targets: [guardian] };
  }
  return {
    big: false,
    targets: [live[Math.floor(rng() * live.length)] as HeroState],
  };
}

const MONSTER_MOVES: Record<MonsterKind, [string, string]> = {
  slime: ["Slime Splash", "💧"],
  bat: ["Wing Flap", "🦇"],
  mushroom: ["Spore Puff", "🍄"],
  golem: ["Rock Smash", "🪨"],
  dragon: ["Fire Breath", "🔥"],
};
const BIG_MOVES: Record<MonsterKind, [string, string]> = {
  slime: ["Mega Splash", "🌊"],
  bat: ["Screech", "📢"],
  mushroom: ["Spore Cloud", "☁️"],
  golem: ["Earthquake", "🌋"],
  dragon: ["Inferno", "☄️"],
};

/** Run the quest from the start through every input given. */
export function runQuest(setup: QuestSetup, inputs: QuestInput[]): QuestState {
  const d = setup.difficulty;
  const lineup = questLineup(setup.seed);
  const s: QuestState = {
    battle: 0,
    heroes: setup.party.map((h) => ({
      ...h,
      hp: CLASS_INFO[h.cls].maxHp,
      maxHp: CLASS_INFO[h.cls].maxHp,
      defending: false,
      away: false,
      timeouts: 0,
    })),
    monsters: makeMonsters(lineup[0] ?? [], d),
    potions: START_POTIONS,
    angry: false,
    over: false,
    won: false,
    events: [],
    pending: null,
    used: 0,
    inputStart: [],
    stats: Object.fromEntries(
      setup.party.map((h) => [
        h.slot,
        { damage: 0, healed: 0, guards: 0, crits: 0 },
      ]),
    ),
    upNext: [],
  };
  s.events.push({ type: "battle", battle: 0, monsters: cloneMonsters(s) });

  let queue: string[] = [];
  let step = 0;
  while (!s.over && step < MAX_STEPS) {
    if (queue.length === 0) queue = roundOrder(s);
    const id = queue[0] as string;
    const rng = seededRandom(setup.seed ^ Math.imul(step + 7, 0x85ebca6b));

    if (id.startsWith("h")) {
      const hero = s.heroes[Number(id.slice(1))] as HeroState;
      if (hero.hp <= 0) {
        queue.shift();
        continue;
      }
      let input: HeroInput;
      if (needsPlayer(hero)) {
        const given = inputs[s.used];
        if (given === undefined) {
          s.pending = {
            kind: "hero",
            n: s.used,
            slot: hero.slot,
            uid: hero.uid,
            words: heroMoveWords(setup.seed, step, d),
          };
          s.upNext = queue;
          return s;
        }
        s.used++;
        s.inputStart.push(s.events.length);
        input =
          given.kind === "hero"
            ? given
            : { kind: "hero", action: "attack", power: TIMEOUT_POWER };
        hero.timeouts = input.timeout === true ? hero.timeouts + 1 : 0;
        if (hero.timeouts >= AWAY_AFTER) hero.away = true;
      } else {
        input = cpuChoice(s, hero, rng);
      }
      applyHero(s, hero, input, rng);
    } else {
      const m = s.monsters[Number(id.slice(1))] as MonsterState;
      if (m.hp <= 0) {
        queue.shift();
        continue;
      }
      const plan = monsterPlan(s, m, rng);
      const players = plan.targets.filter(needsPlayer);
      let guards: Record<string, boolean> = {};
      if (players.length > 0) {
        const given = inputs[s.used];
        if (given === undefined) {
          s.pending = {
            kind: "guard",
            n: s.used,
            monster: m.index,
            big: plan.big,
            words: Object.fromEntries(
              players.map((h) => [
                h.uid,
                guardWord(setup.seed, step, h.slot, d),
              ]),
            ),
          };
          s.upNext = queue;
          return s;
        }
        s.used++;
        s.inputStart.push(s.events.length);
        guards = given.kind === "guard" ? (given.guards ?? {}) : {};
      }
      const [move, emoji] = (plan.big ? BIG_MOVES : MONSTER_MOVES)[m.kind];
      const base = plan.big ? m.atk * 0.7 : m.atk;
      const hits = plan.targets.flatMap((t) => {
        const guarded = needsPlayer(t)
          ? guards[t.uid] === true
          : rng() < CPU_GUARD_CHANCE;
        return damageHero(s, t, scaled(base, 1, rng), guarded);
      });
      s.events.push({ type: "action", actor: id, move, emoji, hits });
    }
    queue.shift();
    step++;

    // the boss gets angry at half health
    const boss = s.monsters.find((x) => x.boss && x.hp > 0);
    if (boss !== undefined && !s.angry && boss.hp <= boss.maxHp / 2) {
      s.angry = true;
      boss.atk = Math.round(boss.atk * 1.25);
      s.events.push({ type: "angry", actor: monsterId(boss.index) });
    }

    if (alive(s.heroes).length === 0) {
      s.over = true;
      s.events.push({ type: "end", won: false });
    } else if (alive(s.monsters).length === 0) {
      if (s.battle + 1 >= BATTLE_COUNT) {
        s.over = true;
        s.won = true;
        s.events.push({ type: "end", won: true });
      } else {
        // short rest, then the next battle
        s.battle++;
        for (const h of s.heroes) {
          h.hp = Math.min(
            h.maxHp,
            Math.max(h.hp, 0) + Math.round(h.maxHp * REST_HEAL),
          );
          h.defending = false;
          h.protectedBy = undefined;
        }
        s.events.push({ type: "rest", hp: s.heroes.map((h) => h.hp) });
        s.monsters = makeMonsters(lineup[s.battle] ?? [], d);
        s.events.push({
          type: "battle",
          battle: s.battle,
          monsters: cloneMonsters(s),
        });
        queue = [];
      }
    } else {
      queue = queue.filter((a) =>
        a.startsWith("h")
          ? (s.heroes[Number(a.slice(1))]?.hp ?? 0) > 0
          : (s.monsters[Number(a.slice(1))]?.hp ?? 0) > 0,
      );
    }
  }
  s.upNext = queue;
  return s;
}

function cloneMonsters(s: QuestState): MonsterState[] {
  return s.monsters.map((m) => ({ ...m }));
}

// ---------------------------------------------------------------- timing

/** How long the screen spends showing each event, ms. */
export function eventMs(e: QuestEvent): number {
  if (e.type === "battle") return 1800;
  if (e.type === "rest") return 1600;
  if (e.type === "angry") return 1500;
  if (e.type === "end") return 0;
  return e.hits.length > 1 ? 1300 : 1100;
}

/** Time to make a move / guard, ms. */
export const HERO_TURN_MS = 30_000;
export const GUARD_MS = 5_000;
export const START_PAUSE_MS = 3000;

// ---------------------------------------------------------------- score

export const QUEST_SCORE = { win: 40, mvp: 15, guard: 4, crit: 2 };

export function questScore(input: {
  won: boolean;
  stats: HeroStats;
  battlesWon: number;
  mvp: boolean;
}): number {
  return Math.round(
    (input.won ? QUEST_SCORE.win : 0) +
      input.battlesWon * 10 +
      input.stats.damage / 6 +
      input.stats.healed / 6 +
      input.stats.guards * QUEST_SCORE.guard +
      input.stats.crits * QUEST_SCORE.crit +
      (input.mvp ? QUEST_SCORE.mvp : 0),
  );
}

export function questStars(won: boolean, heroes: HeroState[]): number {
  if (!won) return 1;
  const standing = heroes.filter((h) => h.hp > 0).length;
  return standing === heroes.length ? 3 : 2;
}

export type QuestAward = {
  icon: string;
  title: string;
  names: string[];
  value: number;
};

/** Fun awards for the players (helpers don't get them). */
export function questAwards(
  heroes: HeroState[],
  stats: Record<number, HeroStats>,
): QuestAward[] {
  const players = heroes.filter((h) => h.uid !== null);
  if (players.length < 2) return [];
  const award = (
    icon: string,
    title: string,
    value: (st: HeroStats) => number,
  ): QuestAward | null => {
    const best = Math.max(
      ...players.map((h) => value(stats[h.slot] as HeroStats)),
    );
    if (best <= 0) return null;
    return {
      icon,
      title,
      value: best,
      names: players
        .filter((h) => value(stats[h.slot] as HeroStats) === best)
        .map((h) => h.name),
    };
  };
  return [
    award("🏆", "MVP (most damage)", (st) => st.damage),
    award("💖", "Best healer", (st) => st.healed),
    award("🛡️", "Perfect guard", (st) => st.guards),
    award("⭐", "Critical hits", (st) => st.crits),
  ].filter((a): a is QuestAward => a !== null);
}

/**
 * When the pending input times out: the previous input's time (or the start)
 * + time to show what happened since + the turn timer.
 */
export function pendingDeadline(
  s: QuestState,
  startAt: number,
  inputTimes: number[],
): number | null {
  const p = s.pending;
  if (p === null) return null;
  const from = p.n === 0 ? 0 : (s.inputStart[p.n - 1] ?? 0);
  const since = p.n === 0 ? startAt : (inputTimes[p.n - 1] ?? startAt);
  const anim = s.events.slice(from).reduce((ms, e) => ms + eventMs(e), 0);
  return since + anim + (p.kind === "hero" ? HERO_TURN_MS : GUARD_MS);
}

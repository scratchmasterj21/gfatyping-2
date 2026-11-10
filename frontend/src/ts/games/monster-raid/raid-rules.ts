import type { DifficultyOption } from "../components/DifficultySegmented";

import { EASY_WORDS, HARD_WORDS, MEDIUM_WORDS } from "../shared/kid-words";

/**
 * Monster Raid: players team up and type words to hit monsters (two minion
 * waves, then a boss). Every few seconds the monster charges an attack and a
 * shield word appears - anyone on the team who types it in time blocks it,
 * otherwise the team loses a heart.
 *
 * Co-op: everyone is one team. Teams: 2-4 teams each fight their own copy of
 * the monsters; the first team to beat its boss wins.
 *
 * Everything is worked out from shared facts (start time, seed, damage each
 * player has dealt, blocked attacks, when each team cleared), so solo and
 * online games share it and no one player has to run the monsters.
 */

export type RaidTeam = "red" | "blue" | "green" | "yellow";
export const RAID_TEAMS: RaidTeam[] = ["red", "blue", "green", "yellow"];
export type RaidMode = "coop" | "teams";

export const START_HEARTS = 5;
export const MAX_RAID_PLAYERS = 8;
/** 3-2-1 before the first word, ms. */
export const START_PAUSE_MS = 3000;
/** The raid ends after this long, ms (co-op: the monsters win). */
export const RAID_TIME_LIMIT_MS = 4 * 60_000;

export type RaidDifficulty = DifficultyOption & {
  words: string[];
  /** monster HP for all three waves, per player on the team */
  hpPerPlayer: number;
  /** an attack lands every this many ms */
  attackEveryMs: number;
  /** the shield word shows this long before the attack lands, ms */
  chargeMs: number;
};

export const RAID_DIFFICULTIES: RaidDifficulty[] = [
  {
    label: "Easy",
    hint: "short words",
    words: EASY_WORDS,
    hpPerPlayer: 90,
    attackEveryMs: 14_000,
    chargeMs: 7000,
  },
  {
    label: "Medium",
    words: MEDIUM_WORDS,
    hpPerPlayer: 130,
    attackEveryMs: 12_000,
    chargeMs: 6000,
  },
  {
    label: "Hard",
    hint: "long words",
    words: HARD_WORDS,
    hpPerPlayer: 170,
    attackEveryMs: 10_000,
    chargeMs: 5000,
  },
];

export function raidDifficultyFor(label: string): RaidDifficulty {
  return (
    RAID_DIFFICULTIES.find((d) => d.label === label) ??
    (RAID_DIFFICULTIES[0] as RaidDifficulty)
  );
}

/** Share of the total HP each wave has: minion, minion, boss. */
export const WAVE_SHARES = [0.25, 0.25, 0.5] as const;

/** Coins-score bonuses. */
export const RAID_SCORE = { win: 40, mvp: 20, block: 5, heal: 5 };

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

function shuffled<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** This player's own word stream (different for each player). */
export function wordStream(
  seed: number,
  uid: string,
  words: string[],
): string[] {
  return shuffled(words, seededRandom(seed ^ hashString(uid)));
}

// ---------------------------------------------------------------- damage

/**
 * Damage for one finished word: longer words hit harder, and a run of
 * mistake-free words (combo, counting this one) adds a bonus.
 */
export function wordDamage(
  word: string,
  clean: boolean,
  combo: number,
): number {
  const base = Math.max(1, Math.ceil(word.length / 2));
  if (!clean) return base;
  return base + (combo >= 6 ? 2 : combo >= 3 ? 1 : 0);
}

export function teamMaxHp(teamSize: number, d: RaidDifficulty): number {
  return Math.max(1, teamSize) * d.hpPerPlayer;
}

export type WaveView = {
  /** 0, 1 = minions, 2 = boss */
  index: number;
  hp: number;
  maxHp: number;
  cleared: boolean;
};

/** Which wave a team is on and how much HP that monster has left. */
export function waveFor(dealt: number, maxHp: number): WaveView {
  let start = 0;
  for (let i = 0; i < WAVE_SHARES.length; i++) {
    const size =
      i === WAVE_SHARES.length - 1
        ? maxHp - start
        : Math.round(maxHp * (WAVE_SHARES[i] as number));
    if (dealt < start + size) {
      return {
        index: i,
        hp: start + size - dealt,
        maxHp: size,
        cleared: false,
      };
    }
    start += size;
  }
  const bossStart = WAVE_SHARES.slice(0, -1).reduce(
    (s, share) => s + Math.round(maxHp * share),
    0,
  );
  return {
    index: WAVE_SHARES.length - 1,
    hp: 0,
    maxHp: Math.max(1, maxHp - bossStart),
    cleared: true,
  };
}

// ---------------------------------------------------------------- attacks

/** Angry boss (below half HP): attacks come this much more often... */
export const ANGRY_EVERY_FACTOR = 0.6;
/** ...with this much less warning, and every 2nd one hits two players. */
export const ANGRY_CHARGE_FACTOR = 0.75;

export type Attack = {
  /** 1, 2, ... */
  k: number;
  startsAt: number;
  landsAt: number;
  /** the boss was angry when this attack started charging */
  angry: boolean;
  /** shields to type: 1, or 2 for a double attack */
  slots: 1 | 2;
};
/** An attack that is charging right now. */
export type Charge = Attack;

/**
 * Every attack in order. Until the boss gets angry (`angryAt`), attack k
 * lands at startAt + k * attackEveryMs; an attack already charging when he
 * gets angry still lands as normal, after that they speed up.
 */
export function* raidAttacks(
  startAt: number,
  d: RaidDifficulty,
  angryAt?: number,
): Generator<Attack> {
  const angryEvery = Math.round(d.attackEveryMs * ANGRY_EVERY_FACTOR);
  const angryCharge = Math.round(d.chargeMs * ANGRY_CHARGE_FACTOR);
  let last = startAt;
  let angryCount = 0;
  for (let k = 1; ; k++) {
    const normal = last + d.attackEveryMs;
    if (angryAt === undefined || normal - d.chargeMs < angryAt) {
      yield {
        k,
        startsAt: normal - d.chargeMs,
        landsAt: normal,
        angry: false,
        slots: 1,
      };
      last = normal;
      continue;
    }
    angryCount++;
    const landsAt = Math.max(last + angryEvery, angryAt + angryCharge);
    yield {
      k,
      startsAt: landsAt - angryCharge,
      landsAt,
      angry: true,
      slots: angryCount % 2 === 0 ? 2 : 1,
    };
    last = landsAt;
  }
}

/** The attack charging right now, if any. */
export function currentCharge(
  startAt: number,
  now: number,
  d: RaidDifficulty,
  angryAt?: number,
): Charge | null {
  if (now < startAt) return null;
  for (const a of raidAttacks(startAt, d, angryAt)) {
    if (a.landsAt <= now) continue;
    return a.startsAt <= now ? a : null;
  }
  return null;
}

/** Key of one shield in the blocks list: "3", or "3b" for a double's 2nd. */
export function blockKey(k: number, slot: number): string {
  return slot === 0 ? String(k) : `${k}b`;
}

/** The shield word for attack k (the same for everyone in the room). */
export function shieldWord(
  seed: number,
  k: number,
  words: string[],
  slot = 0,
): string {
  const rng = seededRandom(seed ^ Math.imul(k + 1 + slot * 977, 2654435761));
  // prefer a longer word so it feels like a big block
  const pool = words.filter((w) => w.length >= 4);
  const list = pool.length > 0 ? pool : words;
  return list[Math.floor(rng() * list.length)] ?? "block";
}

/**
 * Who each shield of attack k is aimed at (only they can block it). A double
 * attack picks two different players when the team has two.
 */
export function attackTargets(
  seed: number,
  k: number,
  members: string[],
  slots: 1 | 2,
): string[] {
  const list = members.toSorted();
  if (list.length === 0) return [];
  const rng = seededRandom(seed ^ Math.imul(k + 7, 40503));
  const first = Math.floor(rng() * list.length);
  const picks = [list[first] as string];
  if (slots === 2) {
    const second =
      list.length < 2
        ? first
        : (first + 1 + Math.floor(rng() * (list.length - 1))) % list.length;
    picks.push(list[second] as string);
  }
  return picks;
}

/** Boss below half HP: time to get angry. */
export function bossShouldGetAngry(wave: WaveView): boolean {
  return wave.index === 2 && !wave.cleared && wave.hp * 2 <= wave.maxHp;
}

// ---------------------------------------------------------------- heals

/** A 💖 heal word shows up at 40s, then every 45s, for 8s. */
export const HEAL_FIRST_MS = 40_000;
export const HEAL_EVERY_MS = 45_000;
export const HEAL_WINDOW_MS = 8000;

export type HealWindow = { n: number; startsAt: number; endsAt: number };

/** The heal word on screen right now, if any. */
export function currentHeal(startAt: number, now: number): HealWindow | null {
  const since = now - startAt - HEAL_FIRST_MS;
  if (since < 0) return null;
  const n = Math.floor(since / HEAL_EVERY_MS) + 1;
  const begins = startAt + HEAL_FIRST_MS + (n - 1) * HEAL_EVERY_MS;
  const endsAt = begins + HEAL_WINDOW_MS;
  return now < endsAt ? { n, startsAt: begins, endsAt } : null;
}

export function healWord(seed: number, n: number, words: string[]): string {
  const rng = seededRandom(seed ^ Math.imul(n + 3, 2246822519));
  return words[Math.floor(rng() * words.length)] ?? "heart";
}

/**
 * Hearts at time t: each attack slot that landed unblocked costs one, each
 * heal (claim times) gives one back (up to START_HEARTS). Also returns when
 * the last heart went (if it did) - no heal brings a team back after that.
 */
export function heartsAt(
  startAt: number,
  t: number,
  d: RaidDifficulty,
  blocked: ReadonlySet<string>,
  angryAt?: number,
  heals: readonly number[] = [],
): { hearts: number; knockedOutAt?: number } {
  const events: { at: number; delta: number }[] = heals
    .filter((at) => at <= t)
    .map((at) => ({ at, delta: 1 }));
  for (const a of raidAttacks(startAt, d, angryAt)) {
    if (a.landsAt > t) break;
    let lost = 0;
    for (let slot = 0; slot < a.slots; slot++) {
      if (!blocked.has(blockKey(a.k, slot))) lost++;
    }
    if (lost > 0) events.push({ at: a.landsAt, delta: -lost });
  }
  // attacks before heals at the same moment
  events.sort((x, y) => x.at - y.at || x.delta - y.delta);
  let hearts = START_HEARTS;
  for (const e of events) {
    hearts = Math.min(START_HEARTS, hearts + e.delta);
    if (hearts <= 0) return { hearts: 0, knockedOutAt: e.at };
  }
  return { hearts };
}

// ---------------------------------------------------------------- teams

/**
 * Split players into teams of about `teamSize` (at least 2 teams, at most 4),
 * shuffled so friends who joined together don't always team up.
 */
export function assignRaidTeams(
  uids: string[],
  teamSize: number,
  rng: () => number = Math.random,
): Record<string, RaidTeam> {
  const count = Math.min(
    RAID_TEAMS.length,
    Math.max(2, Math.round(uids.length / Math.max(1, teamSize))),
  );
  const teams: Record<string, RaidTeam> = {};
  shuffled(uids, rng).forEach((uid, i) => {
    teams[uid] = RAID_TEAMS[i % count] as RaidTeam;
  });
  return teams;
}

// ---------------------------------------------------------------- outcome

export type RaidFacts = {
  mode: RaidMode;
  difficulty: RaidDifficulty;
  /** when typing starts (after the 3-2-1) */
  startAt: number;
  /** uid -> team (co-op: everyone "red") */
  teams: Record<string, RaidTeam>;
  /** uid -> damage dealt */
  dealt: Record<string, number>;
  /** team -> blocked shields (blockKey) */
  blocked: Partial<Record<RaidTeam, ReadonlySet<string>>>;
  /** team -> when it beat its boss */
  clearedAt: Partial<Record<RaidTeam, number>>;
  /** team -> when its boss got angry */
  angryAt?: Partial<Record<RaidTeam, number>>;
  /** team -> when each heal word was typed */
  heals?: Partial<Record<RaidTeam, readonly number[]>>;
};

export type TeamView = {
  team: RaidTeam;
  members: string[];
  dealt: number;
  maxHp: number;
  wave: WaveView;
  hearts: number;
  knockedOut: boolean;
  clearedAt?: number;
  /** when the boss got angry (if he has) */
  angryAt?: number;
};

export type RaidView = {
  teams: TeamView[];
  over: boolean;
  /** when it ended */
  endAt?: number;
  /** winning team; co-op: "red" when the monsters were beaten */
  winner?: RaidTeam;
  reason?: "cleared" | "hearts" | "time";
};

export function teamsInPlay(teams: Record<string, RaidTeam>): RaidTeam[] {
  const present = new Set(Object.values(teams));
  return RAID_TEAMS.filter((t) => present.has(t));
}

export function raidView(f: RaidFacts, now: number): RaidView {
  const names = teamsInPlay(f.teams);
  const base = names.map((team) => {
    const members = Object.keys(f.teams).filter((u) => f.teams[u] === team);
    const dealt = members.reduce((s, u) => s + Math.max(0, f.dealt[u] ?? 0), 0);
    const maxHp = teamMaxHp(members.length, f.difficulty);
    const ko = heartsAt(
      f.startAt,
      now,
      f.difficulty,
      f.blocked[team] ?? new Set(),
      f.angryAt?.[team],
      f.heals?.[team],
    );
    return { team, members, dealt, maxHp, ko };
  });

  const timeUp = f.startAt + RAID_TIME_LIMIT_MS;
  const clears = names
    .map((t) => f.clearedAt[t])
    .filter((t): t is number => t !== undefined);
  const firstClear = clears.length > 0 ? Math.min(...clears) : undefined;
  const kos = base
    .map((b) => b.ko.knockedOutAt)
    .filter((t): t is number => t !== undefined);
  const allKo = kos.length === base.length ? Math.max(...kos) : undefined;

  let endAt: number | undefined;
  let reason: RaidView["reason"];
  let winner: RaidTeam | undefined;
  const candidates: [number | undefined, RaidView["reason"]][] = [
    [firstClear, "cleared"],
    [allKo, "hearts"],
    [now >= timeUp ? timeUp : undefined, "time"],
  ];
  for (const [t, r] of candidates) {
    if (t !== undefined && (endAt === undefined || t < endAt)) {
      endAt = t;
      reason = r;
    }
  }

  const over = endAt !== undefined && now >= endAt;
  const at = over ? (endAt as number) : now;
  const teams: TeamView[] = base.map((b) => {
    const h = heartsAt(
      f.startAt,
      at,
      f.difficulty,
      f.blocked[b.team] ?? new Set(),
      f.angryAt?.[b.team],
      f.heals?.[b.team],
    );
    return {
      team: b.team,
      members: b.members,
      dealt: b.dealt,
      maxHp: b.maxHp,
      wave: waveFor(b.dealt, b.maxHp),
      hearts: h.hearts,
      knockedOut: h.hearts <= 0,
      clearedAt: f.clearedAt[b.team],
      angryAt: f.angryAt?.[b.team],
    };
  });

  if (over) {
    if (reason === "cleared") {
      winner = names.find((t) => f.clearedAt[t] === firstClear);
    } else if (f.mode === "teams") {
      // nobody beat their boss: the team that got furthest wins (a tie
      // has no winner)
      const best = Math.max(...teams.map((t) => t.dealt / t.maxHp));
      const top = teams.filter((t) => t.dealt / t.maxHp === best);
      if (top.length === 1 && best > 0) winner = top[0]?.team;
    }
  }
  return { teams, over, endAt: over ? endAt : undefined, winner, reason };
}

/** Score used for coins: damage, blocks, and bonuses for the win and MVP. */
export function raidScore(input: {
  dealt: number;
  blocks: number;
  heals?: number;
  won: boolean;
  mvp: boolean;
}): number {
  return (
    Math.max(0, input.dealt) +
    input.blocks * RAID_SCORE.block +
    (input.heals ?? 0) * RAID_SCORE.heal +
    (input.won ? RAID_SCORE.win : 0) +
    (input.mvp ? RAID_SCORE.mvp : 0)
  );
}

/** 1-3 stars for the result screen. */
export function raidStars(won: boolean, hearts: number): number {
  if (!won) return 1;
  return hearts >= 4 ? 3 : 2;
}

// ---------------------------------------------------------------- awards

export type RaidPlayerStats = {
  uid: string;
  name: string;
  dealt: number;
  blocks: number;
  heals: number;
  bestCombo: number;
};

export type RaidAward = {
  icon: string;
  title: string;
  uids: string[];
  names: string[];
  value: number;
};

/** End-screen awards: top damage, blocks, combo and heals (ties share). */
export function raidAwards(players: RaidPlayerStats[]): RaidAward[] {
  const kinds: {
    icon: string;
    title: string;
    of: (p: RaidPlayerStats) => number;
  }[] = [
    { icon: "⚔️", title: "Most damage", of: (p) => p.dealt },
    { icon: "🛡️", title: "Most blocks", of: (p) => p.blocks },
    { icon: "🔥", title: "Best combo", of: (p) => p.bestCombo },
    { icon: "💖", title: "Healer", of: (p) => p.heals },
  ];
  const out: RaidAward[] = [];
  for (const kind of kinds) {
    const best = Math.max(0, ...players.map(kind.of));
    if (best <= 0) continue;
    const top = players.filter((p) => kind.of(p) === best);
    out.push({
      icon: kind.icon,
      title: kind.title,
      uids: top.map((p) => p.uid),
      names: top.map((p) => p.name),
      value: best,
    });
  }
  return out;
}

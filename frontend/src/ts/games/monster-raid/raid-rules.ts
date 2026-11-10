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
export const RAID_SCORE = { win: 40, mvp: 20, block: 5 };

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

export type Charge = { k: number; startsAt: number; landsAt: number };

/** Attack k (1, 2, ...) lands at startAt + k * attackEveryMs. */
export function attackLandsAt(
  startAt: number,
  k: number,
  d: RaidDifficulty,
): number {
  return startAt + k * d.attackEveryMs;
}

/** The attack charging right now, if any. */
export function currentCharge(
  startAt: number,
  now: number,
  d: RaidDifficulty,
): Charge | null {
  if (now < startAt) return null;
  const k = Math.floor((now - startAt) / d.attackEveryMs) + 1;
  const landsAt = attackLandsAt(startAt, k, d);
  const startsAt = landsAt - d.chargeMs;
  return now >= startsAt ? { k, startsAt, landsAt } : null;
}

/** The shield word for attack k (the same for everyone in the room). */
export function shieldWord(seed: number, k: number, words: string[]): string {
  const rng = seededRandom(seed ^ Math.imul(k + 1, 2654435761));
  // prefer a longer word so it feels like a big block
  const pool = words.filter((w) => w.length >= 4);
  const list = pool.length > 0 ? pool : words;
  return list[Math.floor(rng() * list.length)] ?? "block";
}

/**
 * Hearts lost up to time t: attacks that landed and weren't blocked. Also
 * returns when the last heart went (if it did).
 */
export function heartsAt(
  startAt: number,
  t: number,
  d: RaidDifficulty,
  blocked: ReadonlySet<number>,
): { hearts: number; knockedOutAt?: number } {
  let hearts = START_HEARTS;
  for (let k = 1; ; k++) {
    const lands = attackLandsAt(startAt, k, d);
    if (lands > t) break;
    if (blocked.has(k)) continue;
    hearts--;
    if (hearts <= 0) return { hearts: 0, knockedOutAt: lands };
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
  /** team -> blocked attack numbers */
  blocked: Partial<Record<RaidTeam, ReadonlySet<number>>>;
  /** team -> when it beat its boss */
  clearedAt: Partial<Record<RaidTeam, number>>;
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
  won: boolean;
  mvp: boolean;
}): number {
  return (
    Math.max(0, input.dealt) +
    input.blocks * RAID_SCORE.block +
    (input.won ? RAID_SCORE.win : 0) +
    (input.mvp ? RAID_SCORE.mvp : 0)
  );
}

/** 1-3 stars for the result screen. */
export function raidStars(won: boolean, hearts: number): number {
  if (!won) return 1;
  return hearts >= 4 ? 3 : 2;
}

import type {
  ChampRoundKind,
  ChampScore,
  RaceFormat,
  RaceStanding,
} from "./race-types";

// types live in race-types.ts (no import cycle); re-exported for callers
export type {
  ChampRoundKind,
  ChampRoundPlan,
  ChampScore,
  Championship,
} from "./race-types";

/**
 * Class Championship: several rounds of different race formats in one room
 * (same PIN). Each round gives points by place; the highest total is the
 * Class Champion. Lives on the race doc (`championship`), host-written.
 */

export const CHAMP_ROUNDS: Record<
  ChampRoundKind,
  { title: string; emoji: string; format: RaceFormat; blurb: string }
> = {
  speed: {
    title: "Speed",
    emoji: "⚡",
    format: "timed",
    blurb: "Timed race - most words per minute wins",
  },
  accuracy: {
    title: "Accuracy",
    emoji: "🎯",
    format: "accuracy",
    blurb: "Fewest mistakes wins (speed breaks ties)",
  },
  blitz: {
    title: "Word Blitz",
    emoji: "💬",
    format: "blitz",
    blurb: "Quick-fire words - most points wins",
  },
  final: {
    title: "Final race",
    emoji: "🏁",
    format: "finish",
    blurb: "First to finish the whole text wins",
  },
};

export const CHAMP_ROUND_ORDER: ChampRoundKind[] = [
  "speed",
  "accuracy",
  "blitz",
  "final",
];

/** Points for 1st, 2nd, ... 7th; everyone else who takes part gets 1. */
export const PLACE_POINTS = [10, 8, 6, 5, 4, 3, 2];
export const TAKE_PART_POINTS = 1;

/** Coins when the champion is crowned. */
export const PODIUM_COINS = [50, 30, 20];
export const TAKE_PART_COINS = 5;

export function pointsForPlace(place: number): number {
  return PLACE_POINTS[place - 1] ?? TAKE_PART_POINTS;
}

/** Did this student actually play the round (not just sit in the room)? */
function tookPart(s: RaceStanding, format: RaceFormat): boolean {
  if (format === "blitz") return true; // 0 points is still a go
  return s.progress > 0 || s.finalWpm > 0 || (s.words ?? 0) > 0;
}

/**
 * Add one round's standings (already ranked by the round's own rules) to the
 * championship totals. Students who didn't take part score nothing but keep
 * their place in the table.
 */
export function scoreRound(
  scores: Record<string, ChampScore>,
  standings: RaceStanding[],
  format: RaceFormat,
): Record<string, ChampScore> {
  const roundIndex = Math.max(
    0,
    ...Object.values(scores).map((s) => s.places.length),
  );
  const next: Record<string, ChampScore> = {};
  for (const [uid, s] of Object.entries(scores)) {
    next[uid] = { ...s, places: [...s.places] };
  }
  let place = 0;
  for (const st of standings) {
    const prev = next[st.uid] ?? {
      name: st.name,
      ...(st.avatarUrl !== undefined ? { avatarUrl: st.avatarUrl } : {}),
      points: 0,
      wins: 0,
      places: Array.from({ length: roundIndex }, () => 0),
    };
    if (!tookPart(st, format)) {
      next[st.uid] = { ...prev, places: [...prev.places, 0] };
      continue;
    }
    place++;
    next[st.uid] = {
      ...prev,
      name: st.name,
      points: prev.points + pointsForPlace(place),
      wins: prev.wins + (place === 1 ? 1 : 0),
      places: [...prev.places, place],
    };
  }
  // anyone who left the room this round
  for (const [uid, s] of Object.entries(next)) {
    if (s.places.length <= roundIndex) {
      next[uid] = { ...s, places: [...s.places, 0] };
    }
  }
  return next;
}

export type ChampRow = ChampScore & { uid: string; rank: number };

/** Most points, then most round wins, then best place in the last round. */
export function rankChampionship(
  scores: Record<string, ChampScore>,
): ChampRow[] {
  const lastPlace = (s: ChampScore): number => {
    const p = s.places[s.places.length - 1] ?? 0;
    return p === 0 ? Infinity : p;
  };
  const sorted = Object.entries(scores)
    .map(([uid, s]) => ({ ...s, uid }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        lastPlace(a) - lastPlace(b) ||
        a.name.localeCompare(b.name),
    );
  let rank = 0;
  let prev: (typeof sorted)[number] | undefined;
  return sorted.map((row, i) => {
    const tied =
      prev !== undefined &&
      prev.points === row.points &&
      prev.wins === row.wins &&
      lastPlace(prev) === lastPlace(row);
    if (!tied) rank = i + 1;
    prev = row;
    return { ...row, rank };
  });
}

/** Coins paid when crowning: podium places, plus a little for taking part. */
export function championshipCoins(row: ChampRow): number {
  if (row.points === 0) return 0;
  return PODIUM_COINS[row.rank - 1] ?? TAKE_PART_COINS;
}

/** Overall rank before the last scored round (for up/down arrows). */
export function previousRanks(
  scores: Record<string, ChampScore>,
): Record<string, number> {
  const before: Record<string, ChampScore> = {};
  for (const [uid, s] of Object.entries(scores)) {
    const last = s.places[s.places.length - 1] ?? 0;
    const lastPoints = last === 0 ? 0 : pointsForPlace(last);
    if (s.places.length <= 1 && last === 0) continue;
    before[uid] = {
      ...s,
      points: s.points - lastPoints,
      wins: s.wins - (last === 1 ? 1 : 0),
      places: s.places.slice(0, -1),
    };
  }
  return Object.fromEntries(
    rankChampionship(before).map((r) => [r.uid, r.rank]),
  );
}

/**
 * Words for one round when the teacher limits how many to use. Reading
 * passages keep their order (a random stretch of the text, so sentences
 * still read naturally); word lists, lessons and pasted words are shuffled
 * and sampled. Each round picks again, so rounds don't repeat each other.
 */
export function pickRoundWords(
  tokens: string[],
  limit: number | undefined,
  keepOrder: boolean,
  rng: () => number = Math.random,
): string[] {
  if (limit === undefined || limit <= 0 || tokens.length <= limit) {
    return keepOrder ? tokens : shuffled(tokens, rng);
  }
  if (keepOrder) {
    const start = Math.floor(rng() * (tokens.length - limit + 1));
    return tokens.slice(start, start + limit);
  }
  return shuffled(tokens, rng).slice(0, limit);
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

import { KanaDifficulty, seededRng } from "./kana-words";

/**
 * Goldfish Scooping: goldfish carrying hiragana words swim across a shared
 * pond for 60 seconds. Type a fish's word to scoop it before anyone else.
 * Points = kana in the word; golden fish count double. Every player builds
 * the same fish from the room's seed, so the only writes are "I scooped
 * fish #12". Pure.
 */

export const GOLDFISH_MS = 60_000;
export const GOLDFISH_START_PAUSE_MS = 3000;
export const POND_LANES = 5;

export type GoldfishGame = {
  seq: number;
  seed: number;
  /** when fish start swimming (ms, shared clock) */
  startAt: number;
  order: string[];
};

export type Fish = {
  index: number;
  word: string;
  /** ms after startAt */
  spawnAt: number;
  swimMs: number;
  lane: number;
  /** swims left to right? */
  ltr: boolean;
  golden: boolean;
};

export function swimMsFor(d: KanaDifficulty): number {
  return d.label === "Easy" ? 10_000 : d.label === "Medium" ? 8000 : 6500;
}

/** The whole round's fish, the same for everyone with the same seed. */
export function buildFish(
  seed: number,
  d: KanaDifficulty,
  pool: string[],
): Fish[] {
  const rng = seededRng(seed);
  const words = pool.filter((w) => w.length >= 2 && w.length <= d.maxLen);
  const source = words.length > 0 ? words : pool;
  const swim = swimMsFor(d);
  const fish: Fish[] = [];
  const laneFree = Array.from({ length: POND_LANES }, () => -Infinity);
  let t = 0;
  let index = 0;
  while (t < GOLDFISH_MS - 1500) {
    // pick a lane that isn't crowded
    let lane = Math.floor(rng() * POND_LANES);
    for (let k = 0; k < POND_LANES; k++) {
      const l = (lane + k) % POND_LANES;
      if (t - (laneFree[l] ?? -Infinity) > swim * 0.45) {
        lane = l;
        break;
      }
    }
    laneFree[lane] = t;
    fish.push({
      index,
      word: source[Math.floor(rng() * source.length)] ?? "さかな",
      spawnAt: Math.round(t),
      swimMs: Math.round(swim * (0.85 + rng() * 0.3)),
      lane,
      ltr: lane % 2 === 0,
      golden: rng() < 1 / 12,
    });
    index++;
    t += 900 + rng() * 900;
  }
  return fish;
}

export function fishPoints(f: Fish): number {
  return f.word.length * (f.golden ? 2 : 1);
}

/** 0..1 across the pond, or undefined when not swimming right now. */
export function fishProgress(
  f: Fish,
  game: Pick<GoldfishGame, "startAt">,
  now: number,
): number | undefined {
  const t = now - game.startAt - f.spawnAt;
  if (t < 0 || t > f.swimMs) return undefined;
  return t / f.swimMs;
}

export function visibleFish(
  fish: Fish[],
  game: Pick<GoldfishGame, "startAt">,
  caught: Record<string, string>,
  now: number,
): Fish[] {
  return fish.filter(
    (f) =>
      caught[String(f.index)] === undefined &&
      fishProgress(f, game, now) !== undefined,
  );
}

export const goldfishOver = (
  game: Pick<GoldfishGame, "startAt">,
  now: number,
): boolean => now >= game.startAt + GOLDFISH_MS;

export function goldfishPoints(
  fish: Fish[],
  caught: Record<string, string>,
  id: string,
): number {
  return fish
    .filter((f) => caught[String(f.index)] === id)
    .reduce((n, f) => n + fishPoints(f), 0);
}

export function goldfishRanking(
  game: Pick<GoldfishGame, "order">,
  fish: Fish[],
  caught: Record<string, string>,
): { id: string; points: number; count: number }[] {
  return game.order
    .map((id) => ({
      id,
      points: goldfishPoints(fish, caught, id),
      count: Object.values(caught).filter((v) => v === id).length,
    }))
    .sort((a, b) => b.points - a.points);
}

export function goldfishScore(
  game: Pick<GoldfishGame, "order">,
  fish: Fish[],
  caught: Record<string, string>,
  id: string,
): number {
  const ranking = goldfishRanking(game, fish, caught);
  const mine = goldfishPoints(fish, caught, id);
  const top = ranking[0]?.points ?? 0;
  return mine + (mine > 0 && mine === top ? 30 : 0);
}

export function goldfishStars(
  game: Pick<GoldfishGame, "order">,
  fish: Fish[],
  caught: Record<string, string>,
  id: string,
): number {
  const top = goldfishRanking(game, fish, caught)[0]?.points ?? 0;
  const mine = goldfishPoints(fish, caught, id);
  if (mine > 0 && mine === top) return 3;
  if (mine > 0 && mine * 2 >= top) return 2;
  return mine > 0 ? 1 : 0;
}

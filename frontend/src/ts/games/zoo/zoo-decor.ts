/** My Zoo decorations. Prices mirrored in api/_lib/catalogs.ts (zooDecor). */
export const ZOO_DECOR = [
  { id: "signpost", name: "Signpost", price: 10 },
  { id: "rock", name: "Big rock", price: 10 },
  { id: "bush", name: "Bush", price: 15 },
  { id: "flowers", name: "Flower bed", price: 15 },
  { id: "tree", name: "Tree", price: 20 },
  { id: "bench", name: "Bench", price: 25 },
  { id: "balloons", name: "Balloon stand", price: 35 },
  { id: "pond", name: "Pond", price: 40 },
  { id: "ice-cream", name: "Ice cream cart", price: 50 },
  { id: "fountain", name: "Fountain", price: 60 },
] as const;

export type ZooDecorId = (typeof ZOO_DECOR)[number]["id"];

export const isZooDecorId = (id: string): id is ZooDecorId =>
  ZOO_DECOR.some((d) => d.id === id);

/** Care streak days that pay bonus coins. Mirrors api/_lib/zoo.ts. */
export function zooStreakBonus(count: number): number {
  if (count === 3) return 5;
  if (count === 5) return 10;
  if (count === 7) return 15;
  if (count >= 10 && count % 10 === 0) return 20;
  return 0;
}

/** Next streak day with a bonus, after `count`. */
export function nextBonusDay(count: number): number {
  for (let d = count + 1; ; d++) if (zooStreakBonus(d) > 0) return d;
}

/** A streak this long earns golden food bowls in every pen. */
export const GOLDEN_BOWL_STREAK = 5;

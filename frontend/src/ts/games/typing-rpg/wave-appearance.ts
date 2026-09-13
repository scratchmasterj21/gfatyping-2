export type MonsterKind = "slime" | "imp" | "guardian";
export type WaveAppearance = {
  name: string;
  floorIndex: number;
  tier: number;
  monsters: { name: string; kind: MonsterKind }[];
};

const FLOORS = [
  {
    name: "Moss Grove",
    creatures: ["Moss Slime", "Forest Imp", "Gate Guardian"],
  },
  {
    name: "Crystal Hollow",
    creatures: ["Crystal Slime", "Cave Imp", "Gem Guardian"],
  },
  {
    name: "Ember Trail",
    creatures: ["Ember Slime", "Ash Imp", "Flame Guardian"],
  },
  {
    name: "Moonlit Ruins",
    creatures: ["Moon Slime", "Shade Imp", "Rune Guardian"],
  },
] as const;

export function appearanceForWave(wave: number): WaveAppearance {
  const safeWave = Math.max(1, Math.floor(wave));
  const floorIndex = (safeWave - 1) % FLOORS.length;
  const tier = Math.floor((safeWave - 1) / FLOORS.length);
  const floor = FLOORS[floorIndex] ?? FLOORS[0];
  return {
    name: tier === 0 ? floor.name : `${floor.name} · Depth ${tier + 1}`,
    floorIndex,
    tier,
    monsters: floor.creatures.map((name, index) => ({
      name: tier === 0 ? name : `Deep ${name}`,
      kind: (["slime", "imp", "guardian"] as const)[index] ?? "slime",
    })),
  };
}

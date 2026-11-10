import { seededRandom } from "./raid-rules";

const images = import.meta.glob<string>("./art/*.png", {
  eager: true,
  import: "default",
});
const img = (name: string): string => images[`./art/${name}.png`] ?? "";

export type RaidMonster = { id: string; name: string; image: string };

const MINIONS: RaidMonster[] = [
  { id: "slime", name: "Gloopy Slime", image: img("raid-slime") },
  { id: "bat", name: "Batty Bat", image: img("raid-bat") },
  { id: "mushroom", name: "Grumpy Mushroom", image: img("raid-mushroom") },
];
const BOSSES: RaidMonster[] = [
  { id: "golem", name: "Rocky the Golem", image: img("raid-golem") },
  { id: "dragon", name: "Blaze the Dragon", image: img("raid-dragon") },
];

/** Two different minions, then a boss - the same for everyone in the room. */
export function raidLineup(
  seed: number,
): [RaidMonster, RaidMonster, RaidMonster] {
  const rng = seededRandom(seed ^ 0x5eed);
  const first = Math.floor(rng() * MINIONS.length);
  const second =
    (first + 1 + Math.floor(rng() * (MINIONS.length - 1))) % MINIONS.length;
  const boss = Math.floor(rng() * BOSSES.length);
  return [
    MINIONS[first] as RaidMonster,
    MINIONS[second] as RaidMonster,
    BOSSES[boss] as RaidMonster,
  ];
}

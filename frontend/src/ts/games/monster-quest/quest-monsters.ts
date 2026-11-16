import { MonsterKind } from "./quest-rules";

const images = import.meta.glob<string>("./art/*.png", {
  eager: true,
  import: "default",
});

export const MONSTER_ART: Record<MonsterKind, string> = {
  slime: images["./art/raid-slime.png"] ?? "",
  bat: images["./art/raid-bat.png"] ?? "",
  mushroom: images["./art/raid-mushroom.png"] ?? "",
  golem: images["./art/raid-golem.png"] ?? "",
  dragon: images["./art/raid-dragon.png"] ?? "",
};

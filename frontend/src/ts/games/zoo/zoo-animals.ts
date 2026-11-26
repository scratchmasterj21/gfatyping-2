/** Zoo animals: shared by the Zoo Shift game and (later) My Zoo. */
export const ZOO_SPECIES = [
  "rabbit",
  "chick",
  "goat",
  "duck",
  "pig",
  "monkey",
  "parrot",
  "giraffe",
  "zebra",
  "elephant",
  "lion",
  "penguin",
  "panda",
] as const;
export type ZooSpecies = (typeof ZOO_SPECIES)[number];

/** What goes in the food bowl (colour and need icon). */
export type ZooDiet = "veg" | "seed" | "fruit" | "leaf" | "meat" | "fish";

/** Ground in the pen. */
export type ZooHabitat = "grass" | "farm" | "jungle" | "savanna" | "ice";

export type ZooSpeciesInfo = {
  name: string;
  diet: ZooDiet;
  habitat: ZooHabitat;
  /** food words: easy (short), medium (one word), hard (a phrase) */
  food: [easy: string[], medium: string[], hard: string[]];
};

export const ZOO_INFO: Record<ZooSpecies, ZooSpeciesInfo> = {
  rabbit: {
    name: "Rabbit",
    diet: "veg",
    habitat: "grass",
    food: [
      ["kale", "hay"],
      ["carrot", "lettuce", "clover"],
      ["crunchy carrots", "fresh lettuce"],
    ],
  },
  chick: {
    name: "Chick",
    diet: "seed",
    habitat: "farm",
    food: [
      ["seed", "corn", "bug"],
      ["seeds", "grain", "worms"],
      ["yummy seeds", "a fat worm"],
    ],
  },
  goat: {
    name: "Goat",
    diet: "veg",
    habitat: "farm",
    food: [
      ["hay", "oats", "leaf"],
      ["grass", "apples", "clover"],
      ["fresh green grass", "a crisp apple"],
    ],
  },
  duck: {
    name: "Duck",
    diet: "seed",
    habitat: "farm",
    food: [
      ["peas", "corn", "oats"],
      ["lettuce", "grapes", "seeds"],
      ["frozen peas", "green lettuce"],
    ],
  },
  pig: {
    name: "Pig",
    diet: "veg",
    habitat: "farm",
    food: [
      ["corn", "pear", "beet"],
      ["apples", "pumpkin", "carrots"],
      ["a big pumpkin", "sweet apples"],
    ],
  },
  monkey: {
    name: "Monkey",
    diet: "fruit",
    habitat: "jungle",
    food: [
      ["fig", "nuts"],
      ["banana", "mango", "papaya"],
      ["a ripe banana", "a juicy mango"],
    ],
  },
  parrot: {
    name: "Parrot",
    diet: "fruit",
    habitat: "jungle",
    food: [
      ["nuts", "seed"],
      ["berries", "peanuts", "mango"],
      ["sweet berries", "crunchy peanuts"],
    ],
  },
  giraffe: {
    name: "Giraffe",
    diet: "leaf",
    habitat: "savanna",
    food: [
      ["leaf", "twig"],
      ["leaves", "branches", "acacia"],
      ["tall tree leaves", "green branches"],
    ],
  },
  zebra: {
    name: "Zebra",
    diet: "leaf",
    habitat: "savanna",
    food: [
      ["hay", "grass"],
      ["straw", "clover", "grasses"],
      ["sweet green grass", "dry straw"],
    ],
  },
  elephant: {
    name: "Elephant",
    diet: "fruit",
    habitat: "savanna",
    food: [
      ["hay", "bark"],
      ["melon", "bananas", "bamboo"],
      ["a whole melon", "a pile of hay"],
    ],
  },
  lion: {
    name: "Lion",
    diet: "meat",
    habitat: "savanna",
    food: [["meat"], ["steak", "chicken"], ["a big steak", "juicy meat"]],
  },
  penguin: {
    name: "Penguin",
    diet: "fish",
    habitat: "ice",
    food: [
      ["fish"],
      ["shrimp", "squid", "sardines"],
      ["fresh fish", "tiny shrimp"],
    ],
  },
  panda: {
    name: "Panda",
    diet: "leaf",
    habitat: "jungle",
    food: [["leaf"], ["bamboo", "shoots"], ["fresh bamboo", "bamboo shoots"]],
  },
};

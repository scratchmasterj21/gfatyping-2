export type AnimalAvatarShape = "round" | "square";

export type AnimalAvatarItem = {
  id: string;
  shape: AnimalAvatarShape;
  animal: string;
  name: string;
  price: number;
  image: string;
};

function buildImageMap(files: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const match = /([^/]+)\.png$/.exec(path);
    if (match?.[1] !== undefined) map[match[1]] = url;
  }
  return map;
}

const IMAGES_BY_SHAPE: Record<AnimalAvatarShape, Record<string, string>> = {
  round: buildImageMap(
    import.meta.glob("../../assets/animals/round/*.png", {
      eager: true,
      import: "default",
    }),
  ),
  square: buildImageMap(
    import.meta.glob("../../assets/animals/square/*.png", {
      eager: true,
      import: "default",
    }),
  ),
};

// Same 30 animals exist in both the round/ and square/ asset folders.
const ANIMAL_NAMES = [
  "bear",
  "buffalo",
  "chick",
  "chicken",
  "cow",
  "crocodile",
  "dog",
  "duck",
  "elephant",
  "frog",
  "giraffe",
  "goat",
  "gorilla",
  "hippo",
  "horse",
  "monkey",
  "moose",
  "narwhal",
  "owl",
  "panda",
  "parrot",
  "penguin",
  "pig",
  "rabbit",
  "rhino",
  "sloth",
  "snake",
  "walrus",
  "whale",
  "zebra",
] as const;

const ANIMAL_AVATAR_PRICE = 200;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ANIMAL_AVATAR_SHAPES: { id: AnimalAvatarShape; label: string }[] =
  [
    { id: "round", label: "Round" },
    { id: "square", label: "Square" },
  ];

export function animalAvatarId(
  shape: AnimalAvatarShape,
  animal: string,
): string {
  return `${shape}-${animal}`;
}

export const ANIMAL_AVATAR_ITEMS: AnimalAvatarItem[] =
  ANIMAL_AVATAR_SHAPES.flatMap(({ id: shape }) =>
    ANIMAL_NAMES.map((animal) => ({
      id: animalAvatarId(shape, animal),
      shape,
      animal,
      name: capitalize(animal),
      price: ANIMAL_AVATAR_PRICE,
      image: IMAGES_BY_SHAPE[shape][animal] ?? "",
    })),
  );

export function findAnimalAvatarItem(id: string): AnimalAvatarItem | undefined {
  return ANIMAL_AVATAR_ITEMS.find((i) => i.id === id);
}

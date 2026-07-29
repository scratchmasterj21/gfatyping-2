export type PetSpecies = "dog" | "cat" | "rabbit" | "bird" | "butterfly";
export type PetMovement = "walk" | "fly";

export type PetItem = {
  id: string;
  name: string;
  price: number;
  species: PetSpecies;
  movement: PetMovement;
  /** Rendered width in px inside the room/shop card - height follows a fixed 5:3 aspect ratio. */
  sizePx: number;
};

export const PET_ITEMS: PetItem[] = [
  {
    id: "dog",
    name: "Dog",
    price: 60,
    species: "dog",
    movement: "walk",
    sizePx: 70,
  },
  {
    id: "cat",
    name: "Cat",
    price: 60,
    species: "cat",
    movement: "walk",
    sizePx: 60,
  },
  {
    id: "rabbit",
    name: "Rabbit",
    price: 50,
    species: "rabbit",
    movement: "walk",
    sizePx: 55,
  },
  {
    id: "bird",
    name: "Bird",
    price: 70,
    species: "bird",
    movement: "fly",
    sizePx: 45,
  },
  {
    id: "butterfly",
    name: "Butterfly",
    price: 55,
    species: "butterfly",
    movement: "fly",
    sizePx: 50,
  },
];

export function findPetItem(id: string): PetItem | undefined {
  return PET_ITEMS.find((p) => p.id === id);
}

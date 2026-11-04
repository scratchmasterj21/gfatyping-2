/** A buyable sky + ground for the garden. Same shape as a room theme. */
export type GardenTheme = {
  id: string;
  name: string;
  price: number;
  wall: string;
  floor: string;
  baseboard: string;
};

/** Free default. Every garden starts here, with nothing to buy. */
const GRASS_THEME: GardenTheme = {
  id: "grass",
  name: "Grass",
  price: 0,
  wall: "linear-gradient(180deg, #b9e6ff, #e8f7ff)",
  floor: "linear-gradient(180deg, #8fd36a, #6fbf4a)",
  baseboard: "#5aa33a",
};

export const GARDEN_THEMES: GardenTheme[] = [
  GRASS_THEME,
  {
    id: "garden-sunset",
    name: "Sunset",
    price: 60,
    wall: "linear-gradient(180deg, #ffb087, #ffe1a8)",
    floor: "linear-gradient(180deg, #7dbe55, #5ea043)",
    baseboard: "#c47a4a",
  },
  {
    id: "garden-night",
    name: "Night",
    price: 80,
    wall: "linear-gradient(180deg, #1c2454, #3a4a86)",
    floor: "linear-gradient(180deg, #2f6b3a, #244e2c)",
    baseboard: "#1a3320",
  },
];

export const DEFAULT_GARDEN_THEME_ID = GRASS_THEME.id;

export function getGardenTheme(id: string): GardenTheme {
  return GARDEN_THEMES.find((theme) => theme.id === id) ?? GRASS_THEME;
}

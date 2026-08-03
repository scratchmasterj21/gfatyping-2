/** A buyable wall + floor finish for the room. */
export type HouseTheme = {
  id: string;
  name: string;
  price: number;
  /** CSS background for the upper (wall) band of the room. */
  wall: string;
  /** CSS background for the lower (floor) band. */
  floor: string;
  /** Colour of the baseboard line where the two meet. */
  baseboard: string;
};

/**
 * The first entry is the free default every student starts on - it keeps the
 * original theme-variable look, so a room nobody has decorated still matches
 * whatever Monkeytype theme they've picked.
 */
const PLAIN_THEME: HouseTheme = {
  id: "plain",
  name: "Plain",
  price: 0,
  wall: "var(--bg-color)",
  floor: "var(--sub-alt-color)",
  baseboard: "var(--sub-color)",
};

export const HOUSE_THEMES: HouseTheme[] = [
  PLAIN_THEME,
  {
    id: "cozy-wood",
    name: "Cozy Wood",
    price: 80,
    wall: "linear-gradient(180deg, #f3e4cf, #e8d3b6)",
    floor:
      "repeating-linear-gradient(90deg, #b07d46 0 22px, #a5743f 22px 44px)",
    baseboard: "#8a5c2e",
  },
  {
    id: "mint-tile",
    name: "Mint Tile",
    price: 80,
    wall: "linear-gradient(180deg, #e3f6f1, #cfeae3)",
    floor:
      "repeating-conic-gradient(#dff3ee 0% 25%, #c2e3da 0% 50%) 0 0 / 36px 36px",
    baseboard: "#7fb8a9",
  },
  {
    id: "night-sky",
    name: "Night Sky",
    price: 120,
    wall: "linear-gradient(180deg, #1b2140, #2b3566)",
    floor: "linear-gradient(180deg, #3a3f5c, #2d3149)",
    baseboard: "#5a6291",
  },
  {
    id: "candy",
    name: "Candy",
    price: 120,
    wall: "repeating-linear-gradient(90deg, #ffe3ef 0 26px, #ffd0e3 26px 52px)",
    floor: "linear-gradient(180deg, #f7c9dc, #eeb3c9)",
    baseboard: "#d98cae",
  },
  {
    id: "meadow",
    name: "Meadow",
    price: 120,
    wall: "linear-gradient(180deg, #dff0ff, #bfe2fb)",
    floor: "linear-gradient(180deg, #bfe3a8, #9fd189)",
    baseboard: "#7fae6b",
  },
];

export const DEFAULT_HOUSE_THEME_ID = PLAIN_THEME.id;

/** Always resolves to a usable theme, so an unknown/retired id just falls back to the free default rather than leaving the room unpainted. */
export function getHouseTheme(id: string): HouseTheme {
  return HOUSE_THEMES.find((t) => t.id === id) ?? PLAIN_THEME;
}

import type { PetKind } from "./ship-rules";

/** Pixel art for Rescue Ship, drawn as tiny SVGs ("." is see-through). */

const PALETTE: Record<string, string> = {
  k: "#1a1c2c",
  w: "#f4f4f4",
  g: "#b8c2d0",
  G: "#6d7889",
  r: "#e04444",
  R: "#9c2a3a",
  b: "#3d7be0",
  B: "#27458f",
  c: "#7fe0f0",
  y: "#f6c544",
  o: "#ef8a32",
  n: "#8a6a52",
  N: "#5a4232",
  s: "#a89a8c",
  S: "#6e6258",
  p: "#ff8fb8",
  P: "#d9628f",
  h: "#3fbf6a",
  H: "#23804a",
  t: "#f2d2a9",
  T: "#c99a6a",
  e: "#1a1c2c",
  O: "#b8641e",
};

const SHIP: string[] = [
  "..........kkkk..............",
  ".........kggggk.............",
  "........kgggggkk............",
  "..kk....kgggggggkkkk........",
  ".kRrk..kgggggggggggkkkk.....",
  "kyRrrkkgggkkkkgggggggggkk...",
  "kyorrrkggkccccwkgggggggggkk.",
  "kyorrrkggkcccccwkggggggbbbgk",
  "kyRrrkkggkccccckggggggbbbbgk",
  ".kRrk.kgggkkkkkgggggggggggk.",
  "..kk...kggggggggggggggggkk..",
  ".......kkGGGGGGGGGGGGkkk....",
  "........kkrRkkkkkrRkk.......",
  "..........kk.....kk.........",
];
const ASTEROID: string[] = [
  "....kkkk....",
  "..kksssskk..",
  ".ksssSssssk.",
  ".kssSSssSsk.",
  "kssssssSSssk",
  "ksSsssssssSk",
  "ksSSssssssSk",
  "kssssSsssssk",
  ".kssSSSsssk.",
  ".ksssssSssk.",
  "..kkssssskk.",
  "....kkkk....",
];
const PETS: Record<PetKind, string[]> = {
  bunny: [
    "..kk....kk..",
    ".kwpk..kwpk.",
    ".kwpk..kwpk.",
    ".kwwkkkkwwk.",
    "kwwwwwwwwwwk",
    "kwwewwwwewwk",
    "kwwwwppwwwwk",
    "kwpwwwwwwpwk",
    ".kwwwwwwwwk.",
    "..kwwwwwwk..",
    "...kkkkkk...",
  ],
  pup: [
    ".kkk....kkk.",
    "kNNk....kNNk",
    "kNNkkkkkkNNk",
    "kNtttttttNNk",
    ".kttettettk.",
    ".kttttttttk.",
    ".ktttkktttk.",
    ".kttttpptk..",
    "..kttttttk..",
    "...kkkkkk...",
  ],
  kitty: [
    ".k........k.",
    "kok......kok",
    "koOkkkkkkoOk",
    "kooooooooook",
    "koeoooooeook",
    "koooooooooOk",
    "kooookkoooOk",
    "kowoopkoowok",
    ".koooooooOk.",
    "..kkkkkkkk..",
  ],
  hamster: [
    "..kk....kk..",
    ".kTTk..kTTk.",
    ".kTttkktttk.",
    "kTttttttttTk",
    "kTteTttTetTk",
    "kTtttttttTTk",
    "kwwttkkttwwk",
    "kpwwttttwwpk",
    ".kTttttttTk.",
    "..kkkkkkkk..",
  ],
  duck: [
    "...kkkk.....",
    "..kyyyyk....",
    ".kyyyeyyk...",
    ".kyyyyyyoook",
    "..kyyyykooo.",
    "..kyyyyykk..",
    ".kyyyyyyyyk.",
    "kyyyyyyyyyyk",
    "kyyyyyyyyyk.",
    ".kkyyyyykk..",
    "...kkkkk....",
  ],
  turtle: [
    "....kkkk....",
    "..kkhHhHkk..",
    ".khHhhhhHhk.",
    "khhhHHHhhhhk",
    "khHhhhhhHhhkkk",
    "kkkkkkkkkkkkHk",
    ".kHk....kHkkek",
    ".kkk....kkk.kk",
  ],
};

function toSvg(grid: string[]): string {
  const width = Math.max(...grid.map((r) => r.length));
  const rects: string[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour = PALETTE[row[x] ?? "."];
      if (colour === undefined) continue;
      rects.push(
        `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${colour}"/>`,
      );
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${grid.length}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const SHIP_ART = toSvg(SHIP);
export const ASTEROID_ART = toSvg(ASTEROID);
export const PET_ART: Record<PetKind, string> = {
  bunny: toSvg(PETS.bunny),
  pup: toSvg(PETS.pup),
  kitty: toSvg(PETS.kitty),
  hamster: toSvg(PETS.hamster),
  duck: toSvg(PETS.duck),
  turtle: toSvg(PETS.turtle),
};

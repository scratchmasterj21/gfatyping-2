// Shared finger assignment used by both the keymap finger coloring and the
// lesson intro screens. Touch-typing finger codes:
//   lp/lr/lm/li = left pinky/ring/middle/index
//   ri/rm/rr/rp = right index/middle/ring/pinky
//   thumb       = space bar
// Mapping is a best-effort heuristic for standard staggered/matrix keyboards;
// exotic styles (steno) are skipped by the caller.
export type Finger =
  | "lp"
  | "lr"
  | "lm"
  | "li"
  | "ri"
  | "rm"
  | "rr"
  | "rp"
  | "thumb";

export const FINGER_LABEL: Record<Finger, string> = {
  lp: "left pinky",
  lr: "left ring",
  lm: "left middle",
  li: "left index",
  ri: "right index",
  rm: "right middle",
  rr: "right ring",
  rp: "right pinky",
  thumb: "thumb",
};

/** Order used by the on-screen legend (left hand, then right hand). */
export const FINGER_ORDER: Finger[] = [
  "lp",
  "lr",
  "lm",
  "li",
  "ri",
  "rm",
  "rr",
  "rp",
];

// Column index (within a row's key list) -> finger, for the alpha/number rows.
// 0..9 are the ten standard typing columns; anything further right (-, =, [, ],
// \) belongs to the right pinky.
const COLUMN_FINGER: Finger[] = [
  "lp",
  "lr",
  "lm",
  "li",
  "li",
  "ri",
  "ri",
  "rm",
  "rr",
  "rp",
];

/**
 * Finger for a key given its keymap row id ("row1".."row5") and column index.
 * Returns undefined when the position can't be mapped.
 */
export function fingerForKey(rowId: string, keyId: number): Finger | undefined {
  if (rowId === "row5") return "thumb";
  if (keyId < 0) return undefined;
  return COLUMN_FINGER[keyId] ?? "rp";
}

// Character -> finger for standard QWERTY, used by lesson intros to show which
// finger presses each new key.
const CHAR_FINGER: Record<string, Finger> = {
  "`": "lp",
  "1": "lp",
  q: "lp",
  a: "lp",
  z: "lp",
  "2": "lr",
  w: "lr",
  s: "lr",
  x: "lr",
  "3": "lm",
  e: "lm",
  d: "lm",
  c: "lm",
  "4": "li",
  "5": "li",
  r: "li",
  t: "li",
  f: "li",
  g: "li",
  v: "li",
  b: "li",
  "6": "ri",
  "7": "ri",
  y: "ri",
  u: "ri",
  h: "ri",
  j: "ri",
  n: "ri",
  m: "ri",
  "8": "rm",
  i: "rm",
  k: "rm",
  ",": "rm",
  "9": "rm",
  o: "rr",
  l: "rr",
  ".": "rr",
  "0": "rp",
  p: "rp",
  ";": "rp",
  "/": "rp",
  "-": "rp",
  "=": "rp",
  "'": "rp",
  "[": "rp",
  "]": "rp",
  "\\": "rp",
  " ": "thumb",
};

/** Finger for a single character (case-insensitive), or undefined if unknown. */
export function fingerForChar(char: string): Finger | undefined {
  return CHAR_FINGER[char.toLowerCase()];
}

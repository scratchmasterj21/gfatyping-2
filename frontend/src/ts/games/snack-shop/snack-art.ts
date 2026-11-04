/** Animal customers and snacks drawn by SnackCustomer / SnackIcon. */
export const ANIMALS = [
  "bear",
  "bunny",
  "fox",
  "panda",
  "frog",
  "cat",
  "pig",
  "penguin",
] as const;
export type Animal = (typeof ANIMALS)[number];

export const SNACK_KINDS = [
  "donut",
  "cupcake",
  "cookie",
  "icecream",
  "watermelon",
  "lollipop",
] as const;
export type SnackKind = (typeof SNACK_KINDS)[number];

export const SNACK_NAMES: Record<SnackKind, string> = {
  donut: "donut",
  cupcake: "cupcake",
  cookie: "cookie",
  icecream: "ice cream",
  watermelon: "watermelon",
  lollipop: "lollipop",
};

export type CustomerMood = "happy" | "waiting" | "grumpy" | "angry";

/** How a waiting customer feels, from the patience left (0..1). */
export const moodFor = (patience: number): CustomerMood =>
  patience > 0.6 ? "happy" : patience > 0.3 ? "waiting" : "grumpy";

export const game = (name: string): string => `var(--color-game-${name})`;

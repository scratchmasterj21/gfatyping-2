import { JSX } from "solid-js";

/**
 * Battle effects (fire, slashes, sparkles, shields...) drawn with plain
 * shapes and CSS animations. Each one is a list of particles placed on the
 * centre of the hero / monster it lands on.
 */

export type FxKind =
  | "fire"
  | "slash"
  | "bigslash"
  | "heal"
  | "shield"
  | "water"
  | "claw"
  | "spore"
  | "rock"
  | "ice"
  | "poison"
  | "spooky"
  | "laser"
  | "vine"
  | "charge"
  | "thunder"
  | "holy";

export type FlashKind = "fire" | "rock" | "water" | "spore" | "ice" | "laser";

export type Particle = { class: string; style: JSX.CSSProperties };

const BASE =
  "pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 motion-reduce:hidden";

/** Which effect a move makes. */
export function fxForMove(move: string, heroActor: boolean): FxKind {
  switch (move) {
    case "Fire Storm":
    case "Fire Breath":
    case "Inferno":
    case "Sky Dive":
      return "fire";
    case "Snowball":
    case "Snowstorm":
    case "Ice Shard":
    case "Blizzard":
    case "Freeze":
    case "Howl":
      return "ice";
    case "Poison Bite":
      return "poison";
    case "Spooky Touch":
      return "spooky";
    case "Laser Beam":
    case "Mega Laser":
    case "Zap":
      return "laser";
    case "Vine Whip":
      return "vine";
    case "Charge Up":
    case "Fly Up":
      return "charge";
    case "Root Quake":
    case "Mega Smash":
    case "Bone Toss":
      return "rock";
    case "Power Strike":
    case "Whirlwind":
    case "Mighty Blow":
      return "bigslash";
    case "Ice Storm":
      return "ice";
    case "Thunder":
      return "thunder";
    case "Holy Light":
      return "holy";
    case "Group Heal":
      return "heal";
    case "Shield Wall":
      return "shield";
    case "Earth Slam":
      return "rock";
    case "Heal":
    case "Wake Up":
    case "Potion":
      return "heal";
    case "Protect":
    case "Defend":
      return "shield";
    case "Slime Splash":
    case "Mega Splash":
      return "water";
    case "Wing Flap":
    case "Screech":
    case "Double Bite":
    case "Sneaky Swipe":
      return "claw";
    case "Spore Puff":
    case "Spore Cloud":
      return "spore";
    case "Rock Smash":
    case "Earthquake":
      return "rock";
    default:
      return heroActor ? "slash" : "claw";
  }
}

/** Big moves that hit everyone also tint the whole battlefield. */
export function flashFor(kind: FxKind): FlashKind | null {
  switch (kind) {
    case "fire":
    case "rock":
    case "water":
    case "spore":
    case "ice":
    case "laser":
      return kind;
    case "thunder":
      return "laser";
    default:
      return null;
  }
}

export const FLASH_CLASS: Record<FlashKind, string> = {
  fire: "bg-game-orange",
  rock: "bg-game-brown",
  water: "bg-game-blue",
  spore: "bg-game-purple",
  ice: "bg-game-sky",
  laser: "bg-game-red",
};

const delay = (s: number): string => `${s.toFixed(2)}s`;

/** Things falling in from above, from the attacker's side. */
function falling(
  count: number,
  shape: string,
  fromRight: boolean,
  spin = false,
): Particle[] {
  const side = fromRight ? 1 : -1;
  return Array.from({ length: count }, (_, i) => ({
    class: `${BASE} ${shape} animate-quest-fly`,
    style: {
      "--fx-x0": `${side * (50 + ((i * 37) % 70))}px`,
      "--fx-y0": `${-110 - ((i * 23) % 50)}px`,
      "--fx-r": spin ? `${180 + i * 90}deg` : "0deg",
      "margin-left": `${((i * 29) % 40) - 20}px`,
      "margin-top": `${((i * 17) % 24) - 12}px`,
      "animation-delay": delay((i * 0.12) / Math.max(1, count - 1)),
    } as JSX.CSSProperties,
  }));
}

/** Bits flying out from the centre. */
function spray(
  count: number,
  shape: string,
  start: number,
  reach = 55,
): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + 0.4;
    const r = reach * (0.7 + ((i * 13) % 10) / 20);
    return {
      class: `${BASE} ${shape} animate-quest-spray`,
      style: {
        "--fx-x": `${Math.round(Math.cos(a) * r)}px`,
        "--fx-y": `${Math.round(Math.sin(a) * r)}px`,
        "animation-delay": delay(start + (i % 3) * 0.03),
      } as JSX.CSSProperties,
    };
  });
}

/** Bits floating up. */
function rising(count: number, shapes: string[], spread = 50): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    class: `${BASE} ${shapes[i % shapes.length] ?? ""} animate-quest-rise`,
    style: {
      "--fx-x": `${((i * 41) % (spread * 2)) - spread}px`,
      "animation-delay": delay((i * 0.06) % 0.4),
    } as JSX.CSSProperties,
  }));
}

function ring(shape: string, start: number): Particle {
  return {
    class: `${BASE} ${shape} animate-quest-ring`,
    style: { "animation-delay": delay(start) },
  };
}

function slashes(
  count: number,
  shape: string,
  angles: number[],
  gap = 0,
): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    class: `${BASE} ${shape} animate-quest-slash`,
    style: {
      rotate: `${angles[i % angles.length] ?? -35}deg`,
      "margin-top": `${(i - (count - 1) / 2) * gap}px`,
      "animation-delay": delay(0.22 + i * 0.07),
    },
  }));
}

const FIREBALL =
  "h-8 w-8 rounded-full bg-radial from-game-yellow via-game-orange to-game-red shadow-[0_0_14px_var(--color-game-orange)]";
const EMBER = "h-2 w-2 rounded-full bg-game-yellow";
const EMBER_RED = "h-2.5 w-2.5 rounded-full bg-game-orange";
const SLASH =
  "h-1.5 w-32 rounded-full bg-linear-to-r from-transparent via-game-cream to-transparent shadow-[0_0_10px_var(--color-game-cream)]";
const GOLD_SLASH =
  "h-2 w-40 rounded-full bg-linear-to-r from-transparent via-game-yellow to-transparent shadow-[0_0_14px_var(--color-game-yellow)]";
const CLAW =
  "h-1 w-24 rounded-full bg-linear-to-r from-transparent via-game-red to-transparent shadow-[0_0_8px_var(--color-game-red)]";

export function fxParticles(kind: FxKind, fromRight: boolean): Particle[] {
  switch (kind) {
    case "fire":
      return [
        ...falling(5, FIREBALL, fromRight),
        ring("h-16 w-16 rounded-full border-4 border-game-orange", 0.36),
        ring(
          "h-10 w-10 rounded-full bg-radial from-game-yellow to-transparent",
          0.36,
        ),
        ...spray(10, EMBER, 0.38, 60),
        ...spray(6, EMBER_RED, 0.42, 40),
      ];
    case "bigslash":
      return [
        ...slashes(2, GOLD_SLASH, [-35, 35]),
        ring("h-16 w-16 rounded-full border-4 border-game-yellow", 0.34),
        ...spray(8, "h-2 w-2 rotate-45 bg-game-yellow", 0.36, 60),
      ];
    case "slash":
      return [
        ...slashes(1, SLASH, [-35]),
        ring("h-12 w-12 rounded-full border-4 border-game-cream", 0.34),
        ...spray(5, "h-1.5 w-1.5 rounded-full bg-game-cream", 0.36, 40),
      ];
    case "claw":
      return [
        ...slashes(3, CLAW, [-50], 12),
        ...spray(5, "h-1.5 w-1.5 rounded-full bg-game-red", 0.38, 40),
      ];
    case "heal":
      return [
        ring(
          "h-20 w-20 rounded-full bg-radial from-game-green/70 to-transparent",
          0.3,
        ),
        ...rising(12, [
          "h-2.5 w-2.5 rotate-45 bg-game-green",
          "h-2 w-2 rounded-full bg-game-mint",
          "h-2 w-2 rotate-45 bg-game-cream",
        ]),
      ];
    case "shield":
      return [
        {
          class: `${BASE} h-24 w-24 rounded-full border-2 border-game-blue bg-game-blue/20 shadow-[0_0_18px_var(--color-game-blue)] animate-quest-bubble`,
          style: { "animation-delay": delay(0.2) },
        },
        ...rising(5, ["h-1.5 w-1.5 rounded-full bg-game-blue"], 40),
      ];
    case "water":
      return [
        ...falling(3, "h-5 w-3.5 rounded-full bg-game-blue", fromRight),
        ring("h-14 w-14 rounded-full border-4 border-game-blue", 0.36),
        ...spray(10, "h-2.5 w-2 rounded-full bg-game-sky", 0.38, 55),
      ];
    case "spore":
      return [
        ...spray(6, "h-9 w-9 rounded-full bg-game-purple/60 blur-sm", 0.2, 35),
        ...rising(8, [
          "h-2 w-2 rounded-full bg-game-green",
          "h-2 w-2 rounded-full bg-game-purple",
        ]),
      ];
    case "ice":
      return [
        ...falling(
          4,
          "h-6 w-2.5 rotate-45 bg-linear-to-b from-game-cream to-game-sky shadow-[0_0_8px_var(--color-game-sky)]",
          fromRight,
        ),
        ring("h-16 w-16 rounded-full border-4 border-game-sky", 0.36),
        ...spray(10, "h-2 w-2 rotate-45 bg-game-cream", 0.38, 55),
      ];
    case "poison":
      return [
        ...slashes(2, CLAW, [-40, -20], 10),
        ring(
          "h-16 w-16 rounded-full bg-radial from-game-green/70 to-transparent",
          0.34,
        ),
        ...rising(8, [
          "h-3 w-3 rounded-full border-2 border-game-green bg-game-green/40",
          "h-2 w-2 rounded-full bg-game-purple",
        ]),
      ];
    case "spooky":
      return [
        ...spray(6, "h-8 w-8 rounded-full bg-game-purple/50 blur-sm", 0.15, 30),
        ring("h-16 w-16 rounded-full border-4 border-game-purple", 0.34),
        ...rising(6, ["h-2 w-2 rounded-full bg-game-cream"]),
      ];
    case "laser":
      return [
        ...slashes(
          1,
          "h-2.5 w-56 rounded-full bg-linear-to-r from-transparent via-game-red to-game-yellow shadow-[0_0_16px_var(--color-game-red)]",
          [0],
        ),
        ring("h-14 w-14 rounded-full border-4 border-game-yellow", 0.34),
        ...spray(8, "h-2 w-2 rounded-full bg-game-yellow", 0.36, 50),
      ];
    case "vine":
      return [
        ...slashes(
          3,
          "h-2 w-28 rounded-full bg-linear-to-r from-transparent via-game-green to-transparent shadow-[0_0_8px_var(--color-game-green)]",
          [-30, 10, -60],
        ),
        ...spray(6, "h-2.5 w-1.5 rounded-full bg-game-green", 0.38, 45),
      ];
    case "thunder":
      return [
        ...falling(
          3,
          "h-10 w-2 bg-linear-to-b from-game-cream to-game-yellow shadow-[0_0_16px_var(--color-game-yellow)]",
          fromRight,
        ),
        ring("h-20 w-20 rounded-full border-4 border-game-yellow", 0.34),
        ring(
          "h-14 w-14 rounded-full bg-radial from-game-cream to-transparent",
          0.34,
        ),
        ...spray(10, "h-2 w-2 rotate-45 bg-game-yellow", 0.36, 65),
      ];
    case "holy":
      return [
        ring(
          "h-24 w-24 rounded-full bg-radial from-game-gold/70 to-transparent",
          0.2,
        ),
        ring("h-16 w-16 rounded-full border-4 border-game-gold", 0.34),
        ...rising(10, [
          "h-2.5 w-2.5 rotate-45 bg-game-gold",
          "h-2 w-2 rounded-full bg-game-cream",
        ]),
      ];
    case "charge":
      return [
        ring("h-20 w-20 rounded-full border-4 border-game-yellow", 0),
        ring("h-20 w-20 rounded-full border-4 border-game-yellow", 0.25),
        ...rising(8, ["h-2 w-2 rotate-45 bg-game-yellow"], 45),
      ];
    case "rock":
      return [
        ...falling(
          4,
          "h-6 w-6 rounded-sm border-2 border-game-brown-dark bg-game-brown",
          fromRight,
          true,
        ),
        ring("h-16 w-16 rounded-full bg-game-tan/50 blur-sm", 0.38),
        ...spray(8, "h-2.5 w-2.5 rounded-sm bg-game-tan", 0.4, 55),
      ];
  }
}

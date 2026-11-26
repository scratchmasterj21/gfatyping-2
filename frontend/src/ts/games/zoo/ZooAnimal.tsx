import {
  createUniqueId,
  For,
  JSX,
  JSXElement,
  Match,
  Show,
  Switch,
} from "solid-js";

import { cn } from "../../utils/cn";
import { game } from "../snack-shop/snack-art";
import { ZooDiet, ZOO_INFO, ZooSpecies } from "./zoo-animals";

export type ZooMood = "happy" | "waiting" | "sad" | "sleepy";
export type ZooAction =
  | "eat"
  | "drink"
  | "wash"
  | "sleep"
  | "heal"
  | "play"
  | "cheer";

const INK = game("ink");
const ANIM = "motion-reduce:animate-none";

/** SVG transforms spin around their own box (CSS default is the viewport). */
const pivot = (origin: string): JSX.CSSProperties => ({
  "transform-box": "fill-box",
  "transform-origin": origin,
});

type FaceProps = {
  cx: number;
  cy: number;
  r: number;
  mood: ZooMood;
  action: ZooAction | undefined;
  /** beak animals draw their own mouth */
  mouth: boolean;
  /** mouth sits lower (under a snout or muzzle) */
  mouthDy?: number;
  /** panda: light eyes on dark patches */
  lightEyes?: boolean;
};

function Face(p: FaceProps): JSXElement {
  const closed = (): boolean => p.mood === "sleepy" || p.action === "sleep";
  const joyful = (): boolean =>
    p.action === "cheer" ||
    p.action === "play" ||
    p.action === "heal" ||
    p.action === "wash";
  const eating = (): boolean => p.action === "eat" || p.action === "drink";
  const ex = (): number => p.r * 0.38;
  const ey = (): number => p.cy - p.r * 0.08;
  const er = (): number => Math.max(3, p.r * 0.13);
  const my = (): number => p.cy + p.r * 0.42 + (p.mouthDy ?? 0);
  const eyeFill = (): string => (p.lightEyes === true ? game("cream") : INK);

  return (
    <g>
      {/* cheeks */}
      <Show when={p.mood === "happy" || joyful()}>
        <circle
          cx={p.cx - p.r * 0.62}
          cy={p.cy + p.r * 0.25}
          r={p.r * 0.14}
          fill={game("pink")}
          opacity="0.45"
        ></circle>
        <circle
          cx={p.cx + p.r * 0.62}
          cy={p.cy + p.r * 0.25}
          r={p.r * 0.14}
          fill={game("pink")}
          opacity="0.45"
        ></circle>
      </Show>

      {/* eyes */}
      <Switch>
        <Match when={closed()}>
          <For each={[-1, 1]}>
            {(s) => (
              <path
                d={`M${p.cx + s * ex() - er()} ${ey()} Q${p.cx + s * ex()} ${ey() + er() * 1.3} ${p.cx + s * ex() + er()} ${ey()}`}
                fill="none"
                stroke={eyeFill()}
                stroke-width="2.5"
                stroke-linecap="round"
              ></path>
            )}
          </For>
        </Match>
        <Match when={joyful()}>
          <For each={[-1, 1]}>
            {(s) => (
              <path
                d={`M${p.cx + s * ex() - er()} ${ey() + er() * 0.5} Q${p.cx + s * ex()} ${ey() - er() * 1.4} ${p.cx + s * ex() + er()} ${ey() + er() * 0.5}`}
                fill="none"
                stroke={eyeFill()}
                stroke-width="2.8"
                stroke-linecap="round"
              ></path>
            )}
          </For>
        </Match>
        <Match when={true}>
          <g class={cn("animate-zoo-blink", ANIM)} style={pivot("center")}>
            <For each={[-1, 1]}>
              {(s) => (
                <>
                  <circle
                    cx={p.cx + s * ex()}
                    cy={ey()}
                    r={er()}
                    fill={eyeFill()}
                  ></circle>
                  <circle
                    cx={p.cx + s * ex() + er() * 0.35}
                    cy={ey() - er() * 0.35}
                    r={er() * 0.35}
                    fill={p.lightEyes === true ? INK : game("cloud")}
                  ></circle>
                </>
              )}
            </For>
          </g>
        </Match>
      </Switch>

      {/* worried brows (inner ends up) + tear */}
      <Show when={!closed() && (p.mood === "waiting" || p.mood === "sad")}>
        <For each={[-1, 1]}>
          {(s) => (
            <path
              d={`M${p.cx + s * (ex() - er() * 1.3)} ${ey() - er() * (p.mood === "sad" ? 2.9 : 2.5)} L${p.cx + s * (ex() + er() * 1.1)} ${ey() - er() * 1.8}`}
              stroke={INK}
              stroke-width="2.4"
              stroke-linecap="round"
            ></path>
          )}
        </For>
      </Show>
      <Show when={p.mood === "sad" && !joyful()}>
        <path
          d={`M${p.cx + ex()} ${ey() + er() * 1.4} q-3 6 0 8 q3 -2 0 -8 z`}
          fill={game("blue")}
        ></path>
      </Show>

      {/* mouth */}
      <Show when={p.mouth}>
        <Switch>
          <Match when={eating()}>
            <ellipse
              cx={p.cx}
              cy={my()}
              rx={p.r * 0.13}
              ry={p.r * 0.11}
              fill={INK}
            ></ellipse>
          </Match>
          <Match when={joyful()}>
            <path
              d={`M${p.cx - p.r * 0.22} ${my() - 2} Q${p.cx} ${my() + p.r * 0.32} ${p.cx + p.r * 0.22} ${my() - 2} Z`}
              fill={INK}
            ></path>
            <ellipse
              cx={p.cx}
              cy={my() + p.r * 0.12}
              rx={p.r * 0.09}
              ry={p.r * 0.05}
              fill={game("pink")}
            ></ellipse>
          </Match>
          <Match when={p.mood === "sad"}>
            <path
              d={`M${p.cx - p.r * 0.16} ${my() + 3} Q${p.cx} ${my() - 4} ${p.cx + p.r * 0.16} ${my() + 3}`}
              fill="none"
              stroke={INK}
              stroke-width="2.4"
              stroke-linecap="round"
            ></path>
          </Match>
          <Match when={p.mood === "waiting" || p.mood === "sleepy"}>
            <path
              d={`M${p.cx - p.r * 0.1} ${my()} L${p.cx + p.r * 0.1} ${my()}`}
              stroke={INK}
              stroke-width="2.4"
              stroke-linecap="round"
            ></path>
          </Match>
          <Match when={true}>
            <path
              d={`M${p.cx - p.r * 0.18} ${my() - 2} Q${p.cx} ${my() + 7} ${p.cx + p.r * 0.18} ${my() - 2}`}
              fill="none"
              stroke={INK}
              stroke-width="2.4"
              stroke-linecap="round"
            ></path>
          </Match>
        </Switch>
      </Show>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Four-legged rig: goat, pig, giraffe, zebra, elephant, lion
// ---------------------------------------------------------------------------

type QuadLook = {
  fur: string;
  belly: string;
  hoof: string;
  scale: number;
  ears: "pointy" | "floppy" | "round" | "elephant";
  tail: "tuft" | "curly" | "thin";
  pattern?: "stripes" | "spots";
  neck?: boolean;
  horns?: "goat" | "ossicone";
  mane?: string;
  muzzle?: string;
  snout?: boolean;
  trunk?: boolean;
  beard?: boolean;
};

const QUADS: Partial<Record<ZooSpecies, QuadLook>> = {
  goat: {
    fur: game("cream"),
    belly: game("cloud"),
    hoof: game("brown-dark"),
    scale: 0.88,
    ears: "floppy",
    tail: "tuft",
    horns: "goat",
    muzzle: game("tan"),
    beard: true,
  },
  pig: {
    fur: game("blush"),
    belly: game("blush"),
    hoof: game("pink"),
    scale: 0.85,
    ears: "pointy",
    tail: "curly",
    snout: true,
  },
  giraffe: {
    fur: game("gold"),
    belly: game("cream"),
    hoof: game("brown-dark"),
    scale: 0.92,
    ears: "pointy",
    tail: "tuft",
    pattern: "spots",
    neck: true,
    horns: "ossicone",
    muzzle: game("tan"),
  },
  zebra: {
    fur: game("cloud"),
    belly: game("cloud"),
    hoof: INK,
    scale: 0.95,
    ears: "pointy",
    tail: "tuft",
    pattern: "stripes",
    mane: INK,
    muzzle: game("grey"),
  },
  elephant: {
    fur: game("grey"),
    belly: game("grey"),
    hoof: game("cream"),
    scale: 1.08,
    ears: "elephant",
    tail: "thin",
    trunk: true,
  },
  lion: {
    fur: game("orange"),
    belly: game("tan"),
    hoof: game("orange"),
    scale: 1,
    ears: "round",
    tail: "tuft",
    mane: game("brown"),
    muzzle: game("tan"),
  },
};

function Quad(p: {
  look: QuadLook;
  /** url() of the light/shadow gradient (see ZooAnimal defs) */
  shade: string;
  /** url() of the leg/wing/arm shading gradient */
  limb: string;
  mood: ZooMood;
  action: ZooAction | undefined;
  walking: boolean;
}): JSXElement {
  const clip = createUniqueId();
  const L = (): QuadLook => p.look;
  const head = (): { x: number; y: number; r: number } =>
    L().neck === true ? { x: 152, y: 34, r: 21 } : { x: 146, y: 70, r: 26 };
  const nibble = (): boolean => p.action === "eat" || p.action === "drink";
  const drooped = (): boolean => p.mood === "sad" || p.mood === "sleepy";
  const leg = (x: number, far: boolean, alt: boolean): JSXElement => (
    <g
      class={cn(
        p.walking && (alt ? "animate-zoo-step-alt" : "animate-zoo-step"),
        ANIM,
      )}
      style={pivot("top")}
    >
      <rect
        x={x}
        y="108"
        width="15"
        height="46"
        rx="7"
        fill={L().fur}
        opacity={far ? 0.82 : 1}
      ></rect>
      <rect x={x} y="108" width="15" height="46" rx="7" fill={p.limb}></rect>
      <rect x={x} y="148" width="15" height="9" rx="3" fill={L().hoof}></rect>
    </g>
  );

  return (
    <g
      transform={`translate(100 160) scale(${L().scale}) translate(-100 -160)`}
    >
      {/* tail */}
      <g class={cn("animate-zoo-wag", ANIM)} style={pivot("right top")}>
        <Switch>
          <Match when={L().tail === "curly"}>
            <path
              d="M50 92 q-14 -4 -12 8 q2 10 -10 6"
              fill="none"
              stroke={L().fur}
              stroke-width="5"
              stroke-linecap="round"
            ></path>
          </Match>
          <Match when={L().tail === "thin"}>
            <path
              d="M48 92 Q34 104 34 122"
              fill="none"
              stroke={L().fur}
              stroke-width="5"
              stroke-linecap="round"
            ></path>
            <ellipse cx="34" cy="125" rx="4" ry="6" fill={INK}></ellipse>
          </Match>
          <Match when={true}>
            <path
              d="M50 90 Q34 100 32 120"
              fill="none"
              stroke={L().fur}
              stroke-width="5"
              stroke-linecap="round"
            ></path>
            <ellipse
              cx="31"
              cy="124"
              rx="6"
              ry="9"
              fill={L().mane ?? game("brown-dark")}
            ></ellipse>
          </Match>
        </Switch>
      </g>

      {/* far legs, body, near legs */}
      {leg(74, true, true)}
      {leg(126, true, false)}
      <g class={cn("animate-zoo-breathe", ANIM)} style={pivot("bottom")}>
        <clipPath id={clip}>
          <ellipse cx="95" cy="98" rx="52" ry="32"></ellipse>
        </clipPath>
        <ellipse cx="95" cy="98" rx="52" ry="32" fill={L().fur}></ellipse>
        <ellipse cx="95" cy="98" rx="52" ry="32" fill={p.shade}></ellipse>
        <ellipse
          cx="95"
          cy="112"
          rx="38"
          ry="14"
          fill={L().belly}
          opacity="0.9"
        ></ellipse>
        <g style={{ "clip-path": `url(#${clip})` }}>
          <Show when={L().pattern === "stripes"}>
            <For each={[52, 68, 84, 100, 116, 132]}>
              {(x, i) => (
                <path
                  d={`M${x} 62 q${i() % 2 === 0 ? 8 : -6} 20 ${2} 40`}
                  stroke={INK}
                  stroke-width="7"
                  fill="none"
                  stroke-linecap="round"
                ></path>
              )}
            </For>
          </Show>
          <Show when={L().pattern === "spots"}>
            <For
              each={[
                [62, 84, 9],
                [84, 76, 8],
                [108, 82, 10],
                [130, 92, 7],
                [76, 104, 7],
                [100, 102, 8],
                [122, 110, 6],
              ]}
            >
              {([x, y, r]) => (
                <rect
                  x={(x ?? 0) - (r ?? 0)}
                  y={(y ?? 0) - (r ?? 0)}
                  width={(r ?? 0) * 2}
                  height={(r ?? 0) * 1.8}
                  rx="4"
                  fill={game("brown")}
                ></rect>
              )}
            </For>
          </Show>
        </g>
      </g>
      {leg(58, false, false)}
      {leg(110, false, true)}

      {/* neck (giraffe) */}
      <Show when={L().neck === true}>
        <path
          d="M118 82 L146 40"
          stroke={L().fur}
          stroke-width="22"
          stroke-linecap="round"
        ></path>
        <For
          each={[
            [126, 70],
            [136, 56],
            [142, 46],
          ]}
        >
          {([x, y]) => (
            <rect
              x={(x ?? 0) - 4}
              y={(y ?? 0) - 4}
              width="8"
              height="7"
              rx="2"
              fill={game("brown")}
            ></rect>
          )}
        </For>
      </Show>

      {/* head */}
      <g
        class={cn(nibble() && "animate-zoo-nibble", ANIM)}
        style={pivot("left bottom")}
        transform={
          drooped() && !nibble()
            ? `rotate(8 ${head().x - head().r} ${head().y + head().r})`
            : undefined
        }
      >
        {/* mane */}
        <Show when={L().mane !== undefined && L().neck !== true}>
          <Show
            when={L().ears === "round"}
            fallback={
              <path
                d={`M${head().x - 14} ${head().y - head().r + 2} q6 -12 16 -8 q8 -8 14 4`}
                fill={L().mane}
              ></path>
            }
          >
            <For each={Array.from({ length: 12 }, (_, i) => i)}>
              {(i) => (
                <circle
                  cx={
                    head().x + Math.cos((i / 12) * Math.PI * 2) * (head().r + 6)
                  }
                  cy={
                    head().y + Math.sin((i / 12) * Math.PI * 2) * (head().r + 6)
                  }
                  r="12"
                  fill={L().mane}
                ></circle>
              )}
            </For>
          </Show>
        </Show>

        {/* ears */}
        <Switch>
          <Match when={L().ears === "elephant"}>
            <ellipse
              cx={head().x - head().r - 6}
              cy={head().y + 2}
              rx="20"
              ry="26"
              fill={L().fur}
            ></ellipse>
            <ellipse
              cx={head().x + head().r + 6}
              cy={head().y + 2}
              rx="20"
              ry="26"
              fill={L().fur}
            ></ellipse>
            <ellipse
              cx={head().x - head().r - 5}
              cy={head().y + 3}
              rx="12"
              ry="17"
              fill={game("blush")}
              opacity="0.7"
            ></ellipse>
            <ellipse
              cx={head().x + head().r + 5}
              cy={head().y + 3}
              rx="12"
              ry="17"
              fill={game("blush")}
              opacity="0.7"
            ></ellipse>
          </Match>
          <Match when={L().ears === "floppy"}>
            <ellipse
              cx={head().x - head().r}
              cy={head().y - 2}
              rx="14"
              ry="7"
              fill={L().fur}
              transform={`rotate(25 ${head().x - head().r} ${head().y - 2})`}
            ></ellipse>
            <ellipse
              cx={head().x + head().r}
              cy={head().y - 2}
              rx="14"
              ry="7"
              fill={L().fur}
              transform={`rotate(-25 ${head().x + head().r} ${head().y - 2})`}
            ></ellipse>
          </Match>
          <Match when={L().ears === "round"}>
            <circle
              cx={head().x - head().r * 0.7}
              cy={head().y - head().r * 0.75}
              r="8"
              fill={L().fur}
            ></circle>
            <circle
              cx={head().x + head().r * 0.7}
              cy={head().y - head().r * 0.75}
              r="8"
              fill={L().fur}
            ></circle>
          </Match>
          <Match when={true}>
            <For each={[-1, 1]}>
              {(s) => (
                <path
                  d={`M${head().x + s * head().r * 0.45} ${head().y - head().r * 0.7} l${s * 12} -16 l${s * 2} 20 z`}
                  fill={L().fur}
                  stroke={L().fur}
                  stroke-width="4"
                  stroke-linejoin="round"
                ></path>
              )}
            </For>
          </Match>
        </Switch>

        {/* horns */}
        <Show when={L().horns === "goat"}>
          <For each={[-1, 1]}>
            {(s) => (
              <path
                d={`M${head().x + s * 8} ${head().y - head().r + 4} q${s * 6} -16 ${s * 16} -12`}
                fill="none"
                stroke={game("tan")}
                stroke-width="5"
                stroke-linecap="round"
              ></path>
            )}
          </For>
        </Show>
        <Show when={L().horns === "ossicone"}>
          <For each={[-1, 1]}>
            {(s) => (
              <>
                <path
                  d={`M${head().x + s * 7} ${head().y - head().r + 4} l${s * 2} -12`}
                  stroke={L().fur}
                  stroke-width="4"
                  stroke-linecap="round"
                ></path>
                <circle
                  cx={head().x + s * 9}
                  cy={head().y - head().r - 9}
                  r="4"
                  fill={game("brown-dark")}
                ></circle>
              </>
            )}
          </For>
        </Show>

        <circle
          cx={head().x}
          cy={head().y}
          r={head().r}
          fill={L().fur}
        ></circle>
        <circle
          cx={head().x}
          cy={head().y}
          r={head().r}
          fill={p.shade}
        ></circle>
        <Show when={L().pattern === "stripes"}>
          <path
            d={`M${head().x - 10} ${head().y - head().r + 3} l4 10 M${head().x + 10} ${head().y - head().r + 3} l-4 10`}
            stroke={INK}
            stroke-width="5"
            stroke-linecap="round"
          ></path>
        </Show>
        <Show when={L().muzzle !== undefined}>
          <ellipse
            cx={head().x}
            cy={head().y + head().r * 0.48}
            rx={head().r * 0.6}
            ry={head().r * 0.42}
            fill={L().muzzle}
          ></ellipse>
          <ellipse
            cx={head().x}
            cy={head().y + head().r * 0.3}
            rx="4"
            ry="3"
            fill={INK}
          ></ellipse>
        </Show>
        <Show when={L().beard === true}>
          <path
            d={`M${head().x - 5} ${head().y + head().r - 2} l5 12 l5 -12 z`}
            fill={game("cloud")}
          ></path>
        </Show>
        <Show when={L().snout === true}>
          <ellipse
            cx={head().x}
            cy={head().y + head().r * 0.3}
            rx="11"
            ry="8"
            fill={game("pink")}
          ></ellipse>
          <circle
            cx={head().x - 4}
            cy={head().y + head().r * 0.3}
            r="2"
            fill={INK}
          ></circle>
          <circle
            cx={head().x + 4}
            cy={head().y + head().r * 0.3}
            r="2"
            fill={INK}
          ></circle>
        </Show>
        <Face
          cx={head().x}
          cy={head().y}
          r={head().r}
          mood={p.mood}
          action={p.action}
          mouth={L().trunk !== true}
          mouthDy={
            L().snout === true || L().muzzle !== undefined ? head().r * 0.22 : 0
          }
        />
        <Show when={L().trunk === true}>
          <path
            d={`M${head().x} ${head().y + 6} Q${head().x + 2} ${head().y + 34} ${head().x + 14} ${head().y + 40} q6 2 6 -6`}
            fill="none"
            stroke={L().fur}
            stroke-width="12"
            stroke-linecap="round"
          ></path>
        </Show>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Bird rig: chick, duck, parrot, penguin
// ---------------------------------------------------------------------------

type BirdLook = {
  body: string;
  belly: string;
  wing: string;
  beak: string;
  feet: string;
  beakShape: "small" | "flat" | "hook";
  scale: number;
  crest?: string;
  tail?: string;
};

const BIRDS: Partial<Record<ZooSpecies, BirdLook>> = {
  chick: {
    body: game("yellow"),
    belly: game("yellow"),
    wing: game("gold"),
    beak: game("orange"),
    feet: game("orange"),
    beakShape: "small",
    scale: 0.72,
    crest: game("gold"),
  },
  duck: {
    body: game("cloud"),
    belly: game("cream"),
    wing: game("cream"),
    beak: game("orange"),
    feet: game("orange"),
    beakShape: "flat",
    scale: 0.88,
    tail: game("cloud"),
  },
  parrot: {
    body: game("red"),
    belly: game("red"),
    wing: game("blue"),
    beak: game("cream"),
    feet: game("grey"),
    beakShape: "hook",
    scale: 0.9,
    crest: game("yellow"),
    tail: game("blue"),
  },
  penguin: {
    body: game("navy"),
    belly: game("cream"),
    wing: game("navy"),
    beak: game("orange"),
    feet: game("orange"),
    beakShape: "small",
    scale: 0.95,
  },
};

function Bird(p: {
  look: BirdLook;
  /** url() of the light/shadow gradient (see ZooAnimal defs) */
  shade: string;
  /** url() of the leg/wing/arm shading gradient */
  limb: string;
  mood: ZooMood;
  action: ZooAction | undefined;
  walking: boolean;
}): JSXElement {
  const L = (): BirdLook => p.look;
  const flap = (): boolean =>
    p.action === "cheer" ||
    p.action === "play" ||
    p.action === "heal" ||
    p.action === "wash";
  const nibble = (): boolean => p.action === "eat" || p.action === "drink";

  return (
    <g
      transform={`translate(100 160) scale(${L().scale}) translate(-100 -160)`}
    >
      <Show when={L().tail !== undefined}>
        <g class={cn("animate-zoo-wag", ANIM)} style={pivot("right top")}>
          <path d="M72 128 L44 150 L52 134 L40 138 Z" fill={L().tail}></path>
        </g>
      </Show>
      {/* feet */}
      <For each={[86, 112]}>
        {(x, i) => (
          <g
            class={cn(
              p.walking &&
                (i() === 0 ? "animate-zoo-step" : "animate-zoo-step-alt"),
              ANIM,
            )}
            style={pivot("top")}
          >
            <path
              d={`M${x} 146 v8 l-8 4 h18 l-6 -4 z`}
              fill={L().feet}
              stroke={L().feet}
              stroke-width="3"
              stroke-linejoin="round"
            ></path>
          </g>
        )}
      </For>
      <g class={cn("animate-zoo-breathe", ANIM)} style={pivot("bottom")}>
        <ellipse cx="100" cy="112" rx="38" ry="40" fill={L().body}></ellipse>
        <ellipse cx="100" cy="112" rx="38" ry="40" fill={p.shade}></ellipse>
        <ellipse cx="102" cy="120" rx="26" ry="29" fill={L().belly}></ellipse>
        {/* wings */}
        <For each={[-1, 1]}>
          {(s) => (
            // mirror on the outer group: a CSS animation replaces the
            // transform attribute of the element it runs on
            <g transform={s > 0 ? "translate(200 0) scale(-1 1)" : undefined}>
              <g
                class={cn(flap() && "animate-zoo-flap", ANIM)}
                style={pivot("right top")}
              >
                <ellipse
                  cx="64"
                  cy="114"
                  rx="11"
                  ry="26"
                  fill={L().wing}
                  transform="rotate(14 64 114)"
                ></ellipse>
                <ellipse
                  cx="64"
                  cy="114"
                  rx="11"
                  ry="26"
                  fill={p.limb}
                  transform="rotate(14 64 114)"
                ></ellipse>
              </g>
            </g>
          )}
        </For>
      </g>
      <g
        class={cn(nibble() && "animate-zoo-nibble", ANIM)}
        style={pivot("left bottom")}
      >
        <Show when={L().crest !== undefined}>
          <path
            d="M96 36 q-4 -14 6 -16 q-2 8 4 4 q2 8 -6 14 z"
            fill={L().crest}
          ></path>
        </Show>
        <circle cx="100" cy="62" r="28" fill={L().body}></circle>
        <circle cx="100" cy="62" r="28" fill={p.shade}></circle>
        <Show when={L().belly !== L().body && L().body === game("navy")}>
          <ellipse cx="100" cy="68" rx="20" ry="18" fill={L().belly}></ellipse>
        </Show>
        <Face
          cx={100}
          cy={60}
          r={28}
          mood={p.mood}
          action={p.action}
          mouth={false}
        />
        <Switch>
          <Match when={L().beakShape === "flat"}>
            <ellipse cx="100" cy="72" rx="13" ry="6" fill={L().beak}></ellipse>
            <path
              d="M88 72 h24"
              stroke={game("brown")}
              stroke-width="1.5"
            ></path>
          </Match>
          <Match when={L().beakShape === "hook"}>
            <path
              d="M93 66 q8 -4 14 2 q2 12 -6 14 q2 -8 -8 -8 z"
              fill={L().beak}
              stroke={INK}
              stroke-width="1.5"
            ></path>
          </Match>
          <Match when={true}>
            <path d="M93 68 L107 68 L100 78 Z" fill={L().beak}></path>
          </Match>
        </Switch>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Sitting rig: rabbit, monkey, panda
// ---------------------------------------------------------------------------

type SitLook = {
  fur: string;
  belly: string;
  limbs: string;
  scale: number;
  ears: "long" | "side" | "top";
  tail: "puff" | "curl" | "none";
  face?: string;
  patches?: boolean;
};

const SITTERS: Partial<Record<ZooSpecies, SitLook>> = {
  rabbit: {
    fur: game("cream"),
    belly: game("cloud"),
    limbs: game("cream"),
    scale: 0.8,
    ears: "long",
    tail: "puff",
  },
  monkey: {
    fur: game("brown"),
    belly: game("tan"),
    limbs: game("brown"),
    scale: 0.92,
    ears: "side",
    tail: "curl",
    face: game("tan"),
  },
  panda: {
    fur: game("cloud"),
    belly: game("cloud"),
    limbs: INK,
    scale: 1,
    ears: "top",
    tail: "none",
    patches: true,
  },
};

function Sitter(p: {
  look: SitLook;
  /** url() of the light/shadow gradient (see ZooAnimal defs) */
  shade: string;
  /** url() of the leg/wing/arm shading gradient */
  limb: string;
  mood: ZooMood;
  action: ZooAction | undefined;
  walking: boolean;
}): JSXElement {
  const L = (): SitLook => p.look;
  const wave = (): boolean =>
    p.action === "cheer" || p.action === "play" || p.action === "heal";
  const nibble = (): boolean => p.action === "eat" || p.action === "drink";
  const drooped = (): boolean => p.mood === "sad" || p.mood === "sleepy";

  return (
    <g
      transform={`translate(100 160) scale(${L().scale}) translate(-100 -160)`}
    >
      <Switch>
        <Match when={L().tail === "curl"}>
          <g class={cn("animate-zoo-wag", ANIM)} style={pivot("right bottom")}>
            <path
              d="M70 144 Q36 140 40 108 Q44 86 60 96"
              fill="none"
              stroke={L().fur}
              stroke-width="7"
              stroke-linecap="round"
            ></path>
          </g>
        </Match>
        <Match when={L().tail === "puff"}>
          <circle cx="66" cy="146" r="11" fill={game("cloud")}></circle>
        </Match>
      </Switch>
      <g class={cn("animate-zoo-breathe", ANIM)} style={pivot("bottom")}>
        <ellipse cx="100" cy="120" rx="38" ry="37" fill={L().fur}></ellipse>
        <ellipse cx="100" cy="120" rx="38" ry="37" fill={p.shade}></ellipse>
        <ellipse cx="100" cy="128" rx="23" ry="25" fill={L().belly}></ellipse>
        <Show when={L().patches === true}>
          <path
            d="M64 104 Q100 88 136 104 L132 116 Q100 104 68 116 Z"
            fill={INK}
          ></path>
        </Show>
      </g>
      {/* feet */}
      <g class={cn(p.walking && "animate-zoo-step", ANIM)} style={pivot("top")}>
        <ellipse cx="80" cy="154" rx="15" ry="8" fill={L().limbs}></ellipse>
        <ellipse cx="80" cy="154" rx="15" ry="8" fill={p.limb}></ellipse>
      </g>
      <g
        class={cn(p.walking && "animate-zoo-step-alt", ANIM)}
        style={pivot("top")}
      >
        <ellipse cx="120" cy="154" rx="15" ry="8" fill={L().limbs}></ellipse>
        <ellipse cx="120" cy="154" rx="15" ry="8" fill={p.limb}></ellipse>
      </g>
      {/* arms */}
      <ellipse
        cx="68"
        cy="120"
        rx="9"
        ry="20"
        fill={L().limbs}
        transform="rotate(18 68 120)"
      ></ellipse>
      <ellipse
        cx="68"
        cy="120"
        rx="9"
        ry="20"
        fill={p.limb}
        transform="rotate(18 68 120)"
      ></ellipse>
      <g
        class={cn(wave() && "animate-game-wave", ANIM)}
        style={pivot("left top")}
      >
        <ellipse
          cx={wave() ? 142 : 132}
          cy={wave() ? 90 : 120}
          rx="9"
          ry="20"
          fill={L().limbs}
          transform={wave() ? "rotate(24 142 90)" : "rotate(-18 132 120)"}
        ></ellipse>
        <ellipse
          cx={wave() ? 142 : 132}
          cy={wave() ? 90 : 120}
          rx="9"
          ry="20"
          fill={p.limb}
          transform={wave() ? "rotate(24 142 90)" : "rotate(-18 132 120)"}
        ></ellipse>
      </g>
      <g
        class={cn(nibble() && "animate-zoo-nibble", ANIM)}
        style={pivot("left bottom")}
        transform={drooped() && !nibble() ? "rotate(7 70 92)" : undefined}
      >
        <Switch>
          <Match when={L().ears === "long"}>
            <For each={[-1, 1]}>
              {(s) => (
                <>
                  <ellipse
                    cx={100 + s * 13}
                    cy="24"
                    rx="9"
                    ry="26"
                    fill={L().fur}
                    transform={`rotate(${s * 8} ${100 + s * 13} 24)`}
                  ></ellipse>
                  <ellipse
                    cx={100 + s * 13}
                    cy="26"
                    rx="4.5"
                    ry="18"
                    fill={game("blush")}
                    transform={`rotate(${s * 8} ${100 + s * 13} 26)`}
                  ></ellipse>
                </>
              )}
            </For>
          </Match>
          <Match when={L().ears === "side"}>
            <For each={[-1, 1]}>
              {(s) => (
                <>
                  <circle
                    cx={100 + s * 31}
                    cy="62"
                    r="11"
                    fill={L().fur}
                  ></circle>
                  <circle
                    cx={100 + s * 31}
                    cy="62"
                    r="6"
                    fill={L().face ?? L().belly}
                  ></circle>
                </>
              )}
            </For>
          </Match>
          <Match when={L().ears === "top"}>
            <circle cx="76" cy="40" r="11" fill={INK}></circle>
            <circle cx="124" cy="40" r="11" fill={INK}></circle>
          </Match>
        </Switch>
        <circle cx="100" cy="64" r="30" fill={L().fur}></circle>
        <circle cx="100" cy="64" r="30" fill={p.shade}></circle>
        <Show when={L().face !== undefined}>
          <ellipse cx="100" cy="70" rx="23" ry="21" fill={L().face}></ellipse>
        </Show>
        <Show when={L().patches === true}>
          <ellipse
            cx="88"
            cy="61"
            rx="8"
            ry="10"
            fill={INK}
            transform="rotate(25 88 61)"
          ></ellipse>
          <ellipse
            cx="112"
            cy="61"
            rx="8"
            ry="10"
            fill={INK}
            transform="rotate(-25 112 61)"
          ></ellipse>
        </Show>
        <Show when={L().ears === "long"}>
          <ellipse cx="100" cy="70" rx="4" ry="3" fill={game("pink")}></ellipse>
        </Show>
        <Show when={L().patches === true}>
          <ellipse cx="100" cy="72" rx="4" ry="3" fill={INK}></ellipse>
        </Show>
        <Face
          cx={100}
          cy={64}
          r={30}
          mood={p.mood}
          action={p.action}
          mouth={true}
          mouthDy={3}
          lightEyes={L().patches === true}
        />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Extras: food bowl, ball, bubbles, mud, zzz, bandage
// ---------------------------------------------------------------------------

const FOOD_COLOR: Record<ZooDiet, string> = {
  veg: game("orange"),
  seed: game("yellow"),
  fruit: game("yellow"),
  leaf: game("green"),
  meat: game("red"),
  fish: game("blue"),
};

function Bowl(p: { fill: string }): JSXElement {
  return (
    <g>
      <ellipse cx="172" cy="150" rx="18" ry="6" fill={p.fill}></ellipse>
      <circle cx="166" cy="148" r="5" fill={p.fill}></circle>
      <circle cx="176" cy="147" r="5" fill={p.fill}></circle>
      <path d="M152 150 h40 l-5 10 h-30 z" fill={game("brown")}></path>
    </g>
  );
}

/**
 * A drawn, animated zoo animal (front-facing head on a side or sitting body).
 * `mood` sets the face, `action` plays a care animation, `walking` swings the
 * legs (the parent moves it across the pen).
 */
export function ZooAnimal(props: {
  species: ZooSpecies;
  mood?: ZooMood;
  action?: ZooAction;
  dirty?: boolean;
  walking?: boolean;
  class?: string;
}): JSXElement {
  const mood = (): ZooMood => props.mood ?? "happy";
  const walking = (): boolean => props.walking === true && !props.action;
  const quad = (): QuadLook | undefined => QUADS[props.species];
  const bird = (): BirdLook | undefined => BIRDS[props.species];
  const sitter = (): SitLook | undefined => SITTERS[props.species];
  const hop = (): boolean =>
    props.action === "cheer" ||
    props.action === "play" ||
    props.action === "heal";
  // light from the top left, shadow underneath: gives the flat shapes depth
  const shadeId = createUniqueId();
  const shade = `url(#${shadeId})`;
  const limbId = createUniqueId();
  const limb = `url(#${limbId})`;

  return (
    <svg
      viewBox="0 0 200 170"
      class={cn("overflow-visible", props.class)}
      role="img"
      aria-label={`${ZOO_INFO[props.species].name}, ${mood()}`}
    >
      <defs>
        {/* oxlint-disable react/no-unknown-property -- Solid wants kebab-case SVG attributes */}
        <radialGradient id={shadeId} cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" stop-color={game("cloud")} stop-opacity="0.6"></stop>
          <stop
            offset="0.32"
            stop-color={game("cloud")}
            stop-opacity="0"
          ></stop>
          <stop offset="0.68" stop-color={INK} stop-opacity="0"></stop>
          <stop offset="1" stop-color={INK} stop-opacity="0.32"></stop>
        </radialGradient>
        <linearGradient id={limbId} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stop-color={game("cloud")} stop-opacity="0.4"></stop>
          <stop offset="0.4" stop-color={game("cloud")} stop-opacity="0"></stop>
          <stop offset="0.6" stop-color={INK} stop-opacity="0"></stop>
          <stop offset="1" stop-color={INK} stop-opacity="0.3"></stop>
        </linearGradient>
        {/* oxlint-enable react/no-unknown-property */}
      </defs>
      {/* ground shadow */}
      <ellipse
        cx="100"
        cy="160"
        rx="56"
        ry="8"
        fill={INK}
        opacity="0.22"
      ></ellipse>
      <g
        // cartoon ink outline so the animals pop off the grass
        style={{
          filter:
            "drop-shadow(0 0 1.1px rgb(43 33 64 / 0.95)) drop-shadow(0 0 0.5px rgb(43 33 64 / 0.9))",
        }}
      >
        <g
          class={cn(
            hop() && "animate-zoo-cheer",
            props.action === "wash" && "animate-zoo-shimmy",
            walking() && "animate-zoo-trot",
            ANIM,
          )}
          style={pivot("bottom")}
        >
          <Switch>
            <Match when={quad()} keyed>
              {(l) => (
                <Quad
                  look={l}
                  shade={shade}
                  limb={limb}
                  mood={mood()}
                  action={props.action}
                  walking={walking()}
                />
              )}
            </Match>
            <Match when={bird()} keyed>
              {(l) => (
                <Bird
                  look={l}
                  shade={shade}
                  limb={limb}
                  mood={mood()}
                  action={props.action}
                  walking={walking()}
                />
              )}
            </Match>
            <Match when={sitter()} keyed>
              {(l) => (
                <Sitter
                  look={l}
                  shade={shade}
                  limb={limb}
                  mood={mood()}
                  action={props.action}
                  walking={walking()}
                />
              )}
            </Match>
          </Switch>

          {/* mud */}
          <Show when={props.dirty === true && props.action !== "wash"}>
            <g fill={game("brown-dark")} opacity="0.75">
              <ellipse cx="80" cy="112" rx="9" ry="6"></ellipse>
              <ellipse cx="112" cy="124" rx="7" ry="5"></ellipse>
              <ellipse cx="96" cy="136" rx="5" ry="4"></ellipse>
              <circle cx="122" cy="104" r="3"></circle>
            </g>
            <g class={cn("animate-zoo-buzz", ANIM)}>
              <circle cx="150" cy="36" r="3" fill={INK}></circle>
              <ellipse
                cx="148"
                cy="32"
                rx="3"
                ry="2"
                fill={game("cloud")}
                opacity="0.9"
              ></ellipse>
            </g>
          </Show>

          {/* bandage */}
          <Show when={props.action === "heal"}>
            <g transform="rotate(-20 92 118)">
              <rect
                x="78"
                y="112"
                width="28"
                height="11"
                rx="5"
                fill={game("tan")}
              ></rect>
              <rect
                x="88"
                y="112"
                width="8"
                height="11"
                fill={game("cream")}
              ></rect>
            </g>
          </Show>
        </g>
      </g>

      {/* props in front */}
      <Show when={props.action === "eat"}>
        <Bowl fill={FOOD_COLOR[ZOO_INFO[props.species].diet]} />
      </Show>
      <Show when={props.action === "drink"}>
        <Bowl fill={game("sky")} />
      </Show>
      <Show when={props.action === "play"}>
        <g class={cn("animate-game-bob", ANIM)}>
          <circle cx="172" cy="146" r="12" fill={game("red")}></circle>
          <path
            d="M160 146 h24 M172 134 v24"
            stroke={game("cloud")}
            stroke-width="3"
          ></path>
        </g>
      </Show>
      <Show when={props.action === "wash"}>
        <g fill={game("cloud")} opacity="0.9">
          <For
            each={[
              [56, 100, 10],
              [76, 84, 8],
              [130, 92, 9],
              [146, 120, 11],
              [60, 132, 8],
              [108, 76, 7],
            ]}
          >
            {([x, y, r], i) => (
              <circle
                cx={x}
                cy={y}
                r={r}
                stroke={game("sky")}
                stroke-width="2"
                class={cn("animate-game-bob", ANIM)}
                style={{ "animation-delay": `${i() * 0.15}s` }}
              ></circle>
            )}
          </For>
        </g>
      </Show>
      <Show when={mood() === "sleepy" || props.action === "sleep"}>
        <For each={[0, 0.7, 1.4]}>
          {(d) => (
            <text
              x="150"
              y="40"
              font-size="18"
              fill={game("navy")}
              class={cn("animate-zoo-zzz font-bold", ANIM)}
              style={{ "animation-delay": `${d}s` }}
            >
              z
            </text>
          )}
        </For>
      </Show>
    </svg>
  );
}

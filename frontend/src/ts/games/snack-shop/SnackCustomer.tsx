import { JSXElement, Match, Show, Switch } from "solid-js";

import { Animal, CustomerMood, game } from "./snack-art";

type Look = {
  fur: string;
  inner: string;
  nose: string;
  eyeY: number;
};

const LOOKS: Record<Animal, Look> = {
  bear: {
    fur: game("brown"),
    inner: game("tan"),
    nose: game("brown-dark"),
    eyeY: 74,
  },
  bunny: {
    fur: game("cream"),
    inner: game("blush"),
    nose: game("pink"),
    eyeY: 76,
  },
  fox: {
    fur: game("orange"),
    inner: game("cream"),
    nose: game("ink"),
    eyeY: 74,
  },
  panda: {
    fur: game("cream"),
    inner: game("ink"),
    nose: game("ink"),
    eyeY: 76,
  },
  frog: {
    fur: game("frog"),
    inner: game("mint"),
    nose: game("frog"),
    eyeY: 42,
  },
  cat: {
    fur: game("grey"),
    inner: game("blush"),
    nose: game("pink"),
    eyeY: 76,
  },
  pig: {
    fur: game("blush"),
    inner: game("pink"),
    nose: game("pink"),
    eyeY: 72,
  },
  penguin: {
    fur: game("navy"),
    inner: game("cream"),
    nose: game("orange"),
    eyeY: 76,
  },
};

const INK = game("ink");

/**
 * A cartoon animal customer seen over the shop counter (head + shoulders).
 * Face changes with mood; `shirt` colours the shoulders.
 */
export function SnackCustomer(props: {
  animal: Animal;
  mood: CustomerMood;
  shirt: string;
  size?: number;
  class?: string;
}): JSXElement {
  const look = (): Look => LOOKS[props.animal];
  const eyeFill = (): string =>
    props.animal === "panda" ? game("cream") : INK;
  const happy = (): boolean => props.mood === "happy";

  return (
    <svg
      viewBox="0 0 160 170"
      width={props.size ?? 160}
      height={((props.size ?? 160) * 170) / 160}
      class={props.class}
      role="img"
      aria-label={`${props.animal} customer, ${props.mood}`}
    >
      {/* shoulders */}
      <path
        d="M22 170 Q24 128 80 124 Q136 128 138 170 Z"
        fill={props.shirt}
      ></path>
      <path
        d="M62 126 L80 146 L98 126"
        fill="none"
        stroke={game("cream")}
        stroke-width="6"
        stroke-linejoin="round"
      ></path>

      {/* ears (behind head) */}
      <Switch>
        <Match when={props.animal === "bear" || props.animal === "panda"}>
          <circle
            cx="38"
            cy="40"
            r="18"
            fill={props.animal === "panda" ? INK : look().fur}
          ></circle>
          <circle
            cx="122"
            cy="40"
            r="18"
            fill={props.animal === "panda" ? INK : look().fur}
          ></circle>
          <Show when={props.animal === "bear"}>
            <circle cx="38" cy="40" r="9" fill={look().inner}></circle>
            <circle cx="122" cy="40" r="9" fill={look().inner}></circle>
          </Show>
        </Match>
        <Match when={props.animal === "bunny"}>
          <ellipse
            cx="58"
            cy="22"
            rx="13"
            ry="34"
            fill={look().fur}
            transform="rotate(-10 58 22)"
          ></ellipse>
          <ellipse
            cx="102"
            cy="22"
            rx="13"
            ry="34"
            fill={look().fur}
            transform="rotate(10 102 22)"
          ></ellipse>
          <ellipse
            cx="58"
            cy="24"
            rx="6"
            ry="24"
            fill={look().inner}
            transform="rotate(-10 58 24)"
          ></ellipse>
          <ellipse
            cx="102"
            cy="24"
            rx="6"
            ry="24"
            fill={look().inner}
            transform="rotate(10 102 24)"
          ></ellipse>
        </Match>
        <Match when={props.animal === "fox" || props.animal === "cat"}>
          <path d="M30 60 L36 14 L72 40 Z" fill={look().fur}></path>
          <path d="M130 60 L124 14 L88 40 Z" fill={look().fur}></path>
          <path
            d="M38 48 L41 26 L60 40 Z"
            fill={props.animal === "fox" ? INK : look().inner}
          ></path>
          <path
            d="M122 48 L119 26 L100 40 Z"
            fill={props.animal === "fox" ? INK : look().inner}
          ></path>
        </Match>
        <Match when={props.animal === "pig"}>
          <path d="M34 50 L40 18 L66 36 Z" fill={look().inner}></path>
          <path d="M126 50 L120 18 L94 36 Z" fill={look().inner}></path>
        </Match>
      </Switch>

      {/* head */}
      <ellipse cx="80" cy="82" rx="56" ry="50" fill={look().fur}></ellipse>

      {/* face markings */}
      <Switch>
        <Match when={props.animal === "fox"}>
          <path
            d="M28 84 Q50 92 80 120 Q110 92 132 84 Q120 128 80 132 Q40 128 28 84 Z"
            fill={look().inner}
          ></path>
        </Match>
        <Match when={props.animal === "penguin"}>
          <path
            d="M80 62 Q60 40 42 62 Q30 92 80 126 Q130 92 118 62 Q100 40 80 62 Z"
            fill={look().inner}
          ></path>
        </Match>
        <Match when={props.animal === "panda"}>
          <ellipse
            cx="56"
            cy="78"
            rx="14"
            ry="17"
            fill={INK}
            transform="rotate(-20 56 78)"
          ></ellipse>
          <ellipse
            cx="104"
            cy="78"
            rx="14"
            ry="17"
            fill={INK}
            transform="rotate(20 104 78)"
          ></ellipse>
        </Match>
        <Match when={props.animal === "bear"}>
          <ellipse
            cx="80"
            cy="102"
            rx="24"
            ry="18"
            fill={look().inner}
          ></ellipse>
        </Match>
        <Match when={props.animal === "frog"}>
          <ellipse
            cx="80"
            cy="104"
            rx="38"
            ry="20"
            fill={look().inner}
          ></ellipse>
          <circle cx="56" cy="42" r="21" fill={look().fur}></circle>
          <circle cx="104" cy="42" r="21" fill={look().fur}></circle>
          <circle cx="56" cy="42" r="13" fill={game("cream")}></circle>
          <circle cx="104" cy="42" r="13" fill={game("cream")}></circle>
        </Match>
      </Switch>

      {/* cheeks */}
      <ellipse
        cx="42"
        cy="100"
        rx="9"
        ry="6"
        fill={game("blush")}
        opacity="0.85"
      ></ellipse>
      <ellipse
        cx="118"
        cy="100"
        rx="9"
        ry="6"
        fill={game("blush")}
        opacity="0.85"
      ></ellipse>

      {/* eyes */}
      <Show
        when={happy()}
        fallback={
          <g>
            <circle cx="56" cy={look().eyeY} r="7" fill={eyeFill()}></circle>
            <circle cx="104" cy={look().eyeY} r="7" fill={eyeFill()}></circle>
            <circle
              cx="58"
              cy={look().eyeY - 2}
              r="2.2"
              fill={props.animal === "panda" ? INK : game("cream")}
            ></circle>
            <circle
              cx="106"
              cy={look().eyeY - 2}
              r="2.2"
              fill={props.animal === "panda" ? INK : game("cream")}
            ></circle>
          </g>
        }
      >
        <g
          stroke={eyeFill()}
          stroke-width="5"
          stroke-linecap="round"
          fill="none"
        >
          <path
            d={`M48 ${look().eyeY + 3} Q56 ${look().eyeY - 7} 64 ${look().eyeY + 3}`}
          ></path>
          <path
            d={`M96 ${look().eyeY + 3} Q104 ${look().eyeY - 7} 112 ${look().eyeY + 3}`}
          ></path>
        </g>
      </Show>

      {/* brows when cross */}
      <Show when={props.mood === "grumpy" || props.mood === "angry"}>
        <g stroke={INK} stroke-width="5" stroke-linecap="round">
          <path d={`M44 ${look().eyeY - 16} L64 ${look().eyeY - 10}`}></path>
          <path d={`M116 ${look().eyeY - 16} L96 ${look().eyeY - 10}`}></path>
        </g>
      </Show>

      {/* nose / snout / beak */}
      <Switch>
        <Match when={props.animal === "pig"}>
          <ellipse cx="80" cy="98" rx="16" ry="11" fill={look().nose}></ellipse>
          <ellipse
            cx="74"
            cy="98"
            rx="3"
            ry="4"
            fill={game("brown-dark")}
          ></ellipse>
          <ellipse
            cx="86"
            cy="98"
            rx="3"
            ry="4"
            fill={game("brown-dark")}
          ></ellipse>
        </Match>
        <Match when={props.animal === "penguin"}>
          <path d="M70 90 L90 90 L80 102 Z" fill={look().nose}></path>
        </Match>
        <Match when={props.animal !== "frog"}>
          <ellipse cx="80" cy="94" rx="7" ry="5" fill={look().nose}></ellipse>
        </Match>
      </Switch>

      {/* cat whiskers */}
      <Show when={props.animal === "cat"}>
        <g stroke={INK} stroke-width="2" stroke-linecap="round" opacity="0.6">
          <path d="M30 92 L54 96"></path>
          <path d="M30 104 L54 102"></path>
          <path d="M130 92 L106 96"></path>
          <path d="M130 104 L106 102"></path>
        </g>
      </Show>

      {/* mouth */}
      <Switch>
        <Match when={happy()}>
          <path d="M66 106 Q80 126 94 106 Z" fill={INK}></path>
          <path d="M72 114 Q80 120 88 114" fill={game("pink")}></path>
          <Show when={props.animal === "bunny"}>
            <rect
              x="75"
              y="106"
              width="10"
              height="7"
              rx="1.5"
              fill={game("cream")}
            ></rect>
          </Show>
        </Match>
        <Match when={props.mood === "waiting"}>
          <path
            d="M70 110 Q80 116 90 110"
            fill="none"
            stroke={INK}
            stroke-width="4"
            stroke-linecap="round"
          ></path>
        </Match>
        <Match when={props.mood === "grumpy"}>
          <path
            d="M68 114 Q74 108 80 114 Q86 120 92 114"
            fill="none"
            stroke={INK}
            stroke-width="4"
            stroke-linecap="round"
          ></path>
        </Match>
        <Match when={props.mood === "angry"}>
          <path
            d="M68 118 Q80 104 92 118"
            fill="none"
            stroke={INK}
            stroke-width="4.5"
            stroke-linecap="round"
          ></path>
        </Match>
      </Switch>

      {/* worried sweat drop */}
      <Show when={props.mood === "grumpy"}>
        <path
          d="M132 56 Q140 68 132 74 Q124 68 132 56 Z"
          fill={game("sky")}
        ></path>
      </Show>
    </svg>
  );
}

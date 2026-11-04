import { JSXElement, Match, Switch } from "solid-js";

import { game, SnackKind, SNACK_NAMES } from "./snack-art";

const INK = game("ink");

/** Hand-drawn snack picture used in orders and on the serving plate. */
export function SnackIcon(props: {
  kind: SnackKind;
  size?: number;
  class?: string;
}): JSXElement {
  return (
    <svg
      viewBox="0 0 64 64"
      width={props.size ?? 48}
      height={props.size ?? 48}
      class={props.class}
      role="img"
      aria-label={SNACK_NAMES[props.kind]}
    >
      <Switch>
        <Match when={props.kind === "donut"}>
          <circle
            cx="32"
            cy="34"
            r="24"
            fill={game("tan")}
            stroke={game("brown")}
            stroke-width="3"
          ></circle>
          <path
            d="M10 32 Q12 12 32 10 Q52 12 54 32 Q50 30 46 36 Q40 30 34 36 Q28 30 22 36 Q16 30 10 32 Z"
            fill={game("pink")}
          ></path>
          <circle
            cx="32"
            cy="32"
            r="8"
            fill={game("cream")}
            stroke={game("brown")}
            stroke-width="3"
          ></circle>
          <g stroke-width="3" stroke-linecap="round">
            <path d="M20 20 L23 22" stroke={game("yellow")}></path>
            <path d="M40 16 L43 18" stroke={game("blue")}></path>
            <path d="M44 26 L46 23" stroke={game("cream")}></path>
            <path d="M26 15 L28 12" stroke={game("green")}></path>
          </g>
        </Match>
        <Match when={props.kind === "cupcake"}>
          <path d="M14 34 L20 58 L44 58 L50 34 Z" fill={game("blue")}></path>
          <g stroke={game("navy")} stroke-width="2" opacity="0.4">
            <path d="M24 36 L27 58"></path>
            <path d="M32 36 L32 58"></path>
            <path d="M40 36 L37 58"></path>
          </g>
          <path
            d="M10 36 Q8 24 20 22 Q22 10 34 12 Q46 10 46 22 Q56 24 54 36 Z"
            fill={game("blush")}
          ></path>
          <circle cx="34" cy="10" r="5" fill={game("red")}></circle>
        </Match>
        <Match when={props.kind === "cookie"}>
          <circle
            cx="32"
            cy="32"
            r="24"
            fill={game("tan")}
            stroke={game("brown")}
            stroke-width="3"
          ></circle>
          <g fill={game("brown-dark")}>
            <circle cx="24" cy="22" r="3.5"></circle>
            <circle cx="40" cy="26" r="3"></circle>
            <circle cx="28" cy="38" r="3.5"></circle>
            <circle cx="42" cy="42" r="3"></circle>
            <circle cx="18" cy="34" r="2.5"></circle>
          </g>
        </Match>
        <Match when={props.kind === "icecream"}>
          <path d="M20 32 L32 60 L44 32 Z" fill={game("orange")}></path>
          <g stroke={game("brown")} stroke-width="1.8" opacity="0.6">
            <path d="M24 36 L38 50"></path>
            <path d="M40 36 L26 50"></path>
          </g>
          <circle cx="32" cy="22" r="13" fill={game("mint")}></circle>
          <circle cx="22" cy="30" r="8" fill={game("pink")}></circle>
          <circle cx="42" cy="30" r="8" fill={game("cream")}></circle>
          <circle cx="32" cy="9" r="4" fill={game("red")}></circle>
        </Match>
        <Match when={props.kind === "watermelon"}>
          <path d="M6 22 A26 26 0 0 0 58 22 Z" fill={game("green")}></path>
          <path d="M11 22 A21 21 0 0 0 53 22 Z" fill={game("red")}></path>
          <g fill={INK}>
            <ellipse cx="22" cy="30" rx="1.8" ry="3"></ellipse>
            <ellipse cx="32" cy="36" rx="1.8" ry="3"></ellipse>
            <ellipse cx="42" cy="30" rx="1.8" ry="3"></ellipse>
            <ellipse cx="32" cy="26" rx="1.8" ry="3"></ellipse>
          </g>
        </Match>
        <Match when={props.kind === "lollipop"}>
          <rect
            x="30"
            y="34"
            width="5"
            height="26"
            rx="2.5"
            fill={game("cream")}
            stroke={game("grey")}
            stroke-width="1.5"
          ></rect>
          <circle cx="32" cy="24" r="18" fill={game("purple")}></circle>
          <path
            d="M32 24 m-12 0 a12 12 0 1 1 12 12 a8 8 0 1 1 -8 -8 a4 4 0 1 1 4 4"
            fill="none"
            stroke={game("cream")}
            stroke-width="3.5"
            stroke-linecap="round"
          ></path>
        </Match>
      </Switch>
    </svg>
  );
}

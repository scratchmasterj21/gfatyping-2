import { For, JSXElement, Match, Switch } from "solid-js";

import { cn } from "../../utils/cn";
import { game } from "../snack-shop/snack-art";
import { ZooDecorId } from "./zoo-decor";

const INK = game("ink");
const ANIM = "motion-reduce:animate-none";

/** A drawn zoo decoration (viewBox 100x100, sitting on the bottom edge). */
export function ZooDecor(props: {
  id: ZooDecorId;
  class?: string;
}): JSXElement {
  return (
    <svg
      viewBox="0 0 100 100"
      class={cn("overflow-visible", props.class)}
      aria-hidden="true"
      style={{
        filter: "drop-shadow(0 0 0.8px rgb(43 33 64 / 0.6))",
      }}
    >
      <ellipse
        cx="50"
        cy="96"
        rx="34"
        ry="4"
        fill={INK}
        opacity="0.12"
      ></ellipse>
      <Switch>
        <Match when={props.id === "signpost"}>
          <rect
            x="46"
            y="40"
            width="8"
            height="56"
            rx="2"
            fill={game("brown-dark")}
          ></rect>
          <path d="M18 30 h56 l10 9 l-10 9 h-56 z" fill={game("tan")}></path>
          <text
            x="46"
            y="44"
            font-size="13"
            text-anchor="middle"
            fill={game("brown-dark")}
            class="font-bold"
          >
            ZOO
          </text>
        </Match>
        <Match when={props.id === "rock"}>
          <path
            d="M14 96 Q12 64 38 58 Q60 50 78 66 Q92 80 88 96 Z"
            fill={game("grey")}
          ></path>
          <path
            d="M36 66 Q48 60 60 64"
            stroke={game("cloud")}
            stroke-width="3"
            fill="none"
            opacity="0.6"
          ></path>
        </Match>
        <Match when={props.id === "bush"}>
          <circle cx="32" cy="78" r="20" fill={game("grass-dark")}></circle>
          <circle cx="56" cy="70" r="24" fill={game("green")}></circle>
          <circle cx="74" cy="82" r="16" fill={game("grass-dark")}></circle>
          <circle cx="50" cy="66" r="3" fill={game("red")}></circle>
          <circle cx="64" cy="78" r="3" fill={game("red")}></circle>
        </Match>
        <Match when={props.id === "flowers"}>
          <rect
            x="10"
            y="80"
            width="80"
            height="16"
            rx="6"
            fill={game("brown")}
          ></rect>
          <For each={[22, 40, 58, 76]}>
            {(x, i) => (
              <g
                class={cn("animate-game-wave", ANIM)}
                style={{
                  "transform-box": "fill-box",
                  "transform-origin": "bottom",
                  "animation-delay": `${i() * 0.3}s`,
                }}
              >
                <path
                  d={`M${x} 82 v-20`}
                  stroke={game("grass-dark")}
                  stroke-width="3"
                ></path>
                <circle
                  cx={x}
                  cy="60"
                  r="8"
                  fill={
                    [game("pink"), game("yellow"), game("purple"), game("red")][
                      i()
                    ]
                  }
                ></circle>
                <circle cx={x} cy="60" r="3" fill={game("cream")}></circle>
              </g>
            )}
          </For>
        </Match>
        <Match when={props.id === "tree"}>
          <rect
            x="44"
            y="56"
            width="12"
            height="40"
            rx="3"
            fill={game("brown")}
          ></rect>
          <g
            class={cn("animate-game-wave", ANIM)}
            style={{
              "transform-box": "fill-box",
              "transform-origin": "bottom",
            }}
          >
            <circle cx="50" cy="34" r="26" fill={game("green")}></circle>
            <circle cx="32" cy="48" r="16" fill={game("grass-dark")}></circle>
            <circle cx="68" cy="48" r="16" fill={game("grass-dark")}></circle>
            <circle cx="42" cy="26" r="4" fill={game("red")}></circle>
            <circle cx="60" cy="40" r="4" fill={game("red")}></circle>
          </g>
        </Match>
        <Match when={props.id === "bench"}>
          <rect
            x="16"
            y="60"
            width="68"
            height="9"
            rx="3"
            fill={game("brown")}
          ></rect>
          <rect
            x="16"
            y="46"
            width="68"
            height="8"
            rx="3"
            fill={game("brown")}
          ></rect>
          <rect
            x="22"
            y="69"
            width="6"
            height="27"
            fill={game("brown-dark")}
          ></rect>
          <rect
            x="72"
            y="69"
            width="6"
            height="27"
            fill={game("brown-dark")}
          ></rect>
        </Match>
        <Match when={props.id === "balloons"}>
          <rect
            x="34"
            y="72"
            width="32"
            height="24"
            rx="4"
            fill={game("red")}
          ></rect>
          <rect x="34" y="72" width="32" height="6" fill={game("cloud")}></rect>
          <For
            each={
              [
                [30, 26, "pink"],
                [50, 16, "yellow"],
                [70, 28, "blue"],
              ] as const
            }
          >
            {([x, y, c], i) => (
              <g
                class={cn("animate-game-bob", ANIM)}
                style={{ "animation-delay": `${i() * 0.4}s` }}
              >
                <path
                  d={`M${x} ${y + 12} L50 72`}
                  stroke={INK}
                  stroke-width="1"
                  opacity="0.5"
                ></path>
                <ellipse cx={x} cy={y} rx="10" ry="12" fill={game(c)}></ellipse>
              </g>
            )}
          </For>
        </Match>
        <Match when={props.id === "pond"}>
          <ellipse
            cx="50"
            cy="82"
            rx="44"
            ry="14"
            fill={game("sky-top")}
          ></ellipse>
          <ellipse cx="50" cy="80" rx="36" ry="9" fill={game("sky")}></ellipse>
          <ellipse cx="34" cy="80" rx="7" ry="3" fill={game("green")}></ellipse>
          <path
            d="M60 79 q4 -3 8 0"
            stroke={game("cloud")}
            stroke-width="2"
            fill="none"
          ></path>
        </Match>
        <Match when={props.id === "ice-cream"}>
          <rect
            x="18"
            y="56"
            width="58"
            height="30"
            rx="5"
            fill={game("cream")}
          ></rect>
          <rect x="18" y="56" width="58" height="8" fill={game("pink")}></rect>
          <circle cx="30" cy="90" r="6" fill={INK}></circle>
          <circle cx="66" cy="90" r="6" fill={INK}></circle>
          <path
            d="M76 70 h12"
            stroke={game("grey")}
            stroke-width="4"
            stroke-linecap="round"
          ></path>
          <path d="M14 56 L47 30 L80 56 Z" fill={game("blue")}></path>
          <path d="M44 42 l3 12 l3 -12 z" fill={game("tan")}></path>
          <circle cx="47" cy="40" r="5" fill={game("pink")}></circle>
        </Match>
        <Match when={props.id === "fountain"}>
          <ellipse
            cx="50"
            cy="86"
            rx="40"
            ry="10"
            fill={game("grey")}
          ></ellipse>
          <ellipse cx="50" cy="83" rx="32" ry="6" fill={game("sky")}></ellipse>
          <rect x="45" y="44" width="10" height="40" fill={game("grey")}></rect>
          <ellipse cx="50" cy="46" rx="16" ry="4" fill={game("grey")}></ellipse>
          <For each={[0, 0.5, 1]}>
            {(d) => (
              <circle
                cx="50"
                cy="38"
                r="4"
                fill={game("sky")}
                class={cn("animate-game-float-up", ANIM)}
                style={{
                  "animation-delay": `${d}s`,
                  "animation-iteration-count": "infinite",
                }}
              ></circle>
            )}
          </For>
        </Match>
      </Switch>
    </svg>
  );
}

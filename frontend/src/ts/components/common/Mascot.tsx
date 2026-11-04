import { JSXElement, Match, Show, Switch } from "solid-js";

import { cn } from "../../utils/cn";

export type MascotMood =
  | "idle"
  | "happy"
  | "cheer"
  | "sad"
  | "thinking"
  | "sleepy";

export type MascotProps = {
  mood?: MascotMood;
  /** Rendered width/height in px. */
  size?: number;
  /** Gentle bob + blink. Always off for prefers-reduced-motion. */
  animate?: boolean;
  class?: string;
};

// Theme-aware colors, derived from the active theme so Tappy fits every theme.
const BODY = "var(--main-color)";
const LEDGE = "color-mix(in srgb, var(--main-color) 70%, black)";
const FACE = "color-mix(in srgb, var(--main-color) 30%, white)";
const INK = "color-mix(in srgb, var(--main-color) 15%, #1a1a1a)";
const CHEEK = "color-mix(in srgb, #ff6b8b 55%, transparent)";

/**
 * Tappy - the app's keycap buddy. A little keyboard key with a face,
 * used to cheer students on across lessons, results and empty states.
 */
export function Mascot(props: MascotProps): JSXElement {
  const mood = (): MascotMood => props.mood ?? "idle";
  const animate = () => props.animate ?? true;
  const armsUp = () => mood() === "cheer";
  const happyEyes = () => mood() === "happy" || mood() === "cheer";

  return (
    <svg
      viewBox="0 0 120 124"
      width={props.size ?? 96}
      height={props.size ?? 96}
      role="img"
      aria-label={`Tappy the keycap buddy, feeling ${mood()}`}
      class={cn(
        "shrink-0 overflow-visible",
        animate() && "animate-mascot-bob motion-reduce:animate-none",
        props.class,
      )}
    >
      {/* feet */}
      <ellipse cx="44" cy="114" rx="11" ry="6" fill={LEDGE}></ellipse>
      <ellipse cx="76" cy="114" rx="11" ry="6" fill={LEDGE}></ellipse>

      {/* arms */}
      <g stroke={LEDGE} stroke-width="7" stroke-linecap="round" fill="none">
        <Show
          when={armsUp()}
          fallback={
            <>
              <path d="M20 70 Q10 76 9 86"></path>
              <path d="M100 70 Q110 76 111 86"></path>
            </>
          }
        >
          <path d="M20 60 Q8 48 10 32"></path>
          <path d="M100 60 Q112 48 110 32"></path>
        </Show>
      </g>

      {/* keycap: ledge, top, face plate */}
      <rect x="16" y="30" width="88" height="80" rx="22" fill={LEDGE}></rect>
      <rect x="16" y="22" width="88" height="78" rx="22" fill={BODY}></rect>
      <rect x="27" y="31" width="66" height="58" rx="15" fill={FACE}></rect>

      {/* cheeks */}
      <ellipse cx="38" cy="70" rx="6" ry="4" fill={CHEEK}></ellipse>
      <ellipse cx="82" cy="70" rx="6" ry="4" fill={CHEEK}></ellipse>

      {/* eyes */}
      <Switch>
        <Match when={happyEyes()}>
          <g stroke={INK} stroke-width="4" stroke-linecap="round" fill="none">
            <path d="M40 58 Q46 49 52 58"></path>
            <path d="M68 58 Q74 49 80 58"></path>
          </g>
        </Match>
        <Match when={mood() === "sleepy"}>
          <g stroke={INK} stroke-width="4" stroke-linecap="round" fill="none">
            <path d="M40 57 Q46 61 52 57"></path>
            <path d="M68 57 Q74 61 80 57"></path>
          </g>
        </Match>
        <Match when={true}>
          <g
            class={cn(
              "origin-center [transform-box:fill-box]",
              animate() && "animate-mascot-blink motion-reduce:animate-none",
            )}
          >
            <circle
              cx="46"
              cy={mood() === "thinking" ? 52 : 56}
              r="6.5"
              fill={INK}
            ></circle>
            <circle
              cx="74"
              cy={mood() === "thinking" ? 52 : 56}
              r="6.5"
              fill={INK}
            ></circle>
            <circle
              cx="48"
              cy={mood() === "thinking" ? 50 : 54}
              r="2"
              fill="white"
            ></circle>
            <circle
              cx="76"
              cy={mood() === "thinking" ? 50 : 54}
              r="2"
              fill="white"
            ></circle>
          </g>
          <Show when={mood() === "sad"}>
            <g stroke={INK} stroke-width="3" stroke-linecap="round">
              <path d="M38 46 L50 44"></path>
              <path d="M82 46 L70 44"></path>
            </g>
          </Show>
        </Match>
      </Switch>

      {/* mouth */}
      <Switch>
        <Match when={happyEyes()}>
          <path d="M48 70 Q60 86 72 70 Z" fill={INK}></path>
          <path d="M53 76 Q60 81 67 76" fill={CHEEK}></path>
        </Match>
        <Match when={mood() === "sad"}>
          <path
            d="M51 77 Q60 69 69 77"
            stroke={INK}
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          ></path>
        </Match>
        <Match when={mood() === "thinking"}>
          <path
            d="M53 75 L67 72"
            stroke={INK}
            stroke-width="4"
            stroke-linecap="round"
          ></path>
        </Match>
        <Match when={mood() === "sleepy"}>
          <ellipse cx="60" cy="75" rx="4" ry="5" fill={INK}></ellipse>
        </Match>
        <Match when={true}>
          <path
            d="M51 72 Q60 80 69 72"
            stroke={INK}
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          ></path>
        </Match>
      </Switch>

      {/* extras */}
      <Show when={mood() === "cheer"}>
        <g fill="var(--caret-color)">
          <path d="M8 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"></path>
          <path d="M108 10 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"></path>
        </g>
      </Show>
      <Show when={mood() === "thinking"}>
        <g fill={FACE} stroke={LEDGE} stroke-width="2">
          <circle cx="104" cy="16" r="7"></circle>
          <circle cx="94" cy="6" r="3.5"></circle>
        </g>
      </Show>
      <Show when={mood() === "sleepy"}>
        <text
          x="96"
          y="18"
          fill={INK}
          font-size="16"
          class="font-kid font-bold"
        >
          z
        </text>
      </Show>
    </svg>
  );
}

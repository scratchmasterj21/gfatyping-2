import { For, JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";

const BLOCK_COLORS = [
  "var(--color-game-pink)",
  "var(--color-game-yellow)",
  "var(--color-game-green)",
  "var(--color-game-blue)",
  "var(--color-game-purple)",
  "var(--color-game-orange)",
];

const blockColor = (floor: number): string =>
  BLOCK_COLORS[(floor - 1 + BLOCK_COLORS.length) % BLOCK_COLORS.length] ??
  "var(--color-game-pink)";

const CRACK_PATHS = [
  "M30 2 L36 14 L31 22 L38 34",
  "M70 44 L76 30 L70 22 L78 10",
  "M50 2 L46 12 L54 20 L49 30 L56 44",
];

/**
 * A chunky candy keycap block. `cracks` draws crack lines across it; the
 * floor number sits on the face like a key legend.
 */
export function TowerBlock(props: {
  floor: number;
  cracks?: number;
  class?: string;
  children?: JSXElement;
}): JSXElement {
  const color = (): string => blockColor(props.floor);
  return (
    <div
      class={cn(
        "relative flex h-11 w-44 items-center justify-center rounded-xl xs:w-56 sm:w-64",
        props.class,
      )}
      style={{
        "background-color": color(),
        "box-shadow": `0 6px 0 color-mix(in srgb, ${color()} 62%, black)`,
      }}
    >
      <span class="absolute inset-x-3 top-1 h-1.5 rounded-full bg-game-cloud/45"></span>
      <Show
        when={props.children}
        fallback={
          <span class="text-lg font-bold text-game-cloud/90 [text-shadow:0_2px_0_rgb(0_0_0/0.18)]">
            {props.floor}
          </span>
        }
      >
        {props.children}
      </Show>
      <Show when={(props.cracks ?? 0) > 0}>
        <svg
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          class="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <For each={CRACK_PATHS.slice(0, props.cracks ?? 0)}>
            {(d) => (
              <path
                d={d}
                fill="none"
                stroke="var(--color-game-ink)"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            )}
          </For>
        </svg>
      </Show>
    </div>
  );
}

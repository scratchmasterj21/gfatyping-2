import { For, JSXElement } from "solid-js";

import { cn } from "../../utils/cn";

/** Three big stars that pop in one after another. */
export function StarRating(props: { stars: number }): JSXElement {
  return (
    <div
      class="flex items-end gap-2"
      role="img"
      aria-label={`${props.stars} of 3 stars`}
    >
      <For each={[0, 1, 2]}>
        {(i) => (
          <svg
            viewBox="0 0 24 24"
            class={cn(
              "animate-game-pop motion-reduce:animate-none",
              i === 1 ? "h-16 w-16" : "h-12 w-12",
            )}
            style={{ "animation-delay": `${0.15 + i * 0.2}s` }}
          >
            <path
              d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
              fill={
                i < props.stars
                  ? "var(--color-game-gold)"
                  : "color-mix(in srgb, var(--sub-color) 35%, transparent)"
              }
              stroke={
                i < props.stars
                  ? "color-mix(in srgb, var(--color-game-gold) 60%, black)"
                  : "transparent"
              }
              stroke-width="1.2"
              stroke-linejoin="round"
            ></path>
          </svg>
        )}
      </For>
    </div>
  );
}

import { JSXElement } from "solid-js";

import { cn } from "../../utils/cn";

/** Thin time bar for the top of a game. */
export function TimeBar(props: {
  remaining: number;
  total: number;
}): JSXElement {
  return (
    <div
      class="h-3 w-full overflow-hidden rounded-full bg-sub-alt"
      role="timer"
    >
      <div
        class={cn(
          "h-full rounded-full transition-[width] duration-100",
          props.remaining / props.total < 0.2 ? "bg-error" : "bg-main",
        )}
        style={{ width: `${(props.remaining / props.total) * 100}%` }}
      ></div>
    </div>
  );
}

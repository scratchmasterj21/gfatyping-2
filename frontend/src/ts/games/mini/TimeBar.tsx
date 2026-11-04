import { JSXElement } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";

/** Chunky countdown bar with the seconds left, for the top of a game. */
export function TimeBar(props: {
  remaining: number;
  total: number;
}): JSXElement {
  const frac = (): number => Math.max(0, props.remaining / props.total);
  return (
    <div
      class="flex w-full items-center gap-2 rounded-full bg-game-cream p-1.5 pr-3 shadow-[0_4px_0_rgb(43_33_64/0.2)]"
      role="timer"
      aria-label={`${Math.ceil(props.remaining)} seconds left`}
    >
      <div class="h-4 flex-1 overflow-hidden rounded-full bg-game-ink/10">
        <div
          class={cn(
            "h-full rounded-full transition-[width] duration-100",
            frac() < 0.2
              ? "bg-game-red"
              : frac() < 0.5
                ? "bg-game-yellow"
                : "bg-game-green",
          )}
          style={{ width: `${frac() * 100}%` }}
        ></div>
      </div>
      <span
        class={cn(
          "flex w-14 items-center justify-end gap-1 text-base font-bold text-game-ink tabular-nums",
          frac() < 0.2 && "text-game-red",
        )}
      >
        <Fa icon="fa-clock" class="text-sm" />
        {Math.ceil(props.remaining)}s
      </span>
    </div>
  );
}

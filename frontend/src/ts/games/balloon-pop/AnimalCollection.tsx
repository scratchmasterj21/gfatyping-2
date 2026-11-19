import { For, JSXElement } from "solid-js";

import type { StarMap } from "./balloon-store";

import { cn } from "../../utils/cn";
import { LEVELS } from "./balloon-rules";

/** Balloon animals: one per level, won with 2+ stars. */
export function AnimalCollection(props: { stars: StarMap }): JSXElement {
  const got = (): number =>
    LEVELS.filter((l) => (props.stars[l.id] ?? 0) >= 2).length;
  return (
    <div class="grid gap-1">
      <div class="text-sm font-bold text-sub">
        🎈 Balloon animals: {got()} / {LEVELS.length}
      </div>
      <div class="grid grid-cols-6 gap-1">
        <For each={LEVELS}>
          {(l) => {
            const have = (): boolean => (props.stars[l.id] ?? 0) >= 2;
            return (
              <div
                class={cn(
                  "grid place-items-center rounded-lg p-1 text-center",
                  have() ? "bg-main/15" : "bg-sub-alt",
                )}
                title={have() ? l.animalName : `2 stars on level ${l.id}`}
              >
                <span class={cn("text-2xl", !have() && "opacity-25 grayscale")}>
                  {l.animal}
                </span>
                <span class="text-[0.6rem] text-sub">
                  {have() ? l.animalName : `Lv ${l.id}`}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

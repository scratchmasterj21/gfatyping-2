import { For, JSXElement, Show } from "solid-js";

import type { StarMap } from "./balloon-store";

import { cn } from "../../utils/cn";
import { LEVELS, levelOpen, Theme } from "./balloon-rules";

const THEME_STYLE: Record<Theme, string> = {
  garden: "bg-game-grass/30",
  beach: "bg-game-sunset/30",
  party: "bg-game-pink/30",
};
const THEME_NAME: Record<Theme, string> = {
  garden: "🌻 Garden",
  beach: "🏖️ Beach",
  party: "🎉 Party",
};

/** The 12 levels: stars, locks, and which one is picked. */
export function LevelMap(props: {
  stars: StarMap;
  selected: number;
  onSelect: (id: number) => void;
}): JSXElement {
  return (
    <div class="grid gap-2">
      <For each={["garden", "beach", "party"] as Theme[]}>
        {(theme) => (
          <div class={cn("grid gap-1 rounded-xl p-2", THEME_STYLE[theme])}>
            <div class="text-sm font-bold text-text">{THEME_NAME[theme]}</div>
            <div class="grid grid-cols-4 gap-2">
              <For each={LEVELS.filter((l) => l.theme === theme)}>
                {(l) => {
                  const open = (): boolean => levelOpen(l.id, props.stars);
                  const stars = (): number => props.stars[l.id] ?? 0;
                  return (
                    <button
                      type="button"
                      disabled={!open()}
                      class={cn(
                        "grid place-items-center gap-0.5 rounded-xl border-2 bg-bg p-1.5 text-center",
                        props.selected === l.id
                          ? "border-main"
                          : "border-transparent",
                        open()
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-50",
                      )}
                      onClick={() => props.onSelect(l.id)}
                    >
                      <span class="text-xl font-bold text-text">
                        {open() ? l.id : "🔒"}
                      </span>
                      <span class="text-xs">
                        {[1, 2, 3]
                          .map((n) => (n <= stars() ? "⭐" : "☆"))
                          .join("")}
                      </span>
                      <Show when={stars() >= 2}>
                        <span class="text-base">{l.animal}</span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

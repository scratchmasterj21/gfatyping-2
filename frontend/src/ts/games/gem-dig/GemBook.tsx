import { For, JSXElement } from "solid-js";

import { cn } from "../../utils/cn";
import { GEM_IDS, GEMS, WORLDS } from "./dig-rules";

/** My gem collection: every gem kind, by world. */
export function GemBook(props: { gems: Record<string, number> }): JSXElement {
  const found = (): number =>
    GEM_IDS.filter((g) => (props.gems[g] ?? 0) > 0).length;
  return (
    <div class="grid gap-1">
      <div class="text-sm font-bold text-sub">
        📖 Gem book: {found()} / {GEM_IDS.length} kinds found
      </div>
      <div class="grid grid-cols-4 gap-1">
        <For each={WORLDS.flatMap((w) => w.gems)}>
          {(g) => {
            const n = (): number => props.gems[g] ?? 0;
            return (
              <div
                class={cn(
                  "grid place-items-center rounded-lg p-1 text-center",
                  n() > 0 ? "bg-main/15" : "bg-sub-alt",
                )}
                title={`${GEMS[g].name} (${WORLDS.find((w) => w.id === GEMS[g].world)?.name ?? ""})`}
              >
                <span
                  class={cn("text-2xl", n() === 0 && "opacity-25 grayscale")}
                >
                  {GEMS[g].emoji}
                </span>
                <span class="text-[0.65rem] text-sub">
                  {n() > 0 ? `${GEMS[g].name} ×${n()}` : "???"}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

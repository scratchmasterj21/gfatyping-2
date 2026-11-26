import { For, JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";

export type DifficultyOption = {
  label: string;
  hint?: string;
};

export function DifficultySegmented<T extends DifficultyOption>(props: {
  options: T[];
  selectedLabel: string;
  onSelect: (option: T) => void;
  compact?: boolean;
  /** Why an option can't be picked (e.g. All Keys not finished yet). */
  lockedReason?: (option: T) => string | undefined;
}): JSXElement {
  return (
    <div class="flex gap-2">
      <For each={props.options}>
        {(d) => {
          const locked = (): string | undefined => props.lockedReason?.(d);
          return (
            <button
              type="button"
              class={cn(
                "press-3d min-h-12 flex-1 rounded-xl font-semibold",
                props.compact ? "px-2 py-2 text-sm" : "px-3 py-3 text-base",
                locked() !== undefined
                  ? "cursor-not-allowed bg-sub-alt text-sub opacity-60"
                  : props.selectedLabel === d.label
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-sub hover:text-text",
              )}
              disabled={locked() !== undefined}
              title={locked()}
              onClick={() => props.onSelect(d)}
            >
              <span class="block">
                <Show when={locked() !== undefined}>
                  <Fa icon="fa-lock" class="mr-1.5" />
                </Show>
                {d.label}
              </span>
              <Show
                when={locked()}
                fallback={
                  <Show when={d.hint !== undefined}>
                    <span class="block text-xs opacity-70">{d.hint}</span>
                  </Show>
                }
              >
                {(why) => <span class="block text-xs opacity-80">{why()}</span>}
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}

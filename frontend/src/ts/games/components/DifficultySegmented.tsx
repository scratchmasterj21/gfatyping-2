import { For, JSXElement, Show } from "solid-js";

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
}): JSXElement {
  return (
    <div class="flex gap-2">
      <For each={props.options}>
        {(d) => (
          <button
            type="button"
            class={cn(
              "flex-1 rounded-lg font-semibold transition-colors",
              props.compact ? "px-2 py-1 text-em-xs" : "px-3 py-1.5 text-em-sm",
              props.selectedLabel === d.label
                ? "bg-main text-bg"
                : "bg-sub-alt text-sub hover:text-text",
            )}
            onClick={() => props.onSelect(d)}
          >
            <span class="block">{d.label}</span>
            <Show when={d.hint !== undefined}>
              <span class="block text-xs opacity-70">{d.hint}</span>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}

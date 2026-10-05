import { createMemo, createSignal, For, JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { WordListOption } from "../word-defender/systems/vocab-pool";
import { WordListGroup } from "./groupWordListOptions";

export function WordListPicker(props: {
  groups: WordListGroup[];
  selectedId: string;
  onSelect: (option: WordListOption) => void;
  filterable?: boolean;
  listClass?: string;
}): JSXElement {
  const [filter, setFilter] = createSignal("");
  const filteredGroups = createMemo((): WordListGroup[] => {
    const q = filter().trim().toLowerCase();
    if (q.length === 0) return props.groups;
    return props.groups
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            g.group.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  });

  return (
    <div class="grid gap-2">
      <Show when={props.filterable !== false}>
        <input
          type="search"
          class="w-full rounded-lg border border-main/20 bg-bg px-3 py-2 text-em-sm text-text placeholder:text-sub"
          placeholder="Filter word lists…"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      </Show>
      <div
        class={cn(
          "max-h-72 overflow-y-auto rounded-lg border border-main/20 bg-sub-alt",
          props.listClass,
        )}
      >
        <For each={filteredGroups()}>
          {(g) => (
            <div>
              <div class="sticky top-0 bg-sub-alt px-3 py-1.5 text-em-xs font-bold tracking-widest text-sub uppercase">
                {g.group}
              </div>
              <For each={g.items}>
                {(opt) => (
                  <button
                    type="button"
                    class={cn(
                      "w-full border-l-2 px-4 py-2 text-left text-em-sm transition-colors",
                      props.selectedId === opt.id
                        ? "border-main bg-bg text-text ring-1 ring-main/30"
                        : "border-transparent text-sub hover:bg-bg/60 hover:text-text",
                    )}
                    onClick={() => props.onSelect(opt)}
                  >
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

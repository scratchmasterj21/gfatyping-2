import { For, JSXElement, Show } from "solid-js";

import type { TableEntry } from "./table-entry";

import { cn } from "../../../utils/cn";
import { RankRow, RankRowVariant } from "./RankRow";

export function TopThreePodium(props: {
  type: "speed" | "xp" | "racewpm" | "raceacc";
  entries: TableEntry[];
  friendsOnly: boolean;
  compactXp?: boolean;
  enabled: boolean;
  selfUid?: string;
}): JSXElement {
  const topThree = () =>
    props.enabled
      ? props.entries.filter((e) => (e.rank ?? 99) <= 3).slice(0, 3)
      : [];

  const ordered = () => {
    const t = topThree();
    if (t.length < 2) return [];
    return [...t].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  };

  const variantFor = (entry: TableEntry): RankRowVariant => ({
    kind: "entry",
    type: props.type,
    entry,
    friendsOnly: props.friendsOnly,
    compactXp: props.compactXp,
  });

  return (
    <Show when={ordered().length >= 2}>
      <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
        <For each={ordered()}>
          {(entry) => (
            <div class="rankings-podium-slot flex min-w-0 flex-col justify-end">
              <RankRow
                rank={entry.rank ?? 0}
                variant={variantFor(entry)}
                selfUid={props.selfUid}
                class={cn(entry.rank === 1 && "ring-2 ring-main/40")}
              />
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

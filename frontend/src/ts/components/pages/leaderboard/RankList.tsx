import { For, JSXElement } from "solid-js";

import type { TableEntry } from "./Table";

import { cn } from "../../../utils/cn";
import { RankRow, RankRowVariant } from "./RankRow";

export function RankList(props: {
  type: "speed" | "xp" | "racewpm" | "raceacc";
  entries: TableEntry[];
  friendsOnly: boolean;
  compactXp?: boolean;
  skipTop?: number;
  selfUid?: string;
  class?: string;
}): JSXElement {
  const rows = () => props.entries.slice(props.skipTop ?? 0);

  const variantFor = (entry: TableEntry): RankRowVariant => ({
    kind: "entry",
    type: props.type,
    entry,
    friendsOnly: props.friendsOnly,
    compactXp: props.compactXp,
  });

  const rankFor = (entry: TableEntry, index: number): number => {
    if (entry.rank !== undefined) return entry.rank;
    const base = (props.skipTop ?? 0) + index;
    return base + 1;
  };

  return (
    <div class={cn("grid gap-1", props.class)}>
      <For each={rows()}>
        {(entry, i) => (
          <RankRow
            rank={rankFor(entry, i())}
            variant={variantFor(entry)}
            selfUid={props.selfUid}
          />
        )}
      </For>
    </div>
  );
}

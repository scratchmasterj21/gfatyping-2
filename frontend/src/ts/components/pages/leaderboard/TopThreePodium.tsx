import { For, JSXElement, Show } from "solid-js";

import type { TableEntry } from "./table-entry";

import { getUserId } from "../../../states/core";
import { cn } from "../../../utils/cn";
import { UserAvatar } from "../../common/UserAvatar";
import { rankMedal } from "./RankDisplay";
import { rankRowStats, RankRowVariant } from "./RankRow";

// Visual order on the podium: 2nd left, 1st middle, 3rd right.
const PODIUM_ORDER = [2, 1, 3] as const;

const STEP_HEIGHT: Record<number, string> = {
  1: "h-24 sm:h-28",
  2: "h-16 sm:h-20",
  3: "h-12 sm:h-14",
};

export function TopThreePodium(props: {
  type: "speed" | "xp" | "racewpm" | "raceacc";
  entries: TableEntry[];
  friendsOnly: boolean;
  compactXp?: boolean;
  enabled: boolean;
  selfUid?: string;
}): JSXElement {
  const topThree = (): TableEntry[] =>
    props.enabled
      ? props.entries.filter((e) => (e.rank ?? 99) <= 3).slice(0, 3)
      : [];

  /** Entries in podium order; a missing 3rd place just leaves its step out. */
  const slots = (): TableEntry[] => {
    const t = topThree();
    if (t.length < 2) return [];
    return PODIUM_ORDER.flatMap((rank) => {
      const entry = t.find((e) => e.rank === rank);
      return entry === undefined ? [] : [entry];
    });
  };

  const variantFor = (entry: TableEntry): RankRowVariant => ({
    kind: "entry",
    type: props.type,
    entry,
    friendsOnly: props.friendsOnly,
    compactXp: props.compactXp,
  });

  const isSelf = (entry: TableEntry): boolean =>
    entry.uid === props.selfUid || entry.uid === getUserId();

  return (
    <Show when={slots().length >= 2}>
      <div
        class="grid grid-cols-3 items-end gap-2 font-kid sm:gap-4"
        data-ui-element="rankingsPodium"
        role="list"
        aria-label="Top 3"
      >
        <For each={slots()}>
          {(entry) => {
            const rank = (): number => entry.rank ?? 0;
            const first = (): boolean => rank() === 1;
            const stats = () => rankRowStats(variantFor(entry));
            return (
              <div
                class={cn(
                  "flex min-w-0 flex-col items-center",
                  // keep the visual order even if an entry is missing
                  rank() === 2 && "col-start-1",
                  rank() === 1 && "col-start-2",
                  rank() === 3 && "col-start-3",
                )}
                role="listitem"
                data-rank-user={isSelf(entry) ? "" : undefined}
              >
                <div class="relative">
                  <UserAvatar
                    uid={entry.uid}
                    size={first() ? 88 : 64}
                    celebrate={first()}
                  />
                  <span
                    class={cn(
                      "absolute -right-2 -bottom-1 leading-none drop-shadow",
                      first() ? "text-4xl" : "text-3xl",
                    )}
                    aria-hidden="true"
                  >
                    {rankMedal(rank())}
                  </span>
                </div>
                <div
                  class={cn(
                    "mt-2 w-full text-center leading-tight font-semibold break-words text-text",
                    first() ? "text-lg" : "text-base",
                  )}
                >
                  {entry.name}
                  <Show when={isSelf(entry)}>
                    <span class="text-sub"> (you)</span>
                  </Show>
                </div>
                <div
                  class={cn(
                    "mt-1 rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap",
                    first() ? "bg-main text-bg" : "bg-sub-alt text-text",
                  )}
                >
                  {stats().primary}
                </div>
                <div
                  class={cn(
                    "mt-2 flex w-full items-start justify-center rounded-t-[calc(var(--roundness)*2)] pt-2 text-2xl font-bold",
                    STEP_HEIGHT[rank()],
                    first() ? "bg-main/25 text-main" : "bg-sub-alt text-sub",
                    isSelf(entry) && "outline-2 outline-main",
                  )}
                  aria-label={`Rank ${rank()}`}
                >
                  {rank()}
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}

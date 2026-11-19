import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { DailyCollection, getDailyClassBoard } from "../shared/daily-board";

/** Today's top classes for a daily challenge (one doc read, cached 5 min). */
export function DailyClassBoard(props: {
  collection: DailyCollection;
  day: number;
  /** after the number, e.g. "hits" */
  unit?: string;
}): JSXElement {
  const board = useQuery(() => ({
    queryKey: [props.collection, props.day],
    queryFn: async () => getDailyClassBoard(props.collection, props.day),
    staleTime: 5 * 60 * 1000,
    enabled: getAuthenticatedUser() !== null,
  }));
  const myClass = (): string | undefined => getSnapshot()?.classId;
  return (
    <div class="grid gap-1">
      <div class="text-sm font-bold text-sub">🏆 Top classes today</div>
      <Show
        when={(board.data ?? []).length > 0}
        fallback={
          <div class="text-sm text-sub">
            {board.isLoading
              ? "Loading…"
              : "No class has played yet - be the first!"}
          </div>
        }
      >
        <For each={(board.data ?? []).slice(0, 6)}>
          {(row, i) => (
            <div
              class={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1 text-sm",
                row.classId === myClass() ? "bg-main text-bg" : "bg-bg",
              )}
            >
              <span class="w-6 font-bold">
                {["🥇", "🥈", "🥉"][i()] ?? `${i() + 1}.`}
              </span>
              <span class="font-bold">{row.classId}</span>
              <span class="flex-1 truncate opacity-80">{row.name}</span>
              <span class="font-mono font-bold tabular-nums">
                {row.score}
                {props.unit === undefined ? "" : ` ${props.unit}`}
              </span>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

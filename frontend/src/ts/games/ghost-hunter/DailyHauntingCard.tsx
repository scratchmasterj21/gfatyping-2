import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { DAILY_WAVES, dailyPlan, getDailyBoard } from "./daily-haunting";

/** Free play or today's Daily Haunting, with the best classes today. */
export function DailyHauntingCard(props: {
  day: number;
  selected: boolean;
  onSelect: (daily: boolean) => void;
}): JSXElement {
  const plan = (): ReturnType<typeof dailyPlan> => dailyPlan(props.day);
  const board = useQuery(() => ({
    queryKey: ["dailyGhost", props.day],
    queryFn: async () => getDailyBoard(props.day),
    staleTime: 5 * 60 * 1000,
    // only read when the card is open
    enabled: props.selected && getAuthenticatedUser() !== null,
  }));
  const myClass = (): string | undefined => getSnapshot()?.classId;

  return (
    <div class="grid gap-2">
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class={cn(
            "press-3d cursor-pointer rounded-xl p-2 font-kid text-lg font-bold",
            !props.selected
              ? "bg-main text-bg"
              : "bg-sub-alt text-text hover:bg-text hover:text-bg",
          )}
          onClick={() => props.onSelect(false)}
        >
          👻 Free play
        </button>
        <button
          type="button"
          class={cn(
            "press-3d cursor-pointer rounded-xl p-2 font-kid text-lg font-bold",
            props.selected
              ? "bg-main text-bg"
              : "bg-sub-alt text-text hover:bg-text hover:text-bg",
          )}
          onClick={() => props.onSelect(true)}
        >
          🗓️ Daily haunting
        </button>
      </div>
      <Show when={props.selected}>
        <div class="grid gap-2 rounded-xl bg-sub-alt p-3 font-kid text-text">
          <div class="grid gap-0.5">
            <div class="font-bold">🏚️ Today: {plan().label}</div>
            <div class="text-xs text-sub">
              Same ghosts for everyone today · Medium · {DAILY_WAVES} waves · 👑
              Ghost King at the end · best score wins for your class
            </div>
          </div>
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
            <div class="grid gap-1">
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
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

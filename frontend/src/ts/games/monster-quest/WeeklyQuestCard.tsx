import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { MONSTER_ART } from "./quest-monsters";
import { LANDS, MONSTER_INFO, TWISTS, weeklyPlan } from "./quest-rules";
import { formatQuestTime, getWeeklyBoard } from "./weekly-quest-db";

/** This week's quest for the whole school, and the fastest classes. */
export function WeeklyQuestCard(props: {
  week: number;
  selected: boolean;
  onSelect: (weekly: boolean) => void;
}): JSXElement {
  const plan = (): ReturnType<typeof weeklyPlan> => weeklyPlan(props.week);
  const board = useQuery(() => ({
    queryKey: ["weeklyQuest", props.week],
    queryFn: async () => getWeeklyBoard(props.week),
    staleTime: 5 * 60 * 1000,
    enabled: getAuthenticatedUser() !== null,
  }));
  const myClass = (): string | undefined => getSnapshot()?.classId;
  const twist = (): (typeof TWISTS)[keyof typeof TWISTS] =>
    TWISTS[plan().twist];

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
          🗺️ Free quest
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
          🗓️ Weekly quest
        </button>
      </div>
      <Show when={props.selected}>
        <div class="grid gap-2 rounded-xl bg-sub-alt p-3 font-kid text-text">
          <div class="flex items-center gap-3">
            <img
              src={MONSTER_ART[plan().boss]}
              alt=""
              class="h-14 w-14 object-contain [image-rendering:pixelated]"
            />
            <div class="grid flex-1 gap-0.5">
              <div class="font-bold">
                {LANDS[plan().land].emoji} {LANDS[plan().land].name} · 👑{" "}
                {MONSTER_INFO[plan().boss].name}
              </div>
              <div class="text-sm">
                {twist().emoji} <span class="font-bold">{twist().name}</span>:{" "}
                {twist().tip}
              </div>
              <div class="text-xs text-sub">
                Same quest for everyone this week · Medium words · fastest clear
                wins for your class
              </div>
            </div>
          </div>
          <div class="text-sm font-bold text-sub">⏱️ Fastest classes</div>
          <Show
            when={(board.data ?? []).length > 0}
            fallback={
              <div class="text-sm text-sub">
                {board.isLoading
                  ? "Loading…"
                  : "No class has cleared it yet - be the first!"}
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
                      {formatQuestTime(row.ms)}
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

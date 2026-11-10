import { useQuery } from "@tanstack/solid-query";
import {
  createMemo,
  createSignal,
  For,
  JSXElement,
  onMount,
  Show,
} from "solid-js";

import {
  evaluateAchievements,
  getEarnedAchievements,
} from "../../../achievements/achievements";
import { achievements } from "../../../achievements/achievements-data";
import { queryClient } from "../../../queries";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { ACHIEVEMENT_GROUPS } from "./stats-helpers";

/**
 * Achievements, shorter: earned badges by group (speed, practice, lessons,
 * races, levels) with a count each, and the full list behind "See all".
 */
export function AchievementsSummary(): JSXElement {
  const [showAll, setShowAll] = createSignal(false);
  onMount(() => {
    void evaluateAchievements().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["achievements"] });
    });
  });
  const earnedQuery = useQuery(() => ({
    queryKey: ["achievements"],
    queryFn: getEarnedAchievements,
  }));
  const isEarned = (id: string): boolean => earnedQuery.data?.has(id) === true;
  const earnedCount = createMemo(
    () => achievements.filter((a) => isEarned(a.id)).length,
  );
  const groups = createMemo(() =>
    ACHIEVEMENT_GROUPS.map((g) => {
      const list = achievements.filter((a) => g.match(a.id));
      return { ...g, list, earned: list.filter((a) => isEarned(a.id)) };
    }).filter((g) => g.list.length > 0),
  );

  return (
    <div class="grid gap-3 rounded-xl bg-sub-alt p-4 font-kid">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xl font-bold text-text">
          🏅 Achievements{" "}
          <span class="text-base font-normal text-sub">
            {earnedCount()} of {achievements.length}
          </span>
        </span>
        <button
          type="button"
          class="cursor-pointer rounded-full bg-bg px-3 py-1 text-sm text-text hover:bg-main hover:text-bg"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll() ? "Show less" : "See all achievements"}
        </button>
      </div>

      <div class="grid gap-2 md:grid-cols-2">
        <For each={groups()}>
          {(g) => (
            <div class="grid gap-2 rounded-xl bg-bg p-3">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-text">
                  {g.emoji} {g.name}
                </span>
                <span class="text-sm text-sub">
                  {g.earned.length}/{g.list.length}
                </span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <For each={g.list}>
                  {(a) => (
                    <span
                      class={cn(
                        "grid h-9 w-9 place-items-center rounded-full",
                        isEarned(a.id)
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-sub opacity-50",
                      )}
                      title={`${a.name}: ${a.description}${isEarned(a.id) ? "" : " (locked)"}`}
                    >
                      <Fa icon={isEarned(a.id) ? a.icon : "fa-lock"} />
                    </span>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={showAll()}>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <For each={achievements}>
            {(a) => (
              <div
                class={cn(
                  "flex items-start gap-3 rounded-xl bg-bg p-3",
                  !isEarned(a.id) && "opacity-45",
                )}
              >
                <Fa
                  icon={a.icon}
                  fixedWidth
                  size={1.25}
                  class={cn(
                    "mt-0.5",
                    isEarned(a.id) ? "text-main" : "text-sub",
                  )}
                />
                <div class="grid gap-0.5">
                  <span class="leading-tight text-text">{a.name}</span>
                  <span class="text-xs leading-tight text-sub">
                    {a.description}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

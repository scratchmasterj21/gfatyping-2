import { For, JSXElement, Show } from "solid-js";

import { WEEKLY_QUESTS } from "../../../coins";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

/** Picks a friendly icon per quest from what it counts. */
function questIcon(counterKey: string, unit?: string): FaSolidIcon {
  if (unit === "seconds") return "fa-clock";
  if (counterKey.toLowerCase().includes("lesson")) return "fa-book-open";
  return "fa-star";
}

export function WeeklyQuests(props: {
  progress: Record<string, number>;
  claimed: string[];
}): JSXElement {
  const allClaimed = (): boolean =>
    WEEKLY_QUESTS.every((quest) => props.claimed.includes(quest.id));

  return (
    <div class="grid gap-3 rounded-double bg-sub-alt/80 p-4 font-kid">
      <div class="flex items-center gap-2 text-base font-semibold text-text">
        <Fa icon="fa-flag-checkered" class="text-main" />
        This week&apos;s quests
      </div>
      <Show when={allClaimed()}>
        <p class="text-sm font-semibold text-main">
          All weekly quests done - nice!
        </p>
      </Show>
      <div class="grid gap-3 sm:grid-cols-2">
        <For each={WEEKLY_QUESTS}>
          {(quest) => {
            const current = (): number =>
              Math.min(props.progress[quest.counterKey] ?? 0, quest.target);
            const done = (): boolean => props.claimed.includes(quest.id);
            const percent = (): number => (current() / quest.target) * 100;
            const formatProgress = (value: number): string =>
              quest.unit === "seconds"
                ? `${Math.round(value / 60)} min`
                : `${value}`;
            return (
              <div
                class={cn(
                  "flex items-center gap-3 rounded-xl bg-bg p-3",
                  done() && "outline-2 outline-main",
                )}
              >
                <span
                  class={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                    done() ? "bg-main text-bg" : "bg-sub-alt text-main",
                  )}
                >
                  <Fa
                    icon={
                      done()
                        ? "fa-check"
                        : questIcon(quest.counterKey, quest.unit)
                    }
                    size={1.1}
                  />
                </span>
                <div class="grid min-w-0 flex-1 gap-1.5">
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-sm font-semibold text-text">
                      {quest.description}
                    </span>
                    <span class="flex shrink-0 items-center gap-1 rounded-full bg-sub-alt px-2 py-0.5 text-xs font-bold text-main">
                      <Fa icon="fa-coins" size={0.85} />
                      {quest.coinReward}
                    </span>
                  </div>
                  <div class="h-2.5 rounded-full bg-sub-alt">
                    <div
                      class="h-2.5 rounded-full bg-main transition-[width]"
                      style={{ width: `${Math.min(100, percent())}%` }}
                    ></div>
                  </div>
                  <span
                    class={cn(
                      "text-xs font-semibold",
                      done() ? "text-main" : "text-sub",
                    )}
                  >
                    <Show when={!done()} fallback="Done - coins added!">
                      {formatProgress(current())} /{" "}
                      {formatProgress(quest.target)}
                    </Show>
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

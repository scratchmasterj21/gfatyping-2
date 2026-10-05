import { For, JSXElement, Show } from "solid-js";

import { WEEKLY_QUESTS } from "../../../coins";
import { Fa } from "../../common/Fa";

export function WeeklyQuests(props: {
  progress: Record<string, number>;
  claimed: string[];
}): JSXElement {
  const allClaimed = (): boolean =>
    WEEKLY_QUESTS.every((quest) => props.claimed.includes(quest.id));

  return (
    <div class="grid gap-3 rounded-xl bg-sub-alt/80 p-3">
      <div class="flex items-center gap-2 text-sm font-medium text-text">
        <Fa icon="fa-flag-checkered" class="text-main" size={0.85} />
        This week&apos;s quests
      </div>
      <Show when={allClaimed()}>
        <p class="text-em-xs text-main">All weekly quests done — nice!</p>
      </Show>
      <For each={WEEKLY_QUESTS}>
        {(quest) => {
          const current = (): number =>
            Math.min(props.progress[quest.counterKey] ?? 0, quest.target);
          const done = (): boolean => props.claimed.includes(quest.id);
          const percent = (): number => (current() / quest.target) * 100;
          const formatProgress = (value: number): string =>
            quest.unit === "seconds"
              ? `${Math.round(value / 60)}m`
              : `${value}`;
          return (
            <div class="grid gap-1">
              <div class="flex items-center justify-between text-em-xs">
                <span class={done() ? "text-main" : "text-text"}>
                  <Show when={done()}>
                    <Fa icon="fa-check-circle" class="mr-1" />
                  </Show>
                  {quest.description}
                </span>
                <span class="flex items-center gap-1 text-sub">
                  <Fa icon="fa-coins" size={0.7} />
                  {quest.coinReward}
                </span>
              </div>
              <div class="h-1 rounded-full bg-bg">
                <div
                  class="h-1 rounded-full bg-main transition-[width]"
                  style={{ width: `${Math.min(100, percent())}%` }}
                ></div>
              </div>
              <span class="text-em-xs text-sub">
                {formatProgress(current())}/{formatProgress(quest.target)}
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
}

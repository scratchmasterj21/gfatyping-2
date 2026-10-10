import { JSXElement, onMount, Show } from "solid-js";

import {
  DAILY_GOAL_SECONDS,
  getDailyGoalSeconds,
  refreshDailyGoal,
} from "../../../states/daily-goal";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DailyGoalRing(props: { class?: string }): JSXElement {
  onMount(refreshDailyGoal);

  const pct = (): number =>
    Math.min(1, getDailyGoalSeconds() / DAILY_GOAL_SECONDS);
  const minutes = (): number => Math.floor(getDailyGoalSeconds() / 60);
  const done = (): boolean => pct() >= 1;

  return (
    <div
      class={cn(
        "flex items-center gap-3 rounded-2xl bg-sub-alt px-4 py-2",
        props.class,
      )}
    >
      <svg
        viewBox="0 0 40 40"
        class="h-10 w-10 shrink-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke-width="5"
          class="stroke-bg"
        ></circle>
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke-width="5"
          stroke-linecap="round"
          class="stroke-main transition-[stroke-dashoffset] duration-500"
          style={{
            "stroke-dasharray": String(CIRCUMFERENCE),
            "stroke-dashoffset": String(CIRCUMFERENCE * (1 - pct())),
          }}
        ></circle>
      </svg>
      <div class="grid">
        <span class="font-bold text-text">
          <Show when={done()} fallback={`${minutes()} / 10 minutes today`}>
            <Fa icon="fa-star" class="mr-1.5 text-main" />
            Daily goal done!
          </Show>
        </span>
        <span class="text-em-xs text-sub">
          <Show when={done()} fallback="Type for 10 minutes to fill the ring">
            You typed {minutes()} minutes today. Great job!
          </Show>
        </span>
      </div>
    </div>
  );
}

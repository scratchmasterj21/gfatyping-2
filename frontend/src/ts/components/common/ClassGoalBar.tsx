import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

export function ClassGoalBar(props: {
  classId: string;
  current: number;
  goal: number;
  reward: string;
  class?: string;
}): JSXElement {
  const pct = (): number =>
    Math.min(100, Math.round((props.current / Math.max(1, props.goal)) * 100));
  const done = (): boolean => props.current >= props.goal;

  return (
    <section
      class={cn("rounded-2xl bg-sub-alt p-4", props.class)}
      data-ui-element="classGoalBar"
    >
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-bold text-text">
          <Fa
            icon={done() ? "fa-trophy" : "fa-flag-checkered"}
            class="text-main"
          />
          {props.classId} class goal
          <Show when={props.reward !== ""}>
            <span class="font-normal text-sub">· {props.reward}</span>
          </Show>
        </span>
        <span class="text-sm font-bold text-main">
          <Fa icon="fa-star" class="mr-1" size={0.85} />
          {Math.min(props.current, props.goal)} / {props.goal}
        </span>
      </div>
      <div class="h-4 overflow-hidden rounded-full bg-bg">
        <div
          class="h-full rounded-full bg-main transition-[width] duration-700"
          style={{ width: `${pct()}%` }}
        ></div>
      </div>
      <div class="mt-2 text-em-xs text-sub">
        <Show
          when={done()}
          fallback={`${props.goal - props.current} more stars to go — every lesson helps your class!`}
        >
          Goal reached! Amazing teamwork, {props.classId}!
        </Show>
      </div>
    </section>
  );
}

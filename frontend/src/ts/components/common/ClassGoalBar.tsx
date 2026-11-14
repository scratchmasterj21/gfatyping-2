import { JSXElement, Show } from "solid-js";

import { ClassGoalKind, goalUnit } from "../../classroom/class-goals";
import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

export function ClassGoalBar(props: {
  classId: string;
  kind?: ClassGoalKind;
  current: number;
  goal: number;
  reward: string;
  class?: string;
}): JSXElement {
  const pct = (): number =>
    Math.min(100, Math.round((props.current / Math.max(1, props.goal)) * 100));
  const done = (): boolean => props.current >= props.goal;
  const kind = (): ClassGoalKind => props.kind ?? "stars";
  const unit = (n: number): string => goalUnit(kind(), n);

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
          <Show when={kind() !== "stars"}>
            <span class="font-normal text-sub">(this week)</span>
          </Show>
          <Show when={props.reward !== ""}>
            <span class="font-normal text-sub">· {props.reward}</span>
          </Show>
        </span>
        <span class="text-sm font-bold text-main">
          {Math.min(props.current, props.goal)} / {props.goal}{" "}
          {unit(props.goal)}
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
          fallback={`${props.goal - props.current} more ${unit(props.goal - props.current)} to go${kind() === "stars" ? "" : " (resets Monday)"}`}
        >
          Goal reached! Amazing teamwork, {props.classId}!
        </Show>
      </div>
    </section>
  );
}

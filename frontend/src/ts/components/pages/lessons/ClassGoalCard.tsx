import { For, JSXElement, Show } from "solid-js";

import { weekDates } from "../../../classroom/activity";
import {
  ClassGoalKind,
  GOAL_KIND_EMOJI,
  goalUnit,
} from "../../../classroom/class-goals";
import { Confetti } from "../../../games/mini/Confetti";
import { cn } from "../../../utils/cn";

const MILESTONES = [25, 50, 75];

/** Big, kid-friendly class goal on the Learn tab. */
export function ClassGoalCard(props: {
  classId: string;
  kind: ClassGoalKind;
  current: number;
  goal: number;
  reward: string;
  /** what this student added (weekly goals only) */
  mine?: number;
}): JSXElement {
  const weekly = (): boolean => props.kind !== "stars";
  const pct = (): number =>
    Math.min(100, Math.round((props.current / Math.max(1, props.goal)) * 100));
  const done = (): boolean => props.current >= props.goal;
  const left = (): number => Math.max(0, props.goal - props.current);
  const daysLeft = (): number => 8 - weekDates().length;
  const unit = (n: number): string => goalUnit(props.kind, n);
  const emoji = (): string => GOAL_KIND_EMOJI[props.kind];

  return (
    <section
      class={cn(
        "relative overflow-hidden rounded-2xl p-5 font-kid",
        done() ? "bg-main/15 ring-4 ring-main" : "bg-sub-alt",
      )}
      data-ui-element="classGoalCard"
    >
      <Show when={done()}>
        <Confetti />
      </Show>

      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-2xl font-bold text-text sm:text-3xl">
            {done() ? "🎉 We did it!" : "🚀 Our class goal"}
          </div>
          <div class="mt-1 text-lg text-sub">
            {emoji()} {props.goal}{" "}
            {weekly() && props.kind === "weekLessons" && "⭐⭐ "}
            {unit(props.goal)}
            {weekly() ? " this week" : ""} together
          </div>
        </div>
        <Show when={props.reward !== ""}>
          <div class="rounded-xl bg-bg px-4 py-2 text-lg font-bold text-main">
            🎁 {props.reward}
          </div>
        </Show>
      </div>

      {/* the track: rocket flies toward the flag */}
      <div class="relative mx-4 mt-8 mb-2">
        <div class="h-6 overflow-hidden rounded-full bg-bg">
          <div
            class="h-full rounded-full bg-main transition-[width] duration-1000"
            style={{ width: `${pct()}%` }}
          ></div>
        </div>
        <For each={MILESTONES}>
          {(m) => (
            <span
              class={cn(
                "absolute top-1/2 size-3 -translate-1/2 rounded-full",
                pct() >= m ? "bg-bg" : "bg-sub",
              )}
              style={{ left: `${m}%` }}
            ></span>
          )}
        </For>
        <span
          class="absolute -top-9 -translate-x-1/2 text-4xl transition-[left] duration-1000"
          style={{ left: `${pct()}%` }}
          aria-hidden="true"
        >
          {done() ? "🏆" : "🚀"}
        </span>
        <Show when={!done()}>
          <span
            class="absolute -top-8 right-0 translate-x-1/2 text-3xl"
            aria-hidden="true"
          >
            🏁
          </span>
        </Show>
      </div>

      <div class="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div class="text-lg text-text">
          <Show
            when={done()}
            fallback={
              <>
                Only <b class="text-main">{left()}</b> more {unit(left())} to
                go!
              </>
            }
          >
            Amazing teamwork, {props.classId}!
          </Show>
          <Show when={props.mine !== undefined && props.mine > 0}>
            <span class="ml-2 text-sub">· You added {props.mine} 🙌</span>
          </Show>
        </div>
        <div class="text-right">
          <div class="text-3xl font-bold text-main">
            {Math.min(props.current, props.goal)}
            <span class="text-xl text-sub"> / {props.goal}</span>
          </div>
          <Show when={weekly()}>
            <div class="text-sm text-sub">
              {daysLeft() === 1 ? "Last day!" : `${daysLeft()} days left`}
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}

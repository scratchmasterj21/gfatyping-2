import { JSXElement, Show } from "solid-js";

import { Fa } from "../../common/Fa";
import { PracticeRecommendation } from "./LessonHero";

/** The one huge "do this next" button at the top of the Learn tab. */
export function NextStepCard(props: {
  recommendation: PracticeRecommendation;
  todayPracticeDone: number;
  rewardLabel: string;
  loading: boolean;
}): JSXElement {
  return (
    <section class="grid gap-2 font-kid" aria-labelledby="next-step-title">
      <div class="flex items-end justify-between gap-3">
        <h1
          id="next-step-title"
          class="lesson-hero-heading text-[1.65em] font-bold text-text sm:text-[1.85em]"
        >
          Your next step
        </h1>
        <span class="shrink-0 rounded bg-sub-alt px-3 py-1 text-sm font-bold text-main">
          {props.todayPracticeDone}/3 done today
        </span>
      </div>
      <button
        type="button"
        class="press-3d grid min-h-28 cursor-pointer gap-1 rounded-double bg-main px-5 py-4 text-left text-bg [--press-color:color-mix(in_srgb,var(--main-color)_60%,black)] [--press-depth:0.375rem] hover:opacity-95 disabled:opacity-50"
        onClick={() => props.recommendation.onStart()}
        disabled={props.loading}
      >
        <span class="flex items-center gap-2 text-base font-semibold">
          <Fa icon={props.recommendation.icon} />
          {props.recommendation.eyebrow}
        </span>
        <span class="flex items-center justify-between gap-3 text-3xl font-bold">
          {props.recommendation.title}
          <Fa icon="fa-play-circle" size={1.3} />
        </span>
        <span class="text-base opacity-90">
          {props.recommendation.description}
        </span>
      </button>
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-sub">
        <span>
          <Fa icon="fa-clock" class="mr-1.5" />
          3–5 minutes
          <span class="ml-3 text-main">{props.rewardLabel}</span>
        </span>
        <Show when={props.recommendation.onScrollToTarget !== undefined}>
          <button
            type="button"
            class="min-h-10 cursor-pointer font-semibold text-text hover:text-main"
            onClick={() => props.recommendation.onScrollToTarget?.()}
          >
            <Fa icon="fa-map-marker-alt" class="mr-1.5" />
            Show me where
          </button>
        </Show>
      </div>
    </section>
  );
}

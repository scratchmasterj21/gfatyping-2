import { JSXElement, Show } from "solid-js";

import { tipOfTheDay } from "../../../lessons/typing-tips";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";

function PracticeCard(props: {
  icon: FaSolidIcon;
  title: string;
  subtitle: string;
  reward?: string;
  done: boolean;
  action: string;
  loading?: boolean;
  onStart: () => void;
}): JSXElement {
  return (
    <button
      type="button"
      class="press-3d flex min-h-28 cursor-pointer items-center gap-4 rounded-double bg-sub-alt p-4 text-left text-text hover:bg-text hover:text-bg disabled:opacity-60"
      disabled={props.loading === true}
      onClick={() => props.onStart()}
    >
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-bg">
        <Fa
          icon={props.loading === true ? "fa-circle-notch" : props.icon}
          class={cn("text-main", props.loading === true ? "fa-spin" : "")}
          size={1.6}
        />
      </span>
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="text-xl font-bold">{props.title}</span>
        <span class="text-sm opacity-80">{props.subtitle}</span>
        <Show when={props.reward}>
          <span class="text-sm text-main">{props.reward}</span>
        </Show>
      </span>
      <Show
        when={props.done}
        fallback={
          <span class="shrink-0 rounded-xl bg-main px-3 py-2 text-base font-bold text-bg">
            {props.action}
          </span>
        }
      >
        <span class="flex shrink-0 items-center gap-1.5 text-base font-bold text-main">
          <Fa icon="fa-check-circle" /> Done
        </span>
      </Show>
    </button>
  );
}

/** Practice tab: today's challenge, tricky keys, free typing + a tip. */
export function DailyPracticeCards(props: {
  dailyChallengeName: string;
  dailyChallengeDone: boolean;
  dailyChallengeReward: string;
  onDailyChallenge: () => void;
  adaptiveReward: string;
  adaptiveDoneToday: boolean;
  adaptiveLoading: boolean;
  onAdaptiveReview: () => void;
}): JSXElement {
  const tip = tipOfTheDay();
  return (
    <section class="grid gap-3 font-kid">
      <div class="grid gap-3 sm:grid-cols-2">
        <PracticeCard
          icon="fa-calendar-day"
          title="Today's challenge"
          subtitle={props.dailyChallengeName}
          reward={props.dailyChallengeReward}
          done={props.dailyChallengeDone}
          action="Start"
          onStart={() => props.onDailyChallenge()}
        />
        <PracticeCard
          icon="fa-dumbbell"
          title="Tricky keys"
          subtitle="Practice the keys you miss most"
          reward={props.adaptiveReward}
          done={props.adaptiveDoneToday}
          action="Start"
          loading={props.adaptiveLoading}
          onStart={() => props.onAdaptiveReview()}
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-sub-alt px-3 py-2 text-base text-text">
          <Fa icon="fa-lightbulb" class="text-main" />
          Tip: {tip.text}
        </div>
        <Button
          href="/test"
          router-link
          class="min-h-12 px-4 text-base font-bold"
          text="Free typing"
          fa={{ icon: "fa-keyboard", fixedWidth: true }}
        />
      </div>
    </section>
  );
}

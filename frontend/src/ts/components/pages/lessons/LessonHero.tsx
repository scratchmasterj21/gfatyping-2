import { JSXElement, Show } from "solid-js";

import { AvatarShape } from "../../../avatar/avatar-items";
import { PracticeRewardCategory } from "../../../lessons/lesson-progress";
import { tipOfTheDay } from "../../../lessons/typing-tips";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { Avatar } from "../../common/Avatar";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { DailyGoalRing } from "./DailyGoalRing";
import { WeeklyQuests } from "./WeeklyQuests";

export type PracticeRecommendation = {
  icon: FaSolidIcon;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  onStart: () => void;
  /** Scroll the lesson grid to the next lesson or checkpoint card. */
  onScrollToTarget?: () => void;
};

type AvatarProps = {
  color?: string;
  shape?: AvatarShape;
  hair?: string;
  hat?: string;
  accessory?: string;
  face?: string;
  background?: string;
  highlightColor?: string;
  animalImage?: string;
};

export function LessonHero(props: {
  signedIn: boolean;
  showClassSetupNotice: boolean;
  isNewStudent: boolean;
  streakDays: number;
  streakFreezes: number;
  recommendation: PracticeRecommendation | undefined;
  todayPracticeDone: number;
  practiceRewardLabel: (category: PracticeRewardCategory) => string;
  dailyChallengeName: string;
  dailyChallengeDone: boolean;
  onDailyChallenge: () => void;
  onAdaptiveReview: () => void;
  adaptiveLoading: boolean;
  adaptiveDoneToday: boolean;
  primaryLoading: boolean;
  avatar?: AvatarProps;
  weeklyQuestProgress?: Record<string, number>;
  weeklyQuestClaimed?: string[];
}): JSXElement {
  const tip = tipOfTheDay();
  return (
    <>
      <section class="flex flex-wrap items-center gap-3 rounded-2xl bg-sub-alt px-4 py-3">
        <Show
          when={props.signedIn && props.avatar !== undefined}
          fallback={
            <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-bg">
              <Fa icon="fa-graduation-cap" class="text-main" size={1.4} />
            </div>
          }
        >
          <div class="shrink-0">
            <Avatar
              color={props.avatar?.color}
              shape={props.avatar?.shape}
              hair={props.avatar?.hair}
              hat={props.avatar?.hat}
              accessory={props.avatar?.accessory}
              face={props.avatar?.face}
              background={props.avatar?.background}
              highlightColor={props.avatar?.highlightColor}
              size={56}
              animalImage={props.avatar?.animalImage}
            />
          </div>
        </Show>
        <div class="min-w-0 flex-1 basis-48">
          <p class="lesson-hero-heading text-lg font-bold text-text">
            {props.isNewStudent
              ? "Welcome to your typing lessons!"
              : "Welcome back!"}
          </p>
          <Show when={props.isNewStudent}>
            <p class="mt-1 text-base text-sub">
              Tap the big yellow button to see what to do next. Finish
              checkpoint games when they show up — they unlock the next lesson.
            </p>
          </Show>
          <Show when={props.signedIn}>
            <Button
              variant="text"
              href="/test"
              router-link
              class="mt-1 text-sm text-main"
              text="Free typing practice"
              fa={{ icon: "fa-keyboard", fixedWidth: true }}
            />
          </Show>
        </div>
        <Show when={props.signedIn}>
          <DailyGoalRing class="bg-bg" />
        </Show>
        <Show when={props.streakDays > 0}>
          <div class="flex items-center gap-2 rounded-2xl bg-bg px-4 py-3 text-main">
            <Fa icon="fa-fire" />
            <span class="font-bold">{props.streakDays}</span>
            <span class="text-sub">day streak</span>
            <Show when={props.streakFreezes > 0}>
              <span
                class="rounded bg-sub-alt px-1.5 py-0.5 text-em-xs text-sub"
                title="Miss a day and this protects your streak once."
              >
                freeze ready
              </span>
            </Show>
          </div>
        </Show>
      </section>

      <Show when={!props.signedIn}>
        <section class="rounded-2xl bg-sub-alt p-4 text-center text-sub">
          <Fa icon="fa-info-circle" class="mr-2" />
          Sign in to save your lesson progress across devices.
        </section>
      </Show>

      <Show when={props.showClassSetupNotice}>
        <section class="rounded-2xl bg-sub-alt p-4 text-center">
          <div class="font-bold text-text">
            <Fa icon="fa-user-clock" class="mr-2 text-main" />
            Welcome! Your teacher is setting up your class.
          </div>
          <p class="mt-1 text-sm text-sub">
            You can start lessons now. Class assignments and scores will appear
            automatically when ready.
          </p>
        </section>
      </Show>

      <Show when={props.recommendation} keyed>
        {(recommendation) => (
          <section class="grid gap-2" aria-labelledby="today-practice-title">
            <div class="flex items-end justify-between gap-3">
              <div>
                <h1
                  id="today-practice-title"
                  class="lesson-hero-heading text-[1.65em] font-bold text-text sm:text-[1.85em]"
                >
                  Your next step
                </h1>
                <p class="text-sm text-sub">
                  Daily extras and weekly quests are below; the map and lesson
                  list are further down.
                </p>
              </div>
              <span class="shrink-0 rounded bg-sub-alt px-3 py-1 text-sm font-bold text-main">
                {props.todayPracticeDone}/3 done
              </span>
            </div>
            <div class="grid gap-3 rounded-2xl bg-sub-alt p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div class="grid gap-2">
                <div class="flex items-center gap-2 text-em-xs font-medium text-main">
                  <Fa icon={recommendation.icon} />
                  {recommendation.eyebrow}
                </div>
                <div class="text-xl font-bold text-text">
                  {recommendation.title}
                </div>
                <p class="max-w-2xl text-base text-sub">
                  {recommendation.description}
                </p>
                <div class="text-em-xs text-sub">
                  <Fa icon="fa-clock" class="mr-1.5" /> about 3–5 minutes
                  <span class="ml-3 text-main">
                    {props.practiceRewardLabel("recommendation")}
                  </span>
                </div>
                <div class="flex items-center gap-2 rounded-lg bg-bg px-3 py-1.5 text-em-xs text-text">
                  <Fa icon="fa-lightbulb" class="text-main" />
                  Tip: {tip.text}
                </div>
              </div>
              <div class="flex flex-col gap-2 sm:items-stretch">
                <button
                  type="button"
                  class="cursor-pointer rounded-xl bg-main px-6 py-4 text-lg font-bold text-bg transition-opacity hover:opacity-80 disabled:opacity-50"
                  onClick={recommendation.onStart}
                  disabled={props.primaryLoading}
                >
                  {recommendation.action}
                  <Fa icon="fa-arrow-right" class="ml-2" />
                </button>
                <Show when={recommendation.onScrollToTarget !== undefined}>
                  <button
                    type="button"
                    class="cursor-pointer rounded-lg border border-sub-alt bg-bg px-4 py-2 text-sm font-medium text-text transition-colors hover:border-main"
                    onClick={() => recommendation.onScrollToTarget?.()}
                  >
                    <Fa icon="fa-map-marker-alt" class="mr-1.5 text-main" />
                    Show on lesson list
                  </button>
                </Show>
              </div>
            </div>

            <div class="grid gap-2 sm:grid-cols-2">
              <div class="flex items-center justify-between gap-3 rounded-xl bg-sub-alt/80 p-3">
                <div class="grid gap-1">
                  <div class="flex items-center gap-2 text-sm font-medium text-text">
                    <Fa icon="fa-calendar-day" class="text-main" size={0.85} />
                    Today&apos;s Challenge
                  </div>
                  <span class="text-em-xs text-sub">
                    {props.dailyChallengeName}
                  </span>
                  <span class="text-em-xs text-main">
                    {props.practiceRewardLabel("dailyChallenge")}
                  </span>
                </div>
                <Show
                  when={props.dailyChallengeDone}
                  fallback={
                    <button
                      type="button"
                      class="cursor-pointer rounded-lg bg-bg px-3 py-2 text-em-xs text-text transition-colors hover:bg-text hover:text-bg"
                      onClick={props.onDailyChallenge}
                    >
                      start
                    </button>
                  }
                >
                  <span class="flex items-center gap-1.5 text-em-xs text-main">
                    <Fa icon="fa-check-circle" /> done
                  </span>
                </Show>
              </div>

              <div class="flex items-center justify-between gap-3 rounded-xl bg-sub-alt/80 p-3">
                <div class="grid gap-1">
                  <div class="flex items-center gap-2 text-sm font-medium text-text">
                    <Fa icon="fa-dumbbell" class="text-main" size={0.85} />
                    Adaptive Review
                  </div>
                  <span class="text-em-xs text-sub">
                    Practice the keys you miss most
                  </span>
                  <span class="text-em-xs text-main">
                    {props.practiceRewardLabel("adaptive")}
                  </span>
                </div>
                <button
                  type="button"
                  class="cursor-pointer rounded-lg bg-bg px-3 py-2 text-em-xs text-text transition-colors hover:bg-text hover:text-bg"
                  onClick={props.onAdaptiveReview}
                  disabled={props.adaptiveLoading}
                >
                  <Fa
                    icon={
                      props.adaptiveLoading
                        ? "fa-circle-notch"
                        : "fa-arrow-right"
                    }
                    class={cn(props.adaptiveLoading ? "fa-spin" : "")}
                  />
                  <span class="ml-1.5">
                    {props.adaptiveDoneToday ? "Practice again" : "Start"}
                  </span>
                </button>
              </div>
            </div>

            <Show when={props.signedIn}>
              <WeeklyQuests
                progress={props.weeklyQuestProgress ?? {}}
                claimed={props.weeklyQuestClaimed ?? []}
              />
            </Show>
          </section>
        )}
      </Show>
    </>
  );
}

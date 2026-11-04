import { Component } from "solid-js";
import { fn } from "storybook/test";

import preview from "#.storybook/preview";

import { LessonHero } from "../../src/ts/components/pages/lessons/LessonHero";

const meta = preview.meta({
  title: "Lessons/LessonHero",
  component: LessonHero as Component,
  parameters: { layout: "padded" },
});

const base = {
  signedIn: false,
  showClassSetupNotice: false,
  isNewStudent: true,
  streakDays: 4,
  streakFreezes: 1,
  todayPracticeDone: 1,
  practiceRewardLabel: () => "+10 coins",
  dailyChallengeName: "Home row sprint",
  dailyChallengeDone: false,
  onDailyChallenge: fn(),
  onAdaptiveReview: fn(),
  adaptiveLoading: false,
  adaptiveDoneToday: false,
  primaryLoading: false,
};

export const WithNextStep = meta.story({
  render: () => (
    <div class="grid max-w-3xl gap-4 font-kid">
      <LessonHero
        {...base}
        recommendation={{
          icon: "fa-play",
          eyebrow: "Next lesson",
          title: "Home row: F and J",
          description: "Find the bumps on F and J, then type the row.",
          action: "Start",
          onStart: fn(),
          onScrollToTarget: fn(),
        }}
      />
    </div>
  ),
});

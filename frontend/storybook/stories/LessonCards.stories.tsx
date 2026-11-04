import { Component } from "solid-js";

import preview from "#.storybook/preview";

import { LessonCard } from "../../src/ts/components/pages/lessons/LessonCard";
import { lessonGroups } from "../../src/ts/lessons/lessons-data";

const meta = preview.meta({
  title: "Lessons/LessonCard",
  component: LessonCard as Component,
  parameters: { layout: "padded" },
});

const lessons = lessonGroups[0]?.lessons ?? [];

export const States = meta.story({
  render: () => (
    <div class="lessons-student-ui grid max-w-3xl grid-cols-2 gap-3 font-kid sm:grid-cols-3">
      <LessonCard
        lesson={lessons[0]!}
        number={1}
        progress={
          {
            completed: true,
            stars: 3,
            attempts: 2,
            bestWpm: 24,
            lastAt: 1,
          } as never
        }
      />
      <LessonCard lesson={lessons[1]!} number={2} progress={undefined} next />
      <LessonCard
        lesson={lessons[2]!}
        number={3}
        progress={undefined}
        locked
        lockedMessage="Finish Middle (d k) first"
      />
    </div>
  ),
});

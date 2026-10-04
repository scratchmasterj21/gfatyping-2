import { JSXElement, Show } from "solid-js";

import { launchLessonWithIntro } from "../../../lessons/lesson-intro";
import { LessonProgress } from "../../../lessons/lesson-progress";
import { Lesson } from "../../../lessons/lessons-data";
import { showNoticeNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { LessonStars } from "./LessonStars";

function LessonStatus(props: { done: boolean }): JSXElement {
  return (
    <Show when={props.done}>
      <Fa icon="fa-check-circle" class="text-main" size={0.9} />
    </Show>
  );
}

function speedLabel(wpm: number, grade: string | undefined): string {
  const g = grade !== undefined ? Number.parseInt(grade, 10) : undefined;
  if (g !== undefined && g <= 3) {
    return `Best speed: ${Math.round(wpm)}`;
  }
  return `Best speed: ${Math.round(wpm)} wpm`;
}

export function LessonCard(props: {
  lesson: Lesson;
  progress: LessonProgress | undefined;
  number?: number;
  locked?: boolean;
  lockedMessage?: string;
  next?: boolean;
  grade?: string;
}): JSXElement {
  const done = (): boolean => props.progress?.completed === true;
  const locked = (): boolean => props.locked === true;
  const needsImprovement = (): boolean =>
    done() && (props.progress?.stars ?? 3) < 3;
  const onClick = (): void => {
    if (locked()) {
      showNoticeNotification(
        props.lockedMessage ?? "Complete the previous lesson first",
      );
      return;
    }
    launchLessonWithIntro(props.lesson);
  };
  const isNext = (): boolean => props.next === true && !done() && !locked();

  return (
    <button
      type="button"
      aria-label={`${props.number === undefined ? "Lesson" : `Lesson ${props.number}`}: ${props.lesson.name}${locked() ? ", locked" : ""}`}
      class={cn(
        "group relative grid min-h-48 grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-sub-alt bg-sub-alt text-left shadow-md transition-all",
        locked()
          ? "cursor-not-allowed text-sub opacity-55"
          : needsImprovement()
            ? "cursor-pointer text-text ring-2 ring-main/50 hover:-translate-y-0.5 hover:shadow-lg"
            : "cursor-pointer text-text hover:-translate-y-0.5 hover:border-main hover:shadow-lg",
        isNext() ? "lesson-card-next ring-2 ring-main" : "",
      )}
      onClick={onClick}
    >
      <div class="flex items-start justify-between px-4 pt-3">
        <span class="text-2xl font-bold text-sub tabular-nums">
          {props.number === undefined
            ? ""
            : String(props.number).padStart(2, "0")}
        </span>
        <Show when={locked()} fallback={<LessonStatus done={done()} />}>
          <Fa icon="fa-lock" class="mt-1 text-sub" />
        </Show>
      </div>
      <div class="flex flex-col items-center justify-center gap-3 px-3 py-2 text-center">
        <Show
          when={props.lesson.newKeys}
          fallback={
            <Fa
              icon={locked() ? "fa-lock" : "fa-keyboard"}
              class={locked() ? "text-sub" : "text-main"}
              size={2.35}
            />
          }
        >
          {(keys) => (
            <span class="rounded-xl border-2 border-sub-alt bg-bg px-4 py-2 text-4xl font-black tracking-wider text-main">
              {keys().toUpperCase()}
            </span>
          )}
        </Show>
        <Show when={done()}>
          <LessonStars count={props.progress?.stars ?? 1} />
        </Show>
        <Show when={isNext()}>
          <span class="rounded-full bg-main px-3 py-1 text-em-xs font-bold text-bg">
            Start here
          </span>
        </Show>
      </div>
      <div class="border-t border-bg px-3 py-2.5 text-center">
        <div
          class="lesson-card-title truncate font-medium"
          title={props.lesson.name}
        >
          {props.lesson.name}
        </div>
        <Show when={props.progress !== undefined}>
          <div class="mt-0.5 text-em-xs text-sub">
            {speedLabel(props.progress?.bestWpm ?? 0, props.grade)}
          </div>
        </Show>
      </div>
    </button>
  );
}

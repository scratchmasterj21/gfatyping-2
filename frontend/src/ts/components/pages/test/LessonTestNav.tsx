import { createMemo, JSXElement, Show } from "solid-js";

import {
  getActiveLesson,
  isCurriculumLesson,
} from "../../../lessons/lesson-progress";
import { getCustomTextIndicator } from "../../../states/core";
import { getFocus, getResultVisible } from "../../../states/test";
import { nextTest } from "../../../test/test-logic";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";

export function LessonTestNav(): JSXElement {
  const showBar = createMemo(
    () =>
      !getResultVisible() &&
      (getActiveLesson() !== null || getCustomTextIndicator() !== undefined),
  );
  const showNextLesson = createMemo(() => {
    const id = getActiveLesson();
    return id !== null && isCurriculumLesson(id);
  });
  const idle = (): boolean => !getFocus() && !getResultVisible();

  return (
    <Show when={showBar()}>
      <div
        class={cn(
          "mx-auto mb-4 flex max-w-xl flex-wrap items-center justify-center gap-2 px-2 text-sm",
          !idle() && "pointer-events-none opacity-60",
        )}
        data-ui-element="lessonTestNav"
      >
        <Button
          variant="text"
          href="/"
          router-link
          class="rounded-lg border border-sub-alt bg-sub-alt px-3 py-1.5 font-medium text-text"
          fa={{ icon: "fa-graduation-cap", fixedWidth: true }}
          text="Back to lessons"
        />
        <Show when={showNextLesson()}>
          <button
            type="button"
            class="cursor-pointer rounded-lg bg-main px-3 py-1.5 font-medium text-bg transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!idle()}
            onClick={() => void nextTest()}
          >
            <Fa icon="fa-arrow-right" class="mr-1.5" />
            Next lesson
          </button>
        </Show>
      </div>
    </Show>
  );
}

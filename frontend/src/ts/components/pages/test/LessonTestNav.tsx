import { createMemo, JSXElement, Show } from "solid-js";

import {
  getActiveLesson,
  isCurriculumLesson,
} from "../../../lessons/lesson-progress";
import { getCustomTextIndicator } from "../../../states/core";
import { getFocus, getResultVisible } from "../../../states/test";
import { nextTest } from "../../../test/test-logic";
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
    <Show when={showBar() && idle()}>
      <div
        class="mx-auto mb-4 flex max-w-xl flex-wrap items-center justify-center gap-3 px-2"
        data-ui-element="lessonTestNav"
      >
        <Button
          variant="text"
          href="/"
          router-link
          class="min-h-12 rounded-lg border border-sub-alt bg-sub-alt px-4 text-base font-semibold text-text"
          fa={{ icon: "fa-graduation-cap", fixedWidth: true }}
          text="Back to lessons"
        />
        <Show when={showNextLesson()}>
          <button
            type="button"
            class="min-h-12 cursor-pointer rounded-lg bg-main px-5 text-base font-semibold text-bg transition-opacity hover:opacity-80"
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

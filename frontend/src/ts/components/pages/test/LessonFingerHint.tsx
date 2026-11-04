import { JSXElement, Show } from "solid-js";

import { getLessonFingerHint } from "../../../lessons/lesson-finger-hint";
import { getActiveLesson } from "../../../lessons/lesson-progress";
import { getResultVisible } from "../../../states/test";

function tileText(char: string): string {
  if (char === " ") return "space";
  return /[a-z]/i.test(char) ? char.toUpperCase() : char;
}

/** Stays on screen for the whole lesson and follows the next key. */
export function LessonFingerHint(): JSXElement {
  const hint = (): ReturnType<typeof getLessonFingerHint> =>
    getActiveLesson() !== null && !getResultVisible()
      ? getLessonFingerHint()
      : null;

  return (
    <Show when={hint()} keyed>
      {(current) => (
        <div
          class="pointer-events-none mb-3 flex min-h-14 items-center justify-center gap-3"
          data-ui-element="lessonFingerHint"
        >
          <span
            class="lessonKeyTile"
            data-finger={current.finger}
            style={{
              "font-size": current.char === " " ? "0.9rem" : undefined,
            }}
          >
            {tileText(current.char)}
          </span>
          <span class="text-xl font-semibold whitespace-nowrap text-text">
            {current.label}
          </span>
        </div>
      )}
    </Show>
  );
}

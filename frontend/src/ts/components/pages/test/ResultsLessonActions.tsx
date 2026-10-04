import { JSXElement, Show } from "solid-js";

import {
  getActiveLesson,
  isCurriculumLesson,
} from "../../../lessons/lesson-progress";
import { getResultVisible } from "../../../states/test";
import { StudentPageHeader } from "../../common/StudentPageHeader";

export function ResultsLessonActions(): JSXElement {
  const show = () => {
    const id = getActiveLesson();
    return getResultVisible() && id !== null && isCurriculumLesson(id);
  };

  return (
    <Show when={show()}>
      <div
        class="typing-student-ui lesson-result-actions mx-auto max-w-lg py-2"
        data-ui-element="resultsLessonActions"
      >
        <StudentPageHeader
          eyebrow="Lesson"
          title="Nice work!"
          subtitle="See your score below, then pick what to do next."
        />
      </div>
    </Show>
  );
}

import { createSignal, JSXElement, onCleanup, Show } from "solid-js";

import { lessonResultHeaderEvent } from "../../../events/lesson-result-ui";
import {
  getActiveLesson,
  isCurriculumLesson,
} from "../../../lessons/lesson-progress";
import { getResultVisible } from "../../../states/test";
import { StudentPageHeader } from "../../common/StudentPageHeader";

export function ResultsLessonActions(): JSXElement {
  const [title, setTitle] = createSignal("Nice work!");
  const [subtitle, setSubtitle] = createSignal(
    "Pick what to do next—your score is below.",
  );

  const unsub = lessonResultHeaderEvent.subscribe((state) => {
    setTitle(state.title);
    setSubtitle(state.subtitle);
  });
  onCleanup(unsub);

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
          title={title()}
          subtitle={subtitle()}
        />
      </div>
    </Show>
  );
}

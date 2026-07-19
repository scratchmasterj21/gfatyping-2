import { createSignal } from "solid-js";

import { Config } from "../config/store";
import { showModal } from "../states/modals";
import { startLesson } from "./lesson-launcher";
import { Lesson } from "./lessons-data";

const [introLesson, setIntroLesson] = createSignal<Lesson | null>(null);

/** The lesson currently being introduced (read by the intro modal). */
export const getIntroLesson = introLesson;

/**
 * Launch a lesson, first showing a pre-reader intro (new keys + finger hints,
 * optional read-aloud) when intros are enabled and the lesson introduces keys.
 * Otherwise starts the lesson directly.
 */
export function launchLessonWithIntro(lesson: Lesson): void {
  const hasNewKeys = lesson.newKeys !== undefined && lesson.newKeys !== "";
  if (Config.lessonIntros && hasNewKeys) {
    setIntroLesson(lesson);
    showModal("LessonIntro");
    return;
  }
  void startLesson(lesson);
}

import { createSignal } from "solid-js";

import type { Lesson } from "../lessons/lessons-data";

/**
 * Which hiragana typing screen is open: a Japanese lesson, or the 60-second
 * Maipaso-style romaji practice. Read by KanaPracticeModal (Lessons page).
 */
export type KanaPractice =
  | { mode: "lesson"; lesson: Lesson }
  | { mode: "contest" };

const [kanaPractice, setKanaPractice] = createSignal<KanaPractice | null>(null);

export { kanaPractice };

export function openKanaPractice(practice: KanaPractice): void {
  setKanaPractice(practice);
}

export function closeKanaPractice(): void {
  setKanaPractice(null);
}

/** Japanese lessons run on the hiragana screen, not the typing test. */
export function isKanaLesson(lesson: Pick<Lesson, "id">): boolean {
  return lesson.id.startsWith("jp-");
}

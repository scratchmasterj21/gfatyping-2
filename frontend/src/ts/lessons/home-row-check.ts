import { createSignal } from "solid-js";

import { showModal } from "../states/modals";
import { PracticeRewardCategory } from "./lesson-progress";
import { Lesson } from "./lessons-data";

/**
 * Before each lesson: hold F + J (the bumpy keys) so fingers start on the
 * home row. The browser can't see fingers, so this is the habit we build.
 */

/** Physical keys (KeyboardEvent.code), so any layout / JIS keyboard works. */
export const HOME_ROW_KEYS = [
  { code: "KeyA", label: "A" },
  { code: "KeyS", label: "S" },
  { code: "KeyD", label: "D" },
  { code: "KeyF", label: "F" },
  { code: "KeyJ", label: "J" },
  { code: "KeyK", label: "K" },
  { code: "KeyL", label: "L" },
  { code: "Semicolon", label: ";" },
] as const;

/** Must be held together. Many keyboards can't sense all 8 at once. */
export const REQUIRED_CODES = ["KeyF", "KeyJ"];
export const HOLD_MS = 800;

export function homeRowReady(held: ReadonlySet<string>): boolean {
  return REQUIRED_CODES.every((c) => held.has(c));
}

type Pending = { lesson: Lesson; rewardCategory?: PracticeRewardCategory };
const [pending, setPending] = createSignal<Pending | null>(null);
export const getHomeRowCheckLesson = pending;

/** Show the check; the modal starts the lesson once fingers are placed. */
export function requestHomeRowCheck(
  lesson: Lesson,
  rewardCategory?: PracticeRewardCategory,
): void {
  setPending({ lesson, rewardCategory });
  showModal("HomeRowCheck");
}

import { createSignal } from "solid-js";

import { FINGER_LABEL, Finger, fingerForChar } from "./finger-map";

export type LessonFingerHint = {
  char: string;
  finger: Finger;
  label: string;
};

const [hint, setHint] = createSignal<LessonFingerHint | null>(null);

export function getLessonFingerHint(): LessonFingerHint | null {
  return hint();
}

/** Next character the student should type. Unknown characters hide the hint. */
export function syncLessonFingerHint(nextChar: string): void {
  const finger = fingerForChar(nextChar);
  if (nextChar === "" || finger === undefined) {
    setHint(null);
    return;
  }
  setHint({
    char: nextChar,
    finger,
    label: finger === "thumb" ? "thumb" : `${FINGER_LABEL[finger]} finger`,
  });
}

export function clearLessonFingerHint(): void {
  setHint(null);
}

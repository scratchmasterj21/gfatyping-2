import { createEffect, createRoot } from "solid-js";

import { isCurrentUserAdmin } from "../auth";
import { setConfig } from "../config/setters";
import { Config } from "../config/store";
import { getDefaultConfig } from "../constants/default-config";
import { getStudentGrade } from "../lessons/lessons-data";
import { getSnapshot } from "../states/snapshot";
import { getTheme } from "../states/theme";
import { qs } from "../utils/dom";

/** Students (everyone except the teacher account) get the kid look. */
export function isKidThemeActive(): boolean {
  return !isCurrentUserAdmin();
}

const YOUNG_GRADE_MAX = 3;
const YOUNG_FONT_SIZE = 2.5;
let youngFontAppliedFor: string | undefined;

createRoot(() => {
  createEffect(() => {
    const body = qs("body");
    body?.toggleClass("kid-theme", isKidThemeActive());
    body?.setAttribute("data-theme", getTheme().name);
  });

  // Grades 1-3 get bigger typing text, but only while the font size is still
  // the default - never overrides a size the student picked. Not saved, so
  // it costs no config write.
  createEffect(() => {
    const uid = getSnapshot()?.uid;
    const grade = getStudentGrade();
    if (uid === undefined || grade === undefined) return;
    if (youngFontAppliedFor === uid) return;
    if (!isKidThemeActive() || grade > YOUNG_GRADE_MAX) return;
    if (Config.fontSize !== getDefaultConfig().fontSize) return;
    youngFontAppliedFor = uid;
    setConfig("fontSize", YOUNG_FONT_SIZE, { nosave: true });
  });
});

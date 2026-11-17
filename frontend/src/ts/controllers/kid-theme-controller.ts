import { createEffect, createRoot, createSignal, untrack } from "solid-js";

import { isCurrentUserAdmin, isCurrentUserTeacher } from "../auth";
import { isServerConfigLoaded } from "../config/remote";
import { setConfig } from "../config/setters";
import { Config, getConfig } from "../config/store";
import { getDefaultConfig } from "../constants/default-config";
import { getAuthenticatedUser } from "../firebase";
import {
  classThemePolicy,
  getLessonSettingsCached,
  LessonSettings,
} from "../lessons/lesson-settings";
import { getStudentGrade } from "../lessons/lessons-data";
import { getSnapshot } from "../states/snapshot";
import { showNoticeNotification } from "../states/notifications";
import { getTheme } from "../states/theme";
import { convertCustomColorsToTheme } from "./theme-controller";
import {
  ClassThemePolicy,
  customAllowed,
  fallbackTheme,
  presetAllowed,
} from "./theme-policy";
import { qs } from "../utils/dom";

/** Students (everyone except the teacher account) get the kid look. */
export function isKidThemeActive(): boolean {
  return !isCurrentUserAdmin();
}

/** The readable-theme / class theme rules: students only (not teachers). */
export function themeRulesApply(): boolean {
  return isKidThemeActive() && !isCurrentUserTeacher();
}

const [lessonSettings, setLessonSettings] = createSignal<
  LessonSettings | undefined
>();

/** The signed-in student's class theme rule (readable by default). */
export function getMyThemePolicy(): ClassThemePolicy {
  return classThemePolicy(
    lessonSettings(),
    getSnapshot()?.classId ?? undefined,
  );
}

/** Re-read the class rule (cached 30 min). */
export async function refreshThemePolicy(): Promise<void> {
  try {
    setLessonSettings(await getLessonSettingsCached());
  } catch {
    // keep the readable baseline
  }
}

/** Signed in as a student, with their saved config loaded. */
function enforcingThemes(): boolean {
  return (
    themeRulesApply() &&
    getAuthenticatedUser() !== null &&
    getSnapshot()?.uid !== undefined &&
    isServerConfigLoaded()
  );
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

  // Students: load the class theme rule once signed in.
  createEffect(() => {
    if (getSnapshot()?.uid === undefined || !themeRulesApply()) return;
    void refreshThemePolicy();
  });

  // Students: switch away from hard-to-read / not-allowed themes. Watches the
  // saved config (not live custom-colour previews) so editing isn't blocked.
  createEffect(() => {
    if (!enforcingThemes()) return;
    const policy = getMyThemePolicy();
    const theme = getConfig.theme;
    const custom = getConfig.customTheme;
    const colors = getConfig.customThemeColors;
    const random = getConfig.randomTheme;
    const autoSwitch = getConfig.autoSwitchTheme;
    untrack(() => {
      // random / auto-switch can land on any theme
      if (random !== "off") setConfig("randomTheme", "off");
      if (
        autoSwitch &&
        (!presetAllowed(policy, getConfig.themeLight) ||
          !presetAllowed(policy, getConfig.themeDark))
      ) {
        setConfig("autoSwitchTheme", false);
      }
      const ok = custom
        ? customAllowed(policy, convertCustomColorsToTheme(colors))
        : presetAllowed(policy, theme);
      if (ok) return;
      const next = fallbackTheme(policy);
      if (custom) setConfig("customTheme", false);
      if (theme !== next) setConfig("theme", next);
      showNoticeNotification(
        policy.mode === "readable"
          ? `🎨 That theme was hard to read, so we switched to ${next.replace(/_/g, " ")}`
          : `🎨 Your teacher picked the themes for your class`,
        { durationMs: 6000 },
      );
    });
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

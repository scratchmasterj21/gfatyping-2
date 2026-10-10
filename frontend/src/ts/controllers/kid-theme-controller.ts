import { createEffect, createRoot } from "solid-js";

import { isCurrentUserAdmin } from "../auth";
import { getTheme } from "../states/theme";
import { qs } from "../utils/dom";

/** Students (everyone except the teacher account) get the kid look. */
export function isKidThemeActive(): boolean {
  return !isCurrentUserAdmin();
}

createRoot(() => {
  createEffect(() => {
    const body = qs("body");
    body?.toggleClass("kid-theme", isKidThemeActive());
    body?.setAttribute("data-theme", getTheme().name);
  });
});

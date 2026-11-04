import { restartTestEvent } from "../../../events/test";
import { leaveLessonDrillThen } from "../../../lessons/lesson-launcher";
import { getActivePage } from "../../../states/core";

/** Lessons is the home page, so "/" counts as Lessons too. */
export function isLessonsNavActive(): boolean {
  if (getActivePage() === "lessons") return true;
  const path = window.location.pathname;
  return path === "/" || path === "/lessons";
}

export function isNavPageActive(page: string): boolean {
  return page === "lessons" ? isLessonsNavActive() : getActivePage() === page;
}

/** Free typing: leave any lesson drill; if already on /test, restart. */
export function onFreeTypingNavClick(): void {
  leaveLessonDrillThen(() => {
    if (getActivePage() === "test") restartTestEvent.dispatch();
  });
}

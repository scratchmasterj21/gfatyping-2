import { setConfig } from "../config/setters";
import { navigationEvent } from "../events/navigation";
import { restartTestEvent } from "../events/test";
import { setCustomTextIndicator, getActivePage } from "../states/core";
import { showErrorNotification } from "../states/notifications";
import * as CustomText from "../test/custom-text";
import { Lesson } from "./lessons-data";
import { PracticeRewardCategory, setActiveLesson } from "./lesson-progress";

/**
 * Configure a custom test from already-resolved tokens and start it on the test
 * page, recording completion against `id`. Shared by lessons, assignments and
 * class word lists.
 */
export function startCustomDrill(drill: {
  id: string;
  name: string;
  tokens: string[];
  /** keep token order (staged muscle-memory drills); default shuffles */
  preserveOrder?: boolean;
  rewardCategory?: PracticeRewardCategory;
}): void {
  if (drill.tokens.length === 0) {
    showErrorNotification("Lesson produced no content");
    return;
  }

  setConfig("mode", "custom", { nosave: true });
  setConfig("punctuation", false, { nosave: true });
  setConfig("numbers", false, { nosave: true });
  // A student's own account may have stopOnError/difficulty/strictSpace set
  // from exploring Settings (or a shared class device left in a weird
  // state). Any of these silently block space from advancing to the next
  // word whenever the current word has a mistake (or, for strictSpace, on a
  // stray double space) - looking exactly like "the space bar doesn't
  // work" to a student with no idea those settings exist. Lessons need
  // predictable behavior regardless, same reasoning as punctuation/numbers.
  setConfig("stopOnError", "off", { nosave: true });
  setConfig("difficulty", "normal", { nosave: true });
  setConfig("strictSpace", false, { nosave: true });
  // Funbox is disabled for lessons (not a curated part of the experience -
  // see commandline/lists/funbox.ts's `available` guard); reset here too in
  // case one was left active from a prior commandline pick or settings-page
  // change, so it can't silently carry into this lesson's run.
  setConfig("funbox", [], { nosave: true });

  CustomText.setPipeDelimiter(false);
  CustomText.setMode(drill.preserveOrder === true ? "repeat" : "shuffle");
  CustomText.setLimitMode("word");
  CustomText.setText(drill.tokens);

  setCustomTextIndicator({ name: drill.name, isLong: false });
  setActiveLesson(drill.id, drill.rewardCategory);

  if (getActivePage() === "test") {
    restartTestEvent.dispatch();
  } else {
    navigationEvent.dispatch({ url: "/", options: {} });
  }
}

/**
 * Configure a custom test from a lesson's generated drill and start it on the
 * test page. Mirrors the launch flow used by practise-words.
 */
export async function startLesson(
  lesson: Lesson,
  rewardCategory?: PracticeRewardCategory,
): Promise<void> {
  let tokens: string[];
  try {
    tokens = await lesson.generate();
  } catch (e) {
    console.error(e);
    showErrorNotification("Failed to generate lesson");
    return;
  }

  startCustomDrill({
    id: lesson.id,
    name: lesson.name,
    tokens,
    preserveOrder: lesson.preserveOrder,
    rewardCategory,
  });
}

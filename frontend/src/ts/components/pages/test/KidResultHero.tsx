import { createSignal, JSXElement, Show } from "solid-js";

import { isKidThemeActive } from "../../../controllers/kid-theme-controller";
import { createEffectOn } from "../../../hooks/effects";
import {
  getActiveLesson,
  isCurriculumLesson,
} from "../../../lessons/lesson-progress";
import { getLastResult, getResultVisible } from "../../../states/test";
import { qs } from "../../../utils/dom";
import { Button } from "../../common/Button";
import { Card } from "../../common/Card";
import { Mascot, MascotMood } from "../../common/Mascot";

type Verdict = { mood: MascotMood; title: string; subtitle: string };

function verdictFor(wpm: number, acc: number): Verdict {
  if (wpm === 0) {
    return {
      mood: "sleepy",
      title: "Ready when you are!",
      subtitle: "Tap the words and start typing to see your score.",
    };
  }
  if (acc >= 95) {
    return {
      mood: "cheer",
      title: "Amazing typing!",
      subtitle: "Super careful and accurate. Keep it up!",
    };
  }
  if (acc >= 85) {
    return {
      mood: "happy",
      title: "Nice work!",
      subtitle: "Go a little slower to hit even more keys right.",
    };
  }
  return {
    mood: "thinking",
    title: "Good try!",
    subtitle: "Slow down and watch each letter. Accuracy first, speed later.",
  };
}

/**
 * Friendly summary at the top of free-typing results for students:
 * Tappy, a headline and the two numbers that matter. The detailed
 * Monkeytype stats + chart stay available behind "More details".
 * Curriculum lessons keep their own header (ResultsLessonActions).
 */
export function KidResultHero(): JSXElement {
  const [detailsOpen, setDetailsOpen] = createSignal(false);

  const show = (): boolean => {
    if (!isKidThemeActive() || !getResultVisible()) return false;
    if (getLastResult() === null) return false;
    const lesson = getActiveLesson();
    return lesson === null || !isCurriculumLesson(lesson);
  };

  // Each new result starts with details collapsed.
  createEffectOn(getLastResult, () => setDetailsOpen(false));

  // Legacy result markup is styled from these classes (kid-theme.scss).
  createEffectOn([show, detailsOpen], ([visible, open]) => {
    const result = qs("#result");
    result?.toggleClass("kid-result", visible);
    result?.toggleClass("kid-details-open", visible && open);
  });

  const wpm = () => Math.round(getLastResult()?.wpm ?? 0);
  const acc = () => Math.floor(getLastResult()?.acc ?? 0);
  const verdict = () => verdictFor(wpm(), acc());

  return (
    <Show when={show()}>
      <Card
        tone="accent"
        padding="lg"
        class="mx-auto mb-2 grid w-full max-w-2xl gap-4 font-kid"
      >
        <div class="flex flex-wrap items-center justify-center gap-4 sm:flex-nowrap sm:justify-start">
          <Mascot mood={verdict().mood} size={104} />
          <div class="grid gap-1 text-center sm:text-left">
            <div class="text-3xl font-semibold">{verdict().title}</div>
            <div class="text-base text-sub">{verdict().subtitle}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid justify-items-center rounded-double bg-bg p-3">
            <div class="text-5xl leading-none font-bold text-main">{wpm()}</div>
            <div class="mt-1 text-sm font-semibold text-sub">
              words per minute
            </div>
          </div>
          <div class="grid justify-items-center rounded-double bg-bg p-3">
            <div class="text-5xl leading-none font-bold text-main">
              {acc()}%
            </div>
            <div class="mt-1 text-sm font-semibold text-sub">
              keys typed right
            </div>
          </div>
        </div>
        <Button
          variant="text"
          class="justify-self-center text-sm"
          fa={{ icon: detailsOpen() ? "fa-chevron-up" : "fa-chevron-down" }}
          text={detailsOpen() ? "Hide details" : "More details"}
          aria-label={
            detailsOpen() ? "Hide detailed stats" : "Show detailed stats"
          }
          onClick={() => setDetailsOpen((open) => !open)}
        />
      </Card>
    </Show>
  );
}

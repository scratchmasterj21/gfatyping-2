import { createSignal, For, JSXElement, Show } from "solid-js";

import { Grade, gradeOf, GRADES } from "../../../constants/classes";
import { isKidThemeActive } from "../../../controllers/kid-theme-controller";
import { createEffectOn } from "../../../hooks/effects";
import {
  getActiveLesson,
  isCurriculumLesson,
} from "../../../lessons/lesson-progress";
import { practiceReward } from "../../../practice/practice-reward";
import {
  activeStory,
  badgesFor,
  bestWpm,
  finishStoryChapter,
  gardenSize,
  plantFor,
  practiceStars,
  startStoryChapter,
} from "../../../practice/practice-state";
import { getSnapshot } from "../../../states/snapshot";
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

  const [story, setStory] =
    createSignal<ReturnType<typeof finishStoryChapter>>(null);
  // Each new result starts with details collapsed; a story chapter is done.
  createEffectOn(getLastResult, (r) => {
    setDetailsOpen(false);
    const lesson = getActiveLesson();
    setStory(
      r !== null &&
        r.mode === "custom" &&
        lesson === null &&
        activeStory() !== null
        ? finishStoryChapter()
        : null,
    );
  });

  // Legacy result markup is styled from these classes (kid-theme.scss).
  createEffectOn([show, detailsOpen], ([visible, open]) => {
    const result = qs("#result");
    result?.toggleClass("kid-result", visible);
    result?.toggleClass("kid-details-open", visible && open);
  });

  const wpm = () => Math.round(getLastResult()?.wpm ?? 0);
  const acc = () => Math.floor(getLastResult()?.acc ?? 0);
  const verdict = () => verdictFor(wpm(), acc());
  const grade = (): Grade | undefined =>
    GRADES.find((g) => g === gradeOf(getSnapshot()?.classId));
  const stars = (): number => practiceStars(wpm(), acc(), grade(), bestWpm());
  /** what this test earned (once the server answered) */
  const reward = () => {
    const r = practiceReward();
    return r !== null && r.at === getLastResult()?.timestamp ? r : null;
  };
  const newPlant = (): boolean => {
    const r = reward();
    return (
      r !== null &&
      r.wordsAdded > 0 &&
      gardenSize(r.typedWords) > gardenSize(r.typedWords - r.wordsAdded)
    );
  };
  const topBadge = (): number | undefined => badgesFor(wpm()).at(-1);

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
        <div
          class="flex justify-center gap-1 text-4xl"
          aria-label={`${stars()} stars`}
        >
          <For each={[1, 2, 3]}>
            {(n) => (
              <span class={n <= stars() ? "" : "opacity-25 grayscale"}>⭐</span>
            )}
          </For>
        </div>
        <Show when={reward()}>
          {(r) => (
            <div class="flex flex-wrap justify-center gap-2 text-sm font-bold">
              <Show when={r().coins > 0}>
                <span class="rounded-full bg-game-gold px-3 py-1 text-game-ink">
                  🪙 +{r().coins} coins
                  {(r().parts?.warmUp ?? 0) > 0 ? " (warm-up ×2!)" : ""}
                </span>
              </Show>
              <Show when={(r().parts?.accuracy ?? 0) > 0}>
                <span class="rounded-full bg-bg px-3 py-1">
                  🎯 careful typing bonus
                </span>
              </Show>
              <Show when={r().wordsAdded > 0}>
                <span class="rounded-full bg-bg px-3 py-1">
                  🌱 +{r().wordsAdded} words for your garden
                  {newPlant()
                    ? ` - a new ${plantFor(gardenSize(r().typedWords) - 1)} grew!`
                    : ""}
                </span>
              </Show>
              <Show when={r().gain > 0}>
                <span class="rounded-full bg-main px-3 py-1 text-bg">
                  🌟 +{r().gain} WPM faster than last week!
                </span>
              </Show>
              <Show when={(r().parts?.pb ?? 0) > 0 && topBadge() !== undefined}>
                <span class="rounded-full bg-game-yellow px-3 py-1 text-game-ink">
                  👑 New best! ⚡ {topBadge()} WPM badge
                </span>
              </Show>
            </div>
          )}
        </Show>
        <Show when={story()}>
          {(st) => (
            <div class="grid justify-items-center gap-2 rounded-double bg-bg p-3 text-center">
              <div class="text-lg font-bold">
                {st().story.emoji} {st().story.title}: chapter{" "}
                {st().chapter + 1} done!
              </div>
              <Show
                when={st().next}
                fallback={
                  <div class="text-sub">🎉 You finished the whole story!</div>
                }
              >
                {(n) => (
                  <Button
                    class="font-bold"
                    text={`Next: chapter ${n() + 1} - ${st().story.chapters[n()]?.title ?? ""}`}
                    fa={{ icon: "fa-book-open" }}
                    onClick={() => startStoryChapter(st().story.id, n())}
                  />
                )}
              </Show>
            </div>
          )}
        </Show>
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

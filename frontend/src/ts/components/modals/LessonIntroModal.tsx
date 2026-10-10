import { createMemo, For, JSXElement, Show } from "solid-js";

import {
  FINGER_LABEL,
  FINGER_ORDER,
  fingerForChar,
} from "../../lessons/finger-map";
import {
  getIntroLesson,
  getIntroRewardCategory,
} from "../../lessons/lesson-intro";
import { startLesson } from "../../lessons/lesson-launcher";
import { tipOfTheDay } from "../../lessons/typing-tips";
import { hideModalAndClearChain } from "../../states/modals";
import * as TTS from "../../test/tts";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Fa } from "../common/Fa";

function displayChar(c: string): string {
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

export function LessonIntroModal(): JSXElement {
  const tip = tipOfTheDay();
  const keys = createMemo(() => [...(getIntroLesson()?.newKeys ?? "")]);

  // Unique fingers used by the new keys, in left-to-right order, as labels.
  const fingerHint = createMemo(() => {
    const used = new Set(
      keys()
        .map((c) => fingerForChar(c))
        .filter((f): f is NonNullable<typeof f> => f !== undefined),
    );
    const labels = FINGER_ORDER.filter((f) => used.has(f)).map(
      (f) => FINGER_LABEL[f],
    );
    if (labels.length === 0) return "";
    if (labels.length === 1) return `Use your ${labels[0]} finger.`;
    const last = labels[labels.length - 1];
    return `Use your ${labels.slice(0, -1).join(", ")} and ${last} fingers.`;
  });

  const speechText = (): string => {
    const lesson = getIntroLesson();
    if (lesson === undefined || lesson === null) return "";
    const keyList = keys().map(displayChar).join(", ");
    return `${lesson.name}. New keys: ${keyList}. ${fingerHint()}`;
  };

  const speak = (): void => {
    void TTS.speak(speechText());
  };

  const start = (): void => {
    const lesson = getIntroLesson();
    window.speechSynthesis.cancel();
    hideModalAndClearChain("LessonIntro");
    if (lesson !== null) void startLesson(lesson, getIntroRewardCategory());
  };

  return (
    <AnimatedModal
      id="LessonIntro"
      title="New lesson"
      afterShow={() => {
        window.speechSynthesis.cancel();
      }}
      beforeHide={() => {
        window.speechSynthesis.cancel();
      }}
    >
      <div
        class="grid justify-items-center gap-6 text-center"
        style={{ "font-family": '"Lexend Deca", sans-serif' }}
      >
        <div class="text-3xl font-bold text-main">{getIntroLesson()?.name}</div>

        <div class="flex flex-wrap justify-center gap-3">
          <For each={keys()}>
            {(key) => (
              <span class="lessonKeyTile" data-finger={fingerForChar(key)}>
                {displayChar(key)}
              </span>
            )}
          </For>
        </div>

        <Show when={fingerHint() !== ""}>
          <div class="text-xl text-sub">{fingerHint()}</div>
        </Show>

        <div class="flex items-center gap-2 rounded-xl bg-sub-alt px-4 py-2 text-base text-text">
          <Fa icon={tip.icon} class="text-main" />
          {tip.text}
        </div>

        <div class="flex flex-wrap justify-center gap-4">
          <Button onClick={speak} fa={{ icon: "fa-volume-up" }}>
            read aloud
          </Button>
          <Button onClick={start} active fa={{ icon: "fa-play" }}>
            Start lesson
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
}

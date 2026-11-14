import { createSignal, For, JSXElement, onCleanup, Show } from "solid-js";

import { isCurrentUserAdmin } from "../../auth";
import { fingerForChar } from "../../lessons/finger-map";
import {
  getHomeRowCheckLesson,
  HOLD_MS,
  HOME_ROW_KEYS,
  homeRowReady,
} from "../../lessons/home-row-check";
import { startLesson } from "../../lessons/lesson-launcher";
import { hideModalAndClearChain, isModalOpen } from "../../states/modals";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

/** Hold F + J (fingers on the home row) to start the lesson. */
export function HomeRowCheckModal(): JSXElement {
  const [held, setHeld] = createSignal<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = createSignal(0);
  const [done, setDone] = createSignal(false);
  let holdStart: number | null = null;
  let frame: number | null = null;

  const reset = (): void => {
    setHeld(new Set<string>());
    setProgress(0);
    setDone(false);
    holdStart = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };

  const begin = (): void => {
    const pending = getHomeRowCheckLesson();
    setDone(true);
    setTimeout(() => {
      hideModalAndClearChain("HomeRowCheck");
      if (pending !== null) {
        void startLesson(pending.lesson, pending.rewardCategory);
      }
    }, 450);
  };

  const tick = (): void => {
    frame = null;
    if (holdStart === null || done()) return;
    const p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      begin();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const update = (next: Set<string>): void => {
    setHeld(next);
    if (homeRowReady(next)) {
      if (holdStart === null) {
        holdStart = performance.now();
        frame = requestAnimationFrame(tick);
      }
    } else {
      holdStart = null;
      setProgress(0);
    }
  };

  const isHomeKey = (code: string): boolean =>
    HOME_ROW_KEYS.some((k) => k.code === code);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!isModalOpen("HomeRowCheck") || done()) return;
    if (!isHomeKey(e.code)) return;
    // keep the letters out of the test behind the modal
    e.preventDefault();
    e.stopPropagation();
    if (held().has(e.code)) return;
    update(new Set([...held(), e.code]));
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!held().has(e.code)) return;
    const next = new Set(held());
    next.delete(e.code);
    update(next);
  };
  const onBlur = (): void => update(new Set());

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur);
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("blur", onBlur);
    if (frame !== null) cancelAnimationFrame(frame);
  });

  const allEight = (): boolean => held().size === HOME_ROW_KEYS.length;

  return (
    <AnimatedModal
      id="HomeRowCheck"
      title="Fingers ready?"
      modalClass="w-full max-w-2xl"
      beforeShow={reset}
      afterHide={reset}
    >
      <div class="grid justify-items-center gap-5 text-center font-kid">
        <div class="text-2xl font-bold text-text sm:text-3xl">
          Put your fingers on the home row
        </div>
        <div class="text-lg text-sub">
          Feel the bumps on <b class="text-main">F</b> and{" "}
          <b class="text-main">J</b>. Hold them down!
        </div>

        <div class="flex items-end gap-2 sm:gap-3">
          <For each={HOME_ROW_KEYS}>
            {(k, i) => (
              <>
                <Show when={i() === 4}>
                  <span class="w-4 sm:w-8"></span>
                </Show>
                <span
                  class={cn(
                    "lessonKeyTile relative transition-all duration-100",
                    held().has(k.code)
                      ? "-translate-y-1 scale-110 opacity-100 ring-4 ring-text"
                      : "opacity-40",
                  )}
                  data-finger={fingerForChar(k.label)}
                >
                  {k.label}
                  <Show when={k.code === "KeyF" || k.code === "KeyJ"}>
                    <span class="absolute bottom-1.5 h-1 w-4 rounded-full bg-[#1a1a1a]/60"></span>
                  </Show>
                </span>
              </>
            )}
          </For>
        </div>
        <div class="flex gap-24 text-sm text-sub sm:gap-40">
          <span>
            <Fa icon="fa-hand-paper" class="mr-1 -scale-x-100" /> left hand
          </span>
          <span>
            right hand <Fa icon="fa-hand-paper" class="ml-1" />
          </span>
        </div>

        <div class="h-4 w-full max-w-sm overflow-hidden rounded-full bg-sub-alt">
          <div
            class="h-full rounded-full bg-main"
            style={{ width: `${Math.round(progress() * 100)}%` }}
          ></div>
        </div>

        <div class="min-h-8 text-xl font-bold">
          <Show
            when={done()}
            fallback={
              <span class="text-sub">
                {homeRowReady(held())
                  ? "Keep holding..."
                  : "Waiting for F and J"}
              </span>
            }
          >
            <span class="text-main">
              {allEight()
                ? "⭐ Perfect! All 8 fingers!"
                : "👍 Great! Let's go!"}
            </span>
          </Show>
        </div>

        <Show when={isCurrentUserAdmin()}>
          <button
            type="button"
            class="cursor-pointer text-sm text-sub underline hover:text-text"
            onClick={begin}
          >
            Skip (teacher)
          </button>
        </Show>
      </div>
    </AnimatedModal>
  );
}

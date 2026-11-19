import { createSignal, JSXElement, onCleanup, onMount, Show } from "solid-js";

import { isKidThemeActive } from "../../../controllers/kid-theme-controller";
import { restartTestEvent, typedCharEvent } from "../../../events/test";
import { getResultVisible } from "../../../states/test";
import { cn } from "../../../utils/cn";

/** Correct keys in a row before the flame shows. */
const SHOW_AT = 10;
/** Words per minute on the gauge's full turn. */
const GAUGE_MAX = 60;

/**
 * Live feel for free typing (kids): a combo flame for correct keys in a
 * row and a little speed gauge, both reset on restart.
 */
export function PracticeCombo(): JSXElement {
  const [streak, setStreak] = createSignal(0);
  const [wpm, setWpm] = createSignal(0);
  let firstAt = 0;
  let correct = 0;

  const reset = (): void => {
    setStreak(0);
    setWpm(0);
    firstAt = 0;
    correct = 0;
  };
  restartTestEvent.useListener(reset);
  typedCharEvent.useListener(({ correct: ok }) => {
    if (firstAt === 0) firstAt = Date.now();
    if (ok) {
      correct++;
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  });

  onMount(() => {
    const t = setInterval(() => {
      if (firstAt === 0) return;
      const min = (Date.now() - firstAt) / 60_000;
      setWpm(min > 0.05 ? Math.round(correct / 5 / min) : 0);
    }, 500);
    onCleanup(() => clearInterval(t));
  });

  const show = (): boolean =>
    isKidThemeActive() &&
    !getResultVisible() &&
    firstAt >= 0 &&
    wpm() + streak() > 0;
  const hot = (): boolean => streak() >= SHOW_AT;
  const turn = (): number => Math.min(1, wpm() / GAUGE_MAX) * 180 - 90;

  return (
    <Show when={show()}>
      <div class="pointer-events-none mx-auto flex items-center justify-center gap-4 font-kid">
        <div
          class={cn(
            "flex items-center gap-1 rounded-full px-3 py-1 text-lg font-bold transition-opacity",
            hot() ? "bg-game-orange text-game-ink opacity-100" : "opacity-0",
          )}
          aria-hidden={!hot()}
        >
          <span class={hot() ? "animate-pulse" : ""}>🔥</span> {streak()} in a
          row!
        </div>
        <div class="flex items-center gap-1 text-sm font-bold text-sub">
          <svg viewBox="0 0 100 56" class="w-12">
            <path
              d="M8 52 A42 42 0 0 1 92 52"
              fill="none"
              stroke="currentColor"
              stroke-opacity="0.25"
              stroke-width="10"
              stroke-linecap="round"
            ></path>
            <line
              x1="50"
              y1="52"
              x2="50"
              y2="16"
              stroke="var(--color-game-orange)"
              stroke-width="6"
              stroke-linecap="round"
              transform={`rotate(${turn()} 50 52)`}
            ></line>
          </svg>
          {wpm()} WPM
        </div>
      </div>
    </Show>
  );
}

import { createMemo, createSignal, For, JSXElement, Show } from "solid-js";

import { LessonKeyStats } from "../../../events/lesson-result-ui";
import { startCustomDrill } from "../../../lessons/lesson-launcher";
import { generateWeakKeysDrill } from "../../../lessons/lessons-data";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

const ROWS = ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
const MIN_MISS_RATE = 0.1;
const MAX_DRILL_KEYS = 5;

function missRate(s: { correct: number; missed: number } | undefined): number {
  if (s === undefined) return 0;
  const total = s.correct + s.missed;
  return total === 0 ? 0 : s.missed / total;
}

export function LessonKeyHeatmap(props: { stats: LessonKeyStats }): JSXElement {
  const [loading, setLoading] = createSignal(false);

  const trickyKeys = createMemo(() => {
    const stats = props.stats;
    return ROWS.join("")
      .split("")
      .map((k) => ({ k, rate: missRate(stats[k]) }))
      .filter((e) => e.rate >= MIN_MISS_RATE)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, MAX_DRILL_KEYS)
      .map((e) => e.k);
  });

  const keyClass = (k: string): string => {
    const s = props.stats[k];
    if (s === undefined || s.correct + s.missed === 0) {
      return "bg-bg text-sub opacity-50";
    }
    const rate = missRate(s);
    if (rate >= 0.25) return "bg-error text-bg";
    if (rate >= MIN_MISS_RATE) return "bg-error/30 text-text";
    if (rate > 0) return "bg-caret/30 text-text";
    return "bg-main/25 text-text";
  };

  const practice = async (): Promise<void> => {
    setLoading(true);
    try {
      const tokens = await generateWeakKeysDrill(trickyKeys().join(""));
      startCustomDrill({
        id: "weak-keys-review",
        name: "Tricky Keys Practice",
        tokens,
        preserveOrder: true,
        rewardCategory: "adaptive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="mt-3 rounded-2xl bg-sub-alt p-3">
      <div class="mb-2 text-center text-em-sm text-sub">
        <Show when={trickyKeys().length > 0} fallback="Every key looked great!">
          Red keys were tricky this time
        </Show>
      </div>
      <div class="flex flex-col items-center gap-1">
        <For each={ROWS}>
          {(row, i) => (
            <div
              class={cn("flex gap-1", i() === 1 && "ml-3", i() === 2 && "ml-7")}
            >
              <For each={row.split("")}>
                {(k) => (
                  <div
                    class={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg font-mono text-em-sm",
                      keyClass(k),
                    )}
                  >
                    {k}
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
      <Show when={trickyKeys().length > 0}>
        <div class="mt-3 flex justify-center">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-em-sm"
            disabled={loading()}
            onClick={() => void practice()}
          >
            <Fa
              icon={loading() ? "fa-circle-notch" : "fa-dumbbell"}
              class={cn(loading() && "fa-spin")}
            />
            <span class="ml-1.5">
              Practice {trickyKeys().join(" ").toUpperCase()}
            </span>
          </button>
        </div>
      </Show>
    </div>
  );
}

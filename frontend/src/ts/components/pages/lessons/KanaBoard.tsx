import { createEffect, createSignal, For, JSXElement, Show } from "solid-js";

import { hintFor, KanaRunState, UnitState } from "../../../lessons/kana-romaji";
import { cn } from "../../../utils/cn";

const unitClass = (state: UnitState, current: boolean): string => {
  if (current) return "rounded-md bg-game-yellow text-game-ink";
  if (state === "correct") return "text-game-ink/30";
  if (state === "wrong") return "text-game-red underline decoration-2";
  return "text-game-ink";
};

/**
 * The hiragana words, Maipaso style: big kana in rows; typed kana fade,
 * missed kana turn red, the current kana is highlighted. Under the current
 * word: what's been typed, and (optionally) a romaji hint.
 */
export function KanaBoard(props: {
  run: KanaRunState;
  showHints: boolean;
}): JSXElement {
  const [box, setBox] = createSignal<HTMLDivElement>();

  // keep the current word in view
  createEffect(() => {
    const wi = props.run.wordIndex;
    const el = box()?.querySelector(`[data-word="${wi}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  return (
    <div
      ref={setBox}
      class="flex min-h-0 flex-1 flex-wrap content-start gap-x-8 gap-y-5 overflow-y-auto rounded-xl bg-game-cream px-5 py-6 sm:px-8"
      lang="ja"
    >
      <For each={props.run.words}>
        {(units, wi) => {
          const isCurrentWord = (): boolean => wi() === props.run.wordIndex;
          return (
            <div
              data-word={wi()}
              class={cn(
                "flex items-start",
                isCurrentWord() && "rounded-lg ring-2 ring-game-blue/40",
              )}
            >
              <For each={units}>
                {(unit, ui) => {
                  const state = (): UnitState =>
                    props.run.states[wi()]?.[ui()] ?? "todo";
                  const current = (): boolean =>
                    isCurrentWord() && ui() === props.run.unitIndex;
                  return (
                    <div class="flex flex-col items-center">
                      <span
                        class={cn(
                          "px-0.5 text-3xl leading-tight font-bold sm:text-4xl",
                          unitClass(state(), current()),
                        )}
                      >
                        {unit.kana}
                      </span>
                      <Show when={isCurrentWord()}>
                        <span class="h-5 font-mono text-sm leading-5">
                          <Show
                            when={current() && props.run.buffer !== ""}
                            fallback={
                              <span class="text-game-ink/45">
                                {props.showHints && state() === "todo"
                                  ? hintFor(unit)
                                  : ""}
                              </span>
                            }
                          >
                            <span class="font-bold text-game-green">
                              {props.run.buffer}
                            </span>
                          </Show>
                        </span>
                      </Show>
                    </div>
                  );
                }}
              </For>
              <Show when={isCurrentWord() && props.run.awaitingSpace}>
                <span class="ml-1 animate-pulse self-center rounded-md bg-game-yellow px-2 py-0.5 font-mono text-sm font-bold text-game-ink motion-reduce:animate-none">
                  space ␣
                </span>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}

import type Phaser from "phaser";

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { cn } from "../../utils/cn";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { createTypeRacerGame } from "./game-config";

const OPTIONS = getWordListOptions();

function grouped(
  options: WordListOption[],
): { group: string; items: WordListOption[] }[] {
  const map = new Map<string, WordListOption[]>();
  for (const o of options) {
    const list = map.get(o.group) ?? [];
    list.push(o);
    map.set(o.group, list);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

type Props = {
  open: boolean;
  onClose: () => void;
  onResult?: (score: number, wave: number) => void;
};

type Difficulty = { label: string; wpm: number };
const DIFFICULTIES: Difficulty[] = [
  { label: "Easy", wpm: 20 },
  { label: "Medium", wpm: 35 },
  { label: "Hard", wpm: 55 },
];

export function TypeRacerModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<Difficulty>(
    DIFFICULTIES[0] as Difficulty,
  );
  const [phase, setPhase] = createSignal<"pick" | "loading" | "playing">(
    "pick",
  );
  let containerRef: HTMLDivElement | undefined;
  let game: Phaser.Game | null = null;

  const groups = createMemo(() => grouped(OPTIONS));

  const startGame = async (): Promise<void> => {
    const opt = selected();
    const cpuWpm = difficulty().wpm;
    const onClose = props.onClose;
    const onResult = props.onResult;
    setPhase("loading");
    const words = await opt.getWords();
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    game = await createTypeRacerGame(containerRef, words, cpuWpm);
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      onResult?.(data.score, data.wave);
    });
    game.events.on("exit-game", () => {
      onClose();
    });
  };

  const cleanup = (): void => {
    if (game !== null) {
      game.destroy(true);
      game = null;
    }
    setPhase("pick");
  };

  createEffect(() => {
    if (!props.open) cleanup();
  });
  onCleanup(() => {
    cleanup();
  });

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/95">
        <div
          class={cn(
            "relative flex flex-col overflow-hidden rounded-xl border border-main/30 bg-bg shadow-2xl",
            phase() === "playing"
              ? "h-[90vh] w-[95vw] max-w-5xl"
              : "w-full max-w-lg p-6",
          )}
        >
          <button
            type="button"
            class="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded text-sub hover:text-text"
            onClick={() => {
              props.onClose();
            }}
          >
            ✕
          </button>

          <Show when={phase() === "pick"}>
            <h2 class="mb-1 text-lg font-bold text-text">Type Racer</h2>
            <p class="mb-4 text-em-sm text-sub">
              Race the CPU — type words to speed your car to the finish line!
            </p>

            <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
              Difficulty
            </p>
            <div class="mb-4 flex gap-2">
              <For each={DIFFICULTIES}>
                {(d) => (
                  <button
                    type="button"
                    class={cn(
                      "flex-1 rounded px-3 py-1.5 text-em-sm font-semibold transition-colors",
                      difficulty().label === d.label
                        ? "bg-main text-bg"
                        : "bg-sub-alt text-sub hover:text-text",
                    )}
                    onClick={() => {
                      setDifficulty(d);
                    }}
                  >
                    {d.label}
                  </button>
                )}
              </For>
            </div>

            <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
              Choose a word list
            </p>

            <div class="max-h-72 overflow-y-auto rounded border border-main/20 bg-sub-alt">
              <For each={groups()}>
                {(g) => (
                  <div>
                    <div class="sticky top-0 bg-sub-alt px-3 py-1.5 text-em-xs font-bold tracking-widest text-sub uppercase">
                      {g.group}
                    </div>
                    <For each={g.items}>
                      {(opt) => (
                        <button
                          type="button"
                          class={cn(
                            "w-full px-4 py-2 text-left text-em-sm transition-colors",
                            selected().id === opt.id
                              ? "bg-main/20 text-text"
                              : "text-sub hover:bg-main/10 hover:text-text",
                          )}
                          onClick={() => {
                            setSelected(opt);
                          }}
                        >
                          {opt.label}
                        </button>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>

            <button
              type="button"
              class="button primary mt-4"
              onClick={() => {
                void startGame();
              }}
            >
              Race →
            </button>
          </Show>

          <Show when={phase() === "loading"}>
            <div class="flex items-center justify-center py-12 text-sub">
              Loading…
            </div>
          </Show>

          <Show when={phase() === "playing"}>
            <div
              ref={(el) => {
                containerRef = el;
              }}
              class="h-full w-full"
            ></div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

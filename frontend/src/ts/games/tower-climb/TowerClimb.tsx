import {
  createMemo,
  createSignal,
  For,
  JSXElement,
  Show,
  untrack,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { Mascot } from "../../components/common/Mascot";
import { cn } from "../../utils/cn";
import { shuffled, useCountdown } from "../mini/mini-game-utils";
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TimeBar } from "../mini/TimeBar";
import {
  CRACKS_TO_SLIDE,
  initialTower,
  TowerDifficulty,
  towerOnTypo,
  towerOnWord,
  towerScore,
  TowerState,
} from "./tower-rules";

const VISIBLE_FLOORS = 6;

/** Tappy climbs a keycap tower: each correct word is one block up. */
export function TowerClimb(p: MiniGamePlayProps<TowerDifficulty>): JSXElement {
  const pool = shuffled(
    untrack(() => (p.words.length > 0 ? p.words : ["tap", "key", "jump"])),
  );
  let cursor = 0;
  const nextWord = (): string => {
    const w = pool[cursor % pool.length] as string;
    cursor++;
    return w;
  };

  const [state, setState] = createSignal<TowerState>(initialTower());
  const [word, setWord] = createSignal(nextWord());
  const [typed, setTyped] = createSignal("");
  const [wordClean, setWordClean] = createSignal(true);
  const [wrong, setWrong] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const flash = (text: string): void => {
    setMessage(text);
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => setMessage(null), 1100);
  };

  const end = (): void => {
    if (finished) return;
    finished = true;
    const s = state();
    p.onFinish({
      score: towerScore(s),
      wave: Math.max(1, s.highest),
      headline: s.highest >= 20 ? "Sky high!" : "Nice climb!",
      stats: [
        { label: "highest floor", value: String(s.highest) },
        { label: "words", value: String(s.words) },
        { label: "double jumps", value: String(s.doubleJumps) },
        { label: "typos", value: String(s.typos) },
      ],
    });
  };

  const timer = useCountdown(
    untrack(() => p.difficulty.seconds),
    end,
  );

  const onInput = (value: string): void => {
    const target = word();
    if (target.startsWith(value)) {
      setWrong(false);
      setTyped(value);
      if (value === target) {
        const before = state();
        const after = towerOnWord(before, wordClean());
        setState(after);
        if (after.floor - before.floor === 2) flash("Double jump!");
        setWord(nextWord());
        setTyped("");
        setWordClean(true);
      }
      return;
    }
    // typo: crack once per word, keep the correct part typed
    setWrong(true);
    if (wordClean()) {
      setWordClean(false);
      const r = towerOnTypo(state(), p.difficulty.slideFloors);
      setState(r.state);
      if (r.slid) flash("Whoops - Tappy slid down!");
    }
  };

  // floors shown: a window ending one above Tappy
  const floors = createMemo((): number[] => {
    const top = state().floor + 1;
    const bottom = Math.max(0, top - VISIBLE_FLOORS + 1);
    const list: number[] = [];
    for (let f = top; f >= bottom; f--) list.push(f);
    return list;
  });

  return (
    <div class="flex h-full flex-col gap-3 p-4 pt-16 font-kid">
      <div class="flex items-center gap-3">
        <TimeBar remaining={timer.remaining()} total={p.difficulty.seconds} />
        <span class="w-12 text-right text-lg font-bold text-text tabular-nums">
          {Math.ceil(timer.remaining())}s
        </span>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
        <span class="rounded-full bg-sub-alt px-3 py-1 text-text">
          <Fa icon="fa-building" class="mr-1.5 text-main" />
          Floor {state().floor}
        </span>
        <span class="rounded-full bg-sub-alt px-3 py-1 text-text">
          <Fa icon="fa-fire" class="mr-1.5 text-main" />
          Streak {state().streak}
        </span>
        <span
          class="flex items-center gap-1 rounded-full bg-sub-alt px-3 py-1 text-text"
          aria-label={`${state().cracks} of ${CRACKS_TO_SLIDE} cracks`}
        >
          Cracks
          <For each={Array.from({ length: CRACKS_TO_SLIDE }, (_, i) => i)}>
            {(i) => (
              <span
                class={cn(
                  "h-2.5 w-2.5 rounded-full",
                  i < state().cracks ? "bg-error" : "bg-bg",
                )}
              ></span>
            )}
          </For>
        </span>
      </div>

      <div class="relative flex min-h-0 flex-1 flex-col items-center justify-end overflow-hidden rounded-double bg-sub-alt/50 py-3">
        <Show when={message()}>
          {(m) => (
            <div class="absolute top-3 z-10 rounded-full bg-main px-4 py-1.5 text-base font-bold text-bg">
              {m()}
            </div>
          )}
        </Show>
        <For each={floors()}>
          {(f) => {
            const isNext = (): boolean => f === state().floor + 1;
            const isTappy = (): boolean => f === state().floor;
            return (
              <div class="flex flex-col items-center">
                <Show when={isTappy()}>
                  <Mascot
                    mood={wrong() ? "thinking" : "happy"}
                    size={64}
                    class="-mb-1"
                  />
                </Show>
                <div
                  class={cn(
                    "flex h-11 w-48 items-center justify-center rounded-xl border-b-4 text-lg font-bold sm:w-64",
                    isNext()
                      ? "border-main bg-bg text-text"
                      : "border-[color-mix(in_srgb,var(--main-color)_60%,black)] bg-main text-bg",
                    isNext() && wrong() && "border-error",
                  )}
                >
                  <Show when={isNext()} fallback={f === 0 ? "start" : f}>
                    <span class="font-mono">
                      <span class="text-main">{typed()}</span>
                      {word().slice(typed().length)}
                    </span>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <div class="flex justify-center">
        <MiniTypingInput
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          placeholder={word()}
        />
      </div>
    </div>
  );
}

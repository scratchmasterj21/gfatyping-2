import { createEffect, For, Index, JSXElement, on, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { NITRO_WORDS, QueuedWord } from "./race-rules";

export type StripView = {
  /** current word first */
  queue: QueuedWord[];
  /** last few finished words */
  done: string[];
  typed: string;
  /** letters typed right */
  good: number;
  nitro: number;
  streak: number;
  wpm: number;
};

export type StripPopup = {
  id: number;
  text: string;
  tone: "good" | "boost" | "bad";
};

const KIND_STYLE: Record<QueuedWord["kind"], string> = {
  normal: "",
  nitro: "text-game-orange",
  jump: "text-game-purple",
};
const KIND_TAG: Record<QueuedWord["kind"], string> = {
  normal: "",
  nitro: "🔥 NITRO",
  jump: "🛫 JUMP",
};

/** Words per minute shown on the gauge's full turn. */
const GAUGE_MAX = 60;

/**
 * The typing area: one big line of words, the current word centred and
 * coloured letter by letter, then the typing box, nitro meter and speed
 * gauge.
 */
export function TypingStrip(props: {
  view: StripView;
  value: string;
  onInput: (value: string) => void;
  waiting: boolean;
  popups: StripPopup[];
  /** shake the current word */
  shakeKey: number;
  /** "2nd" (phones show it here) */
  place: string;
}): JSXElement {
  const current = (): QueuedWord =>
    props.view.queue[0] ?? { text: "", kind: "normal" };
  const wrong = (): boolean => props.view.typed.length > props.view.good;
  const nextLetter = (): string => current().text[props.view.good] ?? "␣";
  let wordEl: HTMLSpanElement | undefined;
  createEffect(
    on(
      () => props.shakeKey,
      () => {
        wordEl?.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-8px)" },
            { transform: "translateX(8px)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 300 },
        );
      },
      { defer: true },
    ),
  );
  const gaugeTurn = (): number =>
    Math.min(1, props.view.wpm / GAUGE_MAX) * 180 - 90;

  return (
    <div class="grid shrink-0 gap-2 bg-game-grass-dark px-3 pt-2 pb-3 sm:px-6">
      {/* the word line */}
      <div class="relative flex items-center overflow-hidden rounded-double bg-game-cream px-2 py-3 font-mono shadow-[0_6px_0_rgb(43_33_64/0.25)] sm:py-4">
        {/* finished words, fading out to the left */}
        <div class="flex min-w-0 flex-1 justify-end gap-3 overflow-hidden text-xl text-game-grass-dark/60 sm:text-2xl">
          <For each={props.view.done}>
            {(w, i) => (
              <span
                class="whitespace-nowrap"
                style={{
                  opacity: `${0.3 + (i() / props.view.done.length) * 0.5}`,
                }}
              >
                {w}
              </span>
            )}
          </For>
        </div>
        {/* current word */}
        <div class="relative mx-3 flex shrink-0 flex-col items-center">
          <Show when={KIND_TAG[current().kind] !== ""}>
            <span
              class={cn(
                "absolute -top-3 animate-game-pop rounded-full px-2 text-[0.65rem] font-bold text-game-cream sm:text-xs",
                current().kind === "nitro"
                  ? "bg-game-orange"
                  : "bg-game-purple",
              )}
            >
              {KIND_TAG[current().kind]}
            </span>
          </Show>
          <span
            ref={(el) => {
              wordEl = el;
            }}
            class={cn(
              "rounded-xl px-2 text-4xl font-bold tracking-wide whitespace-nowrap sm:text-6xl",
              current().kind === "normal"
                ? "bg-game-yellow/40"
                : current().kind === "nitro"
                  ? "bg-game-orange/20"
                  : "bg-game-purple/20",
            )}
          >
            <Index each={[...current().text]}>
              {(ch, i) => (
                <span
                  class={cn(
                    "relative",
                    i < props.view.good
                      ? "text-game-green"
                      : i === props.view.good && wrong()
                        ? "rounded bg-game-red text-game-cream"
                        : cn("text-game-ink", KIND_STYLE[current().kind]),
                    i === props.view.good &&
                      !wrong() &&
                      "after:absolute after:inset-x-0 after:-bottom-1 after:h-1.5 after:animate-pulse after:rounded-full after:bg-game-blue",
                  )}
                >
                  {ch()}
                </span>
              )}
            </Index>
          </span>
        </div>
        {/* what's next */}
        <div class="flex min-w-0 flex-1 gap-3 overflow-hidden text-xl sm:text-3xl">
          <For each={props.view.queue.slice(1, 6)}>
            {(w, i) => (
              <span
                class={cn(
                  "font-semibold whitespace-nowrap",
                  w.kind === "normal" ? "text-game-ink" : KIND_STYLE[w.kind],
                )}
                style={{ opacity: `${1 - i() * 0.2}` }}
              >
                {w.kind === "nitro" ? "🔥" : w.kind === "jump" ? "🛫" : ""}
                {w.text}
              </span>
            )}
          </For>
        </div>
        {/* popups */}
        <div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
          <For each={props.popups}>
            {(p) => (
              <span
                class={cn(
                  "absolute animate-game-float-up text-xl font-bold whitespace-nowrap drop-shadow",
                  p.tone === "good"
                    ? "text-game-green"
                    : p.tone === "boost"
                      ? "text-game-orange"
                      : "text-game-red",
                )}
              >
                {p.text}
              </span>
            )}
          </For>
        </div>
      </div>

      {/* phones: place, nitro, speed in one row */}
      <div class="flex items-center gap-2 text-xs font-bold text-game-cream sm:hidden">
        <Show when={props.place !== ""}>
          <span class="rounded-full bg-game-ink/40 px-2">📍 {props.place}</span>
        </Show>
        <span>🔥</span>
        <div class="flex flex-1 gap-1">
          <Index each={Array.from({ length: NITRO_WORDS })}>
            {(_, i) => (
              <div
                class={cn(
                  "h-2 flex-1 rounded-full",
                  i < props.view.nitro ? "bg-game-orange" : "bg-game-ink/30",
                )}
              ></div>
            )}
          </Index>
        </div>
        <span>⚡ {props.view.streak}</span>
        <span>{props.view.wpm} WPM</span>
      </div>
      {/* typing box + meters */}
      <div class="flex items-center gap-3">
        {/* nitro + streak */}
        <div class="hidden w-36 shrink-0 flex-col gap-1 sm:flex">
          <div class="flex justify-between text-xs font-bold text-game-cream">
            <span>🔥 Nitro</span>
            <span>⚡ {props.view.streak} in a row</span>
          </div>
          <div class="flex gap-1">
            <Index each={Array.from({ length: NITRO_WORDS })}>
              {(_, i) => (
                <div
                  class={cn(
                    "h-3 flex-1 rounded-full",
                    i < props.view.nitro ? "bg-game-orange" : "bg-game-ink/30",
                  )}
                ></div>
              )}
            </Index>
          </div>
        </div>
        <div class="relative flex flex-1 flex-col items-center">
          <Show when={wrong() && !props.waiting}>
            <div class="absolute bottom-full mb-1 animate-game-pop rounded-full bg-game-red px-3 py-0.5 text-sm font-bold text-game-cream">
              Oops! Type{" "}
              <span class="rounded bg-game-cream px-1.5 font-mono text-game-ink">
                {nextLetter()}
              </span>{" "}
              next (delete the wrong letter)
            </div>
          </Show>
          <MiniTypingInput
            value={props.value}
            onInput={props.onInput}
            wrong={wrong()}
            waiting={props.waiting}
            placeholder={props.waiting ? "get ready…" : current().text}
          />
        </div>
        {/* speed gauge */}
        <div class="hidden w-28 shrink-0 flex-col items-center sm:flex">
          <svg viewBox="0 0 100 56" class="w-24">
            <path
              d="M8 52 A42 42 0 0 1 92 52"
              fill="none"
              stroke="var(--color-game-ink)"
              stroke-opacity="0.3"
              stroke-width="10"
              stroke-linecap="round"
            ></path>
            <path
              d="M8 52 A42 42 0 0 1 92 52"
              fill="none"
              stroke="var(--color-game-yellow)"
              stroke-width="10"
              stroke-linecap="round"
              pathLength="100"
              // oxlint-disable-next-line react/no-unknown-property
              stroke-dasharray={`${Math.min(100, (props.view.wpm / GAUGE_MAX) * 100)} 100`}
            ></path>
            <line
              x1="50"
              y1="52"
              x2="50"
              y2="16"
              stroke="var(--color-game-cream)"
              stroke-width="4"
              stroke-linecap="round"
              transform={`rotate(${gaugeTurn()} 50 52)`}
            ></line>
            <circle
              cx="50"
              cy="52"
              r="5"
              fill="var(--color-game-cream)"
            ></circle>
          </svg>
          <span class="text-sm font-bold text-game-cream">
            {props.view.wpm} WPM
          </span>
        </div>
      </div>
    </div>
  );
}

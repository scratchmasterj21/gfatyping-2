import {
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { Mascot } from "../../components/common/Mascot";
import { FINGER_COLORS, fingerForChar } from "../../lessons/finger-map";
import { cn } from "../../utils/cn";
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import {
  ECHO_LIVES,
  EchoDifficulty,
  echoIsOver,
  echoOnMistake,
  echoOnRoundWin,
  EchoState,
  initialEcho,
  makeSequence,
} from "./echo-rules";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
/** Beating a pattern this long ends the game as a win. */
const MAX_LENGTH = 15;

const fingerColor = (key: string): string | undefined => {
  const f = fingerForChar(key);
  return f === undefined || f === "thumb" ? undefined : FINGER_COLORS[f];
};

/** Watch Tappy's key pattern, then repeat it from memory. */
export function EchoKeys(p: MiniGamePlayProps<EchoDifficulty>): JSXElement {
  const settings = untrack(() => p.difficulty);
  const keySet = new Set(settings.keys);

  const [state, setState] = createSignal<EchoState>(initialEcho());
  const [sequence, setSequence] = createSignal<string[]>([]);
  const [phase, setPhase] = createSignal<"watch" | "turn" | "pause">("pause");
  const [lit, setLit] = createSignal<string | null>(null);
  const [litGood, setLitGood] = createSignal(true);
  const [progress, setProgress] = createSignal(0);
  const [message, setMessage] = createSignal("Watch Tappy!");
  const timers: ReturnType<typeof setTimeout>[] = [];
  let inputEl: HTMLInputElement | undefined;
  let finished = false;

  onCleanup(() => timers.forEach(clearTimeout));

  const end = (won: boolean): void => {
    if (finished) return;
    finished = true;
    const s = state();
    p.onFinish({
      score: s.score,
      wave: Math.max(1, s.rounds),
      headline: won ? "Memory master!" : "Great remembering!",
      stats: [
        { label: "patterns repeated", value: String(s.rounds) },
        { label: "longest pattern", value: String(s.longest) },
        { label: "lives left", value: String(Math.max(0, s.lives)) },
        { label: "points", value: String(s.score) },
      ],
    });
  };

  const playRound = (length: number): void => {
    const seq = makeSequence(settings.keys, length, Math.random);
    setSequence(seq);
    setProgress(0);
    setPhase("watch");
    setMessage("Watch Tappy!");
    const step = settings.showMs;
    seq.forEach((key, i) => {
      timers.push(
        setTimeout(
          () => {
            setLitGood(true);
            setLit(key);
          },
          400 + i * step,
        ),
      );
      timers.push(setTimeout(() => setLit(null), 400 + i * step + step * 0.7));
    });
    timers.push(
      setTimeout(
        () => {
          setPhase("turn");
          setMessage("Your turn!");
          inputEl?.focus();
        },
        400 + seq.length * step,
      ),
    );
  };

  onMount(() => playRound(state().length));

  const press = (raw: string): void => {
    if (phase() !== "turn" || raw.length === 0) return;
    const key = raw.toLowerCase();
    const expected = sequence()[progress()];
    setLit(key);
    timers.push(setTimeout(() => setLit(null), 250));
    if (key === expected) {
      setLitGood(true);
      const next = progress() + 1;
      setProgress(next);
      if (next >= sequence().length) {
        const won = echoOnRoundWin(state());
        setState(won);
        setPhase("pause");
        setMessage("Great memory!");
        if (won.longest >= MAX_LENGTH) {
          timers.push(setTimeout(() => end(true), 700));
        } else {
          timers.push(setTimeout(() => playRound(won.length), 900));
        }
      }
      return;
    }
    setLitGood(false);
    const after = echoOnMistake(state());
    setState(after);
    setPhase("pause");
    if (echoIsOver(after)) {
      setMessage("Out of lives!");
      timers.push(setTimeout(() => end(false), 900));
      return;
    }
    setMessage("Oops! Watch again");
    timers.push(setTimeout(() => playRound(after.length), 1100));
  };

  return (
    <div class="flex h-full flex-col gap-3 p-4 pt-16 font-kid">
      <div class="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
        <span class="rounded-full bg-sub-alt px-3 py-1 text-text">
          <Fa icon="fa-star" class="mr-1.5 text-main" />
          {state().score} pts
        </span>
        <span class="rounded-full bg-sub-alt px-3 py-1 text-text">
          <Fa icon="fa-ruler-horizontal" class="mr-1.5 text-main" />
          Pattern {state().length}
        </span>
        <span
          class="rounded-full bg-sub-alt px-3 py-1 text-text"
          aria-label={`${state().lives} ${state().lives === 1 ? "life" : "lives"} left`}
        >
          <For each={Array.from({ length: ECHO_LIVES }, (_, i) => i)}>
            {(i) => (
              <Fa
                icon="fa-heart"
                class={cn(
                  "mx-0.5",
                  i < state().lives ? "text-error" : "text-bg",
                )}
              />
            )}
          </For>
        </span>
      </div>

      <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-double bg-sub-alt/50 p-4">
        <div class="flex items-center gap-3">
          <Mascot
            mood={
              phase() === "watch"
                ? "thinking"
                : message().startsWith("Oops") || message().startsWith("Out")
                  ? "sad"
                  : "happy"
            }
            size={72}
          />
          <div
            class="text-2xl font-bold text-text"
            aria-live="polite"
            role="status"
          >
            {message()}
          </div>
        </div>
        <div class="flex gap-2" aria-label="pattern progress">
          <For each={sequence()}>
            {(_, i) => (
              <span
                class={cn(
                  "h-3.5 w-3.5 rounded-full",
                  i() < progress() ? "bg-main" : "bg-bg",
                )}
              ></span>
            )}
          </For>
        </div>
        <div class="grid gap-1.5 sm:gap-2">
          <For each={ROWS}>
            {(row, r) => (
              <div
                class="flex justify-center gap-1.5 sm:gap-2"
                style={{ "padding-left": `${r() * 0.9}rem` }}
              >
                <For each={[...row]}>
                  {(key) => {
                    const isLit = (): boolean => lit() === key;
                    const color = fingerColor(key);
                    return (
                      <div
                        class={cn(
                          "flex h-11 w-9 items-center justify-center rounded-lg border-b-4 font-mono text-lg font-bold uppercase transition-transform duration-100 sm:h-14 sm:w-12 sm:text-xl",
                          keySet.has(key) ? "opacity-100" : "opacity-30",
                          isLit() ? "scale-110 text-bg" : "bg-bg text-text",
                          isLit() && !litGood() && "bg-error",
                        )}
                        style={{
                          "border-bottom-color": color,
                          "background-color":
                            isLit() && litGood() ? color : undefined,
                        }}
                      >
                        {key}
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="flex justify-center">
        <Show
          when={phase() === "turn"}
          fallback={
            <div class="py-3 text-base font-semibold text-sub">
              <Fa icon="fa-eye" class="mr-1.5" />
              Watch the keys light up…
            </div>
          }
        >
          <MiniTypingInput
            value=""
            ref={(el) => {
              inputEl = el;
            }}
            placeholder="repeat the keys"
            onInput={(v) => {
              const ch = v.slice(-1);
              if (inputEl !== undefined) inputEl.value = "";
              press(ch);
            }}
          />
        </Show>
      </div>
    </div>
  );
}

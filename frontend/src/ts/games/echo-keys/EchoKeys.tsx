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
import { sfx } from "../mini/mini-sounds";
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import {
  ECHO_LIVES,
  EchoDifficulty,
  echoIsOver,
  echoOnMistake,
  echoOnRoundWin,
  EchoState,
  echoStars,
  initialEcho,
  makeSequence,
} from "./echo-rules";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
/** Beating a pattern this long ends the game as a win. */
const MAX_LENGTH = 15;

const fingerColor = (key: string): string => {
  const f = fingerForChar(key);
  return f === undefined || f === "thumb"
    ? "var(--color-game-grey)"
    : FINGER_COLORS[f];
};

/** Each key plays its own note: higher rows and keys further right sound higher. */
const noteIndex = (key: string): number => {
  const r = ROWS.findIndex((row) => row.includes(key));
  return r < 0 ? 0 : (ROWS[r] ?? "").indexOf(key) + (2 - r) * 2;
};

type Phase = "watch" | "turn" | "pause";

/** Watch Tappy's key pattern, then repeat it from memory. */
export function EchoKeys(p: MiniGamePlayProps<EchoDifficulty>): JSXElement {
  const settings = untrack(() => p.difficulty);
  const keySet = new Set(settings.keys);

  const [state, setState] = createSignal<EchoState>(initialEcho());
  const [sequence, setSequence] = createSignal<string[]>([]);
  const [phase, setPhase] = createSignal<Phase>("pause");
  const [lit, setLit] = createSignal<string | null>(null);
  const [litGood, setLitGood] = createSignal(true);
  const [progress, setProgress] = createSignal(0);
  const [message, setMessage] = createSignal("Watch Tappy!");
  // visual-only state
  const [hint, setHint] = createSignal<string | null>(null);
  const [ripple, setRipple] = createSignal<{ key: string; id: number }>({
    key: "",
    id: 0,
  });
  const [sweep, setSweep] = createSignal(0);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let inputEl: HTMLInputElement | undefined;
  let finished = false;

  onCleanup(() => timers.forEach(clearTimeout));

  const light = (key: string, good: boolean): void => {
    setLitGood(good);
    setLit(key);
    setRipple((r) => ({ key, id: r.id + 1 }));
  };

  const end = (won: boolean): void => {
    if (finished) return;
    finished = true;
    const s = state();
    p.onFinish({
      score: s.score,
      wave: Math.max(1, s.rounds),
      headline: won ? "Memory master!" : "Great remembering!",
      stars: echoStars(s.longest),
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
            light(key, true);
            sfx.note(noteIndex(key));
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
    timers.push(setTimeout(() => setLit(null), 250));
    if (key === expected) {
      light(key, true);
      sfx.note(noteIndex(key));
      const next = progress() + 1;
      setProgress(next);
      if (next >= sequence().length) {
        const won = echoOnRoundWin(state());
        setState(won);
        setPhase("pause");
        setMessage("Great memory!");
        setSweep((n) => n + 1);
        timers.push(setTimeout(() => sfx.great(), 200));
        if (won.longest >= MAX_LENGTH) {
          timers.push(setTimeout(() => end(true), 700));
        } else {
          timers.push(setTimeout(() => playRound(won.length), 900));
        }
      }
      return;
    }
    light(key, false);
    sfx.bad();
    if (expected !== undefined) {
      setHint(expected);
      timers.push(setTimeout(() => setHint(null), 950));
    }
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

  const sad = (): boolean =>
    message().startsWith("Oops") || message().startsWith("Out");

  return (
    <div class="relative h-full overflow-hidden font-kid">
      <Stage />

      <div class="relative z-[1] flex h-full flex-col gap-3 p-4 pt-16">
        <div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-game-ink">
          <span class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(0_0_0/0.3)]">
            <Fa icon="fa-star" class="mr-1.5 text-game-gold" />
            {state().score} pts
          </span>
          <span class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(0_0_0/0.3)]">
            <Fa icon="fa-music" class="mr-1.5 text-game-purple" />
            Pattern {state().length}
          </span>
          <span
            class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(0_0_0/0.3)]"
            aria-label={`${state().lives} ${state().lives === 1 ? "life" : "lives"} left`}
          >
            <For each={Array.from({ length: ECHO_LIVES }, (_, i) => i)}>
              {(i) => (
                <Fa
                  icon="fa-heart"
                  class={cn(
                    "mx-0.5",
                    i < state().lives ? "text-game-red" : "text-game-ink/15",
                  )}
                />
              )}
            </For>
          </span>
        </div>

        <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:gap-5">
          {/* banner + Tappy on the stage */}
          <div class="flex flex-col items-center">
            <Show when={message()} keyed>
              {(m) => (
                <div
                  class={cn(
                    "mb-2 animate-game-pop rounded-full px-5 py-1.5 text-xl font-bold shadow-[0_4px_0_rgb(0_0_0/0.3)] motion-reduce:animate-none sm:text-2xl",
                    phase() === "turn"
                      ? "bg-game-green text-game-ink"
                      : sad()
                        ? "bg-game-red text-game-cream"
                        : phase() === "watch"
                          ? "bg-game-yellow text-game-ink"
                          : "bg-game-pink text-game-ink",
                  )}
                  aria-live="polite"
                  role="status"
                >
                  {m}
                </div>
              )}
            </Show>
            <Mascot
              mood={phase() === "watch" ? "thinking" : sad() ? "sad" : "happy"}
              size={76}
            />
            <span class="-mt-2 block h-4 w-28 rounded-[50%] bg-game-brown-dark/80"></span>
          </div>

          {/* light bulbs for pattern progress */}
          <div
            class="flex flex-wrap justify-center gap-1.5"
            role="img"
            aria-label={`${progress()} of ${sequence().length} keys repeated`}
          >
            <For each={sequence()}>
              {(_, i) => <Bulb on={i() < progress()} />}
            </For>
          </div>

          {/* keyboard deck */}
          <div class="grid gap-1.5 rounded-double border-b-8 border-game-ink bg-game-ink/70 p-2 xs:p-2.5 sm:gap-2 sm:p-4">
            <For each={ROWS}>
              {(row, r) => (
                <div
                  class="flex justify-center gap-1 xs:gap-1.5 sm:gap-2"
                  style={{ "padding-left": `${r() * 0.9}rem` }}
                >
                  <For each={[...row]}>
                    {(key, c) => (
                      <For each={[sweep()]}>
                        {() => (
                          <div
                            class={cn(
                              sweep() > 0 &&
                                "animate-game-sweep motion-reduce:animate-none",
                            )}
                            style={{
                              "animation-delay": `${c() * 45 + r() * 25}ms`,
                            }}
                          >
                            <EchoKey
                              letter={key}
                              color={fingerColor(key)}
                              active={keySet.has(key)}
                              lit={lit() === key}
                              good={litGood()}
                              hint={hint() === key}
                              ripple={ripple().key === key ? ripple().id : null}
                            />
                          </div>
                        )}
                      </For>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="flex justify-center">
          {/* stays mounted between turns so the iPad keeps focus + keyboard */}
          <MiniTypingInput
            value=""
            ref={(el) => {
              inputEl = el;
            }}
            waiting={phase() !== "turn"}
            placeholder={
              phase() === "watch" ? "watch the keys…" : "repeat the keys"
            }
            onInput={(v) => {
              const ch = v.slice(-1);
              if (inputEl !== undefined) inputEl.value = "";
              press(ch);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** A chunky keycap with a finger-coloured ledge that glows when lit. */
function EchoKey(props: {
  letter: string;
  color: string;
  active: boolean;
  lit: boolean;
  good: boolean;
  hint: boolean;
  ripple: number | null;
}): JSXElement {
  const glowing = (): boolean => props.lit && props.good;
  return (
    <div
      class={cn(
        "relative flex h-11 w-[1.6rem] items-center justify-center rounded-xl font-mono text-base font-bold uppercase transition-[transform,background-color,box-shadow] duration-100 xs:w-9 xs:text-lg sm:h-14 sm:w-12 sm:text-xl",
        props.active ? "opacity-100" : "opacity-30",
        glowing()
          ? "translate-y-1 text-game-cream"
          : "bg-game-cream text-game-ink",
        props.lit &&
          !props.good &&
          "translate-y-1 animate-game-shake bg-game-red text-game-cream motion-reduce:animate-none",
        props.hint &&
          "animate-game-pulse outline-4 outline-offset-2 outline-game-gold motion-reduce:animate-none",
      )}
      style={{
        "background-color": glowing() ? props.color : undefined,
        "box-shadow": glowing()
          ? `0 1px 0 color-mix(in srgb, ${props.color} 60%, black), 0 0 24px 6px ${props.color}`
          : `0 5px 0 color-mix(in srgb, ${props.color} 70%, black)`,
      }}
    >
      {props.letter}
      <span
        class="absolute inset-x-1.5 bottom-1 h-1 rounded-full opacity-70"
        style={{ "background-color": props.color }}
      ></span>
      <Show when={props.ripple} keyed>
        {(_id) => (
          <span
            class="pointer-events-none absolute inset-0 animate-game-ripple rounded-xl border-4 motion-reduce:hidden"
            style={{
              "border-color": props.good
                ? props.color
                : "var(--color-game-red)",
            }}
          ></span>
        )}
      </Show>
    </div>
  );
}

/** Little light bulb: dark glass until that key is repeated. */
function Bulb(props: { on: boolean }): JSXElement {
  return (
    <svg viewBox="0 0 20 28" width="20" height="28" aria-hidden="true">
      <Show when={props.on}>
        <circle
          cx="10"
          cy="10"
          r="10"
          fill="var(--color-game-gold)"
          opacity="0.35"
        ></circle>
      </Show>
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill={props.on ? "var(--color-game-gold)" : "var(--color-game-cream)"}
        fill-opacity={props.on ? 1 : 0.25}
        stroke="var(--color-game-cream)"
        stroke-opacity="0.6"
        stroke-width="1.5"
      ></circle>
      <rect
        x="6"
        y="17"
        width="8"
        height="7"
        rx="1.5"
        fill="var(--color-game-grey)"
      ></rect>
    </svg>
  );
}

/** Night-time theatre: curtains, a valance and a spotlight on Tappy. */
function Stage(): JSXElement {
  const folds =
    "repeating-linear-gradient(90deg, var(--color-game-red) 0 14px, color-mix(in srgb, var(--color-game-red) 70%, black) 14px 22px)";
  return (
    <div class="absolute inset-0" aria-hidden="true">
      <div class="absolute inset-0 bg-linear-to-b from-game-night to-game-dusk"></div>
      <div
        class="absolute top-0 left-1/2 h-3/5 w-3/4 -translate-x-1/2 bg-linear-to-b from-game-yellow/35 to-transparent"
        style={{ "clip-path": "polygon(42% 0, 58% 0, 100% 100%, 0 100%)" }}
      ></div>
      <div
        class="absolute top-0 bottom-0 left-0 w-[9%] rounded-br-[3rem]"
        style={{ background: folds }}
      ></div>
      <div
        class="absolute top-0 right-0 bottom-0 w-[9%] rounded-bl-[3rem]"
        style={{ background: folds }}
      ></div>
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        class="absolute inset-x-0 top-0 h-12 w-full"
      >
        <path
          d="M0 0 H100 V5 Q95 10 90 5 Q85 10 80 5 Q75 10 70 5 Q65 10 60 5 Q55 10 50 5 Q45 10 40 5 Q35 10 30 5 Q25 10 20 5 Q15 10 10 5 Q5 10 0 5 Z"
          fill="color-mix(in srgb, var(--color-game-red) 80%, black)"
        ></path>
      </svg>
      <div class="absolute inset-x-0 bottom-0 h-24 bg-game-brown-dark"></div>
      <div
        class="absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0 90px, rgb(0 0 0 / 0.18) 90px 93px)",
        }}
      ></div>
    </div>
  );
}

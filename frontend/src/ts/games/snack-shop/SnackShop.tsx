import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";
import { shuffled, useCountdown } from "../mini/mini-game-utils";
import { sfx } from "../mini/mini-sounds";
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TimeBar } from "../mini/TimeBar";
import {
  ANIMALS,
  Animal,
  game,
  moodFor,
  SNACK_KINDS,
  SNACK_NAMES,
  SnackKind,
} from "./snack-art";
import {
  initialSnack,
  isRushHour,
  makeOrder,
  MAX_STRIKES,
  pickRandom,
  SnackDifficulty,
  snackIsOver,
  snackOnMiss,
  snackOnServe,
  SnackState,
  snackStars,
} from "./snack-rules";
import { SnackCustomer } from "./SnackCustomer";
import { SnackIcon } from "./SnackIcon";

type Customer = {
  id: number;
  animal: Animal;
  snack: SnackKind;
  shirt: string;
  order: string;
};

const SHIRTS = ["blue", "purple", "green", "yellow", "red", "pink"].map(game);
/** Counter top, measured from the bottom of the scene. */
const COUNTER = 150;
const BULBS = Array.from({ length: 14 }, (_, i) => i);
const BULB_COLORS = ["yellow", "blue", "green", "red"].map(game);
const HEARTS = [
  { x: -40, delay: 0 },
  { x: 0, delay: 0.12 },
  { x: 40, delay: 0.24 },
];

/** Serve hungry customers by typing their orders before they give up. */
export function SnackShop(p: MiniGamePlayProps<SnackDifficulty>): JSXElement {
  const settings = untrack(() => p.difficulty);
  const words = untrack(() =>
    shuffled(p.words.length > 0 ? p.words : ["cake", "pie", "tea"]),
  );

  let nextId = 0;
  const newCustomer = (): Customer => ({
    id: nextId++,
    animal: pickRandom(ANIMALS, Math.random),
    snack: pickRandom(SNACK_KINDS, Math.random),
    shirt: pickRandom(SHIRTS, Math.random),
    order: makeOrder(words, settings.maxWords, Math.random),
  });

  const [state, setState] = createSignal<SnackState>(initialSnack());
  // live score for the multiplayer scoreboard
  createEffect(() => p.onScore?.(state().score));
  const [current, setCurrent] = createSignal<Customer>(newCustomer());
  const [queue, setQueue] = createSignal<Customer[]>([
    newCustomer(),
    newCustomer(),
  ]);
  const [servedAt, setServedAt] = createSignal(Date.now());
  const [patience, setPatience] = createSignal(1);
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  let finished = false;

  // visual-only state
  const [leaving, setLeaving] = createSignal<{
    c: Customer;
    happy: boolean;
  } | null>(null);
  const [pop, setPop] = createSignal<{ id: number; text: string } | null>(null);
  const timers: ReturnType<typeof setTimeout>[] = [];

  const flash = (text: string): void => {
    setMessage(text);
    timers.push(setTimeout(() => setMessage(null), 1100));
  };

  const end = (): void => {
    if (finished) return;
    finished = true;
    clearInterval(patienceTimer);
    const s = state();
    p.onFinish({
      score: s.score,
      wave: Math.max(1, s.served),
      headline: s.served >= 10 ? "Shop superstar!" : "Shop closed!",
      stars: snackStars(s.served),
      stats: [
        { label: "customers served", value: String(s.served) },
        { label: "best rush", value: String(s.bestCombo) },
        { label: "customers missed", value: String(s.strikes) },
        { label: "points", value: String(s.score) },
      ],
    });
  };

  const timer = useCountdown(settings.seconds, end);

  const nextCustomer = (happy: boolean): void => {
    setLeaving({ c: current(), happy });
    timers.push(setTimeout(() => setLeaving(null), 650));
    const [head, ...rest] = queue();
    setCurrent(head ?? newCustomer());
    setQueue([...rest, newCustomer()]);
    setServedAt(Date.now());
    setPatience(1);
    setTyped("");
    setWrong(false);
  };

  const patienceTimer = setInterval(() => {
    if (finished) return;
    const left = 1 - (Date.now() - servedAt()) / (settings.patience * 1000);
    setPatience(Math.max(0, left));
    if (left <= 0) {
      const next = snackOnMiss(state());
      setState(next);
      flash(`The ${current().animal} got tired of waiting!`);
      sfx.bad();
      if (snackIsOver(next)) {
        timer.stop();
        end();
        return;
      }
      nextCustomer(false);
    }
  }, 100);
  onCleanup(() => {
    clearInterval(patienceTimer);
    timers.forEach(clearTimeout);
  });

  const onInput = (value: string): void => {
    const order = current().order;
    if (!order.startsWith(value)) {
      if (!wrong()) sfx.oops();
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value === order) {
      const before = state();
      const after = snackOnServe(before, order, patience());
      setState(after);
      setPop({ id: after.served, text: `+${after.score - before.score}` });
      if (!isRushHour(before) && isRushHour(after)) {
        flash("Rush hour! x2");
        sfx.great();
      } else {
        sfx.good();
      }
      nextCustomer(true);
    }
  };

  const rush = (): boolean => isRushHour(state());
  const patienceColor = (): string =>
    patience() > 0.6
      ? "bg-game-green"
      : patience() > 0.3
        ? "bg-game-yellow"
        : "bg-game-red";

  return (
    <div class="relative h-full overflow-hidden font-kid">
      {/* back wall */}
      <div
        class="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(90deg, ${game("cream")} 0 34px, ${game("tan")} 34px 38px)`,
        }}
        aria-hidden="true"
      ></div>
      <div
        class={cn(
          "absolute inset-0 bg-game-orange/20 transition-opacity duration-500",
          rush() ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      ></div>

      <Awning rush={rush()} />
      <Shelves />

      {/* waiting line in the doorway */}
      <div
        class="absolute right-3 hidden w-36 flex-col items-center sm:flex"
        style={{ bottom: `${COUNTER}px` }}
        aria-hidden="true"
      >
        <span class="mb-1 rounded-full bg-game-ink/70 px-2.5 py-0.5 text-xs font-bold text-game-cream">
          next
        </span>
        <div class="flex h-44 w-full items-end justify-center overflow-hidden rounded-t-[4rem] border-8 border-b-0 border-game-brown-dark bg-game-sky/60">
          <For each={queue()}>
            {(c, i) => (
              <div class={cn("-mx-3 w-20", i() === 1 && "opacity-80")}>
                <SnackCustomer
                  animal={c.animal}
                  mood="happy"
                  shirt={c.shirt}
                  class="h-auto w-full"
                />
              </div>
            )}
          </For>
        </div>
      </div>

      {/* customer who just left */}
      <Show when={leaving()} keyed>
        {(l) => (
          <div
            class="absolute left-1/2 w-40 -translate-x-1/2 sm:w-48"
            style={{ bottom: `${COUNTER - 16}px` }}
            aria-hidden="true"
          >
            <div
              class={cn(
                "relative motion-reduce:hidden",
                l.happy ? "animate-game-exit-left" : "animate-game-exit-right",
              )}
            >
              <Show when={l.happy} fallback={<StormCloud />}>
                <For each={HEARTS}>
                  {(h) => (
                    <span
                      class="absolute top-0 left-1/2 block animate-game-float-up text-2xl text-game-pink"
                      style={{
                        "margin-left": `${h.x}px`,
                        "animation-delay": `${h.delay}s`,
                      }}
                    >
                      <Fa icon="fa-heart" />
                    </span>
                  )}
                </For>
              </Show>
              <SnackCustomer
                animal={l.c.animal}
                mood={l.happy ? "happy" : "angry"}
                shirt={l.c.shirt}
                class="h-auto w-full"
              />
            </div>
          </div>
        )}
      </Show>

      {/* current customer + order bubble */}
      <Show when={current()} keyed>
        {(c) => (
          <div
            class="absolute left-1/2 flex w-[min(22rem,80%)] -translate-x-1/2 flex-col items-center"
            style={{ bottom: `${COUNTER - 16}px` }}
          >
            <div class="relative mb-2 w-full max-w-xs animate-game-pop rounded-double bg-game-cloud px-4 pt-3 pb-3.5 text-center shadow-[0_6px_0_rgb(43_33_64/0.18)] motion-reduce:animate-none">
              <div class="flex items-center justify-center gap-2">
                <SnackIcon kind={c.snack} size={36} />
                <span class="text-sm font-bold text-game-ink/60">
                  {SNACK_NAMES[c.snack]} order
                </span>
              </div>
              <div
                class={cn(
                  "font-mono text-2xl font-bold break-words text-game-ink sm:text-3xl",
                  wrong() && "animate-game-shake motion-reduce:animate-none",
                )}
              >
                <span class="text-game-green">{typed()}</span>
                {c.order.slice(typed().length)}
              </div>
              <div
                class="mx-auto mt-2 h-2.5 w-4/5 overflow-hidden rounded-full bg-game-ink/10"
                role="progressbar"
                aria-label="patience"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(patience() * 100)}
              >
                <div
                  class={cn("h-full rounded-full", patienceColor())}
                  style={{ width: `${patience() * 100}%` }}
                ></div>
              </div>
              {/* bubble tail */}
              <span class="absolute -bottom-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 bg-game-cloud"></span>
            </div>
            <div class="w-40 animate-game-enter motion-reduce:animate-none sm:w-48">
              <SnackCustomer
                animal={c.animal}
                mood={moodFor(patience())}
                shirt={c.shirt}
                class="h-auto w-full"
              />
            </div>
          </div>
        )}
      </Show>

      <Counter />

      {/* points pop */}
      <Show when={pop()} keyed>
        {(x) => (
          <span
            class="pointer-events-none absolute left-1/2 z-[2] block animate-game-float-up text-3xl font-bold text-game-orange [text-shadow:0_2px_0_rgb(43_33_64/0.35)] motion-reduce:hidden"
            style={{ bottom: `${COUNTER + 40}px`, "margin-left": "5rem" }}
            aria-hidden="true"
          >
            {x.text}
          </span>
        )}
      </Show>

      {/* HUD + input */}
      <div class="pointer-events-none relative z-[1] flex h-full flex-col gap-3 p-4 pt-16">
        <TimeBar remaining={timer.remaining()} total={settings.seconds} />
        <div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-game-ink">
          <span class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]">
            <Fa icon="fa-star" class="mr-1.5 text-game-gold" />
            {state().score} pts
          </span>
          <span
            class={cn(
              "rounded-full px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]",
              rush()
                ? "animate-game-pulse bg-game-orange text-game-cream motion-reduce:animate-none"
                : "bg-game-cream",
            )}
          >
            <Fa icon="fa-bolt" class="mr-1.5" />
            {rush() ? "Rush hour x2" : `Combo ${state().combo}`}
          </span>
          <span
            class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]"
            aria-label={`${MAX_STRIKES - state().strikes} ${MAX_STRIKES - state().strikes === 1 ? "chance" : "chances"} left`}
          >
            <For each={Array.from({ length: MAX_STRIKES }, (_, i) => i)}>
              {(i) => (
                <Fa
                  icon="fa-heart"
                  class={cn(
                    "mx-0.5",
                    i < MAX_STRIKES - state().strikes
                      ? "text-game-red"
                      : "text-game-ink/15",
                  )}
                />
              )}
            </For>
          </span>
        </div>
        <div class="flex justify-center" aria-live="polite" role="status">
          <Show when={message()} keyed>
            {(m) => (
              <div class="animate-game-pop rounded-full bg-game-yellow px-5 py-1.5 text-lg font-bold text-game-ink shadow-[0_4px_0_rgb(43_33_64/0.25)] motion-reduce:animate-none">
                {m}
              </div>
            )}
          </Show>
        </div>
        <div class="flex-1"></div>
        <div class="flex justify-center">
          <MiniTypingInput
            value={typed()}
            onInput={onInput}
            wrong={wrong()}
            placeholder={current().order}
          />
        </div>
      </div>
    </div>
  );
}

/** Striped awning with a string of lights that flash in rush hour. */
function Awning(props: { rush: boolean }): JSXElement {
  return (
    <div class="absolute inset-x-0 top-0" aria-hidden="true">
      <div
        class="h-24"
        style={{
          background: `repeating-linear-gradient(90deg, ${game("pink")} 0 40px, ${game("cloud")} 40px 80px)`,
        }}
      ></div>
      <svg
        viewBox="0 0 80 14"
        preserveAspectRatio="none"
        class="block h-4 w-full"
      >
        <path
          d="M0 0 H80 V2 Q75 14 70 2 Q65 14 60 2 Q55 14 50 2 Q45 14 40 2 Q35 14 30 2 Q25 14 20 2 Q15 14 10 2 Q5 14 0 2 Z"
          fill={game("pink")}
        ></path>
      </svg>
      <div class="flex justify-around px-4 pt-1">
        <For each={BULBS}>
          {(i) => (
            <span
              class={cn(
                "block h-3 w-3 rounded-full",
                props.rush
                  ? "animate-game-twinkle motion-reduce:animate-none"
                  : "opacity-60",
              )}
              style={{
                "background-color": BULB_COLORS[i % BULB_COLORS.length],
                "animation-delay": `${(i % 4) * 0.25}s`,
                "animation-duration": "0.8s",
              }}
            ></span>
          )}
        </For>
      </div>
    </div>
  );
}

const JARS = [
  { lid: "pink", sweets: "yellow" },
  { lid: "blue", sweets: "red" },
  { lid: "green", sweets: "purple" },
];

const jarFill = (sweets: string): string => {
  const dot = (x: number, y: number): string =>
    `radial-gradient(circle at ${x}% ${y}%, ${game(sweets)} 0 6px, transparent 7px)`;
  return `${dot(30, 70)}, ${dot(70, 60)}, ${dot(50, 35)}, color-mix(in srgb, ${game("cloud")} 55%, transparent)`;
};

/** Two shelves of candy jars on the left wall, beside the customer. */
function Shelves(): JSXElement {
  return (
    <div
      class="absolute left-4 hidden flex-col gap-14 sm:flex"
      style={{ bottom: `${COUNTER + 50}px` }}
      aria-hidden="true"
    >
      <For each={[0, 1]}>
        {(shelf) => (
          <div class="flex flex-col items-center">
            <div class="flex items-end gap-2 px-2">
              <For each={JARS}>
                {(j, i) => (
                  <div class="flex flex-col items-center">
                    <span
                      class="block h-2.5 w-9 rounded-t-md"
                      style={{ "background-color": game(j.lid) }}
                    ></span>
                    <span
                      class="block w-11 rounded-b-xl border-4 border-game-cloud/80"
                      style={{
                        height: `${40 + ((i() + shelf) % 2) * 10}px`,
                        background: jarFill(
                          JARS[(i() + shelf) % JARS.length]?.sweets ?? j.sweets,
                        ),
                      }}
                    ></span>
                  </div>
                )}
              </For>
            </div>
            <span class="block h-3 w-48 rounded-md bg-game-brown shadow-[0_4px_0_var(--color-game-brown-dark)]"></span>
          </div>
        )}
      </For>
    </div>
  );
}

/** Wooden counter along the bottom (the typing box sits on it). */
function Counter(): JSXElement {
  return (
    <div
      class="absolute inset-x-0 bottom-0"
      style={{ height: `${COUNTER}px` }}
      aria-hidden="true"
    >
      <div class="h-5 bg-game-brown-dark"></div>
      <div
        class="h-full"
        style={{
          background: `repeating-linear-gradient(90deg, ${game("brown")} 0 120px, color-mix(in srgb, ${game("brown")} 85%, black) 120px 124px)`,
        }}
      ></div>
    </div>
  );
}

/** Grumpy rain cloud over a customer who gave up. */
function StormCloud(): JSXElement {
  return (
    <svg
      viewBox="0 0 80 50"
      class="absolute -top-10 left-1/2 w-20 -translate-x-1/2"
    >
      <g fill={game("grey")}>
        <ellipse cx="26" cy="22" rx="18" ry="13"></ellipse>
        <ellipse cx="46" cy="16" rx="18" ry="15"></ellipse>
        <ellipse cx="60" cy="24" rx="14" ry="11"></ellipse>
        <rect x="12" y="22" width="60" height="12" rx="6"></rect>
      </g>
      <path
        d="M40 34 L34 44 L42 42 L37 50"
        fill="none"
        stroke={game("yellow")}
        stroke-width="3"
        stroke-linejoin="round"
      ></path>
    </svg>
  );
}

import {
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
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TimeBar } from "../mini/TimeBar";
import {
  CUSTOMERS,
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
  SNACKS,
} from "./snack-rules";

type Customer = { face: string; snack: string; order: string };

/** Serve hungry customers by typing their orders before they give up. */
export function SnackShop(p: MiniGamePlayProps<SnackDifficulty>): JSXElement {
  const settings = untrack(() => p.difficulty);
  const words = untrack(() =>
    shuffled(p.words.length > 0 ? p.words : ["cake", "pie", "tea"]),
  );

  const newCustomer = (): Customer => ({
    face: pickRandom(CUSTOMERS, Math.random),
    snack: pickRandom(SNACKS, Math.random),
    order: makeOrder(words, settings.maxWords, Math.random),
  });

  const [state, setState] = createSignal<SnackState>(initialSnack());
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
    clearInterval(patienceTimer);
    const s = state();
    p.onFinish({
      score: s.score,
      wave: Math.max(1, s.served),
      headline: s.served >= 10 ? "Shop superstar!" : "Shop closed!",
      stats: [
        { label: "customers served", value: String(s.served) },
        { label: "best rush", value: String(s.bestCombo) },
        { label: "customers missed", value: String(s.strikes) },
        { label: "points", value: String(s.score) },
      ],
    });
  };

  const timer = useCountdown(settings.seconds, end);

  const nextCustomer = (): void => {
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
      flash(`${current().face} got tired of waiting!`);
      if (snackIsOver(next)) {
        timer.stop();
        end();
        return;
      }
      nextCustomer();
    }
  }, 100);
  onCleanup(() => {
    clearInterval(patienceTimer);
    clearTimeout(messageTimer);
  });

  const onInput = (value: string): void => {
    const order = current().order;
    if (!order.startsWith(value)) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value === order) {
      const before = state();
      const after = snackOnServe(before, order, patience());
      setState(after);
      if (!isRushHour(before) && isRushHour(after)) flash("Rush hour! x2");
      nextCustomer();
    }
  };

  return (
    <div class="flex h-full flex-col gap-3 p-4 pt-16 font-kid">
      <div class="flex items-center gap-3">
        <TimeBar remaining={timer.remaining()} total={settings.seconds} />
        <span class="w-12 text-right text-lg font-bold text-text tabular-nums">
          {Math.ceil(timer.remaining())}s
        </span>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
        <span class="rounded-full bg-sub-alt px-3 py-1 text-text">
          <Fa icon="fa-star" class="mr-1.5 text-main" />
          {state().score} pts
        </span>
        <span
          class={cn(
            "rounded-full px-3 py-1",
            isRushHour(state()) ? "bg-main text-bg" : "bg-sub-alt text-text",
          )}
        >
          <Fa icon="fa-bolt" class="mr-1.5" />
          {isRushHour(state()) ? "Rush hour x2" : `Combo ${state().combo}`}
        </span>
        <span
          class="rounded-full bg-sub-alt px-3 py-1 text-text"
          aria-label={`${MAX_STRIKES - state().strikes} ${MAX_STRIKES - state().strikes === 1 ? "chance" : "chances"} left`}
        >
          <For each={Array.from({ length: MAX_STRIKES }, (_, i) => i)}>
            {(i) => (
              <Fa
                icon="fa-heart"
                class={cn(
                  "mx-0.5",
                  i < MAX_STRIKES - state().strikes ? "text-error" : "text-bg",
                )}
              />
            )}
          </For>
        </span>
      </div>

      <div class="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-double bg-sub-alt/50 p-4">
        <Show when={message()}>
          {(m) => (
            <div class="absolute top-3 z-10 rounded-full bg-main px-4 py-1.5 text-base font-bold text-bg">
              {m()}
            </div>
          )}
        </Show>
        <div class="grid justify-items-center gap-2">
          <div class="relative max-w-full rounded-double bg-bg px-5 py-3 text-center shadow">
            <div class="text-xs font-semibold text-sub">
              {current().snack} order
            </div>
            <div class="font-mono text-2xl font-bold break-words text-text sm:text-3xl">
              <span class="text-main">{typed()}</span>
              {current().order.slice(typed().length)}
            </div>
          </div>
          <div class="text-7xl leading-none" aria-hidden="true">
            {current().face}
          </div>
          <div
            class="h-3 w-48 overflow-hidden rounded-full bg-bg"
            aria-label="patience"
          >
            <div
              class={cn(
                "h-full rounded-full",
                patience() < 0.3 ? "bg-error" : "bg-main",
              )}
              style={{ width: `${patience() * 100}%` }}
            ></div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-sm text-sub">
          <span>Next:</span>
          <For each={queue()}>
            {(c) => (
              <span class="text-3xl opacity-70" aria-hidden="true">
                {c.face}
              </span>
            )}
          </For>
        </div>
      </div>

      <div class="flex justify-center">
        <MiniTypingInput
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          placeholder={current().order}
        />
      </div>
    </div>
  );
}

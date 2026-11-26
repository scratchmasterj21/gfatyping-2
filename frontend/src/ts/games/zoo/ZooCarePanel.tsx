import { createSignal, For, JSXElement, Match, Show, Switch } from "solid-js";

import { Button } from "../../components/common/Button";
import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";
import { CoinCountUp } from "../mini/CoinCountUp";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { CARE_JOB_INFO, ZooCareJob } from "./zoo-areas";

/**
 * One daily care job: type its words one by one. `onWord` lets the zoo play
 * a care animation; `onDone` claims the coins (null = already paid today).
 */
export function ZooCarePanel(props: {
  job: ZooCareJob;
  words: string[];
  paidToday: boolean;
  onWord: (index: number) => void;
  onDone: (job: ZooCareJob) => Promise<number | null>;
  onClose: () => void;
}): JSXElement {
  const [index, setIndex] = createSignal(0);
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [result, setResult] = createSignal<
    "pending" | "claiming" | number | null
  >("pending");

  const word = (): string => props.words[index()] ?? "";
  const finished = (): boolean => index() >= props.words.length;

  const onInput = (value: string): void => {
    if (finished()) return;
    if (!word().startsWith(value)) {
      if (!wrong()) sfx.oops();
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value !== word()) return;
    props.onWord(index());
    setTyped("");
    setIndex((i) => i + 1);
    if (index() < props.words.length) {
      sfx.good();
      return;
    }
    sfx.great();
    setResult("claiming");
    void props.onDone(props.job).then(setResult);
  };

  return (
    <div class="grid gap-3 rounded-double bg-sub-alt p-4 font-kid">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-lg font-bold text-text">
          <Fa icon={CARE_JOB_INFO[props.job].icon} class="text-main" />
          {CARE_JOB_INFO[props.job].title}
        </div>
        <Button
          variant="text"
          fa={{ icon: "fa-times", fixedWidth: true }}
          onClick={() => props.onClose()}
        />
      </div>

      <div class="flex flex-wrap justify-center gap-2">
        <For each={props.words}>
          {(w, i) => (
            <span
              class={cn(
                "rounded-full px-3 py-1 font-mono text-base font-bold",
                i() < index()
                  ? "bg-main text-bg"
                  : i() === index()
                    ? "bg-bg text-text ring-2 ring-main"
                    : "bg-bg text-sub",
              )}
            >
              <Show when={i() < index()}>
                <Fa icon="fa-check" class="mr-1" size={0.8} />
              </Show>
              {w}
            </span>
          )}
        </For>
      </div>

      <Show
        when={!finished()}
        fallback={
          <div
            class="grid min-h-16 place-items-center text-center text-base font-semibold"
            aria-live="polite"
          >
            <Switch>
              <Match when={result() === "claiming"}>
                <span class="text-sub">Adding coins…</span>
              </Match>
              <Match
                when={(() => {
                  const r = result();
                  return typeof r === "number" && r > 0 ? r : false;
                })()}
              >
                {(coins) => (
                  <div class="grid justify-items-center gap-1">
                    <span class="text-text">
                      All done - the animals love you!
                    </span>
                    <CoinCountUp coins={coins()} />
                  </div>
                )}
              </Match>
              <Match when={true}>
                <span class="text-text">
                  All done! You already got today&apos;s coins for this job.
                </span>
              </Match>
            </Switch>
          </div>
        }
      >
        <div class="text-center font-mono text-3xl font-bold text-text">
          <span class="text-main">{typed()}</span>
          {word().slice(typed().length)}
        </div>
        <div class="flex justify-center">
          <MiniTypingInput
            value={typed()}
            onInput={onInput}
            wrong={wrong()}
            placeholder={word()}
          />
        </div>
        <Show when={props.paidToday}>
          <p class="text-center text-xs text-sub">
            Already done today - this one is just for fun.
          </p>
        </Show>
      </Show>
    </div>
  );
}

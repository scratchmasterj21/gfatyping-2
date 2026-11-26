import { For, JSXElement, Match, Switch } from "solid-js";

import { cn } from "../../utils/cn";
import { UltimateId } from "./quest-rules";

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/**
 * The big, whole-battlefield part of a super move (falling hail, a healing
 * glow over the party, a shield dome, a ground crack...). Monsters are on
 * the left half, heroes on the right.
 */
export function UltimateField(props: { kind: UltimateId }): JSXElement {
  return (
    <div class="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <Switch>
        <Match when={props.kind === "icestorm"}>
          <div class="absolute inset-0 animate-quest-flash bg-game-sky/40"></div>
          <For each={range(44)}>
            {(i) => (
              <span
                class="absolute top-0 h-14 w-3 animate-quest-shard rounded-full bg-linear-to-b from-game-cream to-game-sky shadow-[0_0_10px_var(--color-game-sky)]"
                style={{
                  left: `${(i * 31) % 52}%`,
                  "animation-delay": `${((i * 7) % 14) * 0.05}s`,
                }}
              ></span>
            )}
          </For>
        </Match>
        <Match when={props.kind === "thunder"}>
          <div class="absolute inset-0 animate-quest-flash bg-game-cream [animation-delay:0.3s]"></div>
          <div class="absolute inset-0 animate-quest-flash bg-game-yellow/50 [animation-delay:0.5s]"></div>
        </Match>
        <Match when={props.kind === "holy" || props.kind === "judgement"}>
          <div class="absolute -top-1/3 left-0 h-full w-1/2 animate-quest-flash rounded-full bg-radial from-game-gold/80 to-transparent"></div>
        </Match>
        <Match when={props.kind === "arrowrain" || props.kind === "startoss"}>
          <For each={range(30)}>
            {(i) => (
              <span
                class={cn(
                  "absolute top-0 animate-quest-shard",
                  props.kind === "arrowrain"
                    ? "h-12 w-1 rounded-full bg-linear-to-b from-game-cream to-game-brown"
                    : "text-xl",
                )}
                style={{
                  left: `${(i * 31) % 52}%`,
                  "animation-delay": `${((i * 7) % 14) * 0.05}s`,
                }}
              >
                {props.kind === "startoss" ? "✴️" : ""}
              </span>
            )}
          </For>
        </Match>
        <Match when={props.kind === "phoenix"}>
          <div class="absolute inset-y-0 left-0 w-1/2 animate-quest-flash bg-linear-to-t from-game-orange/70 via-game-red/40 to-transparent"></div>
          <span class="absolute top-1/4 left-1/4 animate-quest-rise text-6xl [--fx-x:0px]">
            🔥
          </span>
        </Match>
        <Match when={props.kind === "aura"}>
          <div class="absolute right-[1%] bottom-0 h-[92%] w-[46%] origin-bottom animate-quest-dome rounded-t-full border-4 border-game-gold bg-game-gold/20 shadow-[0_0_40px_var(--color-game-gold)]"></div>
        </Match>
        <Match when={props.kind === "titan"}>
          <div class="absolute bottom-[14%] left-[3%] h-2 w-[46%] origin-right animate-quest-crack rounded-full bg-game-ink shadow-[0_0_10px_var(--color-game-grey)]"></div>
          <div class="absolute inset-x-0 bottom-0 h-1/3 animate-quest-flash bg-linear-to-t from-game-grey/70 to-transparent [animation-delay:0.2s]"></div>
        </Match>
        <Match when={props.kind === "vanish"}>
          <div class="absolute inset-y-0 right-0 w-1/2 animate-quest-flash bg-game-ink/60"></div>
        </Match>
        <Match when={props.kind === "mighty"}>
          <div class="absolute inset-0 animate-quest-flash bg-game-cream [animation-delay:0.4s]"></div>
        </Match>
        <Match when={props.kind === "whirlwind"}>
          <For each={range(12)}>
            {(i) => (
              <span
                class="absolute -left-24 h-1 w-28 animate-quest-wind rounded-full bg-game-cream/70"
                style={{
                  top: `${((i * 23) % 85) + 5}%`,
                  "animation-delay": `${((i * 5) % 8) * 0.06}s`,
                  "animation-iteration-count": "1",
                }}
              ></span>
            )}
          </For>
        </Match>
        <Match when={props.kind === "groupheal"}>
          <div class="absolute inset-y-0 right-0 w-1/2 animate-quest-flash bg-linear-to-t from-game-green/60 to-transparent"></div>
          <For each={range(14)}>
            {(i) => (
              <span
                class="absolute bottom-[10%] animate-quest-rise text-2xl"
                style={{
                  right: `${4 + ((i * 29) % 44)}%`,
                  "--fx-x": "0px",
                  "animation-delay": `${((i * 3) % 10) * 0.07}s`,
                  "animation-duration": "1.2s",
                }}
              >
                {i % 3 === 0 ? "✨" : "💚"}
              </span>
            )}
          </For>
        </Match>
        <Match when={props.kind === "wall"}>
          <div class="absolute right-[1%] bottom-0 h-[92%] w-[46%] origin-bottom animate-quest-dome rounded-t-full border-4 border-game-blue bg-game-blue/20 shadow-[0_0_40px_var(--color-game-blue)]"></div>
          <div class="absolute right-[6%] bottom-0 h-[80%] w-[36%] origin-bottom animate-quest-dome rounded-t-full border-2 border-game-cream/60 [animation-delay:0.1s]"></div>
        </Match>
        <Match when={props.kind === "slam"}>
          <div class="absolute bottom-[14%] left-[3%] h-2 w-[46%] origin-right animate-quest-crack rounded-full bg-game-ink shadow-[0_0_10px_var(--color-game-orange)]"></div>
          <div class="absolute bottom-[10%] left-[8%] h-1.5 w-[36%] origin-right animate-quest-crack rounded-full bg-game-ink [animation-delay:0.12s]"></div>
          <div class="absolute inset-x-0 bottom-0 h-1/3 animate-quest-flash bg-linear-to-t from-game-tan/70 to-transparent [animation-delay:0.2s]"></div>
        </Match>
      </Switch>
    </div>
  );
}

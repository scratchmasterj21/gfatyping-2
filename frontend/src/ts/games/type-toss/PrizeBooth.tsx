import { For, JSXElement, Show } from "solid-js";

import type { Booth } from "./toss-store";

import { cn } from "../../utils/cn";
import { PRIZES } from "./toss-rules";

/** Spend banked tickets on plushies; owned ones sit on your shelf. */
export function PrizeBooth(props: {
  booth: Booth;
  signedIn: boolean;
  onBuy: (id: string) => void;
}): JSXElement {
  const owned = (id: string): boolean => props.booth.prizes.includes(id);
  return (
    <div class="grid gap-3">
      <div class="rounded-xl bg-sub-alt p-3 text-center">
        <div class="text-3xl font-bold text-text">🎟️ {props.booth.tickets}</div>
        <div class="text-sm text-sub">
          {props.signedIn
            ? "tickets to spend - win more by playing!"
            : "Sign in to save tickets and prizes."}
        </div>
      </div>
      <div class="grid gap-1">
        <div class="text-sm font-bold text-sub">🧸 My shelf</div>
        <div class="flex min-h-12 flex-wrap gap-1 rounded-xl border-b-8 border-game-brown bg-game-tan/30 p-2 text-3xl">
          <Show
            when={props.booth.prizes.length > 0}
            fallback={<span class="text-sm text-sub">No prizes yet</span>}
          >
            <For each={PRIZES.filter((p) => owned(p.id))}>
              {(p) => <span title={p.name}>{p.emoji}</span>}
            </For>
          </Show>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <For each={PRIZES}>
          {(p) => {
            const can = (): boolean =>
              props.signedIn && !owned(p.id) && props.booth.tickets >= p.price;
            return (
              <button
                type="button"
                disabled={!can()}
                class={cn(
                  "grid place-items-center gap-0.5 rounded-xl border-2 p-2 text-center",
                  owned(p.id)
                    ? "border-main bg-main/15 text-text"
                    : can()
                      ? "cursor-pointer border-game-yellow bg-sub-alt text-text"
                      : "cursor-not-allowed border-transparent bg-sub-alt text-sub opacity-60",
                )}
                onClick={() => props.onBuy(p.id)}
              >
                <span class="text-3xl">{p.emoji}</span>
                <span class="text-xs font-bold">{p.name}</span>
                <span class="text-xs">
                  {owned(p.id) ? "✓ yours" : `🎟️ ${p.price}`}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}

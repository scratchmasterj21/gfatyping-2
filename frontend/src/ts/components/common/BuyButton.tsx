import { createSignal, JSXElement, onCleanup, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

const CONFIRM_RESET_MS = 3000;

/** Price button that needs a second tap to spend coins. */
export function BuyButton(props: {
  price: number;
  coins: number;
  busy: boolean;
  locked: boolean;
  onBuy: () => void;
  class?: string;
}): JSXElement {
  const [confirming, setConfirming] = createSignal(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(resetTimer));

  const short = (): number => Math.max(0, props.price - props.coins);

  return (
    <button
      type="button"
      class={cn(
        "flex items-center gap-1 rounded px-2 py-1 text-em-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        confirming() ? "bg-main text-bg" : "bg-bg text-text hover:text-main",
        props.class,
      )}
      disabled={short() > 0 || props.locked}
      onClick={() => {
        clearTimeout(resetTimer);
        if (!confirming()) {
          setConfirming(true);
          resetTimer = setTimeout(() => setConfirming(false), CONFIRM_RESET_MS);
          return;
        }
        setConfirming(false);
        props.onBuy();
      }}
    >
      <Show
        when={!props.busy}
        fallback={<Fa icon="fa-circle-notch" spin size={0.7} />}
      >
        <Fa icon={confirming() ? "fa-check" : "fa-coins"} size={0.7} />
      </Show>
      <Show when={short() === 0} fallback={`need ${short()} more`}>
        {confirming() ? `buy for ${props.price}?` : props.price}
      </Show>
    </button>
  );
}

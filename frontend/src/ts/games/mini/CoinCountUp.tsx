import {
  createSignal,
  JSXElement,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { sfx } from "./mini-sounds";

/** "+N coins!" that counts up with a ding per coin. */
export function CoinCountUp(props: { coins: number }): JSXElement {
  const target = untrack(() => props.coins);
  const [shown, setShown] = createSignal(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setShown(target);
      sfx.coin();
      return;
    }
    timer = setInterval(() => {
      const next = shown() + 1;
      setShown(next);
      sfx.coin();
      if (next >= target) clearInterval(timer);
    }, 180);
  });
  onCleanup(() => clearInterval(timer));
  return (
    <span class="inline-flex animate-game-pop items-center gap-2 rounded-full bg-game-gold px-4 py-1.5 text-lg font-bold text-game-ink motion-reduce:animate-none">
      <Fa icon="fa-coins" />+{shown()} coins!
    </span>
  );
}

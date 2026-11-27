import { createSignal, For, JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";

/**
 * How to play, kept small: a few short tips always shown, the full rules
 * behind a button so they don't push the game choices off screen.
 */
export function GameHowTo(props: {
  tips: string[];
  children: JSXElement;
}): JSXElement {
  const [open, setOpen] = createSignal(false);
  return (
    <section class="mb-4 grid gap-2">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-sub-alt/60 px-3 py-2 font-kid text-sm text-text">
        <For each={props.tips}>{(tip) => <span>{tip}</span>}</For>
        <button
          type="button"
          aria-expanded={open()}
          class="ml-auto flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-main px-3 font-bold text-bg"
          onClick={() => setOpen((o) => !o)}
        >
          <Fa icon={open() ? "fa-times" : "fa-question-circle"} />
          {open() ? "Close" : "How to play"}
        </button>
      </div>
      <Show when={open()}>
        <div class="rounded-xl bg-sub-alt/40 p-3">{props.children}</div>
      </Show>
    </section>
  );
}

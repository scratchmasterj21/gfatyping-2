import { createSignal, JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";

/** Extra free-play choices (word lists, match length) stay out of the first screen. */
export function GameSetupMore(props: { children: JSXElement }): JSXElement {
  const [open, setOpen] = createSignal(false);
  return (
    <section class="mb-4 grid gap-2">
      <button
        type="button"
        class="press-3d flex min-h-12 items-center justify-between rounded-xl bg-sub-alt px-4 text-base font-semibold text-text"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
      >
        More
        <Fa
          icon="fa-chevron-down"
          class={cn(
            "text-sub transition-transform",
            open() ? "rotate-180" : "",
          )}
        />
      </button>
      <Show when={open()}>{props.children}</Show>
    </section>
  );
}

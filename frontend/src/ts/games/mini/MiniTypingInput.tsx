import { JSXElement, onMount } from "solid-js";

import { cn } from "../../utils/cn";

/**
 * Big, kid-friendly typing box. Plain <input> so the iPad on-screen
 * keyboard appears; autocorrect/caps are off so words stay exact.
 */
export function MiniTypingInput(props: {
  value: string;
  onInput: (value: string) => void;
  onEnter?: () => void;
  wrong?: boolean;
  placeholder?: string;
  ref?: (el: HTMLInputElement) => void;
}): JSXElement {
  let el: HTMLInputElement | undefined;
  onMount(() => el?.focus());
  return (
    <input
      ref={(e) => {
        el = e;
        props.ref?.(e);
      }}
      type="text"
      value={props.value}
      placeholder={props.placeholder ?? "type here"}
      aria-label="Type here"
      autocomplete="off"
      autocapitalize="off"
      // oxlint-disable-next-line react/no-unknown-property
      autocorrect="off"
      spellcheck={false}
      class={cn(
        "pointer-events-auto w-full max-w-md rounded-double border-4 bg-game-cream px-5 py-3 text-center font-mono text-2xl font-bold text-game-ink shadow-[0_6px_0_rgb(43_33_64/0.25)] outline-none placeholder:text-game-ink/35",
        props.wrong === true
          ? "animate-game-shake border-game-red motion-reduce:animate-none"
          : "border-game-ink/15 focus:border-game-blue",
      )}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          props.onEnter?.();
        }
      }}
    />
  );
}

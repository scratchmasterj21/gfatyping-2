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
        "w-full max-w-md rounded-double border-4 bg-sub-alt px-5 py-3 text-center font-mono text-2xl text-text outline-none",
        props.wrong === true
          ? "border-error"
          : "border-main/60 focus:border-main",
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

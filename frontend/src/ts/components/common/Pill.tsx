import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { Fa, FaProps } from "./Fa";

export type PillProps = {
  text?: string;
  fa?: FaProps;
  tone?: "main" | "sub" | "error";
  size?: "sm" | "md";
  class?: string;
  children?: JSXElement;
};

/** Small rounded badge for counts, coins, streaks, levels. */
export function Pill(props: PillProps): JSXElement {
  const tone = () => props.tone ?? "main";
  return (
    <span
      class={cn(
        "inline-flex items-center gap-[0.4em] rounded-full font-kid leading-none font-semibold whitespace-nowrap",
        (props.size ?? "md") === "md" && "px-3 py-1.5 text-sm",
        props.size === "sm" && "px-2 py-1 text-xs",
        tone() === "main" && "bg-main text-bg",
        tone() === "sub" && "bg-sub-alt text-text",
        tone() === "error" && "bg-error text-bg",
        props.class,
      )}
    >
      <Show when={props.fa !== undefined}>
        <Fa {...(props.fa as FaProps)} />
      </Show>
      <Show when={props.text !== undefined}>{props.text}</Show>
      {props.children}
    </span>
  );
}

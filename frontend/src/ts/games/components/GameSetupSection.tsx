import { JSXElement } from "solid-js";

import { cn } from "../../utils/cn";

export function GameSetupSection(props: {
  title: string;
  accent?: boolean;
  class?: string;
  children: JSXElement;
}): JSXElement {
  return (
    <section class={cn("mb-4 grid gap-2", props.class)}>
      <p
        class={cn(
          "text-em-xs font-semibold tracking-wider uppercase",
          props.accent === true ? "text-main" : "text-sub",
        )}
      >
        {props.title}
      </p>
      {props.children}
    </section>
  );
}

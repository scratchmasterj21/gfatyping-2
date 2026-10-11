import { JSXElement, Show } from "solid-js";

import { findTitle } from "../../titles/titles";
import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

/** Earned title chip; renders nothing for unknown/missing ids. */
export function TitleBadge(props: {
  titleId: string | undefined;
  class?: string;
}): JSXElement {
  return (
    <Show when={findTitle(props.titleId)}>
      {(title) => (
        <span
          class={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full bg-main/15 px-2 py-0.5 text-em-xs font-medium whitespace-nowrap text-main",
            props.class,
          )}
        >
          <Fa icon={title().icon} size={0.7} />
          {title().label}
        </span>
      )}
    </Show>
  );
}

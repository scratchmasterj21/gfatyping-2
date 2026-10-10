import { JSXElement, Show } from "solid-js";

import { FaSolidIcon } from "../../types/font-awesome";
import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

export function EmptyState(props: {
  icon: FaSolidIcon;
  title: string;
  hint?: string;
  class?: string;
}): JSXElement {
  return (
    <div
      class={cn(
        "grid justify-items-center gap-2 py-8 text-center text-sub",
        props.class,
      )}
    >
      <div class="flex h-14 w-14 items-center justify-center rounded-full bg-bg">
        <Fa icon={props.icon} size={1.5} class="text-main" />
      </div>
      <div class="font-bold text-text">{props.title}</div>
      <Show when={props.hint !== undefined}>
        <div class="max-w-sm text-sm">{props.hint}</div>
      </Show>
    </div>
  );
}

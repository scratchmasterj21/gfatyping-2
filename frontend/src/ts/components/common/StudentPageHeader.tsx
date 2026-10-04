import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { H2 } from "./Headers";

export function StudentPageHeader(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  class?: string;
}): JSXElement {
  return (
    <header class={cn("grid gap-1", props.class)}>
      <Show when={props.eyebrow !== undefined}>
        <p class="text-sm font-semibold tracking-wide text-main uppercase">
          {props.eyebrow}
        </p>
      </Show>
      <H2
        text={props.title}
        class="student-page-heading p-0 text-xl text-text md:text-2xl"
      />
      <Show when={props.subtitle !== undefined}>
        <p class="text-sub">{props.subtitle}</p>
      </Show>
    </header>
  );
}

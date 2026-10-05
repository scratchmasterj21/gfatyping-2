import { JSXElement, Show } from "solid-js";

export function GamePickLayout(props: {
  header: JSXElement;
  footer?: JSXElement;
  children: JSXElement;
}): JSXElement {
  return (
    <div class="flex max-h-[94vh] min-h-0 flex-col p-5">
      {props.header}
      <div class="min-h-0 flex-1 overflow-y-auto pt-4">{props.children}</div>
      <Show when={props.footer !== undefined}>
        <div class="sticky bottom-0 shrink-0 border-t border-sub-alt bg-bg pt-3">
          {props.footer}
        </div>
      </Show>
    </div>
  );
}

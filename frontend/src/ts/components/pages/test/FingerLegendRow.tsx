import { For, JSXElement } from "solid-js";

import { FINGER_LABEL, FINGER_ORDER } from "../../../lessons/finger-map";
import { cn } from "../../../utils/cn";

/** Colored swatch row matching keymap finger colors. */
export function FingerLegendRow(props: { class?: string }): JSXElement {
  return (
    <div class={cn("fingerLegend", props.class)}>
      <For each={FINGER_ORDER}>
        {(finger) => (
          <span class="item">
            <span class="swatch" data-finger={finger}></span>
            {FINGER_LABEL[finger]}
          </span>
        )}
      </For>
    </div>
  );
}

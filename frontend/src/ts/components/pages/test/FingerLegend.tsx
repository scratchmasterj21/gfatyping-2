import { For, JSXElement, Show } from "solid-js";

import { getConfig } from "../../../config/store";
import { FINGER_LABEL, FINGER_ORDER } from "../../../lessons/finger-map";

/**
 * Legend shown under the keymap when finger coloring is on: a colored swatch per
 * finger with its name, so students can match key colors to fingers.
 */
export function FingerLegend(): JSXElement {
  return (
    <Show when={getConfig.keymapShowFingers && getConfig.keymapMode !== "off"}>
      <div class="fingerLegend">
        <For each={FINGER_ORDER}>
          {(finger) => (
            <span class="item">
              <span class="swatch" data-finger={finger}></span>
              {FINGER_LABEL[finger]}
            </span>
          )}
        </For>
      </div>
    </Show>
  );
}

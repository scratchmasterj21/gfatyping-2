import { JSXElement, Show } from "solid-js";

import { getConfig } from "../../../config/store";
import { FingerLegendRow } from "./FingerLegendRow";

/**
 * Legend shown under the keymap when finger coloring is on: a colored swatch per
 * finger with its name, so students can match key colors to fingers.
 */
export function FingerLegend(): JSXElement {
  return (
    <Show
      when={
        getConfig.keymapShowFingers &&
        getConfig.keymapMode !== "off" &&
        !getConfig.showGuidedHands
      }
    >
      <FingerLegendRow />
    </Show>
  );
}

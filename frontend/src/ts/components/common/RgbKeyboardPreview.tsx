import { JSXElement } from "solid-js";

import { RgbPaletteItemId } from "../../rgb-palettes/rgb-palette-items";
import { cn } from "../../utils/cn";
import {
  generateMechanicalKeyboardSvg,
  withGradientId,
} from "../pages/test/mechanical-keyboard-svg";
import { cachedSvg, SVG_WRAP_CLASS } from "./keyboard-svg-cache";

let previewCount = 0;

export function RgbKeyboardPreview(props: {
  palette: RgbPaletteItemId;
  class?: string;
}): JSXElement {
  // unique gradient id per copy (ids are page-global)
  const gradId = `rgb-pv-${++previewCount}`;
  return (
    <div
      class={cn(SVG_WRAP_CLASS, props.class)}
      // eslint-disable-next-line solid/no-innerhtml -- generated locally, no user input
      innerHTML={withGradientId(
        cachedSvg(`rgb-${props.palette}`, () =>
          generateMechanicalKeyboardSvg(props.palette),
        ),
        gradId,
      )}
    ></div>
  );
}

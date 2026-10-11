import { JSXElement } from "solid-js";

import { RgbPaletteItemId } from "../../rgb-palettes/rgb-palette-items";
import { cn } from "../../utils/cn";
import { generateMechanicalKeyboardSvg } from "../pages/test/mechanical-keyboard-svg";
import { cachedSvg, SVG_WRAP_CLASS } from "./keyboard-svg-cache";

export function RgbKeyboardPreview(props: {
  palette: RgbPaletteItemId;
  class?: string;
}): JSXElement {
  return (
    <div
      class={cn(SVG_WRAP_CLASS, props.class)}
      // eslint-disable-next-line solid/no-innerhtml -- generated locally, no user input
      innerHTML={cachedSvg(`rgb-${props.palette}`, () =>
        generateMechanicalKeyboardSvg(props.palette),
      )}
    ></div>
  );
}

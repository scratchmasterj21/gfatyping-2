import { JSXElement } from "solid-js";

import { KeyboardSkinItemId } from "../../keyboard-skins/keyboard-skin-items";
import { cn } from "../../utils/cn";
import { generateSkinKeyboardSvg } from "../pages/test/mechanical-keyboard-svg";
import { cachedSvg, SVG_WRAP_CLASS } from "./keyboard-svg-cache";

/** Same SVG the typing page draws for this skin, scaled to fit. */
export function SkinKeyboardPreview(props: {
  skin: KeyboardSkinItemId;
  class?: string;
}): JSXElement {
  return (
    <div
      class={cn(SVG_WRAP_CLASS, props.class)}
      // eslint-disable-next-line solid/no-innerhtml -- generated locally, no user input
      innerHTML={cachedSvg(`skin-${props.skin}`, () =>
        generateSkinKeyboardSvg(props.skin),
      )}
    ></div>
  );
}

import { JSXElement } from "solid-js";

import { FaSolidIcon } from "../../types/font-awesome";
import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

/** Thumbnail: the effect's icon on a keycap. */
export function EffectThumb(props: {
  icon: FaSolidIcon;
  none?: boolean;
}): JSXElement {
  return (
    <span class="relative flex h-10 w-10 items-center justify-center rounded-md border-b-4 border-bg bg-sub text-bg">
      <Fa icon={props.icon} class={cn(props.none ? "" : "text-main")} />
    </span>
  );
}

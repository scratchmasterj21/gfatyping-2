import { JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";

export function GameSetupPrimaryAction(props: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  showArrow?: boolean;
  class?: string;
}): JSXElement {
  return (
    <button
      type="button"
      class={cn(
        "press-3d min-h-14 w-full cursor-pointer rounded-double bg-main py-3 text-lg font-bold text-bg [--press-color:color-mix(in_srgb,var(--main-color)_60%,black)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50",
        props.class,
      )}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.text}
      <Show when={props.showArrow !== false}>
        <Fa icon="fa-arrow-right" class="ml-2" />
      </Show>
    </button>
  );
}

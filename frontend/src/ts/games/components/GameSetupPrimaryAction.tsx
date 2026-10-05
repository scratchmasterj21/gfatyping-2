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
        "w-full cursor-pointer rounded-xl bg-main py-3 text-base font-bold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
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

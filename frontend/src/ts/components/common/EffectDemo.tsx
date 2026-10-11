import { For, JSXElement, Show } from "solid-js";

import { FaSolidIcon } from "../../types/font-awesome";
import { Fa } from "./Fa";

const DEMO_WORD = "type";

/** Try-on: a demo word with the effect bursting on each key. */
export function EffectDemo(props: {
  icon: FaSolidIcon;
  none?: boolean;
}): JSXElement {
  return (
    <div class="flex gap-1.5">
      <For each={DEMO_WORD.split("")}>
        {(letter, i) => (
          <span class="relative flex h-10 w-10 items-center justify-center rounded-md border-b-4 border-bg bg-sub font-mono text-lg text-bg">
            {letter}
            <Show when={!props.none}>
              <span
                class="absolute -top-2 -right-2 animate-ping text-main"
                style={{ "animation-delay": `${i() * 0.25}s` }}
              >
                <Fa icon={props.icon} size={0.8} />
              </span>
            </Show>
          </span>
        )}
      </For>
    </div>
  );
}

import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { kartUrl } from "./car-art";
import { CarLook, garageItem } from "./race-rules";

/** My car with its colour, sticker and driver. */
export function CarPreview(props: {
  look: CarLook;
  class?: string;
}): JSXElement {
  return (
    <div class={cn("relative", props.class)}>
      <img
        src={kartUrl(garageItem(props.look.color)?.color ?? "blue")}
        alt="your car"
        class="h-auto w-full"
      />
      <Show when={garageItem(props.look.driver)?.emoji}>
        {(d) => (
          <span class="absolute top-[-14%] left-[30%] text-[length:inherit]">
            {d()}
          </span>
        )}
      </Show>
      <Show when={garageItem(props.look.sticker)?.emoji}>
        {(s) => (
          <span class="absolute top-[48%] left-[48%] text-sm">{s()}</span>
        )}
      </Show>
    </div>
  );
}

import { JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";

export function SoloTogetherToggle(props: {
  mode: "solo" | "together";
  multiplayerUnlocked: boolean;
  unlockHint: string;
  onModeChange: (mode: "solo" | "together") => void;
  soloLabel?: string;
  togetherLabel?: string;
}): JSXElement {
  const soloLabel = (): string => props.soloLabel ?? "Play solo";
  const togetherLabel = (): string => props.togetherLabel ?? "Play together";
  return (
    <>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class={cn(
            "press-3d min-h-12 rounded-xl px-3 py-2 text-base font-semibold",
            props.mode === "solo"
              ? "bg-main text-bg"
              : "bg-sub-alt text-sub hover:text-text",
          )}
          onClick={() => props.onModeChange("solo")}
        >
          {soloLabel()}
        </button>
        <button
          type="button"
          class={cn(
            "press-3d flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-base font-semibold",
            props.mode === "together"
              ? "bg-main text-bg"
              : "bg-sub-alt text-sub hover:text-text",
            !props.multiplayerUnlocked && "opacity-70",
          )}
          disabled={!props.multiplayerUnlocked}
          onClick={() => {
            if (props.multiplayerUnlocked) props.onModeChange("together");
          }}
        >
          <Show when={!props.multiplayerUnlocked}>
            <Fa icon="fa-lock" size={0.75} />
          </Show>
          {togetherLabel()}
        </button>
      </div>
      <Show when={!props.multiplayerUnlocked}>
        <p class="text-center text-sm text-sub">{props.unlockHint}</p>
      </Show>
    </>
  );
}

import { For, JSXElement, Show } from "solid-js";

import { cn } from "../../../utils/cn";
import { GameSetupSection } from "../GameSetupSection";
import { SoloTogetherToggle } from "../SoloTogetherToggle";

/** Setup: "Play solo / Play together" plus, together, the match length. */
export function ScoreRaceModeSection(props: {
  mode: "solo" | "together";
  onModeChange: (mode: "solo" | "together") => void;
  /** offer a match length choice (seconds); omit when the game times itself */
  lengths?: readonly number[];
  length?: number;
  onLengthChange?: (seconds: number) => void;
}): JSXElement {
  return (
    <>
      <GameSetupSection title="Mode">
        <SoloTogetherToggle
          mode={props.mode}
          multiplayerUnlocked
          unlockHint=""
          onModeChange={props.onModeChange}
        />
      </GameSetupSection>
      <Show when={props.mode === "together" && props.lengths}>
        {(lengths) => (
          <GameSetupSection title="Match length">
            <div class="grid grid-cols-3 gap-2">
              <For each={lengths()}>
                {(seconds) => (
                  <button
                    type="button"
                    class={cn(
                      "min-h-12 rounded-xl px-3 py-3 text-base font-semibold",
                      props.length === seconds
                        ? "bg-main text-bg"
                        : "bg-bg text-sub hover:text-text",
                    )}
                    onClick={() => props.onLengthChange?.(seconds)}
                  >
                    {seconds < 60 ? `${seconds}s` : `${seconds / 60} min`}
                  </button>
                )}
              </For>
            </div>
          </GameSetupSection>
        )}
      </Show>
    </>
  );
}

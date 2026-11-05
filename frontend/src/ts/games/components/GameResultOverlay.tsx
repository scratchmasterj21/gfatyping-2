import { For, JSXElement, Show } from "solid-js";

import { Button } from "../../components/common/Button";
import { Mascot } from "../../components/common/Mascot";
import { Confetti } from "../mini/Confetti";
import { StarRating } from "../mini/StarRating";

export type GameResultView = {
  headline: string;
  score: number;
  /** Word under the big number; defaults to "points". */
  scoreLabel?: string;
  /** 0-3; omit to hide the stars. */
  stars?: number;
  stats: { label: string; value: string }[];
};

/**
 * Kid-friendly end screen drawn over a Phaser game: Tappy, stars,
 * confetti for 2+ stars, stats and the Play again / Done buttons.
 */
export function GameResultOverlay(props: {
  result: GameResultView;
  /** Omit to hide "Play again" (e.g. multiplayer). */
  onPlayAgain?: () => void;
  onExit: () => void;
  /** Small line under the stats, e.g. "Waiting for the other racers…". */
  note?: string;
}): JSXElement {
  return (
    <div class="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-bg/85 p-4">
      <Show when={(props.result.stars ?? 0) >= 2}>
        <Confetti />
      </Show>
      <div class="relative grid w-full max-w-md justify-items-center gap-4 rounded-double bg-bg p-6 text-center font-kid shadow-2xl">
        <Mascot
          mood={props.result.score > 0 ? "cheer" : "thinking"}
          size={96}
          class="animate-game-pop motion-reduce:animate-none"
        />
        <div class="text-2xl font-bold text-text">{props.result.headline}</div>
        <Show when={props.result.stars !== undefined}>
          <StarRating stars={props.result.stars ?? 0} />
        </Show>
        <div class="text-5xl font-bold text-main">{props.result.score}</div>
        <div class="-mt-3 text-sm text-sub">
          {props.result.scoreLabel ?? "points"}
        </div>
        <div class="grid w-full grid-cols-2 gap-2">
          <For each={props.result.stats}>
            {(s) => (
              <div class="rounded-xl bg-sub-alt p-3">
                <div class="text-lg font-bold text-text">{s.value}</div>
                <div class="text-xs text-sub">{s.label}</div>
              </div>
            )}
          </For>
        </div>
        <Show when={props.note}>
          <div class="text-sm font-semibold text-sub">{props.note}</div>
        </Show>
        <div class="flex flex-wrap justify-center gap-3">
          <Show when={props.onPlayAgain}>
            {(play) => (
              <Button
                chunky
                size="lg"
                active
                fa={{ icon: "fa-redo-alt" }}
                text="Play again"
                onClick={() => play()()}
              />
            )}
          </Show>
          <Button
            chunky
            size="lg"
            fa={{ icon: "fa-times" }}
            text="Done"
            onClick={() => props.onExit()}
          />
        </div>
      </div>
    </div>
  );
}

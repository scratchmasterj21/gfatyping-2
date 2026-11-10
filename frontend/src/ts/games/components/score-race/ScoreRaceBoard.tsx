import { For, JSXElement, Show } from "solid-js";

import { Fa } from "../../../components/common/Fa";
import { getAuthenticatedUser } from "../../../firebase";
import { cn } from "../../../utils/cn";
import { formatTime, ranks } from "./score-race-format";
import { ScoreRace } from "./use-score-race";

/** Live scoreboard drawn over the game while playing. */
export function ScoreRaceBoard(props: { race: ScoreRace }): JSXElement {
  const me = (): string | undefined => getAuthenticatedUser()?.uid;
  const placings = (): number[] =>
    ranks(props.race.players().map((p) => p.score));
  return (
    <div class="pointer-events-none absolute top-16 left-3 z-20 grid min-w-44 gap-0.5 rounded-xl bg-bg/90 px-3 py-2 font-kid text-sm shadow">
      <div class="flex items-center justify-between gap-3 font-bold text-main">
        <span>
          <Fa icon="fa-trophy" /> Race
        </span>
        <Show when={props.race.secondsLeft()}>
          {(s) => (
            <span class={cn(s() <= 10 && "animate-pulse text-error")}>
              {formatTime(s())}
            </span>
          )}
        </Show>
      </div>
      <For each={props.race.players()}>
        {(player, i) => (
          <div
            class={cn(
              "flex gap-2",
              player.uid === me() ? "font-bold text-text" : "text-sub",
              !player.online && "opacity-50",
            )}
          >
            <span class="w-5">{(placings()[i()] ?? 0) + 1}.</span>
            <span class="max-w-28 flex-1 truncate">{player.name}</span>
            <span>{player.score}</span>
            <Show when={player.finished}>
              <Fa icon="fa-flag-checkered" class="text-sub" />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

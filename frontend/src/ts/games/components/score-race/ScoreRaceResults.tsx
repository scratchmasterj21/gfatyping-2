import { For, JSXElement, Show } from "solid-js";

import { UserAvatar } from "../../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../../firebase";
import { cn } from "../../../utils/cn";
import { GameSetupPrimaryAction } from "../GameSetupPrimaryAction";
import { medal, ranks } from "./score-race-format";
import { ScoreRace } from "./use-score-race";

/** Final standings. */
export function ScoreRaceResults(props: {
  race: ScoreRace;
  onDone: () => void;
}): JSXElement {
  const me = (): string | undefined => getAuthenticatedUser()?.uid;
  const placings = (): number[] =>
    ranks(props.race.players().map((p) => p.score));
  const finished = (): boolean => props.race.room()?.status === "finished";
  return (
    <div class="grid gap-3 p-4 pt-12 font-kid">
      <div class="text-center text-2xl font-bold text-main">
        {finished() ? "Match complete!" : "Time's up!"}
      </div>
      <Show when={!finished()}>
        <div class="text-center text-sm text-sub">Adding up the scores…</div>
      </Show>
      <For each={props.race.players()}>
        {(player, i) => (
          <div
            class={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2",
              player.uid === me()
                ? "bg-main/20 ring-2 ring-main"
                : "bg-sub-alt",
            )}
          >
            <span class="w-8 text-center text-xl font-bold text-main">
              {medal(placings()[i()] ?? 0)}
            </span>
            <UserAvatar uid={player.uid} class="h-9 w-9" />
            <span class="min-w-0 flex-1 truncate text-base font-bold text-text">
              {player.name}
            </span>
            <span class="text-lg font-bold text-text">{player.score}</span>
          </div>
        )}
      </For>
      <GameSetupPrimaryAction
        text="Done"
        showArrow={false}
        onClick={() => props.onDone()}
      />
    </div>
  );
}

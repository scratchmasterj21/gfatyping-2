import { For, JSXElement, Show } from "solid-js";

import {
  CHAMP_ROUNDS,
  ChampRoundKind,
  ChampRow,
} from "../../../race/championship";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

function PersonAvatar(props: { url?: string; size?: string }): JSXElement {
  return (
    <Show
      when={props.url !== undefined && props.url !== ""}
      fallback={
        <div
          class={cn(
            "flex aspect-square shrink-0 items-center justify-center rounded-full bg-bg text-sub",
            props.size ?? "w-8",
          )}
        >
          <Fa icon="fa-user" />
        </div>
      }
    >
      <img
        src={props.url}
        alt=""
        class={cn(
          "aspect-square shrink-0 rounded-full object-cover",
          props.size ?? "w-8",
        )}
      />
    </Show>
  );
}

/** Overall standings between rounds, with movement arrows. */
export function ChampionshipBoard(props: {
  rows: ChampRow[];
  previous: Record<string, number>;
  roundsPlayed: number;
  roundsTotal: number;
  roundKinds: ChampRoundKind[];
}): JSXElement {
  const move = (row: ChampRow): number | undefined => {
    const before = props.previous[row.uid];
    return before === undefined ? undefined : before - row.rank;
  };
  return (
    <div class="grid gap-3 font-kid">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <div class="text-2xl font-bold text-text">
          🏆 Championship standings
        </div>
        <div class="text-base text-sub">
          after round {props.roundsPlayed} of {props.roundsTotal}
        </div>
      </div>
      <div class="grid gap-2">
        <For each={props.rows}>
          {(row) => (
            <div
              class={cn(
                "flex animate-game-pop items-center gap-3 rounded-xl p-2 text-base motion-reduce:animate-none",
                row.rank === 1 ? "bg-game-gold/30" : "bg-bg",
              )}
            >
              <span class="w-8 text-center text-xl font-bold text-main">
                {row.rank}
              </span>
              <span class="w-6 text-center text-sm font-bold">
                <Show when={move(row)} keyed>
                  {(m) => (
                    <Show
                      when={m > 0}
                      fallback={
                        m < 0 ? <span class="text-error">▼{-m}</span> : ""
                      }
                    >
                      <span class="text-game-green">▲{m}</span>
                    </Show>
                  )}
                </Show>
              </span>
              <PersonAvatar url={row.avatarUrl} />
              <span class="min-w-0 flex-1 truncate font-bold text-text">
                {row.name}
              </span>
              <span class="hidden gap-1 sm:flex">
                <For each={row.places}>
                  {(place, i) => (
                    <span
                      class="rounded-full bg-sub-alt px-2 py-0.5 text-xs text-sub"
                      title={
                        CHAMP_ROUNDS[props.roundKinds[i()] ?? "speed"].title
                      }
                    >
                      {CHAMP_ROUNDS[props.roundKinds[i()] ?? "speed"].emoji}{" "}
                      {place === 0 ? "-" : `#${place}`}
                    </span>
                  )}
                </For>
              </span>
              <span class="w-16 text-right text-lg font-bold text-text">
                {row.points} pts
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

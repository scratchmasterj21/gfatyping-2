import { For, JSXElement, Show } from "solid-js";

import type { ChampionRecord } from "../../../race/race-db";

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

/** Past champions of a class. */
export function HallOfChampions(props: {
  champions: ChampionRecord[];
  classId: string;
}): JSXElement {
  return (
    <div class="grid gap-2 font-kid">
      <div class="text-lg font-bold text-text">
        👑 {props.classId} hall of champions
      </div>
      <Show
        when={props.champions.length > 0}
        fallback={
          <div class="text-sm text-sub">
            No champion yet - run a championship to crown the first one!
          </div>
        }
      >
        <div class="grid gap-1.5">
          <For each={props.champions}>
            {(c, i) => (
              <div
                class={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-base",
                  i() === 0 ? "bg-game-gold/30" : "bg-bg",
                )}
              >
                <span aria-hidden="true">{i() === 0 ? "👑" : "🏆"}</span>
                <PersonAvatar url={c.avatarUrl} />
                <span class="min-w-0 flex-1 truncate font-bold text-text">
                  {c.name}
                </span>
                <span class="text-sm text-sub">
                  {c.points} pts · {c.players} players ·{" "}
                  {new Date(c.crownedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

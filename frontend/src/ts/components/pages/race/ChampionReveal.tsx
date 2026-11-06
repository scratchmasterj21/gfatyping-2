import { For, JSXElement, Show } from "solid-js";

import { ChampRow, championshipCoins } from "../../../race/championship";
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

/** The big finish: crown, champion name and podium. */
export function ChampionReveal(props: {
  rows: ChampRow[];
  classId: string;
}): JSXElement {
  // only students who scored can be on the podium / crowned
  const scored = (): ChampRow[] => props.rows.filter((r) => r.points > 0);
  const top = (): ChampRow[] => scored().slice(0, 3);
  const order = (): ChampRow[] =>
    [1, 0, 2].flatMap((i) =>
      top()[i] !== undefined ? [top()[i] as ChampRow] : [],
    );
  const step = (rank: number): { h: string; color: string; medal: string } =>
    rank === 1
      ? { h: "h-36", color: "bg-game-gold", medal: "🥇" }
      : rank === 2
        ? { h: "h-28", color: "bg-game-grey", medal: "🥈" }
        : { h: "h-20", color: "bg-game-orange", medal: "🥉" };
  return (
    <div class="grid justify-items-center gap-5 font-kid">
      <Show when={scored().length === 0}>
        <div class="text-center text-2xl font-bold text-sub">
          No champion this time - nobody scored any points.
        </div>
      </Show>
      <Show when={scored()[0]}>
        {(champ) => (
          <div class="grid animate-game-pop justify-items-center gap-2 text-center motion-reduce:animate-none">
            <div class="text-7xl" aria-hidden="true">
              👑
            </div>
            <PersonAvatar url={champ().avatarUrl} size="w-24" />
            <div class="text-lg font-bold text-sub">
              {props.classId} Class Champion
            </div>
            <div class="text-5xl font-bold text-main">{champ().name}</div>
            <div class="text-xl text-text">
              {champ().points} points · {champ().wins} round
              {champ().wins === 1 ? "" : "s"} won
            </div>
          </div>
        )}
      </Show>
      <div class="flex items-end justify-center gap-3">
        <For each={order()}>
          {(row) => (
            <div class="flex w-28 flex-col items-center gap-1 sm:w-36">
              <span class="text-3xl" aria-hidden="true">
                {step(row.rank).medal}
              </span>
              <PersonAvatar url={row.avatarUrl} size="w-12" />
              <span class="mt-1 max-w-full truncate text-base font-bold text-text">
                {row.name}
              </span>
              <span class="text-sm font-bold text-sub">
                {row.points} pts · +{championshipCoins(row)} coins
              </span>
              <div
                class={cn(
                  "flex w-full items-start justify-center rounded-t-xl pt-2 text-3xl font-bold text-game-ink",
                  step(row.rank).h,
                  step(row.rank).color,
                )}
              >
                {row.rank}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

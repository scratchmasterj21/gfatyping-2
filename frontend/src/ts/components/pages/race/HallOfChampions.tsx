import { For, JSXElement, Show } from "solid-js";

import type { ChampionRecord } from "../../../race/race-db";

import { cn } from "../../../utils/cn";
import {
  currentSchoolYear,
  schoolYearLabel,
  schoolYearOf,
} from "../../../utils/school-year";
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

/** Champions grouped by school year, newest year first. */
function byYear(
  champions: ChampionRecord[],
): { year: number; list: ChampionRecord[] }[] {
  const groups = new Map<number, ChampionRecord[]>();
  for (const c of champions) {
    const y = schoolYearOf(c.crownedAt);
    groups.set(y, [...(groups.get(y) ?? []), c]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      list: list.sort((a, b) => b.crownedAt - a.crownedAt),
    }));
}

/**
 * Past champions of a class, by school year. Champions are saved under the
 * class name they won in, so after a new school year the old years show as
 * earlier classes that used this name.
 */
export function HallOfChampions(props: {
  champions: ChampionRecord[];
  classId: string;
}): JSXElement {
  const thisYear = (): number => currentSchoolYear();
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
        <For each={byYear(props.champions)}>
          {(group) => (
            <div class="grid gap-1.5">
              <div class="text-sm font-semibold text-sub">
                {schoolYearLabel(group.year)}
                {group.year === thisYear()
                  ? " - this year"
                  : ` - ${props.classId} that year (now moved up)`}
              </div>
              <For each={group.list}>
                {(c, i) => {
                  const crowned = (): boolean =>
                    group.year === thisYear() && i() === 0;
                  return (
                    <div
                      class={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-base",
                        crowned() ? "bg-game-gold/30" : "bg-bg",
                        group.year !== thisYear() && "opacity-75",
                      )}
                    >
                      <span aria-hidden="true">{crowned() ? "👑" : "🏆"}</span>
                      <PersonAvatar url={c.avatarUrl} />
                      <span class="min-w-0 flex-1 truncate font-bold text-text">
                        {c.name}
                      </span>
                      <span class="text-sm text-sub">
                        {c.points} pts · {c.players} players ·{" "}
                        {new Date(c.crownedAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

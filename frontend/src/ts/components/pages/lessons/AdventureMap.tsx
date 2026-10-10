import { createMemo, For, JSXElement, Show } from "solid-js";

import { LessonGroup } from "../../../lessons/lessons-data";
import { getTheme } from "../../../states/theme";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

const COLS = 4;

export type MapStopState = "done" | "current" | "open" | "locked";

const SCENERY: Record<string, FaSolidIcon[]> = {
  jungle: ["fa-leaf", "fa-tree", "fa-seedling"],
  ocean: ["fa-water", "fa-fish", "fa-water"],
  sunny: ["fa-sun", "fa-cloud", "fa-cloud"],
  candy: ["fa-candy-cane", "fa-ice-cream", "fa-cookie"],
};
const DEFAULT_SCENERY: FaSolidIcon[] = ["fa-star", "fa-star", "fa-star"];

/** Snake layout: left-to-right on even rows, right-to-left on odd rows. */
function cellFor(index: number): { row: number; col: number } {
  const row = Math.floor(index / COLS);
  const inRow = index % COLS;
  return { row, col: row % 2 === 0 ? inRow : COLS - 1 - inRow };
}

export function AdventureMap(props: {
  groups: LessonGroup[];
  stateFor: (group: LessonGroup) => MapStopState;
  starsFor: (group: LessonGroup) => { earned: number; max: number };
  onSelect: (group: LessonGroup) => void;
  avatar?: JSXElement;
}): JSXElement {
  const rows = (): number => Math.ceil(props.groups.length / COLS);
  const scenery = (): FaSolidIcon[] =>
    SCENERY[getTheme().name] ?? DEFAULT_SCENERY;

  const points = createMemo(() =>
    props.groups.map((_, i) => {
      const { row, col } = cellFor(i);
      return `${(col + 0.5) * 100},${(row + 0.5) * 100}`;
    }),
  );
  const reachedCount = createMemo(() => {
    const idx = props.groups.findIndex((g) => props.stateFor(g) !== "done");
    return idx === -1 ? props.groups.length : idx + 1;
  });

  return (
    <div
      class="relative overflow-hidden rounded-2xl bg-sub-alt p-2"
      data-ui-element="adventureMap"
    >
      <For each={[0, 1, 2, 3, 4, 5]}>
        {(i) => (
          <span
            class="pointer-events-none absolute text-main opacity-10"
            aria-hidden="true"
            style={{
              left: `${[4, 88, 46, 12, 72, 30][i]}%`,
              top: `${[6, 18, 40, 62, 78, 90][i]}%`,
              transform: `rotate(${[-15, 20, -5, 10, -20, 15][i]}deg)`,
            }}
          >
            <Fa
              icon={scenery()[i % 3] ?? "fa-star"}
              size={1.6 + (i % 3) * 0.4}
            />
          </span>
        )}
      </For>
      <div
        class="relative grid"
        style={{
          "grid-template-columns": `repeat(${COLS}, minmax(0, 1fr))`,
          "grid-template-rows": `repeat(${rows()}, 7.5rem)`,
        }}
      >
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${COLS * 100} ${rows() * 100}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={points().join(" ")}
            fill="none"
            class="stroke-bg"
            stroke-width="10"
            stroke-linejoin="round"
            style={{ "vector-effect": "non-scaling-stroke" }}
          ></polyline>
          <polyline
            points={points().slice(0, reachedCount()).join(" ")}
            fill="none"
            class="stroke-main"
            stroke-width="6"
            stroke-linejoin="round"
            stroke-linecap="round"
            style={{ "vector-effect": "non-scaling-stroke" }}
          ></polyline>
        </svg>
        <For each={props.groups}>
          {(group, i) => {
            const cell = (): { row: number; col: number } => cellFor(i());
            const state = (): MapStopState => props.stateFor(group);
            const stars = (): { earned: number; max: number } =>
              props.starsFor(group);
            return (
              <div
                class="relative flex min-w-0 flex-col items-center justify-center gap-1"
                style={{
                  "grid-row": String(cell().row + 1),
                  "grid-column": String(cell().col + 1),
                }}
              >
                <Show when={state() === "current" && props.avatar}>
                  <div class="absolute -top-1 z-10 animate-bounce">
                    {props.avatar}
                  </div>
                </Show>
                <button
                  type="button"
                  class={cn(
                    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 p-0 shadow-md transition-transform hover:scale-110",
                    state() === "done" && "border-bg bg-main text-bg",
                    state() === "current" &&
                      "border-main bg-bg text-main ring-4 ring-main/30",
                    state() === "open" && "border-bg bg-bg text-main",
                    state() === "locked" &&
                      "border-bg bg-bg text-sub opacity-60",
                  )}
                  title={
                    state() === "locked"
                      ? `${group.name} (locked)`
                      : `Go to ${group.name}`
                  }
                  aria-label={group.name}
                  onClick={() => props.onSelect(group)}
                >
                  <Fa
                    icon={state() === "locked" ? "fa-lock" : group.icon}
                    size={1.2}
                  />
                  <Show when={state() === "done"}>
                    <span class="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-main">
                      <Fa icon="fa-check" size={0.6} />
                    </span>
                  </Show>
                </button>
                <span
                  class={cn(
                    "max-w-full truncate px-1 text-center text-em-xs leading-tight",
                    state() === "locked" ? "text-sub" : "font-bold text-text",
                  )}
                >
                  {group.name}
                </span>
                <span class="text-em-xs leading-none text-sub">
                  <Fa icon="fa-star" size={0.7} class="mr-0.5 text-main" />
                  {stars().earned}/{stars().max}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

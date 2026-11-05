import { createSignal, For, JSXElement, Show } from "solid-js";

import { HouseTrophies } from "../../house/house-state";
import { ACHIEVEMENTS } from "../../lessons/achievements";
import { cn } from "../../utils/cn";
import { Fa } from "../common/Fa";

/** Most achievement badges drawn on the shelf itself; the rest are in the list. */
const SHELF_BADGES = 5;

/**
 * Earned-only trophies on the room wall: lesson achievements, total stars
 * and race results. Not buyable, not movable - tap to see the full list.
 */
export function TrophyShelf(props: { trophies: HouseTrophies }): JSXElement {
  const [open, setOpen] = createSignal(false);
  const earned = () =>
    ACHIEVEMENTS.filter((a) => props.trophies.achievements.includes(a.id));
  const shelfBadges = () => earned().slice(-SHELF_BADGES).reverse();
  const extra = (): number => Math.max(0, earned().length - SHELF_BADGES);
  const isEmpty = (): boolean =>
    earned().length === 0 &&
    props.trophies.lessonStars === 0 &&
    props.trophies.raceWins === 0;

  return (
    <div
      class={cn(
        "absolute top-[5%] left-[3%] max-w-[60%] font-kid",
        // above furniture only while the list is open
        open() ? "z-[5000]" : "z-[1]",
      )}
    >
      <button
        type="button"
        class="flex cursor-pointer flex-col items-stretch rounded-none bg-transparent p-0 hover:bg-transparent"
        aria-expanded={open()}
        aria-label="Trophy shelf"
        onClick={() => setOpen((o) => !o)}
      >
        <div class="flex min-h-10 items-end gap-1.5 px-2">
          <Show
            when={!isEmpty()}
            fallback={
              <span class="pb-1 text-xs font-semibold text-game-ink/70">
                🏆 Earn trophies in lessons!
              </span>
            }
          >
            <Show when={props.trophies.lessonStars > 0}>
              <span class="rounded-md bg-game-gold px-1.5 py-0.5 text-xs font-bold text-game-ink shadow">
                ⭐ {props.trophies.lessonStars}
              </span>
            </Show>
            <For each={shelfBadges()}>
              {(a) => (
                <span
                  class="grid h-8 w-8 place-items-center rounded-full bg-game-gold text-game-ink shadow"
                  title={a.name}
                >
                  <Fa icon={a.icon} />
                </span>
              )}
            </For>
            <Show when={extra() > 0}>
              <span class="pb-1 text-xs font-bold text-game-ink/80">
                +{extra()}
              </span>
            </Show>
            <Show when={props.trophies.raceWins > 0}>
              <span class="text-2xl leading-none" title="Race wins">
                🏁
              </span>
              <span class="pb-1 text-xs font-bold text-game-ink/80">
                ×{props.trophies.raceWins}
              </span>
            </Show>
          </Show>
        </div>
        {/* the shelf board */}
        <div class="h-2.5 rounded-sm border-b-4 border-game-brown-dark bg-game-brown shadow"></div>
      </button>

      <Show when={open()}>
        <div class="mt-2 grid max-h-56 w-72 gap-2 overflow-y-auto rounded-xl bg-game-cream p-3 text-game-ink shadow-lg">
          <div class="flex items-center justify-between">
            <span class="text-base font-bold">🏆 My trophies</span>
            <button
              type="button"
              class="cursor-pointer rounded-none bg-transparent p-0 text-game-ink/60 hover:bg-transparent hover:text-game-ink"
              aria-label="Close trophies"
              onClick={() => setOpen(false)}
            >
              <Fa icon="fa-times" />
            </button>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="rounded-full bg-game-gold px-2 py-0.5 font-bold">
              ⭐ {props.trophies.lessonStars} lesson stars
            </span>
            <Show when={props.trophies.raceWins > 0}>
              <span class="rounded-full bg-game-sky px-2 py-0.5 font-bold">
                🏁 {props.trophies.raceWins} race wins
              </span>
            </Show>
            <Show when={props.trophies.raceBestWpm > 0}>
              <span class="rounded-full bg-game-sky px-2 py-0.5 font-bold">
                ⚡ {Math.round(props.trophies.raceBestWpm)} wpm best race
              </span>
            </Show>
          </div>
          <div class="text-xs font-semibold text-game-ink/70">
            {earned().length} of {ACHIEVEMENTS.length} trophies earned
          </div>
          <For each={ACHIEVEMENTS}>
            {(a) => {
              const has = (): boolean =>
                props.trophies.achievements.includes(a.id);
              return (
                <div
                  class={cn(
                    "flex items-center gap-2 text-sm",
                    !has() && "opacity-45",
                  )}
                >
                  <span
                    class={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      has() ? "bg-game-gold" : "bg-game-ink/15",
                    )}
                  >
                    <Fa icon={has() ? a.icon : "fa-lock"} />
                  </span>
                  <span class="min-w-0">
                    <span class="font-bold">{a.name}</span>
                    <span class="block text-xs text-game-ink/70">
                      {a.description}
                    </span>
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

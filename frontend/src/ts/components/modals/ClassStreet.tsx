import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { getClassStreet, StreetHouse } from "../../house/class-street";
import { HOUSE_THEMES } from "../../house/house-themes";
import { summarizePractice } from "../../house/practice-state";
import { getUserId } from "../../states/core";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { Avatar } from "../common/Avatar";

const STREET_STALE_MS = 5 * 60 * 1000;

function gardenBadge(h: StreetHouse): string {
  const p = summarizePractice({
    activity: h.house.activity,
    lastStarLessonDate: h.house.lastStarLessonDate,
  });
  if (p.drooping) return "🥀";
  return p.plantStage === 3 ? "🌸" : "🌱";
}

/** A row of houses, one per classmate. Tap one to visit (view-only). */
export function ClassStreet(props: {
  open: boolean;
  onVisit: (h: StreetHouse) => void;
}): JSXElement {
  const classId = (): string | undefined => getSnapshot()?.classId;
  const streetQuery = useQuery(() => ({
    queryKey: ["classStreet", classId()],
    queryFn: async () => getClassStreet(classId() ?? "", getUserId()),
    enabled: props.open && classId() !== undefined,
    staleTime: STREET_STALE_MS,
  }));

  // the free "plain" wall follows the site theme (often dark) - use a
  // friendly cream outside instead
  const wall = (h: StreetHouse): string => {
    const theme = HOUSE_THEMES.find((t) => t.id === h.house.themeId);
    return theme === undefined || theme.id === "plain" ? "#f6e7c8" : theme.wall;
  };

  return (
    <div class="min-h-112 rounded-xl bg-linear-to-b from-game-sky-top to-game-sky p-4 font-kid">
      <Show
        when={classId() !== undefined}
        fallback={
          <div class="py-16 text-center text-lg font-semibold text-game-ink">
            Join a class to see your class street!
          </div>
        }
      >
        <div class="mb-3 text-center text-lg font-bold text-game-ink">
          🏘️ {classId()} street - tap a house to visit!
        </div>
        <Show
          when={!streetQuery.isPending}
          fallback={
            <div class="py-16 text-center text-game-ink/70">
              Walking down the street…
            </div>
          }
        >
          <div class="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            <For each={streetQuery.data ?? []}>
              {(h) => (
                <button
                  type="button"
                  class="group flex cursor-pointer flex-col items-center rounded-none bg-transparent p-0 hover:bg-transparent"
                  aria-label={h.isMe ? "Your house" : `Visit ${h.name}'s house`}
                  onClick={() => props.onVisit(h)}
                >
                  {/* roof */}
                  <div
                    class={cn(
                      "h-10 w-[88%] [clip-path:polygon(50%_0,100%_100%,0_100%)]",
                      h.isMe ? "bg-game-gold" : "bg-game-red",
                    )}
                  ></div>
                  {/* walls + door */}
                  <div
                    class="relative flex h-24 w-[76%] items-end justify-center rounded-b-lg border-b-4 border-game-brown-dark shadow transition-transform group-hover:-translate-y-0.5"
                    style={{ background: wall(h) }}
                  >
                    <div class="absolute top-2 left-2 h-5 w-5 rounded-sm border-2 border-game-brown-dark bg-game-sky"></div>
                    <div class="absolute top-2 right-2 h-5 w-5 rounded-sm border-2 border-game-brown-dark bg-game-sky"></div>
                    <div class="mb-0 flex h-16 w-12 items-center justify-center rounded-t-full bg-game-brown">
                      <Avatar
                        color={h.equipped.color}
                        shape={h.equipped.shape}
                        hair={h.equipped.hair}
                        hat={h.equipped.hat}
                        accessory={h.equipped.accessory}
                        face={h.equipped.face}
                        background={h.equipped.background}
                        animalImage={h.equipped.animalImage}
                        size={40}
                      />
                    </div>
                  </div>
                  <div class="mt-1 flex max-w-full items-center gap-1 text-sm font-bold text-game-ink">
                    <span class="truncate">{h.isMe ? "You" : h.name}</span>
                  </div>
                  <div class="text-xs text-game-ink/80">
                    {gardenBadge(h)} 🏆{h.house.trophies.achievements.length}
                    <Show when={Object.keys(h.pets.ownedPets).length > 0}>
                      {" "}
                      🐾{Object.keys(h.pets.ownedPets).length}
                    </Show>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

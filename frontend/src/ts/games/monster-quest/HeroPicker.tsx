import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { isCurrentUserStaff } from "../../auth";
import { BuyButton } from "../../components/common/BuyButton";
import { Fa } from "../../components/common/Fa";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { getAllProgress } from "../../lessons/lesson-progress";
import { lessonGroups } from "../../lessons/lessons-data";
import { queryClient } from "../../queries";
import { getUserId, isAuthenticated } from "../../states/core";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { getGameAccess, resolvePolicy } from "../game-access";
import { HERO_ART } from "./hero-art";
import {
  buyQuestHero,
  canPlayHero,
  getQuestHeroState,
  isFreeHero,
  ownsFullSet,
  QUEST_HERO_PRICE,
  QUEST_HEROES_KEY,
  questSetPrice,
} from "./quest-heroes";
import {
  CLASS_INFO,
  FREE_HEROES,
  HERO_SETS,
  HeroClass,
  HeroSetInfo,
  setOfHero,
} from "./quest-rules";

export type QuestHeroes = {
  coins: () => number;
  owned: () => HeroClass[];
  /** teacher switched bought heroes off (never for staff) */
  heroesOff: () => boolean;
  /** the set's lessons are finished (staff: always) */
  setOpen: (set: HeroSetInfo) => boolean;
  canPlay: (cls: HeroClass) => boolean;
  pendingId: () => string | null;
  buy: (itemId: HeroClass | `set:${string}`, label: string) => void;
};

/** Owned heroes, coins, lesson unlocks and the teacher switch (all cached). */
export function useQuestHeroes(enabled: () => boolean): QuestHeroes {
  const staff = (): boolean => isCurrentUserStaff();
  const heroQuery = useQuery(() => ({
    queryKey: [QUEST_HEROES_KEY, getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      return uid === null ? { coins: 0, owned: [] } : getQuestHeroState(uid);
    },
    enabled: enabled() && isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  }));
  const accessQuery = useQuery(() => ({
    queryKey: ["gameAccess"],
    queryFn: getGameAccess,
    enabled: enabled() && isAuthenticated() && !staff(),
    staleTime: 5 * 60 * 1000,
  }));
  const progressQuery = useQuery(() => ({
    queryKey: ["lessonProgress"],
    queryFn: getAllProgress,
    enabled: enabled() && isAuthenticated() && !staff(),
    staleTime: 5 * 60 * 1000,
  }));
  const { pendingId, guardedBuy } = useBuyGuard();

  const owned = (): HeroClass[] => heroQuery.data?.owned ?? [];
  const heroesOff = (): boolean =>
    !staff() &&
    resolvePolicy(
      accessQuery.data,
      getSnapshot()?.classId ?? undefined,
      getUserId() ?? undefined,
    ).questHeroesOff;
  const setOpen = (set: HeroSetInfo): boolean => {
    if (staff()) return true;
    const group = lessonGroups.find((g) => g.id === set.requires);
    const p = progressQuery.data;
    return (
      group !== undefined &&
      p !== undefined &&
      group.lessons.every((l) => p.get(l.id)?.completed === true)
    );
  };

  return {
    coins: () => heroQuery.data?.coins ?? 0,
    owned,
    heroesOff,
    setOpen,
    // staff can try every hero without buying
    canPlay: (cls) => staff() || canPlayHero(cls, owned(), heroesOff()),
    pendingId,
    buy: (itemId, label) => {
      void guardedBuy(itemId, async () => {
        const r = await buyQuestHero(itemId);
        if (!r.ok) {
          showErrorNotification(r.reason ?? "Couldn't buy that");
          return;
        }
        showSuccessNotification(`${label} joined your heroes!`);
        void queryClient.invalidateQueries({ queryKey: [QUEST_HEROES_KEY] });
      });
    },
  };
}

/** Free heroes, then each hero set: locked, buyable or owned. */
export function HeroPicker(props: {
  heroes: QuestHeroes;
  selected: HeroClass;
  /** picked by someone else in the room */
  taken?: Set<HeroClass | undefined>;
  onSelect: (cls: HeroClass) => void;
}): JSXElement {
  const h = (): QuestHeroes => props.heroes;
  const isTaken = (c: HeroClass): boolean => props.taken?.has(c) === true;

  return (
    <div class="grid gap-3">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <For each={FREE_HEROES as HeroClass[]}>
          {(c) => (
            <HeroCard
              cls={c}
              selected={props.selected === c}
              taken={isTaken(c)}
              playable
              gold={false}
              onSelect={() => props.onSelect(c)}
            />
          )}
        </For>
      </div>
      <Show when={!h().heroesOff()}>
        <For each={HERO_SETS}>
          {(set) => {
            const full = (): boolean => ownsFullSet(set, h().owned());
            const missing = (): number =>
              set.heroes.filter((c) => !h().owned().includes(c)).length;
            const open = (): boolean => h().setOpen(set);
            return (
              <div
                class={cn(
                  "grid gap-2 rounded-2xl p-2",
                  full()
                    ? "bg-game-gold/15 ring-2 ring-game-gold"
                    : "bg-sub-alt/60",
                )}
              >
                <div class="flex flex-wrap items-center gap-2 px-1 font-kid">
                  <span class="text-lg font-bold text-text">
                    {set.emoji} {set.name} heroes
                  </span>
                  <Show when={full()}>
                    <span class="rounded-full bg-game-gold px-2 py-0.5 text-xs font-bold text-game-ink">
                      🏆 {set.title}
                    </span>
                  </Show>
                  <span class="ml-auto flex items-center gap-2 text-sm text-sub">
                    <Show
                      when={open()}
                      fallback={
                        <>
                          <Fa icon="fa-lock" />
                          Finish the {set.requiresName} lessons to unlock
                        </>
                      }
                    >
                      <Show when={!full() && !isCurrentUserStaff()}>
                        <span>
                          {missing() === set.heroes.length
                            ? "Whole set:"
                            : "The rest:"}
                        </span>
                        <BuyButton
                          price={questSetPrice(missing())}
                          coins={h().coins()}
                          busy={h().pendingId() === `set:${set.id}`}
                          locked={h().pendingId() !== null}
                          onBuy={() =>
                            h().buy(`set:${set.id}`, `The ${set.name} set`)
                          }
                        />
                      </Show>
                    </Show>
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <For each={set.heroes}>
                    {(c) => (
                      <HeroCard
                        cls={c}
                        selected={props.selected === c}
                        taken={isTaken(c)}
                        playable={h().canPlay(c)}
                        gold={full()}
                        onSelect={() => props.onSelect(c)}
                        footer={
                          <Show when={!h().canPlay(c)}>
                            <Show
                              when={open()}
                              fallback={
                                <span class="flex min-h-9 items-center gap-1 text-sm text-sub">
                                  <Fa icon="fa-lock" />
                                  {QUEST_HERO_PRICE}
                                </span>
                              }
                            >
                              <BuyButton
                                price={QUEST_HERO_PRICE}
                                coins={h().coins()}
                                busy={h().pendingId() === c}
                                locked={h().pendingId() !== null}
                                onBuy={() => h().buy(c, CLASS_INFO[c].name)}
                              />
                            </Show>
                          </Show>
                        }
                      />
                    )}
                  </For>
                </div>
                <Show when={full()}>
                  <div class="px-1 text-xs text-sub">
                    🏆 Full set bonus: gold frames, the &ldquo;{set.title}
                    &rdquo; title, and {set.combo.emoji} {set.combo.name} when
                    two {set.name} heroes use skills in a row!
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}

function HeroCard(props: {
  cls: HeroClass;
  selected: boolean;
  taken: boolean;
  playable: boolean;
  /** full-set bonus frame */
  gold: boolean;
  onSelect: () => void;
  footer?: JSXElement;
}): JSXElement {
  const info = (): (typeof CLASS_INFO)[HeroClass] => CLASS_INFO[props.cls];
  const off = (): boolean => props.taken || !props.playable;
  return (
    <div class="grid grid-rows-[1fr_auto] justify-items-center gap-1">
      <button
        type="button"
        disabled={off()}
        title={info().tip ?? info().blurb}
        class={cn(
          "press-3d grid h-full w-full cursor-pointer content-start justify-items-center gap-1 rounded-xl p-3 text-center font-kid",
          props.selected && props.playable
            ? "bg-main text-bg"
            : "bg-sub-alt text-text hover:bg-text hover:text-bg",
          props.gold && "ring-2 ring-game-gold",
          off() &&
            "cursor-not-allowed opacity-50 hover:bg-sub-alt hover:text-text",
        )}
        onClick={() => props.onSelect()}
      >
        <img
          src={HERO_ART[props.cls]}
          alt=""
          class={cn(
            "h-16 w-auto [image-rendering:pixelated]",
            !props.playable && "grayscale",
          )}
        />
        <span class="text-lg font-bold">
          {info().emoji} {info().name}
        </span>
        <span class="text-xs leading-tight opacity-80">
          {props.taken ? "taken" : info().blurb}
        </span>
        <Show when={!isFreeHero(props.cls) && props.playable}>
          <span class="text-xs leading-tight opacity-80">
            {setOfHero(props.cls)?.emoji} {info().tip}
          </span>
        </Show>
      </button>
      {props.footer}
    </div>
  );
}

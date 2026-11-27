import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  Show,
  untrack,
} from "solid-js";

import { isCurrentUserStaff } from "../../auth";
import { BuyButton } from "../../components/common/BuyButton";
import { Fa } from "../../components/common/Fa";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { queryClient } from "../../queries";
import { getUserId, isAuthenticated } from "../../states/core";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import {
  EffectivePolicy,
  getGameAccess,
  QuestLevel,
  resolvePolicy,
} from "../game-access";
import { useGameLevel } from "../use-game-level";
import { HERO_ART } from "./hero-art";
import {
  buyQuestHero,
  canPlayHero,
  getQuestHeroState,
  ownsFullSet,
  QUEST_HERO_PRICE,
  QUEST_HEROES_KEY,
  questSetPrice,
} from "./quest-heroes";
import {
  CLASS_INFO,
  ClassInfo,
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
  /** quest words: from lessons, or fixed by the teacher */
  level: () => QuestLevel;
  levelByTeacher: () => boolean;
  /** lessons + teacher settings loaded (staff / signed out: always) */
  levelReady: () => boolean;
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
  const { pendingId, guardedBuy } = useBuyGuard();

  const owned = (): HeroClass[] => heroQuery.data?.owned ?? [];
  const policy = (): EffectivePolicy =>
    resolvePolicy(
      accessQuery.data,
      getSnapshot()?.classId ?? undefined,
      getUserId() ?? undefined,
    );
  const heroesOff = (): boolean => !staff() && policy().questHeroesOff;
  const lv = useGameLevel(enabled);
  const setOpen = (set: HeroSetInfo): boolean => lv.groupDone(set.requires);

  return {
    coins: () => heroQuery.data?.coins ?? 0,
    owned,
    heroesOff,
    setOpen,
    // staff can try every hero without buying
    canPlay: (cls) => staff() || canPlayHero(cls, owned(), heroesOff()),
    pendingId,
    level: lv.level,
    levelByTeacher: lv.byTeacher,
    levelReady: lv.ready,
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

type TabId = "free" | HeroSetInfo["id"];

const STAT_MAX = {
  maxHp: Math.max(...Object.values(CLASS_INFO).map((c) => c.maxHp)),
  atk: Math.max(...Object.values(CLASS_INFO).map((c) => c.atk)),
  speed: Math.max(...Object.values(CLASS_INFO).map((c) => c.speed)),
};

/**
 * Hero picker: a big panel for the hero you're looking at, then tabs (free
 * heroes + one per hero set) with 4 small cards each. Tap a locked hero to
 * see it and buy it in the panel.
 */
export function HeroPicker(props: {
  heroes: QuestHeroes;
  selected: HeroClass;
  /** picked by someone else in the room */
  taken?: Set<HeroClass | undefined>;
  onSelect: (cls: HeroClass) => void;
}): JSXElement {
  const h = (): QuestHeroes => props.heroes;
  const isTaken = (c: HeroClass): boolean => props.taken?.has(c) === true;
  const [tab, setTab] = createSignal<TabId>(
    untrack(() => setOfHero(props.selected)?.id ?? "free"),
  );
  const [preview, setPreview] = createSignal<HeroClass>(
    untrack(() => props.selected),
  );
  // bought heroes switched off: back to the free tab
  createEffect(() => {
    if (h().heroesOff() && tab() !== "free") setTab("free");
  });
  const set = (): HeroSetInfo | undefined =>
    HERO_SETS.find((s) => s.id === tab());
  const tabHeroes = (): HeroClass[] =>
    set()?.heroes ?? (FREE_HEROES as HeroClass[]);
  const pick = (c: HeroClass): void => {
    setPreview(c);
    if (h().canPlay(c) && !isTaken(c)) props.onSelect(c);
  };

  return (
    <div class="grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <HeroPanel
        cls={preview()}
        heroes={h()}
        playingAs={props.selected}
        taken={isTaken(preview())}
      />
      <div class="order-first grid content-start gap-2 md:order-none">
        <Show when={!h().heroesOff()}>
          <div class="flex flex-wrap gap-1.5" role="tablist">
            <TabButton active={tab() === "free"} onClick={() => setTab("free")}>
              ⭐ Free
            </TabButton>
            <For each={HERO_SETS}>
              {(s) => (
                <TabButton
                  active={tab() === s.id}
                  gold={ownsFullSet(s, h().owned())}
                  onClick={() => setTab(s.id)}
                >
                  <Show when={!h().setOpen(s)}>
                    <Fa icon="fa-lock" size={0.75} />
                  </Show>
                  {s.emoji} {s.name}
                </TabButton>
              )}
            </For>
          </div>
        </Show>
        <div class="grid grid-cols-4 gap-2">
          <For each={tabHeroes()}>
            {(c) => (
              <HeroCard
                cls={c}
                selected={props.selected === c}
                previewing={preview() === c}
                taken={isTaken(c)}
                playable={h().canPlay(c)}
                gold={
                  set() !== undefined &&
                  ownsFullSet(set() as HeroSetInfo, h().owned())
                }
                onSelect={() => pick(c)}
              />
            )}
          </For>
        </div>
        <Show when={set()}>{(s) => <SetFooter set={s()} heroes={h()} />}</Show>
      </div>
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  gold?: boolean;
  onClick: () => void;
  children: JSXElement;
}): JSXElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.active}
      class={cn(
        "flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-3 font-kid text-sm font-bold",
        props.active
          ? "bg-main text-bg"
          : "bg-sub-alt text-text hover:bg-text hover:text-bg",
        props.gold === true && "ring-2 ring-game-gold",
      )}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}

/** One set: lock reason, buy-the-set button or the full-set bonus. */
function SetFooter(props: {
  set: HeroSetInfo;
  heroes: QuestHeroes;
}): JSXElement {
  const h = (): QuestHeroes => props.heroes;
  const full = (): boolean => ownsFullSet(props.set, h().owned());
  const missing = (): number =>
    props.set.heroes.filter((c) => !h().owned().includes(c)).length;
  return (
    <div
      class={cn(
        "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 font-kid text-sm",
        full() ? "bg-game-gold/15 text-text" : "bg-sub-alt/60 text-sub",
      )}
    >
      <Show
        when={h().setOpen(props.set)}
        fallback={
          <>
            <Fa icon="fa-lock" />
            Finish the {props.set.requiresName} lessons to unlock
          </>
        }
      >
        <Show
          when={!full()}
          fallback={
            <span>
              🏆 <b>{props.set.title}</b>: gold frames and{" "}
              {props.set.combo.emoji} {props.set.combo.name} when two{" "}
              {props.set.name} heroes use skills in a row!
            </span>
          }
        >
          <span class="flex-1">
            🏆 Own all 4 for the &ldquo;{props.set.title}&rdquo; title and{" "}
            {props.set.combo.emoji} {props.set.combo.name}
          </span>
          <Show when={!isCurrentUserStaff()}>
            <span>
              {missing() === props.set.heroes.length
                ? "Whole set:"
                : "The rest:"}
            </span>
            <BuyButton
              price={questSetPrice(missing())}
              coins={h().coins()}
              busy={h().pendingId() === `set:${props.set.id}`}
              locked={h().pendingId() !== null}
              onBuy={() =>
                h().buy(`set:${props.set.id}`, `The ${props.set.name} set`)
              }
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
}

/** The hero you tapped: big sprite, skill, stats, and buy / lock. */
function HeroPanel(props: {
  cls: HeroClass;
  heroes: QuestHeroes;
  playingAs: HeroClass;
  taken: boolean;
}): JSXElement {
  const info = (): ClassInfo => CLASS_INFO[props.cls];
  const h = (): QuestHeroes => props.heroes;
  const playable = (): boolean => h().canPlay(props.cls);
  const set = (): HeroSetInfo | undefined => setOfHero(props.cls);
  const stat = (label: string, value: number, max: number): JSXElement => (
    <div class="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-xs">
      <span>{label}</span>
      <div class="h-2 overflow-hidden rounded-full bg-bg">
        <div
          class="h-full rounded-full bg-main"
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        ></div>
      </div>
    </div>
  );
  return (
    <div
      class={cn(
        "grid content-start gap-2 rounded-2xl bg-sub-alt p-3 font-kid text-text",
        set() !== undefined &&
          ownsFullSet(set() as HeroSetInfo, h().owned()) &&
          "ring-2 ring-game-gold",
      )}
    >
      <div class="flex items-center gap-3">
        <img
          src={HERO_ART[props.cls]}
          alt=""
          class={cn(
            "h-24 w-auto shrink-0 [image-rendering:pixelated]",
            !playable() && "grayscale",
          )}
        />
        <div class="grid min-w-0 gap-0.5">
          <span class="text-2xl font-bold">
            {info().emoji} {info().name}
          </span>
          <span class="text-sm">{info().blurb}</span>
          <Show when={set()}>
            {(s) => (
              <span class="text-xs text-sub">
                {s().emoji} {s().name} hero
              </span>
            )}
          </Show>
        </div>
      </div>
      <div class="rounded-xl bg-bg/60 px-3 py-2 text-sm">
        <b>
          {info().skillEmoji} {info().skill}
        </b>
        <Show when={info().tip}>
          {(tip) => <span class="block text-xs text-sub">{tip()}</span>}
        </Show>
      </div>
      <div class="grid gap-1">
        {stat("❤️ health", info().maxHp, STAT_MAX.maxHp)}
        {stat("⚔️ power", info().atk, STAT_MAX.atk)}
        {stat("💨 speed", info().speed, STAT_MAX.speed)}
      </div>
      <Show
        when={playable()}
        fallback={
          <div class="flex flex-wrap items-center gap-2 text-sm text-sub">
            <Show
              when={set() !== undefined && h().setOpen(set() as HeroSetInfo)}
              fallback={
                <>
                  <Fa icon="fa-lock" />
                  Finish the {set()?.requiresName} lessons to unlock
                </>
              }
            >
              <Show
                when={!isCurrentUserStaff()}
                fallback={<span>Staff can play every hero</span>}
              >
                <BuyButton
                  price={QUEST_HERO_PRICE}
                  coins={h().coins()}
                  busy={h().pendingId() === props.cls}
                  locked={h().pendingId() !== null}
                  onBuy={() => h().buy(props.cls, info().name)}
                />
              </Show>
            </Show>
            <span class="w-full text-xs">
              You&apos;re playing as {CLASS_INFO[props.playingAs].name} for now.
            </span>
          </div>
        }
      >
        <div class="text-sm font-bold text-main">
          {props.taken
            ? "A friend picked this hero"
            : props.playingAs === props.cls
              ? "✓ Your hero"
              : ""}
        </div>
      </Show>
    </div>
  );
}

function HeroCard(props: {
  cls: HeroClass;
  selected: boolean;
  previewing: boolean;
  taken: boolean;
  playable: boolean;
  /** full-set bonus frame */
  gold: boolean;
  onSelect: () => void;
}): JSXElement {
  const info = (): ClassInfo => CLASS_INFO[props.cls];
  return (
    <button
      type="button"
      disabled={props.taken}
      title={info().blurb}
      class={cn(
        "press-3d grid cursor-pointer justify-items-center gap-0.5 rounded-xl p-2 text-center font-kid",
        props.selected && props.playable
          ? "bg-main text-bg"
          : "bg-sub-alt text-text hover:bg-text hover:text-bg",
        props.previewing && !props.selected && "ring-2 ring-main",
        props.gold && "ring-2 ring-game-gold",
        props.taken && "cursor-not-allowed opacity-50",
      )}
      onClick={() => props.onSelect()}
    >
      <img
        src={HERO_ART[props.cls]}
        alt=""
        class={cn(
          "h-12 w-auto [image-rendering:pixelated]",
          !props.playable && "opacity-60 grayscale",
        )}
      />
      <span class="text-sm leading-tight font-bold">{info().name}</span>
      <span class="flex items-center gap-1 text-xs opacity-80">
        <Show when={props.taken}>taken</Show>
        <Show when={!props.taken && !props.playable}>
          <Fa icon="fa-lock" size={0.7} />
          {QUEST_HERO_PRICE}
        </Show>
      </span>
    </button>
  );
}

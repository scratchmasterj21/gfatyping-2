import { createSignal, For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../hooks/useBuyGuard";
import { ModalId } from "../../states/modals";
import { cn } from "../../utils/cn";
import { CosmeticCollection } from "../../utils/shop-collections";
import {
  currentJapanMonth,
  MONTH_SHORT,
  RARITY_LABELS,
  rarityFor,
  Rarity,
} from "../../utils/shop-rarity";
import { AnimatedModal } from "./AnimatedModal";
import { Fa } from "./Fa";

export type CosmeticItem = {
  id: string;
  name: string;
  description: string;
  /** Omitted for the free default. */
  price?: number;
  /** 1-12; only sold in these months. Owned items stay usable. */
  seasonMonths?: number[];
};

const RARITY_CLASS: Record<Rarity, string> = {
  common: "text-sub",
  rare: "text-text",
  epic: "text-main",
  legendary: "text-main",
  limited: "text-main",
};

/**
 * Shared layout for the simple "buy once, select any time" shops. Tapping an
 * unowned item previews it first; coins are only spent from the try-on
 * panel, so one stray tap never buys anything.
 */
export function CosmeticShop<T extends CosmeticItem>(props: {
  id: ModalId;
  title: string;
  items: T[];
  coins: number;
  isOwned: (id: T["id"]) => boolean;
  isSelected: (id: T["id"]) => boolean;
  /** Small card thumbnail. */
  thumb: (item: T) => JSXElement;
  /** Bigger try-on preview; falls back to the thumbnail. */
  preview?: (item: T) => JSXElement;
  onBuy: (item: T) => Promise<boolean>;
  onSelect: (id: T["id"]) => void | Promise<void>;
  collection?: CosmeticCollection;
  cols?: string;
}): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();
  const [trying, setTrying] = createSignal<T>();
  const [onlyMine, setOnlyMine] = createSignal(false);
  const month = currentJapanMonth();

  const inSeason = (item: T): boolean =>
    item.seasonMonths === undefined || item.seasonMonths.includes(month);
  const visibleItems = (): T[] =>
    props.items.filter((i) =>
      props.isOwned(i.id) ? true : !onlyMine() && inSeason(i),
    );
  const coinsNeeded = (item: T): number =>
    Math.max(0, (item.price ?? 0) - props.coins);

  return (
    <AnimatedModal id={props.id} title={props.title}>
      <div class="grid gap-4 font-kid">
        <div class="flex justify-center">
          <span class="flex items-center gap-2 rounded-full bg-sub-alt px-5 py-2 text-xl font-bold text-main">
            <Fa icon="fa-coins" />
            {props.coins}
          </span>
        </div>

        <Show
          when={trying()}
          keyed
          fallback={
            <p class="text-center text-sm text-sub">
              Tap something you own to use it. Tap anything else to try it
              first.
            </p>
          }
        >
          {(item) => (
            <div class="grid gap-2 rounded-double border-2 border-main bg-[color-mix(in_srgb,var(--main-color)_12%,var(--sub-alt-color))] p-4 text-center">
              <div class="flex justify-center">
                {(props.preview ?? props.thumb)(item)}
              </div>
              <span class="text-base text-sub">
                Trying <span class="font-bold text-text">{item.name}</span>
              </span>
              <span class="text-sm text-sub">{item.description}</span>
              <Show when={coinsNeeded(item) > 0}>
                <span class="text-sm font-semibold text-sub">
                  You need {coinsNeeded(item)} more coins. Finish lessons to
                  earn them!
                </span>
              </Show>
              <div class="mt-1 flex justify-center gap-3">
                <Show when={coinsNeeded(item) === 0}>
                  <button
                    type="button"
                    class="press-3d min-h-12 cursor-pointer rounded-xl bg-main px-5 py-2 font-semibold text-bg [--press-color:color-mix(in_srgb,var(--main-color)_60%,black)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pendingId() !== null}
                    onClick={() => {
                      const onBuy = props.onBuy;
                      void guardedBuy(item.id, async () => {
                        if (await onBuy(item)) setTrying(undefined);
                      });
                    }}
                  >
                    <Show
                      when={pendingId() !== item.id}
                      fallback={<Fa icon="fa-circle-notch" spin />}
                    >
                      <Fa icon="fa-coins" class="mr-1.5" />
                      Buy for {item.price}
                    </Show>
                  </button>
                </Show>
                <button
                  type="button"
                  class="press-3d min-h-12 cursor-pointer rounded-xl bg-bg px-5 py-2 font-semibold text-text hover:bg-text hover:text-bg"
                  onClick={() => setTrying(undefined)}
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </Show>

        <div class="flex flex-wrap items-center gap-3">
          <Show when={props.collection}>
            {(c) => (
              <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl bg-sub-alt px-3 py-2 text-sm">
                <span class="font-medium text-text">
                  <Fa icon="fa-layer-group" class="mr-1.5 text-main" />
                  Collection {c().owned}/{c().total}
                </span>
                <div class="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-bg">
                  <div
                    class="h-full rounded-full bg-main transition-[width] duration-500"
                    style={{
                      width: `${(c().owned / Math.max(1, c().total)) * 100}%`,
                    }}
                  ></div>
                </div>
                <Show
                  when={!c().claimed}
                  fallback={
                    <span class="text-main">
                      <Fa icon="fa-check" class="mr-1" />
                      Collected!
                    </span>
                  }
                >
                  <Show
                    when={c().owned >= c().total}
                    fallback={
                      <span class="text-sub">
                        Collect all: +{c().reward} coins
                      </span>
                    }
                  >
                    <button
                      type="button"
                      class="press-3d min-h-10 cursor-pointer rounded-xl bg-main px-4 py-1.5 font-bold text-bg [--press-color:color-mix(in_srgb,var(--main-color)_60%,black)] hover:opacity-90 disabled:opacity-50"
                      disabled={pendingId() !== null}
                      onClick={() =>
                        void guardedBuy("__collection__", c().onClaim)
                      }
                    >
                      Claim +{c().reward}
                    </button>
                  </Show>
                </Show>
              </div>
            )}
          </Show>
          <label class="ml-auto flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-sub">
            <input
              type="checkbox"
              class="h-5 w-5 accent-(--main-color)"
              checked={onlyMine()}
              onChange={(e) => {
                setOnlyMine(e.currentTarget.checked);
                setTrying(undefined);
              }}
            />
            Only mine
          </label>
        </div>

        <div
          class={cn("grid grid-cols-2 gap-3", props.cols ?? "sm:grid-cols-3")}
        >
          <For each={visibleItems()}>
            {(item) => {
              const owned = (): boolean => props.isOwned(item.id);
              const selected = (): boolean => props.isSelected(item.id);
              const isTrying = (): boolean => trying()?.id === item.id;
              const rarity = (): Rarity =>
                rarityFor(item.price, item.seasonMonths !== undefined);
              return (
                <button
                  type="button"
                  class={cn(
                    "press-3d relative flex cursor-pointer flex-col items-center gap-1.5 rounded-double p-3 outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    selected()
                      ? "bg-main text-bg [--press-color:color-mix(in_srgb,var(--main-color)_60%,black)]"
                      : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                    isTrying() ? "outline-3 outline-main" : "",
                  )}
                  aria-pressed={selected() || isTrying()}
                  disabled={pendingId() !== null}
                  onClick={() => {
                    if (owned()) {
                      if (!selected()) {
                        setTrying(undefined);
                        const onSelect = props.onSelect;
                        void guardedBuy(item.id, async () => onSelect(item.id));
                      }
                    } else {
                      setTrying(() => (isTrying() ? undefined : item));
                    }
                  }}
                >
                  <Show when={selected()}>
                    <span class="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
                      <Fa icon="fa-check" size={0.8} />
                    </span>
                  </Show>
                  <Show when={item.seasonMonths}>
                    {(months) => (
                      <span class="absolute top-1 left-1 rounded bg-bg px-1.5 py-0.5 text-[0.65em] font-bold text-main">
                        {months()
                          .map((m) => MONTH_SHORT[m - 1])
                          .join("/")}{" "}
                        only
                      </span>
                    )}
                  </Show>
                  {props.thumb(item)}
                  <span class="text-center text-base font-semibold">
                    {item.name}
                  </span>
                  <Show
                    when={item.price !== undefined && rarity() !== "limited"}
                  >
                    <span
                      class={cn(
                        "text-[0.65em] font-bold tracking-wide uppercase",
                        selected() ? "text-bg" : RARITY_CLASS[rarity()],
                      )}
                    >
                      {RARITY_LABELS[rarity()]}
                    </span>
                  </Show>
                  <span class="flex items-center gap-1 text-sm font-semibold">
                    <Show
                      when={pendingId() !== item.id}
                      fallback={<Fa icon="fa-circle-notch" spin size={0.7} />}
                    >
                      <Show
                        when={!owned()}
                        fallback={
                          <Show when={selected()} fallback="use">
                            <Fa icon="fa-check" size={0.7} /> using
                          </Show>
                        }
                      >
                        <Fa icon="fa-coins" size={0.7} />
                        {coinsNeeded(item) === 0
                          ? item.price
                          : `Need ${coinsNeeded(item)} more`}
                      </Show>
                    </Show>
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </AnimatedModal>
  );
}

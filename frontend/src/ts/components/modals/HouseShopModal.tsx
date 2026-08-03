import { useQuery } from "@tanstack/solid-query";
import { createSignal, For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../hooks/useBuyGuard";
import {
  HOUSE_ITEMS,
  HouseItem,
  HouseSpriteItem,
} from "../../house/house-items";
import { HOUSE_SMALL_ITEMS } from "../../house/house-small-items";
import { HOUSE_SPRITE_ITEMS } from "../../house/house-sprite-items";
import {
  buyHouseItem,
  getHouseState,
  selectHouseTheme,
  setItemStored,
} from "../../house/house-state";
import {
  DEFAULT_HOUSE_THEME_ID,
  HOUSE_THEMES,
  HouseTheme,
} from "../../house/house-themes";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

type ShopTab = "furniture" | "decor" | "classic" | "room";
const SHOP_TABS: { id: ShopTab; label: string }[] = [
  { id: "furniture", label: "Furniture" },
  { id: "decor", label: "Small Items" },
  { id: "classic", label: "Classic" },
  { id: "room", label: "Walls & Floors" },
];

export function HouseShopModal(): JSXElement {
  const [tab, setTab] = createSignal<ShopTab>("furniture");
  const { pendingId, guardedBuy } = useBuyGuard();

  const stateQuery = useQuery(() => ({
    queryKey: ["houseState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return {
          coins: 0,
          ownedItems: {},
          layout: {},
          scale: {},
          storedItems: {},
          touchOrder: [],
          themeId: DEFAULT_HOUSE_THEME_ID,
        };
      }
      return getHouseState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["houseState"] });
  };

  const isOwned = (id: string): boolean =>
    stateQuery.data?.ownedItems[id] === true;
  const isStored = (id: string): boolean =>
    stateQuery.data?.storedItems[id] === true;

  const handleBuy = async (item: { id: string }): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyHouseItem(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleToggleStored = async (id: string): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await setItemStored(uid, id, !isStored(id));
    refresh();
  };

  const itemsForTab = (): (HouseItem | HouseSpriteItem)[] => {
    if (tab() === "classic") return HOUSE_ITEMS;
    if (tab() === "furniture") return HOUSE_SPRITE_ITEMS;
    return HOUSE_SMALL_ITEMS;
  };

  // The free default is owned by everyone; the rest unlock by purchase.
  const isThemeOwned = (theme: HouseTheme): boolean =>
    theme.price === 0 || isOwned(theme.id);
  const activeThemeId = (): string =>
    stateQuery.data?.themeId ?? DEFAULT_HOUSE_THEME_ID;

  const handleSelectTheme = async (themeId: string): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectHouseTheme(uid, themeId);
    refresh();
  };

  // Buying a finish equips it straight away - nobody buys wallpaper and then
  // wants to look at their old wallpaper.
  const handleBuyTheme = async (theme: HouseTheme): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyHouseItem(uid, theme);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    await selectHouseTheme(uid, theme.id);
    refresh();
  };

  return (
    <AnimatedModal id="HouseShop" title="House Shop">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          Buy furniture and decorations for your house.
        </p>

        <div class="flex gap-1 rounded bg-sub-alt p-1">
          <For each={SHOP_TABS}>
            {(t) => (
              <button
                type="button"
                class={cn(
                  "flex-1 rounded px-3 py-1.5 text-sm transition-colors",
                  tab() === t.id
                    ? "bg-bg text-text"
                    : "text-sub hover:text-text",
                )}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>

        <Show when={tab() === "room"}>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <For each={HOUSE_THEMES}>
              {(theme) => {
                const owned = (): boolean => isThemeOwned(theme);
                const active = (): boolean => activeThemeId() === theme.id;
                const canAfford = (): boolean =>
                  (stateQuery.data?.coins ?? 0) >= theme.price;
                return (
                  <div
                    class={cn(
                      "flex flex-col items-center gap-1.5 rounded p-3 shadow-sm",
                      active() ? "bg-main text-bg" : "bg-sub-alt text-text",
                    )}
                  >
                    {/* Miniature of the room itself: wall band over floor band. */}
                    <div class="h-14 w-full overflow-hidden rounded">
                      <div
                        class="h-2/3 w-full"
                        style={{ background: theme.wall }}
                      ></div>
                      <div
                        class="h-1/3 w-full"
                        style={{ background: theme.floor }}
                      ></div>
                    </div>
                    <span class="text-center text-sm font-medium">
                      {theme.name}
                    </span>
                    <Show
                      when={!owned()}
                      fallback={
                        <Show
                          when={!active()}
                          fallback={
                            <span class="flex items-center gap-1 text-em-xs">
                              <Fa icon="fa-check" size={0.7} /> using
                            </span>
                          }
                        >
                          <button
                            type="button"
                            class="rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={pendingId() !== null}
                            onClick={() =>
                              void guardedBuy(theme.id, async () =>
                                handleSelectTheme(theme.id),
                              )
                            }
                          >
                            use
                          </button>
                        </Show>
                      }
                    >
                      <button
                        type="button"
                        class="flex items-center gap-1 rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canAfford() || pendingId() !== null}
                        onClick={() =>
                          void guardedBuy(theme.id, async () =>
                            handleBuyTheme(theme),
                          )
                        }
                      >
                        <Show
                          when={pendingId() !== theme.id}
                          fallback={
                            <Fa icon="fa-circle-notch" spin size={0.7} />
                          }
                        >
                          <Fa icon="fa-coins" size={0.7} />
                        </Show>
                        {theme.price}
                      </button>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        <Show when={tab() !== "room"}>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <For each={itemsForTab()}>
              {(item) => {
                const owned = (): boolean => isOwned(item.id);
                const stored = (): boolean => isStored(item.id);
                const canAfford = (): boolean =>
                  (stateQuery.data?.coins ?? 0) >= item.price;
                return (
                  <div
                    class={cn(
                      "flex flex-col items-center gap-1.5 rounded p-3 shadow-sm",
                      owned() ? "bg-main text-bg" : "bg-sub-alt text-text",
                    )}
                  >
                    <Show
                      when={"emoji" in item}
                      fallback={
                        <img
                          src={(item as HouseSpriteItem).image}
                          alt={item.name}
                          style={{
                            width: "40px",
                            height: "auto",
                            "image-rendering": "pixelated",
                          }}
                        />
                      }
                    >
                      <div class="text-4xl">{(item as HouseItem).emoji}</div>
                    </Show>
                    <span class="text-center text-sm font-medium">
                      {item.name}
                    </span>
                    <Show
                      when={!owned()}
                      fallback={
                        <button
                          type="button"
                          class="flex items-center gap-1 rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={pendingId() !== null}
                          onClick={() =>
                            void guardedBuy(item.id, async () =>
                              handleToggleStored(item.id),
                            )
                          }
                        >
                          <Show
                            when={pendingId() !== item.id}
                            fallback={
                              <Fa icon="fa-circle-notch" spin size={0.7} />
                            }
                          >
                            <Fa
                              icon={stored() ? "fa-box-open" : "fa-box"}
                              size={0.7}
                            />
                          </Show>
                          {stored() ? "place" : "store"}
                        </button>
                      }
                    >
                      <button
                        type="button"
                        class="flex items-center gap-1 rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canAfford() || pendingId() !== null}
                        onClick={() =>
                          void guardedBuy(item.id, async () => handleBuy(item))
                        }
                      >
                        <Show
                          when={pendingId() !== item.id}
                          fallback={
                            <Fa icon="fa-circle-notch" spin size={0.7} />
                          }
                        >
                          <Fa icon="fa-coins" size={0.7} />
                        </Show>
                        {item.price}
                      </button>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </AnimatedModal>
  );
}

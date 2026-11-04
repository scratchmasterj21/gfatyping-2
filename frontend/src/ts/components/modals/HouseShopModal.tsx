import { useQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../hooks/useBuyGuard";
import { GARDEN_ITEMS } from "../../house/garden-items";
import {
  DEFAULT_GARDEN_THEME_ID,
  GARDEN_THEMES,
  GardenTheme,
} from "../../house/garden-themes";
import {
  HOUSE_ITEMS,
  HouseItem,
  HouseSpriteItem,
} from "../../house/house-items";
import { houseScene } from "../../house/house-scene";
import { HOUSE_SMALL_ITEMS } from "../../house/house-small-items";
import { HOUSE_SPRITE_ITEMS } from "../../house/house-sprite-items";
import {
  buyHouseItem,
  emptyHouseState,
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
import { BuyButton } from "../common/BuyButton";
import { Fa } from "../common/Fa";

type ShopTab = "furniture" | "decor" | "classic" | "room" | "plants" | "sky";
const ROOM_TABS: { id: ShopTab; label: string }[] = [
  { id: "furniture", label: "Furniture" },
  { id: "decor", label: "Small Items" },
  { id: "classic", label: "Classic" },
  { id: "room", label: "Walls & Floors" },
];
const GARDEN_TABS: { id: ShopTab; label: string }[] = [
  { id: "plants", label: "Plants" },
  { id: "sky", label: "Sky" },
];

export function HouseShopModal(): JSXElement {
  const [tab, setTab] = createSignal<ShopTab>("furniture");
  const { pendingId, guardedBuy } = useBuyGuard();
  const garden = (): boolean => houseScene() === "garden";

  createEffect(() => {
    setTab(houseScene() === "garden" ? "plants" : "furniture");
  });

  const stateQuery = useQuery(() => ({
    queryKey: ["houseState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return emptyHouseState();
      return getHouseState(uid);
    },
    staleTime: 60_000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["houseState"] });
  };

  const isOwned = (id: string): boolean => {
    if (garden()) {
      const item = GARDEN_ITEMS.find((entry) => entry.id === id);
      if (item?.price === 0) return true;
      return stateQuery.data?.gardenOwned[id] === true;
    }
    return stateQuery.data?.ownedItems[id] === true;
  };
  const isStored = (id: string): boolean =>
    garden()
      ? stateQuery.data?.gardenStored[id] === true
      : stateQuery.data?.storedItems[id] === true;

  const handleBuy = async (item: { id: string }): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyHouseItem(uid, item, houseScene());
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleToggleStored = async (id: string): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await setItemStored(uid, id, !isStored(id), houseScene());
    refresh();
  };

  const itemsForTab = (): (HouseItem | HouseSpriteItem)[] => {
    if (tab() === "plants") return GARDEN_ITEMS;
    if (tab() === "classic") return HOUSE_ITEMS;
    if (tab() === "furniture") return HOUSE_SPRITE_ITEMS;
    return HOUSE_SMALL_ITEMS;
  };

  const themesForTab = (): (HouseTheme | GardenTheme)[] =>
    tab() === "sky" ? GARDEN_THEMES : HOUSE_THEMES;

  // The free default is owned by everyone; the rest unlock by purchase.
  const isThemeOwned = (theme: HouseTheme | GardenTheme): boolean =>
    theme.price === 0 ||
    (garden()
      ? stateQuery.data?.gardenOwned[theme.id] === true
      : isOwned(theme.id));
  const activeThemeId = (): string =>
    garden()
      ? (stateQuery.data?.gardenThemeId ?? DEFAULT_GARDEN_THEME_ID)
      : (stateQuery.data?.themeId ?? DEFAULT_HOUSE_THEME_ID);

  const handleSelectTheme = async (themeId: string): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectHouseTheme(uid, themeId, houseScene());
    refresh();
  };

  // Buying a finish equips it straight away - nobody buys wallpaper and then
  // wants to look at their old wallpaper.
  const handleBuyTheme = async (
    theme: HouseTheme | GardenTheme,
  ): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyHouseItem(uid, theme, houseScene());
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    await selectHouseTheme(uid, theme.id, houseScene());
    refresh();
  };

  return (
    <AnimatedModal
      id="HouseShop"
      title={garden() ? "Garden Shop" : "House Shop"}
    >
      <div class="grid gap-4 font-kid">
        <div class="flex justify-center">
          <span class="flex items-center gap-2 rounded-full bg-sub-alt px-5 py-2 text-xl font-bold text-main">
            <Fa icon="fa-coins" />
            {stateQuery.data?.coins ?? 0}
          </span>
        </div>

        <p class="text-center text-base text-text">
          {garden()
            ? "Tap a plant to buy it. Tap one you have to put it in the garden or away."
            : "Choose an item. Buy it once, then place or store it anytime."}
        </p>

        <div class="flex gap-2">
          <For each={garden() ? GARDEN_TABS : ROOM_TABS}>
            {(t) => (
              <button
                type="button"
                class={cn(
                  "min-h-12 flex-1 rounded-xl px-3 text-base font-semibold transition-colors",
                  tab() === t.id ? "bg-main text-bg" : "bg-sub-alt text-text",
                )}
                aria-pressed={tab() === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>

        <Show when={tab() === "room" || tab() === "sky"}>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <For each={themesForTab()}>
              {(theme) => {
                const owned = (): boolean => isThemeOwned(theme);
                const active = (): boolean => activeThemeId() === theme.id;
                return (
                  <div
                    class={cn(
                      "flex flex-col items-center gap-2 rounded-double p-3",
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
                    <span class="text-center text-base font-semibold">
                      {theme.name}
                    </span>
                    <Show
                      when={!owned()}
                      fallback={
                        <Show
                          when={!active()}
                          fallback={
                            <span class="flex items-center gap-1 text-sm font-semibold">
                              <Fa icon="fa-check" size={0.7} /> using
                            </span>
                          }
                        >
                          <button
                            type="button"
                            class="press-3d min-h-9 rounded-xl bg-bg px-3 py-1.5 text-sm font-semibold text-text hover:text-main disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
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
                      <BuyButton
                        price={theme.price}
                        coins={stateQuery.data?.coins ?? 0}
                        busy={pendingId() === theme.id}
                        locked={pendingId() !== null}
                        onBuy={() =>
                          void guardedBuy(theme.id, async () =>
                            handleBuyTheme(theme),
                          )
                        }
                      />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        <Show when={tab() !== "room" && tab() !== "sky"}>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <For each={itemsForTab()}>
              {(item) => {
                const owned = (): boolean => isOwned(item.id);
                const stored = (): boolean => isStored(item.id);
                return (
                  <div
                    class={cn(
                      "flex flex-col items-center gap-2 rounded-double p-3",
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
                    <span class="text-center text-base font-semibold">
                      {item.name}
                    </span>
                    <Show
                      when={!owned()}
                      fallback={
                        <button
                          type="button"
                          class="press-3d flex min-h-9 items-center gap-1 rounded-xl bg-bg px-3 py-1.5 text-sm font-semibold text-text hover:text-main disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11"
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
                      <BuyButton
                        price={item.price}
                        coins={stateQuery.data?.coins ?? 0}
                        busy={pendingId() === item.id}
                        locked={pendingId() !== null}
                        onBuy={() =>
                          void guardedBuy(item.id, async () => handleBuy(item))
                        }
                      />
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

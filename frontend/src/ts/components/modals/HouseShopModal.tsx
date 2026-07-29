import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { HOUSE_ITEMS, HouseItem } from "../../house/house-items";
import {
  buyHouseItem,
  getHouseState,
  setItemStored,
} from "../../house/house-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

export function HouseShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["houseState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedItems: {}, layout: {}, storedItems: {} };
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

  const handleBuy = async (item: HouseItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyHouseItem(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleToggleStored = async (item: HouseItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await setItemStored(uid, item.id, !isStored(item.id));
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

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={HOUSE_ITEMS}>
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
                  <div class="text-4xl">{item.emoji}</div>
                  <span class="text-center text-sm font-medium">
                    {item.name}
                  </span>
                  <Show
                    when={!owned()}
                    fallback={
                      <button
                        type="button"
                        class="flex items-center gap-1 rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main"
                        onClick={() => void handleToggleStored(item)}
                      >
                        <Fa
                          icon={stored() ? "fa-box-open" : "fa-box"}
                          size={0.7}
                        />
                        {stored() ? "place" : "store"}
                      </button>
                    }
                  >
                    <button
                      type="button"
                      class="flex items-center gap-1 rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canAfford()}
                      onClick={() => void handleBuy(item)}
                    >
                      <Fa icon="fa-coins" size={0.7} />
                      {item.price}
                    </button>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </AnimatedModal>
  );
}

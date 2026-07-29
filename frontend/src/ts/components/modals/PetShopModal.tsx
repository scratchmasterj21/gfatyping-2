import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { PET_ITEMS, PetItem } from "../../pet-shop/pet-items";
import {
  buyPetItem,
  getPetState,
  setPetStored,
} from "../../pet-shop/pet-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";
import { PetSprite } from "../common/PetSprite";

export function PetShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["petState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedPets: {}, storedPets: {} };
      return getPetState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["petState"] });
  };

  const isOwned = (id: string): boolean =>
    stateQuery.data?.ownedPets[id] === true;
  const isStored = (id: string): boolean =>
    stateQuery.data?.storedPets[id] === true;

  const handleBuy = async (item: PetItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyPetItem(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleToggleStored = async (item: PetItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await setPetStored(uid, item.id, !isStored(item.id));
    refresh();
  };

  return (
    <AnimatedModal id="PetShop" title="Pet Shop">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          Buy a pet to roam around your house.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={PET_ITEMS}>
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
                  <div class="h-12 w-12">
                    <PetSprite species={item.species} sizePx={48} />
                  </div>
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

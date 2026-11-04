import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../hooks/useBuyGuard";
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
import { BuyButton } from "../common/BuyButton";
import { Fa } from "../common/Fa";
import { PetSprite } from "../common/PetSprite";

export function PetShopModal(): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  const stateQuery = useQuery(() => ({
    queryKey: ["petState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedPets: {}, storedPets: {} };
      return getPetState(uid);
    },
    staleTime: 60_000,
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
      <div class="grid gap-4 font-kid">
        <div class="flex justify-center">
          <span class="flex items-center gap-2 rounded-full bg-sub-alt px-5 py-2 text-xl font-bold text-main">
            <Fa icon="fa-coins" />
            {stateQuery.data?.coins ?? 0}
          </span>
        </div>

        <p class="text-center text-sm text-sub">
          Choose a pet. Buy it once, then place it in your house.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={PET_ITEMS}>
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
                  <div class="h-12 w-12">
                    <PetSprite species={item.species} sizePx={48} />
                  </div>
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
                            handleToggleStored(item),
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
      </div>
    </AnimatedModal>
  );
}

import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import {
  buySideImageSet,
  DEFAULT_SIDE_IMAGES_PRICE,
  getSideImagesShopState,
  SideImageSet,
} from "../../classroom/side-images";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

export function SideImagesModal(): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  // Modals mount once at app boot (see Modals.tsx), often before Firebase
  // Auth resolves, so this can't read the uid once via a plain function call
  // like AvatarModal does - it needs getUserId() (the reactive signal) in
  // the queryKey so tanstack-query actually refetches once auth resolves,
  // instead of caching an empty result forever.
  const stateQuery = useQuery(() => ({
    queryKey: ["sideImagesShop", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, catalog: [], owned: {} };
      return getSideImagesShopState(uid);
    },
    enabled: getUserId() !== null,
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["sideImagesShop"] });
  };

  const isOwned = (id: string | undefined): boolean =>
    id !== undefined && stateQuery.data?.owned[id] === true;

  const handleBuy = async (item: SideImageSet): Promise<void> => {
    const uid = getUserId();
    if (uid === null || item.id === undefined) return;
    const result = await buySideImageSet(uid, item.id);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  return (
    <AnimatedModal id="SideImagesShop" title="Side Images Shop">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          Buy image sets to show beside your typing test. Cycle through anything
          you own while you type.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Show
            when={(stateQuery.data?.catalog.length ?? 0) > 0}
            fallback={
              <div class="col-span-full place-self-center py-6 text-sub">
                No side images available yet - ask your teacher to add some.
              </div>
            }
          >
            <For each={stateQuery.data?.catalog}>
              {(item) => {
                const owned = (): boolean => isOwned(item.id);
                const canAfford = (): boolean =>
                  (stateQuery.data?.coins ?? 0) >=
                  (item.price ?? DEFAULT_SIDE_IMAGES_PRICE);
                return (
                  <div
                    class={cn(
                      "flex flex-col items-center gap-1.5 rounded p-3 shadow-sm",
                      owned() ? "bg-main text-bg" : "bg-sub-alt text-text",
                    )}
                  >
                    <Show
                      when={item.left !== null}
                      fallback={
                        <div class="grid h-20 w-full place-items-center rounded bg-bg/40">
                          <Fa icon="fa-image" size={1.2} />
                        </div>
                      }
                    >
                      <div class="grid h-20 w-full place-items-center rounded bg-bg/40">
                        <img
                          src={item.left ?? ""}
                          alt=""
                          class="h-full w-full rounded object-contain"
                        />
                      </div>
                    </Show>
                    <span class="text-center text-sm font-medium">
                      {item.label ?? "Side images"}
                    </span>
                    <Show
                      when={!owned()}
                      fallback={
                        <span class="flex items-center gap-1 text-em-xs">
                          <Fa icon="fa-check" size={0.7} /> owned
                        </span>
                      }
                    >
                      <button
                        type="button"
                        class="flex items-center gap-1 rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canAfford() || pendingId() !== null}
                        onClick={() =>
                          void guardedBuy(item.id ?? "", async () =>
                            handleBuy(item),
                          )
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
                        {item.price ?? DEFAULT_SIDE_IMAGES_PRICE}
                      </button>
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </AnimatedModal>
  );
}

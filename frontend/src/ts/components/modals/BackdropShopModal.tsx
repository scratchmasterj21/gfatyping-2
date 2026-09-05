import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import {
  BACKDROP_ITEMS,
  BackdropItem,
  BackdropItemId,
} from "../../backdrops/backdrop-items";
import {
  buyBackdrop,
  getBackdropState,
  selectBackdrop,
} from "../../backdrops/backdrop-state";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

const PREVIEW_BACKGROUNDS: Record<BackdropItemId, string> = {
  none: "transparent",
  ocean: "linear-gradient(135deg, #0f2942, #1c6ea4, #4fc0d0)",
  wood: "linear-gradient(135deg, #3b2415, #6b4423, #8b5a2b)",
  space: "linear-gradient(135deg, #05010d, #1a0b2e, #3d1a5e)",
};

export function BackdropShopModal(): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  const stateQuery = useQuery(() => ({
    queryKey: ["backdropState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return {
          coins: 0,
          ownedBackdrops: {},
          selectedBackdrop: "none" as const,
        };
      }
      return getBackdropState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["backdropState"] });
  };

  const isOwned = (id: BackdropItemId): boolean =>
    id === "none" || stateQuery.data?.ownedBackdrops[id] === true;

  const isSelected = (id: BackdropItemId): boolean =>
    (stateQuery.data?.selectedBackdrop ?? "none") === id;

  const handleBuy = async (item: BackdropItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyBackdrop(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleSelect = async (id: BackdropItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectBackdrop(uid, id);
    refresh();
  };

  return (
    <AnimatedModal id="BackdropShop" title="Backdrops">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          Choose a backdrop. Buy it once, then select it whenever you want.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <For each={BACKDROP_ITEMS}>
            {(item) => {
              const owned = (): boolean => isOwned(item.id);
              const selected = (): boolean => isSelected(item.id);
              const canAfford = (): boolean =>
                (stateQuery.data?.coins ?? 0) >= (item.price ?? 0);
              return (
                <div
                  class={cn(
                    "flex flex-col items-center gap-1.5 rounded p-3 shadow-sm",
                    selected() ? "bg-main text-bg" : "bg-sub-alt text-text",
                  )}
                >
                  <div
                    class="h-10 w-full rounded"
                    style={{ background: PREVIEW_BACKGROUNDS[item.id] }}
                  ></div>
                  <span class="text-center text-sm font-medium">
                    {item.name}
                  </span>
                  <span class="text-center text-em-xs opacity-80">
                    {item.description}
                  </span>
                  <Show
                    when={!owned()}
                    fallback={
                      <Show
                        when={!selected()}
                        fallback={
                          <span class="flex items-center gap-1 text-em-xs">
                            <Fa icon="fa-check" size={0.7} /> selected
                          </span>
                        }
                      >
                        <button
                          type="button"
                          class="rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={pendingId() !== null}
                          onClick={() =>
                            void guardedBuy(item.id, async () =>
                              handleSelect(item.id),
                            )
                          }
                        >
                          select
                        </button>
                      </Show>
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
                        fallback={<Fa icon="fa-circle-notch" spin size={0.7} />}
                      >
                        <Fa icon="fa-coins" size={0.7} />
                      </Show>
                      {canAfford() ? item.price : "Not enough coins"}
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

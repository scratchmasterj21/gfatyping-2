import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { useBuyGuard } from "../../hooks/useBuyGuard";
import {
  KEYPRESS_EFFECT_ITEMS,
  KeypressEffectItem,
  KeypressEffectItemId,
} from "../../keypress-effects/keypress-effect-items";
import {
  buyKeypressEffect,
  getKeypressEffectState,
  selectKeypressEffect,
} from "../../keypress-effects/keypress-effect-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { FaSolidIcon } from "../../types/font-awesome";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

const PREVIEW_ICONS: Record<KeypressEffectItemId, FaSolidIcon> = {
  none: "fa-ban",
  spark: "fa-star",
  ripple: "fa-circle-notch",
  confetti: "fa-certificate",
};

export function KeypressEffectShopModal(): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  const stateQuery = useQuery(() => ({
    queryKey: ["keypressEffectState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedEffects: {}, selectedEffect: "none" as const };
      }
      return getKeypressEffectState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["keypressEffectState"] });
  };

  const isOwned = (id: KeypressEffectItemId): boolean =>
    id === "none" || stateQuery.data?.ownedEffects[id] === true;

  const isSelected = (id: KeypressEffectItemId): boolean =>
    (stateQuery.data?.selectedEffect ?? "none") === id;

  const handleBuy = async (item: KeypressEffectItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyKeypressEffect(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleSelect = async (id: KeypressEffectItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectKeypressEffect(uid, id);
    refresh();
  };

  return (
    <AnimatedModal id="KeypressEffectShop" title="Keypress Effects">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          A little flourish on the next key you need to press.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <For each={KEYPRESS_EFFECT_ITEMS}>
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
                  <Fa icon={PREVIEW_ICONS[item.id]} size={1.5} />
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

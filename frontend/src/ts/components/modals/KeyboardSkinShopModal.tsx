import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import {
  keyboardStyle,
  setKeyboardStyle,
} from "../../components/pages/test/AnimatedHands";
import {
  KEYBOARD_SKIN_ITEMS,
  KeyboardSkinItem,
} from "../../keyboard-skins/keyboard-skin-items";
import {
  buyKeyboardSkin,
  getKeyboardSkinState,
} from "../../keyboard-skins/keyboard-skin-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

const PREVIEW_COLORS: Record<string, string> = {
  wood: "#8b5a2b",
  glass: "#7fb3d5",
};

export function KeyboardSkinShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["keyboardSkinState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedSkins: {} };
      return getKeyboardSkinState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["keyboardSkinState"] });
  };

  const isOwned = (id: string): boolean =>
    stateQuery.data?.ownedSkins[id] === true;

  const isSelected = (id: string): boolean => keyboardStyle() === id;

  const handleBuy = async (item: KeyboardSkinItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyKeyboardSkin(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    setKeyboardStyle(item.id);
    refresh();
  };

  return (
    <AnimatedModal id="KeyboardSkinShop" title="Keyboard Skins">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          New keyboard finishes for the guided keyboard display.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={KEYBOARD_SKIN_ITEMS}>
            {(item) => {
              const owned = (): boolean => isOwned(item.id);
              const selected = (): boolean => isSelected(item.id);
              const canAfford = (): boolean =>
                (stateQuery.data?.coins ?? 0) >= item.price;
              return (
                <div
                  class={cn(
                    "flex flex-col items-center gap-1.5 rounded p-3 shadow-sm",
                    selected() ? "bg-main text-bg" : "bg-sub-alt text-text",
                  )}
                >
                  <div
                    class="h-10 w-10 rounded"
                    style={{ "background-color": PREVIEW_COLORS[item.id] }}
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
                          class="rounded bg-bg px-2 py-1 text-em-xs text-text transition-colors hover:text-main"
                          onClick={() => setKeyboardStyle(item.id)}
                        >
                          select
                        </button>
                      </Show>
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

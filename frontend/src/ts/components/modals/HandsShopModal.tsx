import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { HAND_STYLES, HandStyle, HandStyleId } from "../../hands/hand-styles";
import {
  buyHandStyle,
  getHandsState,
  selectHandStyle,
} from "../../hands/hands-state";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

// Card swatch preview - mirrors the fill/stroke colors each style actually
// applies to the hand SVG (see AnimatedHands.tsx's HAND_STYLE_THEME_CSS and
// assets/hands.svg's baked-in .theme-robot/.theme-kingfish/.theme-dark rules).
const PREVIEW_COLORS: Record<HandStyleId, { fill: string; stroke: string }> = {
  classic: { fill: "#E0E1E2", stroke: "#808285" },
  robot: { fill: "#b1b7ce", stroke: "#b238b7" },
  kingfish: { fill: "#b5bac3", stroke: "#2196f3" },
  dark: { fill: "#8a8a8a", stroke: "#b158b5" },
  warmtone: { fill: "#e8b892", stroke: "#8a5a3c" },
  golden: { fill: "#f5cf6b", stroke: "#c99a2e" },
};

export function HandsShopModal(): JSXElement {
  const { pendingId, guardedBuy } = useBuyGuard();

  const stateQuery = useQuery(() => ({
    queryKey: ["handsState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedStyles: {}, selectedStyle: "classic" as const };
      }
      return getHandsState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["handsState"] });
  };

  const isOwned = (id: HandStyleId): boolean =>
    id === "classic" || stateQuery.data?.ownedStyles[id] === true;

  const isSelected = (id: HandStyleId): boolean =>
    (stateQuery.data?.selectedStyle ?? "classic") === id;

  const handleBuy = async (item: HandStyle): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyHandStyle(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleSelect = async (id: HandStyleId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectHandStyle(uid, id);
    refresh();
  };

  return (
    <AnimatedModal id="HandsShop" title="Hand Styles">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          Choose a style. Buy it once, then select it whenever you want.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={HAND_STYLES}>
            {(item) => {
              const owned = (): boolean => isOwned(item.id);
              const selected = (): boolean => isSelected(item.id);
              const canAfford = (): boolean =>
                (stateQuery.data?.coins ?? 0) >= (item.price ?? 0);
              const colors = PREVIEW_COLORS[item.id];
              return (
                <div
                  class={cn(
                    "flex flex-col items-center gap-1.5 rounded p-3 shadow-sm",
                    selected() ? "bg-main text-bg" : "bg-sub-alt text-text",
                  )}
                >
                  <div
                    class="h-10 w-10 rounded-full border-2"
                    style={{
                      "background-color": colors.fill,
                      "border-color": colors.stroke,
                    }}
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

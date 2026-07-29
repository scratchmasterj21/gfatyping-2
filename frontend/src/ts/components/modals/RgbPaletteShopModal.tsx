import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement, Show } from "solid-js";

import { queryClient } from "../../queries";
import {
  RGB_PALETTE_ITEMS,
  RgbPaletteItem,
  RgbPaletteItemId,
} from "../../rgb-palettes/rgb-palette-items";
import {
  buyRgbPalette,
  getRgbPaletteState,
  selectRgbPalette,
} from "../../rgb-palettes/rgb-palette-state";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

const PREVIEW_HUES: Record<RgbPaletteItemId, string> = {
  rainbow:
    "linear-gradient(90deg, hsl(0,88%,57%), hsl(120,88%,57%), hsl(240,88%,57%))",
  ocean: "linear-gradient(90deg, hsl(170,88%,57%), hsl(260,88%,57%))",
  sunset: "linear-gradient(90deg, hsl(330,88%,57%), hsl(60,88%,57%))",
  forest: "linear-gradient(90deg, hsl(80,88%,57%), hsl(200,88%,57%))",
  royal: "linear-gradient(90deg, hsl(255,88%,57%), hsl(315,88%,57%))",
};

export function RgbPaletteShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["rgbPaletteState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return {
          coins: 0,
          ownedPalettes: {},
          selectedPalette: "rainbow" as const,
        };
      }
      return getRgbPaletteState(uid);
    },
    staleTime: 0,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["rgbPaletteState"] });
  };

  const isOwned = (id: RgbPaletteItemId): boolean =>
    id === "rainbow" || stateQuery.data?.ownedPalettes[id] === true;

  const isSelected = (id: RgbPaletteItemId): boolean =>
    (stateQuery.data?.selectedPalette ?? "rainbow") === id;

  const handleBuy = async (item: RgbPaletteItem): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    const result = await buyRgbPalette(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    refresh();
  };

  const handleSelect = async (id: RgbPaletteItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectRgbPalette(uid, id);
    refresh();
  };

  return (
    <AnimatedModal id="RgbPaletteShop" title="RGB Palettes">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-2 text-lg font-bold text-main">
          <Fa icon="fa-coins" />
          {stateQuery.data?.coins ?? 0}
        </div>

        <p class="text-center text-em-xs text-sub">
          Change the color scheme of the RGB keyboard lighting.
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={RGB_PALETTE_ITEMS}>
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
                    class="h-3 w-full rounded-full"
                    style={{ background: PREVIEW_HUES[item.id] }}
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
                          onClick={() => void handleSelect(item.id)}
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

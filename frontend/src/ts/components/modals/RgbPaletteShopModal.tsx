import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

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
import { CosmeticShop } from "../common/CosmeticShop";
import { RgbKeyboardPreview } from "../common/RgbKeyboardPreview";
import { shopCollection } from "../../utils/shop-collections";

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
    staleTime: 60 * 1000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["rgbPaletteState"] });
  };

  const handleBuy = async (item: RgbPaletteItem): Promise<boolean> => {
    const uid = getUserId();
    if (uid === null) return false;
    const result = await buyRgbPalette(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return false;
    }
    refresh();
    return true;
  };

  const handleSelect = async (id: RgbPaletteItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectRgbPalette(uid, id);
    refresh();
  };

  return (
    <CosmeticShop
      id="RgbPaletteShop"
      title="RGB Palettes"
      items={RGB_PALETTE_ITEMS}
      coins={stateQuery.data?.coins ?? 0}
      isOwned={(id) =>
        id === "rainbow" || stateQuery.data?.ownedPalettes[id] === true
      }
      collection={shopCollection(
        "rgbPalette",
        RGB_PALETTE_ITEMS,
        (id) => id === "rainbow" || stateQuery.data?.ownedPalettes[id] === true,
        stateQuery.data?.claimedCollections,
      )}
      isSelected={(id) =>
        (stateQuery.data?.selectedPalette ?? "rainbow") === id
      }
      thumb={(item) => <RgbKeyboardPreview palette={item.id} class="w-28" />}
      preview={(item) => (
        <RgbKeyboardPreview palette={item.id} class="w-full max-w-sm" />
      )}
      onBuy={handleBuy}
      onSelect={handleSelect}
    />
  );
}

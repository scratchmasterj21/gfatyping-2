import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

import {
  BACKDROP_BACKGROUNDS,
  BACKDROP_ITEMS,
  BackdropItem,
  BackdropItemId,
} from "../../backdrops/backdrop-items";
import {
  buyBackdrop,
  getBackdropState,
  selectBackdrop,
} from "../../backdrops/backdrop-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { CosmeticShop } from "../common/CosmeticShop";
import { SkinKeyboardPreview } from "../common/SkinKeyboardPreview";
import { shopCollection } from "../../utils/shop-collections";

export function BackdropShopModal(): JSXElement {
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
    staleTime: 60 * 1000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["backdropState"] });
  };

  const handleBuy = async (item: BackdropItem): Promise<boolean> => {
    const uid = getUserId();
    if (uid === null) return false;
    const result = await buyBackdrop(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return false;
    }
    refresh();
    return true;
  };

  const handleSelect = async (id: BackdropItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectBackdrop(uid, id);
    refresh();
  };

  return (
    <CosmeticShop
      id="BackdropShop"
      title="Backdrops"
      items={BACKDROP_ITEMS}
      coins={stateQuery.data?.coins ?? 0}
      isOwned={(id) =>
        id === "none" || stateQuery.data?.ownedBackdrops[id] === true
      }
      collection={shopCollection(
        "backdrop",
        BACKDROP_ITEMS,
        (id) => id === "none" || stateQuery.data?.ownedBackdrops[id] === true,
        stateQuery.data?.claimedCollections,
      )}
      isSelected={(id) => (stateQuery.data?.selectedBackdrop ?? "none") === id}
      thumb={(item) => (
        <div
          class="h-10 w-full rounded"
          style={{ background: BACKDROP_BACKGROUNDS[item.id] }}
        ></div>
      )}
      preview={(item) => (
        <div
          class="w-full max-w-sm rounded-lg p-4"
          style={{ background: BACKDROP_BACKGROUNDS[item.id] }}
        >
          <SkinKeyboardPreview skin="glass" class="opacity-90" />
        </div>
      )}
      onBuy={handleBuy}
      onSelect={handleSelect}
      cols="sm:grid-cols-4"
    />
  );
}

import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

import {
  CARET_EFFECT_ITEMS,
  CaretEffectItem,
  CaretEffectItemId,
} from "../../caret-effects/caret-effect-items";
import {
  buyCaretEffect,
  getCaretEffectState,
  selectCaretEffect,
} from "../../caret-effects/caret-effect-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { FaSolidIcon } from "../../types/font-awesome";
import { CosmeticShop } from "../common/CosmeticShop";
import { EffectDemo } from "../common/EffectDemo";
import { EffectThumb } from "../common/EffectThumb";
import { shopCollection } from "../../utils/shop-collections";

export const CARET_EFFECT_ICONS: Record<CaretEffectItemId, FaSolidIcon> = {
  none: "fa-ban",
  glow: "fa-sun",
  comet: "fa-meteor",
  sparkle: "fa-magic",
  rainbow: "fa-rainbow",
  heartbeat: "fa-heartbeat",
  fire: "fa-fire",
  sakura: "fa-spa",
};

export function CaretEffectShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["caretEffectState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedEffects: {}, selectedEffect: "none" as const };
      }
      return getCaretEffectState(uid);
    },
    staleTime: 60 * 1000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["caretEffectState"] });
  };

  const handleBuy = async (item: CaretEffectItem): Promise<boolean> => {
    const uid = getUserId();
    if (uid === null) return false;
    const result = await buyCaretEffect(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return false;
    }
    refresh();
    return true;
  };

  const handleSelect = async (id: CaretEffectItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectCaretEffect(uid, id);
    refresh();
  };

  return (
    <CosmeticShop
      id="CaretEffectShop"
      title="Caret Effects"
      items={CARET_EFFECT_ITEMS}
      coins={stateQuery.data?.coins ?? 0}
      isOwned={(id) =>
        id === "none" || stateQuery.data?.ownedEffects[id] === true
      }
      collection={shopCollection(
        "caretEffect",
        CARET_EFFECT_ITEMS,
        (id) => id === "none" || stateQuery.data?.ownedEffects[id] === true,
        stateQuery.data?.claimedCollections,
      )}
      isSelected={(id) => (stateQuery.data?.selectedEffect ?? "none") === id}
      thumb={(item) => (
        <EffectThumb
          icon={CARET_EFFECT_ICONS[item.id]}
          none={item.id === "none"}
        />
      )}
      preview={(item) => (
        <EffectDemo
          icon={CARET_EFFECT_ICONS[item.id]}
          none={item.id === "none"}
        />
      )}
      onBuy={handleBuy}
      onSelect={handleSelect}
      cols="sm:grid-cols-4"
    />
  );
}

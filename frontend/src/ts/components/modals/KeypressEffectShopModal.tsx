import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

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
import { CosmeticShop } from "../common/CosmeticShop";
import { EffectDemo } from "../common/EffectDemo";
import { EffectThumb } from "../common/EffectThumb";
import { shopCollection } from "../../utils/shop-collections";

export const KEYPRESS_EFFECT_ICONS: Record<KeypressEffectItemId, FaSolidIcon> =
  {
    none: "fa-ban",
    spark: "fa-star",
    ripple: "fa-circle-notch",
    confetti: "fa-certificate",
    stars: "fa-star",
    hearts: "fa-heart",
    bubbles: "fa-circle",
    snow: "fa-snowflake",
  };

export function KeypressEffectShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["keypressEffectState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedEffects: {}, selectedEffect: "none" as const };
      }
      return getKeypressEffectState(uid);
    },
    staleTime: 60 * 1000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["keypressEffectState"] });
  };

  const handleBuy = async (item: KeypressEffectItem): Promise<boolean> => {
    const uid = getUserId();
    if (uid === null) return false;
    const result = await buyKeypressEffect(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return false;
    }
    refresh();
    return true;
  };

  const handleSelect = async (id: KeypressEffectItemId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectKeypressEffect(uid, id);
    refresh();
  };

  return (
    <CosmeticShop
      id="KeypressEffectShop"
      title="Keypress Effects"
      items={KEYPRESS_EFFECT_ITEMS}
      coins={stateQuery.data?.coins ?? 0}
      isOwned={(id) =>
        id === "none" || stateQuery.data?.ownedEffects[id] === true
      }
      collection={shopCollection(
        "keypressEffect",
        KEYPRESS_EFFECT_ITEMS,
        (id) => id === "none" || stateQuery.data?.ownedEffects[id] === true,
        stateQuery.data?.claimedCollections,
      )}
      isSelected={(id) => (stateQuery.data?.selectedEffect ?? "none") === id}
      thumb={(item) => (
        <EffectThumb
          icon={KEYPRESS_EFFECT_ICONS[item.id]}
          none={item.id === "none"}
        />
      )}
      preview={(item) => (
        <EffectDemo
          icon={KEYPRESS_EFFECT_ICONS[item.id]}
          none={item.id === "none"}
        />
      )}
      onBuy={handleBuy}
      onSelect={handleSelect}
      cols="sm:grid-cols-4"
    />
  );
}

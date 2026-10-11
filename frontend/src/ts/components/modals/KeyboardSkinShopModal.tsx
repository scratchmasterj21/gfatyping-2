import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

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
import { CosmeticShop } from "../common/CosmeticShop";
import { SkinKeyboardPreview } from "../common/SkinKeyboardPreview";
import { shopCollection } from "../../utils/shop-collections";

export function KeyboardSkinShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["keyboardSkinState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedSkins: {} };
      return getKeyboardSkinState(uid);
    },
    staleTime: 60 * 1000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["keyboardSkinState"] });
  };

  const handleBuy = async (item: KeyboardSkinItem): Promise<boolean> => {
    const uid = getUserId();
    if (uid === null) return false;
    const result = await buyKeyboardSkin(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return false;
    }
    setKeyboardStyle(item.id);
    refresh();
    return true;
  };

  return (
    <CosmeticShop
      id="KeyboardSkinShop"
      title="Keyboard Skins"
      items={KEYBOARD_SKIN_ITEMS}
      coins={stateQuery.data?.coins ?? 0}
      isOwned={(id) => stateQuery.data?.ownedSkins[id] === true}
      collection={shopCollection(
        "keyboardSkin",
        KEYBOARD_SKIN_ITEMS,
        (id) => stateQuery.data?.ownedSkins[id] === true,
        stateQuery.data?.claimedCollections,
      )}
      isSelected={(id) => keyboardStyle() === id}
      thumb={(item) => <SkinKeyboardPreview skin={item.id} class="w-28" />}
      preview={(item) => (
        <SkinKeyboardPreview skin={item.id} class="w-full max-w-sm" />
      )}
      onBuy={handleBuy}
      onSelect={setKeyboardStyle}
    />
  );
}

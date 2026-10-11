import { callApi } from "../api-client";
import { invalidateCoinQueries } from "../queries/coins";
import { showSuccessNotification } from "../states/notifications";

/** Mirrors COLLECTION_SHOPS / COLLECTION_REWARD in api/claim-reward.ts. */
export type CollectionShop =
  | "hands"
  | "rgbPalette"
  | "keyboardSkin"
  | "keypressEffect"
  | "caretEffect"
  | "backdrop";
export const SHOP_COLLECTION_REWARD = 40;

export type CosmeticCollection = {
  owned: number;
  total: number;
  reward: number;
  claimed: boolean;
  onClaim: () => Promise<void>;
};

/** Year-round, coin-priced items; free defaults and seasonal ones don't count. */
export function collectibleIds(
  items: { id: string; price?: number; seasonMonths?: number[] }[],
): string[] {
  return items
    .filter((i) => i.price !== undefined && i.seasonMonths === undefined)
    .map((i) => i.id);
}

export function claimedFromDoc(
  data: Record<string, unknown>,
): Record<string, true> {
  return (data["claimedCollections"] as Record<string, true> | undefined) ?? {};
}

export function shopCollection(
  shop: CollectionShop,
  items: { id: string; price?: number; seasonMonths?: number[] }[],
  isOwned: (id: string) => boolean,
  claimed: Record<string, true> | undefined,
): CosmeticCollection {
  const ids = collectibleIds(items);
  return {
    owned: ids.filter(isOwned).length,
    total: ids.length,
    reward: SHOP_COLLECTION_REWARD,
    claimed: claimed?.[`shop-${shop}`] === true,
    onClaim: async () => {
      const result = await callApi<{ claimed: boolean; coins: number }>(
        "/api/claim-reward",
        { type: "shopCollection", category: shop },
      );
      if (result.claimed) {
        invalidateCoinQueries();
        showSuccessNotification(`Collection complete! +${result.coins} coins`);
      }
    },
  };
}

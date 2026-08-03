import { queryClient } from ".";

/**
 * Every TanStack query key that reads the signed-in user's coin balance
 * (shop modals, dashboards, etc). Each shop bundles `coins` into its own
 * state query rather than sharing one, so a coin change anywhere (reward,
 * purchase, quest payout, race reward...) doesn't reach the others unless
 * every one of these gets invalidated too - that's what left other shops
 * showing a stale balance until a full reload.
 *
 * Call invalidateCoinQueries() after ANY write that changes `coins` on a
 * user doc. Adding a new coin-consuming shop later? Add its query key here.
 */
const COIN_QUERY_KEYS: string[] = [
  "avatarState",
  "houseState",
  "petState",
  "handsState",
  "rgbPaletteState",
  "keyboardSkinState",
  "keypressEffectState",
  "caretEffectState",
  "backdropState",
  "sideImagesShop",
];

export function invalidateCoinQueries(): void {
  for (const key of COIN_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

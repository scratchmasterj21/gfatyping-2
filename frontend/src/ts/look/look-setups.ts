import { callApi } from "../api-client";
import {
  isGuidedKeyboardStyle,
  setKeyboardStyle,
} from "../components/pages/test/guided-keyboard-prefs";
import { invalidateCoinQueries } from "../queries/coins";

/** Saved keyboard + effects looks, stored under users/{uid}.savedSetups[slot]. */
export const SETUP_SLOTS = ["1", "2", "3"] as const;

type LookResult = { ok: boolean; keyboardStyle?: string };

function applyLook(result: LookResult): void {
  if (
    result.keyboardStyle !== undefined &&
    isGuidedKeyboardStyle(result.keyboardStyle)
  ) {
    setKeyboardStyle(result.keyboardStyle);
  }
  invalidateCoinQueries();
}

/** Saves the current keyboard style plus every shop pick into a slot. */
export async function saveSetup(
  slot: string,
  keyboardStyle: string,
): Promise<void> {
  await callApi("/api/equip-item", {
    target: "saveSetup",
    slot,
    itemId: keyboardStyle,
  });
  invalidateCoinQueries();
}

/** Puts a saved setup back on; picks no longer owned are skipped server-side. */
export async function wearSetup(slot: string): Promise<void> {
  applyLook(
    await callApi<LookResult>("/api/equip-item", {
      target: "wearSetup",
      slot,
    }),
  );
}

/** Random owned keyboard, hands, palette, backdrop and effects in one write. */
export async function surpriseLook(): Promise<void> {
  applyLook(
    await callApi<LookResult>("/api/equip-item", { target: "surpriseLook" }),
  );
}

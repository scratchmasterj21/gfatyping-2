import { useQuery } from "@tanstack/solid-query";
import { createEffect, JSXElement } from "solid-js";

import { CaretEffectItemId } from "../../caret-effects/caret-effect-items";
import { getCaretEffectState } from "../../caret-effects/caret-effect-state";
import { getUserId } from "../../states/core";

const FX_CLASSES = ["fx-glow", "fx-comet", "fx-sparkle"];

/**
 * Non-visual - just adds/removes a cosmetic class on the existing #caret
 * element based on the student's selected (purchased) caret effect. Doesn't
 * touch the Caret class's own class management (off/default/carrot/etc, see
 * elements/caret.ts), so it's safe to run independently alongside it.
 */
export function CaretEffectController(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["caretEffectState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedEffects: {}, selectedEffect: "none" as const };
      }
      return getCaretEffectState(uid);
    },
    staleTime: 0,
  }));

  createEffect(() => {
    const effect: CaretEffectItemId = stateQuery.data?.selectedEffect ?? "none";
    const el = document.getElementById("caret");
    if (!el) return;
    el.classList.remove(...FX_CLASSES);
    if (effect !== "none") {
      el.classList.add(`fx-${effect}`);
    }
  });

  return null;
}

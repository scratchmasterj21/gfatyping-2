import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

import { HAND_STYLES, HandStyle, HandStyleId } from "../../hands/hand-styles";
import {
  buyHandStyle,
  getHandsState,
  selectHandStyle,
} from "../../hands/hands-state";
import { queryClient } from "../../queries";
import { getUserId } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { CosmeticShop } from "../common/CosmeticShop";
import { Fa } from "../common/Fa";
import { shopCollection } from "../../utils/shop-collections";

// Mirrors the fill/stroke colors each style applies to the hand SVG (see
// AnimatedHands.tsx's HAND_STYLE_THEME_CSS and assets/hands.svg's baked-in
// .theme-robot/.theme-kingfish/.theme-dark rules).
export const HAND_PREVIEW_COLORS: Record<
  HandStyleId,
  { fill: string; stroke: string }
> = {
  classic: { fill: "#E0E1E2", stroke: "#808285" },
  robot: { fill: "#b1b7ce", stroke: "#b238b7" },
  kingfish: { fill: "#b5bac3", stroke: "#2196f3" },
  dark: { fill: "#8a8a8a", stroke: "#b158b5" },
  warmtone: { fill: "#e8b892", stroke: "#8a5a3c" },
  golden: { fill: "#f5cf6b", stroke: "#c99a2e" },
};

function HandSwatch(props: { id: HandStyleId; big?: boolean }): JSXElement {
  const colors = (): { fill: string; stroke: string } =>
    HAND_PREVIEW_COLORS[props.id];
  return (
    <span
      class={
        props.big
          ? "flex h-20 w-20 items-center justify-center rounded-full border-4"
          : "flex h-10 w-10 items-center justify-center rounded-full border-2"
      }
      style={{
        "background-color": colors().fill,
        "border-color": colors().stroke,
        color: colors().stroke,
      }}
    >
      <Fa icon="fa-hand-paper" size={props.big ? 2 : 1} />
    </span>
  );
}

export function HandsShopModal(): JSXElement {
  const stateQuery = useQuery(() => ({
    queryKey: ["handsState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedStyles: {}, selectedStyle: "classic" as const };
      }
      return getHandsState(uid);
    },
    staleTime: 60 * 1000,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["handsState"] });
  };

  const handleBuy = async (item: HandStyle): Promise<boolean> => {
    const uid = getUserId();
    if (uid === null) return false;
    const result = await buyHandStyle(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return false;
    }
    refresh();
    return true;
  };

  const handleSelect = async (id: HandStyleId): Promise<void> => {
    const uid = getUserId();
    if (uid === null) return;
    await selectHandStyle(uid, id);
    refresh();
  };

  return (
    <CosmeticShop
      id="HandsShop"
      title="Hand Styles"
      items={HAND_STYLES}
      coins={stateQuery.data?.coins ?? 0}
      isOwned={(id) =>
        id === "classic" || stateQuery.data?.ownedStyles[id] === true
      }
      collection={shopCollection(
        "hands",
        HAND_STYLES,
        (id) => id === "classic" || stateQuery.data?.ownedStyles[id] === true,
        stateQuery.data?.claimedCollections,
      )}
      isSelected={(id) => (stateQuery.data?.selectedStyle ?? "classic") === id}
      thumb={(item) => <HandSwatch id={item.id} />}
      preview={(item) => <HandSwatch id={item.id} big />}
      onBuy={handleBuy}
      onSelect={handleSelect}
    />
  );
}

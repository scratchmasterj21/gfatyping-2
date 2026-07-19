import { useQuery } from "@tanstack/solid-query";
import { createSignal, For, JSXElement, onMount, Show } from "solid-js";

import {
  evaluateAchievements,
  getEarnedAchievements,
} from "../../achievements/achievements";
import { achievements } from "../../achievements/achievements-data";
import {
  AVATAR_CATEGORIES,
  AVATAR_CATEGORY_LABELS,
  AVATAR_ITEMS,
  AvatarCategory,
  AvatarItem,
  AvatarShape,
} from "../../avatar/avatar-items";
import {
  buyAvatarItem,
  claimAvatarItem,
  equipAvatarItem,
  getAvatarState,
  setAvatarShape,
} from "../../avatar/avatar-state";
import { getAuthenticatedUser } from "../../firebase";
import { queryClient } from "../../queries";
import { triggerCelebration } from "../../states/celebration";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Avatar } from "../common/Avatar";
import { Fa } from "../common/Fa";

type Tab = "wear" | "shop";
const TABS: Tab[] = ["wear", "shop"];
const SHAPES: { id: AvatarShape; label: string }[] = [
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "oval", label: "Oval" },
  { id: "hexagon", label: "Hexagon" },
  { id: "cloud", label: "Cloud" },
];
const CURRENT_MONTH = new Date().getMonth() + 1;

export function AvatarModal(): JSXElement {
  const [tab, setTab] = createSignal<Tab>("wear");
  const [category, setCategory] = createSignal<AvatarCategory>("color");

  const stateQuery = useQuery(() => ({
    queryKey: ["avatarState"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) {
        return {
          coins: 0,
          ownedCostumes: {},
          equipped: {},
          shape: "round" as const,
        };
      }
      return getAvatarState(uid);
    },
    staleTime: 0,
  }));

  onMount(() => {
    void evaluateAchievements().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["achievements"] });
    });
  });

  const earnedQuery = useQuery(() => ({
    queryKey: ["achievements"],
    queryFn: getEarnedAchievements,
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["avatarState"] });
    const uid = getAuthenticatedUser()?.uid;
    if (uid !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: ["avatarEquipped", uid],
      });
    }
  };

  const equippedColorValue = (): string | undefined => {
    const id = stateQuery.data?.equipped.color;
    return id === undefined
      ? undefined
      : AVATAR_ITEMS.find((i) => i.id === id)?.value;
  };

  const equippedShape = (): AvatarShape => stateQuery.data?.shape ?? "round";

  const handleSetShape = async (shape: AvatarShape): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    try {
      await setAvatarShape(uid, shape);
      refresh();
    } catch {
      showErrorNotification("Couldn't update that");
    }
  };

  const equippedHighlightValue = (): string | undefined => {
    const id = stateQuery.data?.equipped.highlight;
    return id === undefined
      ? undefined
      : AVATAR_ITEMS.find((i) => i.id === id)?.value;
  };

  const isOwned = (id: string): boolean =>
    stateQuery.data?.ownedCostumes[id] === true;
  const isEquipped = (item: AvatarItem): boolean =>
    stateQuery.data?.equipped[item.category] === item.id;
  const isAchievementEarned = (id: string): boolean =>
    earnedQuery.data?.has(id) ?? false;
  const achievementName = (id: string): string =>
    achievements.find((a) => a.id === id)?.name ?? id;

  const celebrate = (item: AvatarItem): void => {
    triggerCelebration({
      title: "New style!",
      message: item.name,
      icon: "fa-tshirt",
    });
  };

  const handleBuy = async (item: AvatarItem): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    const result = await buyAvatarItem(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    celebrate(item);
    refresh();
  };

  const handleClaim = async (item: AvatarItem): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    const result = await claimAvatarItem(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't claim that");
      return;
    }
    celebrate(item);
    refresh();
  };

  const handleEquip = async (item: AvatarItem): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    try {
      await equipAvatarItem(
        uid,
        item.category,
        isEquipped(item) ? null : item.id,
      );
      refresh();
    } catch {
      showErrorNotification("Couldn't equip that");
    }
  };

  const isNoneEquipped = (): boolean =>
    stateQuery.data?.equipped[category()] === undefined;

  const handleUnequip = async (): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    try {
      await equipAvatarItem(uid, category(), null);
      refresh();
    } catch {
      showErrorNotification("Couldn't update that");
    }
  };

  const itemsToShow = (): AvatarItem[] => {
    let items = AVATAR_ITEMS.filter((i) => i.category === category());
    // Hats/hair are shape-specific - only show the ones matching the
    // currently-equipped base shape, in both Wear and Shop.
    if (category() === "hat" || category() === "hair") {
      items = items.filter((i) => (i.shape ?? "round") === equippedShape());
    }
    if (tab() === "wear") return items.filter((i) => isOwned(i.id));
    return items.filter(
      (i) =>
        i.seasonMonths === undefined || i.seasonMonths.includes(CURRENT_MONTH),
    );
  };

  return (
    <AnimatedModal id="Avatar" title="My Avatar">
      <div class="grid gap-4">
        <div class="flex items-center justify-center gap-6">
          <Avatar
            color={equippedColorValue()}
            shape={equippedShape()}
            hair={stateQuery.data?.equipped.hair}
            hat={stateQuery.data?.equipped.hat}
            accessory={stateQuery.data?.equipped.accessory}
            face={stateQuery.data?.equipped.face}
            background={stateQuery.data?.equipped.background}
            highlightColor={equippedHighlightValue()}
            size={120}
          />
          <div class="flex items-center gap-2 text-lg font-bold text-main">
            <Fa icon="fa-coins" />
            {stateQuery.data?.coins ?? 0}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2 text-em-xs text-sub">
          <span>Face shape:</span>
          <div class="flex flex-wrap gap-1 rounded bg-sub-alt p-1">
            <For each={SHAPES}>
              {(s) => (
                <button
                  type="button"
                  class={cn(
                    "rounded px-3 py-1 transition-colors",
                    equippedShape() === s.id
                      ? "bg-bg text-text"
                      : "text-sub hover:text-text",
                  )}
                  onClick={() => void handleSetShape(s.id)}
                >
                  {s.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="flex gap-1 rounded bg-sub-alt p-1">
          <For each={TABS}>
            {(t) => (
              <button
                type="button"
                class={cn(
                  "flex-1 rounded px-3 py-1.5 text-sm capitalize transition-colors",
                  tab() === t ? "bg-bg text-text" : "text-sub hover:text-text",
                )}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            )}
          </For>
        </div>

        <div class="flex flex-wrap gap-1">
          <For each={AVATAR_CATEGORIES}>
            {(cat) => (
              <button
                type="button"
                class={cn(
                  "rounded px-2.5 py-1 text-em-xs transition-colors",
                  category() === cat
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-sub hover:text-text",
                )}
                onClick={() => setCategory(cat)}
              >
                {AVATAR_CATEGORY_LABELS[cat]}
              </button>
            )}
          </For>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Show when={tab() === "wear"}>
            <button
              type="button"
              class={cn(
                "relative flex cursor-pointer flex-col items-center gap-1.5 rounded p-3 shadow-sm transition-colors",
                isNoneEquipped()
                  ? "bg-main text-bg"
                  : "bg-sub-alt text-text hover:bg-text hover:text-bg",
              )}
              onClick={() => void handleUnequip()}
            >
              <Show when={isNoneEquipped()}>
                <span class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
                  <Fa icon="fa-check" size={0.6} />
                </span>
              </Show>
              <Avatar shape={equippedShape()} size={48} />
              <span class="text-sm font-medium">None</span>
            </button>
          </Show>

          <Show
            when={itemsToShow().length > 0 || tab() === "wear"}
            fallback={
              <div class="col-span-full place-self-center py-6 text-sub">
                Nothing to show
              </div>
            }
          >
            <For each={itemsToShow()}>
              {(item) => {
                const owned = (): boolean => isOwned(item.id);
                const equipped = (): boolean => isEquipped(item);
                const earned = (): boolean =>
                  item.requiresAchievement !== undefined &&
                  isAchievementEarned(item.requiresAchievement);
                const canAfford = (): boolean =>
                  (stateQuery.data?.coins ?? 0) >= (item.price ?? 0);
                const disabled = (): boolean => {
                  if (owned()) return false;
                  if (item.requiresAchievement !== undefined) return !earned();
                  return !canAfford();
                };
                return (
                  <button
                    type="button"
                    class={cn(
                      "relative flex flex-col items-center gap-1.5 rounded p-3 shadow-sm transition-colors",
                      equipped()
                        ? "bg-main text-bg"
                        : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                      disabled()
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer",
                    )}
                    disabled={disabled()}
                    onClick={() => {
                      if (owned()) {
                        void handleEquip(item);
                      } else if (item.requiresAchievement !== undefined) {
                        if (earned()) void handleClaim(item);
                      } else {
                        void handleBuy(item);
                      }
                    }}
                  >
                    <Show when={equipped()}>
                      <span class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
                        <Fa icon="fa-check" size={0.6} />
                      </span>
                    </Show>
                    <Show
                      when={item.category === "color"}
                      fallback={
                        <Show
                          when={item.category === "highlight"}
                          fallback={
                            <Avatar
                              shape={equippedShape()}
                              hair={
                                item.category === "hair" ? item.id : undefined
                              }
                              hat={
                                item.category === "hat" ? item.id : undefined
                              }
                              accessory={
                                item.category === "accessory"
                                  ? item.id
                                  : undefined
                              }
                              face={
                                item.category === "face" ? item.id : undefined
                              }
                              background={
                                item.category === "background"
                                  ? item.id
                                  : undefined
                              }
                              size={48}
                            />
                          }
                        >
                          <span
                            class="block h-7 w-7 rounded-full bg-bg"
                            style={{
                              "box-shadow": `0 0 0 2px ${item.value}, 0 0 6px ${item.value}`,
                            }}
                          ></span>
                        </Show>
                      }
                    >
                      <span
                        class="block h-7 w-7 rounded-full shadow-inner ring-2 ring-bg"
                        style={{ "background-color": item.value }}
                      ></span>
                    </Show>
                    <span class="text-sm font-medium">{item.name}</span>
                    <Show when={!owned()}>
                      <Show
                        when={item.requiresAchievement === undefined}
                        fallback={
                          <span class="text-center text-em-xs">
                            {earned()
                              ? "Claim!"
                              : `Unlocks: ${achievementName(
                                  item.requiresAchievement ?? "",
                                )}`}
                          </span>
                        }
                      >
                        <span class="flex items-center gap-1 text-em-xs">
                          <Fa icon="fa-coins" size={0.7} />
                          {item.price}
                        </span>
                      </Show>
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>

        <Show when={tab() === "wear" && itemsToShow().length === 0}>
          <div class="place-self-center text-em-xs text-sub">
            You don&apos;t own any of these yet - check the shop!
          </div>
        </Show>
      </div>
    </AnimatedModal>
  );
}

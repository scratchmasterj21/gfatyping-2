import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onMount,
  Show,
} from "solid-js";

import {
  evaluateAchievements,
  getEarnedAchievements,
} from "../../achievements/achievements";
import { achievements } from "../../achievements/achievements-data";
import {
  AnimalAvatarItem,
  AnimalAvatarShape,
  ANIMAL_AVATAR_ITEMS,
  ANIMAL_AVATAR_SHAPES,
  findAnimalAvatarItem,
} from "../../animal-avatars/animal-avatar-items";
import {
  buyAnimalAvatar,
  equipAnimalAvatar,
  getAnimalAvatarState,
} from "../../animal-avatars/animal-avatar-state";
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
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { queryClient } from "../../queries";
import { triggerCelebration } from "../../states/celebration";
import { isAuthenticated } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Avatar } from "../common/Avatar";
import { Fa } from "../common/Fa";

type Tab = "wear" | "shop" | "animals";
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
  const [animalShape, setAnimalShape] = createSignal<AnimalAvatarShape>(
    ANIMAL_AVATAR_SHAPES[0]?.id ?? "round",
  );
  // Both writes hit the same avatarState/animalAvatarState doc, so an id
  // "loading" blocks every other action in the same domain, not just its
  // own button - avoids overlapping writes racing each other.
  const { pendingId: costumePendingId, guardedBuy: guardedCostumeAction } =
    useBuyGuard();
  const { pendingId: animalPendingId, guardedBuy: guardedAnimalAction } =
    useBuyGuard();

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
    // Without this, a modal mounted before Firebase Auth finishes restoring
    // the session fetches with uid undefined, permanently caches the
    // zero-coins fallback, and never retries on its own - every buy button
    // reads that stale 0 and stays disabled until something else happens to
    // invalidate the query.
    enabled: isAuthenticated(),
    staleTime: 0,
  }));

  // Own coins/ownership state for the animal avatars, which are a separate
  // shop from the procedural costume pieces above (no accessories/hair -
  // just a flat image, bought and equipped as a whole).
  const animalStateQuery = useQuery(() => ({
    queryKey: ["animalAvatarState"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) return { coins: 0, ownedAnimalAvatars: {} };
      return getAnimalAvatarState(uid);
    },
    enabled: isAuthenticated(),
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
    void queryClient.invalidateQueries({ queryKey: ["animalAvatarState"] });
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

  const isAnimalOwned = (id: string): boolean =>
    animalStateQuery.data?.ownedAnimalAvatars[id] === true;
  const isAnimalEquipped = (id: string): boolean =>
    animalStateQuery.data?.equippedAnimalAvatarId === id;
  const equippedAnimalImage = (): string | undefined => {
    const id = animalStateQuery.data?.equippedAnimalAvatarId;
    return id === undefined ? undefined : findAnimalAvatarItem(id)?.image;
  };
  const animalItemsToShow = (): AnimalAvatarItem[] =>
    ANIMAL_AVATAR_ITEMS.filter((i) => i.shape === animalShape());

  const handleBuyAnimal = async (item: AnimalAvatarItem): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    const result = await buyAnimalAvatar(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't buy that");
      return;
    }
    triggerCelebration({
      title: "New style!",
      message: item.name,
      icon: "fa-paw",
    });
    refresh();
  };

  const handleEquipAnimal = async (item: AnimalAvatarItem): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    try {
      await equipAnimalAvatar(uid, isAnimalEquipped(item.id) ? null : item.id);
      refresh();
    } catch {
      showErrorNotification("Couldn't equip that");
    }
  };

  const handleUnequipAnimal = async (): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    try {
      await equipAnimalAvatar(uid, null);
      refresh();
    } catch {
      showErrorNotification("Couldn't update that");
    }
  };

  // Wear/Shop only make sense for the normal avatar - an equipped animal
  // avatar replaces the whole preview, so costume pieces would have no
  // visible effect.
  const visibleTabs = (): Tab[] =>
    equippedAnimalImage() === undefined
      ? ["wear", "shop", "animals"]
      : ["animals"];

  createEffect(() => {
    if (equippedAnimalImage() !== undefined && tab() !== "animals") {
      setTab("animals");
    }
  });

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
            animalImage={equippedAnimalImage()}
            size={120}
          />
          <div class="flex items-center gap-2 text-lg font-bold text-main">
            <Fa icon="fa-coins" />
            {stateQuery.data?.coins ?? 0}
          </div>
        </div>

        <Show
          when={tab() !== "animals"}
          fallback={
            <div class="flex flex-wrap items-center justify-center gap-2 text-em-xs text-sub">
              <span>Animal shape:</span>
              <div class="flex flex-wrap gap-1 rounded bg-sub-alt p-1">
                <For each={ANIMAL_AVATAR_SHAPES}>
                  {(s) => (
                    <button
                      type="button"
                      class={cn(
                        "rounded px-3 py-1 transition-colors",
                        animalShape() === s.id
                          ? "bg-bg text-text"
                          : "text-sub hover:text-text",
                      )}
                      onClick={() => setAnimalShape(s.id)}
                    >
                      {s.label}
                    </button>
                  )}
                </For>
              </div>
            </div>
          }
        >
          <div class="flex flex-wrap items-center justify-center gap-2 text-em-xs text-sub">
            <span>Face shape:</span>
            <div class="flex flex-wrap gap-1 rounded bg-sub-alt p-1">
              <For each={SHAPES}>
                {(s) => (
                  <button
                    type="button"
                    class={cn(
                      "rounded px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      equippedShape() === s.id
                        ? "bg-bg text-text"
                        : "text-sub hover:text-text",
                    )}
                    disabled={costumePendingId() !== null}
                    onClick={() =>
                      void guardedCostumeAction(s.id, async () =>
                        handleSetShape(s.id),
                      )
                    }
                  >
                    {s.label}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <div class="flex gap-1 rounded bg-sub-alt p-1">
          <For each={visibleTabs()}>
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

        <Show when={tab() !== "animals"}>
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
        </Show>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Show when={tab() === "animals"}>
            <button
              type="button"
              class={cn(
                "relative flex cursor-pointer flex-col items-center gap-1.5 rounded p-3 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                equippedAnimalImage() === undefined
                  ? "bg-main text-bg"
                  : "bg-sub-alt text-text hover:bg-text hover:text-bg",
              )}
              disabled={animalPendingId() !== null}
              onClick={() =>
                void guardedAnimalAction("__unequip__", handleUnequipAnimal)
              }
            >
              <Show when={equippedAnimalImage() === undefined}>
                <span class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
                  <Fa icon="fa-check" size={0.6} />
                </span>
              </Show>
              <Avatar shape={equippedShape()} size={48} />
              <span class="text-sm font-medium">Normal avatar</span>
            </button>

            <For each={animalItemsToShow()}>
              {(item) => {
                const owned = (): boolean => isAnimalOwned(item.id);
                const equipped = (): boolean => isAnimalEquipped(item.id);
                const canAfford = (): boolean =>
                  (animalStateQuery.data?.coins ?? 0) >= item.price;
                const disabled = (): boolean =>
                  (!owned() && !canAfford()) || animalPendingId() !== null;
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
                        void guardedAnimalAction(item.id, async () =>
                          handleEquipAnimal(item),
                        );
                      } else {
                        void guardedAnimalAction(item.id, async () =>
                          handleBuyAnimal(item),
                        );
                      }
                    }}
                  >
                    <Show when={equipped()}>
                      <span class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
                        <Fa icon="fa-check" size={0.6} />
                      </span>
                    </Show>
                    <img
                      src={item.image}
                      width={48}
                      height={48}
                      alt={item.name}
                    />
                    <span class="text-sm font-medium">{item.name}</span>
                    <Show when={!owned()}>
                      <span class="flex items-center gap-1 text-em-xs">
                        <Show
                          when={animalPendingId() !== item.id}
                          fallback={
                            <Fa icon="fa-circle-notch" spin size={0.7} />
                          }
                        >
                          <Fa icon="fa-coins" size={0.7} />
                          {item.price}
                        </Show>
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>

          <Show when={tab() !== "animals"}>
            <Show when={tab() === "wear"}>
              <button
                type="button"
                class={cn(
                  "relative flex cursor-pointer flex-col items-center gap-1.5 rounded p-3 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  isNoneEquipped()
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                )}
                disabled={costumePendingId() !== null}
                onClick={() =>
                  void guardedCostumeAction("__unequip__", handleUnequip)
                }
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
                    if (costumePendingId() !== null) return true;
                    if (owned()) return false;
                    if (item.requiresAchievement !== undefined) {
                      return !earned();
                    }
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
                          void guardedCostumeAction(item.id, async () =>
                            handleEquip(item),
                          );
                        } else if (item.requiresAchievement !== undefined) {
                          if (earned()) {
                            void guardedCostumeAction(item.id, async () =>
                              handleClaim(item),
                            );
                          }
                        } else {
                          void guardedCostumeAction(item.id, async () =>
                            handleBuy(item),
                          );
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
                          when={costumePendingId() !== item.id}
                          fallback={
                            <span class="flex items-center gap-1 text-em-xs">
                              <Fa icon="fa-circle-notch" spin size={0.7} />
                            </span>
                          }
                        >
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
                      </Show>
                    </button>
                  );
                }}
              </For>
            </Show>
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

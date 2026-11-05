import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
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
} from "../../animal-avatars/animal-avatar-state";
import {
  AVATAR_CATEGORIES,
  AVATAR_ITEMS,
  AvatarCategory,
  AvatarItem,
  AvatarShape,
  COLLECTION_CATEGORIES,
  COLLECTION_REWARD,
  collectionItems,
  findAvatarItem,
} from "../../avatar/avatar-items";
import {
  buyAvatarItem,
  claimAvatarItem,
  claimCollection,
  equipAvatarItem,
  equipOutfit,
  getAvatarState,
  OUTFIT_SLOTS,
  saveOutfit,
  setAvatarShape,
  wearOutfit,
  setTitle,
} from "../../avatar/avatar-state";
import { getAuthenticatedUser } from "../../firebase";
import { useBuyGuard } from "../../hooks/useBuyGuard";
import { queryClient } from "../../queries";
import { triggerCelebration } from "../../states/celebration";
import { isAuthenticated } from "../../states/core";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Avatar } from "../common/Avatar";
import { Fa } from "../common/Fa";
import { TitlePicker } from "../common/TitlePicker";

type Tab = "style" | "animals";
const SHAPES: { id: AvatarShape; label: string }[] = [
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "oval", label: "Oval" },
  { id: "hexagon", label: "Hexagon" },
  { id: "cloud", label: "Cloud" },
];
const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  color: "Color",
  hair: "Hair",
  hat: "Hat",
  accessory: "Extra",
  face: "Face",
  background: "Background",
  highlight: "Glow",
};
const BIG_CHOICE = "press-3d min-h-12 rounded-xl px-4 text-base font-semibold";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const japanMonth = (): number =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      timeZone: "Asia/Tokyo",
    }).format(new Date()),
  );

let achievementsCheckedThisSession = false;

export function AvatarModal(): JSXElement {
  const currentMonth = japanMonth();
  const [tab, setTab] = createSignal<Tab>("style");
  const [category, setCategory] = createSignal<AvatarCategory>("color");
  const [onlyMine, setOnlyMine] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [preview, setPreview] = createSignal<AvatarItem>();
  const [pendingShape, setPendingShape] = createSignal<AvatarShape>();
  const [animalShape, setAnimalShape] = createSignal<AnimalAvatarShape>(
    ANIMAL_AVATAR_SHAPES[0]?.id ?? "round",
  );
  // Both writes hit the same user doc, so an id "loading" blocks every other
  // action in the same domain, not just its own button - avoids overlapping
  // writes racing each other.
  const { pendingId: costumePendingId, guardedBuy: guardedCostumeAction } =
    useBuyGuard();
  const { pendingId: animalPendingId, guardedBuy: guardedAnimalAction } =
    useBuyGuard();

  // One user-doc read covers costumes, animal avatars and coins. Every coin
  // write calls invalidateCoinQueries(), so a short staleTime stays correct.
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
    // zero-coins fallback, and never retries on its own.
    enabled: isAuthenticated(),
    staleTime: 60 * 1000,
  }));

  onMount(() => {
    if (achievementsCheckedThisSession) return;
    achievementsCheckedThisSession = true;
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

  const pickTitle = async (titleId: string | null): Promise<void> => {
    await setTitle(titleId);
    refresh();
  };

  const coins = (): number => stateQuery.data?.coins ?? 0;
  const equippedShape = (): AvatarShape => stateQuery.data?.shape ?? "round";
  const equippedId = (cat: AvatarCategory): string | undefined =>
    stateQuery.data?.equipped[cat];

  /** Equipped look with the try-on item swapped in. */
  const lookId = (cat: AvatarCategory): string | undefined => {
    const p = preview();
    return p !== undefined && p.category === cat ? p.id : equippedId(cat);
  };
  const lookValue = (cat: "color" | "highlight"): string | undefined => {
    const id = lookId(cat);
    return id === undefined ? undefined : findAvatarItem(id)?.value;
  };

  const isOwned = (id: string): boolean =>
    stateQuery.data?.ownedCostumes[id] === true;
  const isEquipped = (item: AvatarItem): boolean =>
    equippedId(item.category) === item.id;
  const isAchievementEarned = (id: string): boolean =>
    earnedQuery.data?.has(id) ?? false;
  const achievementFor = (
    id: string,
  ): { name: string; description: string } | undefined =>
    achievements.find((a) => a.id === id);
  const coinsNeeded = (item: AvatarItem): number =>
    Math.max(0, (item.price ?? 0) - coins());
  const isInSeason = (item: AvatarItem): boolean =>
    item.seasonMonths === undefined || item.seasonMonths.includes(currentMonth);
  const fitsShape = (item: AvatarItem): boolean =>
    (item.category !== "hat" && item.category !== "hair") ||
    (item.shape ?? "round") === equippedShape();

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
    const result =
      item.requiresAchievement === undefined
        ? await buyAvatarItem(uid, item)
        : await claimAvatarItem(uid, item);
    if (!result.ok) {
      showErrorNotification(result.reason ?? "Couldn't get that");
      return;
    }
    setPreview(undefined);
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

  const applyShape = async (shape: AvatarShape): Promise<void> => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined) return;
    setPendingShape(undefined);
    setPreview(undefined);
    try {
      await setAvatarShape(uid, shape);
      refresh();
    } catch {
      showErrorNotification("Couldn't update that");
    }
  };

  /** Equipped hat/hair that would come off with a new shape. */
  const misfitsFor = (shape: AvatarShape): AvatarItem[] =>
    (["hat", "hair"] as const)
      .map((cat) => {
        const id = equippedId(cat);
        return id === undefined ? undefined : findAvatarItem(id);
      })
      .filter(
        (item): item is AvatarItem =>
          item !== undefined && (item.shape ?? "round") !== shape,
      );

  const onShapeClick = (shape: AvatarShape): void => {
    if (shape === equippedShape()) return;
    if (misfitsFor(shape).length > 0) {
      setPendingShape(shape);
      return;
    }
    void guardedCostumeAction(shape, async () => applyShape(shape));
  };

  const itemsToShow = createMemo((): AvatarItem[] =>
    AVATAR_ITEMS.filter(
      (i) =>
        i.category === category() &&
        fitsShape(i) &&
        (isOwned(i.id) || (!onlyMine() && isInSeason(i))),
    ),
  );

  /** Category has something the student can get right now. */
  const hasNewFor = (cat: AvatarCategory): boolean =>
    AVATAR_ITEMS.some(
      (i) =>
        i.category === cat &&
        !isOwned(i.id) &&
        fitsShape(i) &&
        isInSeason(i) &&
        (i.requiresAchievement === undefined
          ? coins() >= (i.price ?? 0)
          : isAchievementEarned(i.requiresAchievement)),
    );

  const pickCategory = (cat: AvatarCategory): void => {
    setCategory(cat);
    setPreview(undefined);
  };

  const ownedAnimals = (): Record<string, true> =>
    stateQuery.data?.ownedAnimalAvatars ?? {};
  const equippedAnimalId = (): string | undefined =>
    stateQuery.data?.equippedAnimalAvatarId;
  const isAnimalOwned = (id: string): boolean => ownedAnimals()[id] === true;
  const isAnimalEquipped = (id: string): boolean => equippedAnimalId() === id;
  const equippedAnimalImage = (): string | undefined => {
    const id = equippedAnimalId();
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

  const runOutfitAction = async (
    action: () => Promise<void>,
    failMessage: string,
  ): Promise<void> => {
    setPreview(undefined);
    setPendingShape(undefined);
    try {
      await action();
      refresh();
    } catch {
      showErrorNotification(failMessage);
    }
  };

  const SURPRISE_CATEGORIES: AvatarCategory[] = [
    "color",
    "hair",
    "hat",
    "accessory",
    "face",
    "background",
  ];
  const surpriseMe = async (): Promise<void> => {
    const picks: Partial<Record<AvatarCategory, string | null>> = {};
    let ownsAny = false;
    for (const cat of SURPRISE_CATEGORIES) {
      const owned = AVATAR_ITEMS.filter(
        (i) => i.category === cat && isOwned(i.id) && fitsShape(i),
      );
      if (owned.length > 0) ownsAny = true;
      const choices: (string | null)[] = [null, ...owned.map((i) => i.id)];
      picks[cat] = choices[Math.floor(Math.random() * choices.length)] ?? null;
    }
    if (!ownsAny) {
      showNoticeNotification("Get a few items first, then try Surprise me!");
      return;
    }
    await runOutfitAction(
      async () => equipOutfit(picks),
      "Couldn't change your look",
    );
  };

  const savedOutfit = (slot: string) => stateQuery.data?.savedOutfits?.[slot];
  const savedLookValue = (
    slot: string,
    cat: "color" | "highlight",
  ): string | undefined => {
    const id = savedOutfit(slot)?.equipped[cat];
    return id === undefined ? undefined : findAvatarItem(id)?.value;
  };

  const collectionOwned = (cat: AvatarCategory): number =>
    collectionItems(cat).filter((i) => isOwned(i.id)).length;
  const isCollectionClaimed = (cat: AvatarCategory): boolean =>
    stateQuery.data?.claimedCollections?.[cat] === true;
  const handleClaimCollection = async (cat: AvatarCategory): Promise<void> => {
    try {
      const result = await claimCollection(cat);
      if (result.claimed) {
        triggerCelebration({
          title: "Collection complete!",
          message: `+${result.coins} coins`,
          icon: "fa-trophy",
        });
      } else {
        showSuccessNotification("Already claimed");
      }
      refresh();
    } catch {
      showErrorNotification("Couldn't claim that");
    }
  };

  // Style only makes sense for the normal avatar - an equipped animal avatar
  // replaces the whole preview, so costume pieces would have no visible
  // effect.
  const visibleTabs = (): Tab[] =>
    equippedAnimalImage() === undefined ? ["style", "animals"] : ["animals"];

  createEffect(() => {
    if (equippedAnimalImage() !== undefined && tab() !== "animals") {
      setTab("animals");
    }
  });

  const pickTab = (t: Tab): void => {
    setTab(t);
    setPreview(undefined);
    setPendingShape(undefined);
  };

  return (
    <AnimatedModal id="Avatar" title="My Avatar" modalClass="max-w-3xl">
      <div
        class={cn(
          "grid gap-4 font-kid",
          preview() !== undefined ? "pb-36" : "",
        )}
      >
        <div class="flex items-center justify-center gap-6">
          <Avatar
            color={lookValue("color")}
            shape={equippedShape()}
            hair={lookId("hair")}
            hat={lookId("hat")}
            accessory={lookId("accessory")}
            face={lookId("face")}
            background={lookId("background")}
            highlightColor={lookValue("highlight")}
            animalImage={equippedAnimalImage()}
            size={160}
          />
          <div class="flex min-h-14 items-center gap-2 rounded-full bg-sub-alt px-5 text-2xl font-bold text-main">
            <Fa icon="fa-coins" />
            {coins()}
          </div>
        </div>

        <Show when={preview()} keyed>
          {(item) => (
            <div class="fixed bottom-3 left-1/2 z-30 w-[min(42rem,calc(100%-2rem))] -translate-x-1/2">
              <TryOnPanel
                item={item}
                coinsNeeded={coinsNeeded(item)}
                achievementEarned={
                  item.requiresAchievement !== undefined &&
                  isAchievementEarned(item.requiresAchievement)
                }
                achievement={
                  item.requiresAchievement === undefined
                    ? undefined
                    : achievementFor(item.requiresAchievement)
                }
                pending={costumePendingId() !== null}
                onGet={() =>
                  void guardedCostumeAction(item.id, async () =>
                    handleBuy(item),
                  )
                }
                onCancel={() => setPreview(undefined)}
              />
            </div>
          )}
        </Show>

        <Show
          when={tab() !== "animals"}
          fallback={
            <div class="grid justify-items-center gap-2">
              <span class="text-base font-semibold text-text">
                Animal shape
              </span>
              <div class="flex flex-wrap justify-center gap-2">
                <For each={ANIMAL_AVATAR_SHAPES}>
                  {(s) => (
                    <button
                      type="button"
                      class={cn(
                        BIG_CHOICE,
                        animalShape() === s.id
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-text",
                      )}
                      aria-pressed={animalShape() === s.id}
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
          <div class="grid justify-items-center gap-2">
            <span class="text-base font-semibold text-text">Face shape</span>
            <div class="flex flex-wrap justify-center gap-2">
              <For each={SHAPES}>
                {(s) => (
                  <button
                    type="button"
                    class={cn(
                      BIG_CHOICE,
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      equippedShape() === s.id
                        ? "bg-main text-bg"
                        : "bg-sub-alt text-text",
                    )}
                    aria-pressed={equippedShape() === s.id}
                    disabled={costumePendingId() !== null}
                    onClick={() => onShapeClick(s.id)}
                  >
                    {s.label}
                  </button>
                )}
              </For>
            </div>
          </div>
          <Show when={pendingShape()} keyed>
            {(shape) => (
              <div class="grid gap-3 rounded-xl bg-sub-alt p-4 text-center text-base">
                <span class="text-text">
                  {misfitsFor(shape)
                    .map((i) => i.name)
                    .join(" and ")}{" "}
                  {misfitsFor(shape).length > 1 ? "don't" : "doesn't"} fit{" "}
                  {SHAPES.find((s) => s.id === shape)?.label} and will come off.
                </span>
                <div class="flex justify-center gap-2">
                  <button
                    type="button"
                    class="press-3d min-h-12 cursor-pointer rounded-xl bg-main px-5 text-base font-semibold text-bg hover:opacity-80"
                    onClick={() =>
                      void guardedCostumeAction(shape, async () =>
                        applyShape(shape),
                      )
                    }
                  >
                    Change anyway
                  </button>
                  <button
                    type="button"
                    class="press-3d min-h-12 cursor-pointer rounded-xl bg-bg px-5 text-base font-semibold text-text hover:bg-text hover:text-bg"
                    onClick={() => setPendingShape(undefined)}
                  >
                    Keep {SHAPES.find((s) => s.id === equippedShape())?.label}
                  </button>
                </div>
              </div>
            )}
          </Show>
        </Show>

        <div class="flex gap-2">
          <For each={visibleTabs()}>
            {(t) => (
              <button
                type="button"
                class={cn(
                  "press-3d flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-bold",
                  tab() === t ? "bg-main text-bg" : "bg-sub-alt text-text",
                )}
                aria-pressed={tab() === t}
                onClick={() => pickTab(t)}
              >
                <Fa icon={t === "style" ? "fa-tshirt" : "fa-paw"} />
                {t === "style" ? "Clothes" : "Animals"}
              </button>
            )}
          </For>
        </div>

        <p class="text-center text-base text-text">
          {tab() === "style"
            ? "Tap yours to wear it. Tap a new one to try it on."
            : "Tap an animal to wear it."}
        </p>

        <Show when={tab() === "style"}>
          <section class="grid gap-2 rounded-xl bg-bg p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 class="font-kid text-lg font-bold text-text">
                <Fa icon="fa-tshirt" class="mr-2 text-main" />
                My outfits
              </h3>
              <span class="text-sm text-sub">
                Save your look in a slot, then tap it to wear it again.
              </span>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <For each={OUTFIT_SLOTS}>
                {(slot) => (
                  <div class="flex items-center gap-2 rounded-xl bg-sub-alt p-2">
                    <Show
                      when={savedOutfit(slot)}
                      fallback={
                        <span class="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-sub text-base text-sub">
                          {slot}
                        </span>
                      }
                    >
                      {(saved) => (
                        <button
                          type="button"
                          class="cursor-pointer rounded-full disabled:cursor-not-allowed"
                          title={`Wear outfit ${slot}`}
                          aria-label={`Wear outfit ${slot}`}
                          disabled={costumePendingId() !== null}
                          onClick={() =>
                            void guardedCostumeAction(
                              `wear-${slot}`,
                              async () =>
                                runOutfitAction(
                                  async () => wearOutfit(slot),
                                  "Couldn't put that on",
                                ),
                            )
                          }
                        >
                          <Avatar
                            shape={saved().shape}
                            color={savedLookValue(slot, "color")}
                            hair={saved().equipped.hair}
                            hat={saved().equipped.hat}
                            accessory={saved().equipped.accessory}
                            face={saved().equipped.face}
                            background={saved().equipped.background}
                            highlightColor={savedLookValue(slot, "highlight")}
                            size={48}
                          />
                        </button>
                      )}
                    </Show>
                    <button
                      type="button"
                      class="press-3d min-h-11 cursor-pointer rounded-xl bg-bg px-3 text-base font-semibold text-text disabled:cursor-not-allowed"
                      disabled={costumePendingId() !== null}
                      onClick={() =>
                        void guardedCostumeAction(`save-${slot}`, async () =>
                          runOutfitAction(
                            async () => saveOutfit(slot),
                            "Couldn't save that",
                          ),
                        )
                      }
                    >
                      Save
                    </button>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>

        <Show when={tab() === "style"}>
          <div class="flex flex-wrap items-center gap-2">
            <For each={AVATAR_CATEGORIES}>
              {(cat) => (
                <button
                  type="button"
                  class={cn(
                    "press-3d relative min-h-12 rounded-xl px-4 text-base font-semibold",
                    category() === cat
                      ? "bg-main text-bg"
                      : "bg-sub-alt text-text",
                  )}
                  aria-pressed={category() === cat}
                  onClick={() => pickCategory(cat)}
                >
                  {CATEGORY_LABELS[cat]}
                  <Show when={hasNewFor(cat)}>
                    <span
                      class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-main ring-2 ring-bg"
                      title="You can get something new here"
                    ></span>
                  </Show>
                </button>
              )}
            </For>
            <button
              type="button"
              class={cn(
                "press-3d min-h-12 rounded-xl px-4 text-base font-semibold",
                onlyMine() ? "bg-main text-bg" : "bg-sub-alt text-text",
              )}
              aria-pressed={onlyMine()}
              onClick={() => {
                setOnlyMine((value) => !value);
                setPreview(undefined);
              }}
            >
              My stuff
            </button>
          </div>
        </Show>

        <Show
          when={tab() === "style" && COLLECTION_CATEGORIES.includes(category())}
        >
          <div class="flex flex-wrap items-center gap-3 rounded-xl bg-sub-alt px-4 py-3 text-sm">
            <span class="font-medium text-text">
              <Fa icon="fa-layer-group" class="mr-1.5 text-main" />
              Collection {collectionOwned(category())}/
              {collectionItems(category()).length}
            </span>
            <div class="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-bg">
              <div
                class="h-full rounded-full bg-main transition-[width] duration-500"
                style={{
                  width: `${(collectionOwned(category()) / Math.max(1, collectionItems(category()).length)) * 100}%`,
                }}
              ></div>
            </div>
            <Show
              when={!isCollectionClaimed(category())}
              fallback={
                <span class="text-main">
                  <Fa icon="fa-check" class="mr-1" />
                  Collected!
                </span>
              }
            >
              <Show
                when={
                  collectionOwned(category()) ===
                  collectionItems(category()).length
                }
                fallback={
                  <span class="text-sub">
                    Collect all: +{COLLECTION_REWARD} coins
                  </span>
                }
              >
                <button
                  type="button"
                  class="press-3d min-h-11 cursor-pointer rounded-xl bg-main px-4 font-bold text-bg hover:opacity-80 disabled:opacity-50"
                  disabled={costumePendingId() !== null}
                  onClick={() => {
                    const cat = category();
                    void guardedCostumeAction(`collection-${cat}`, async () =>
                      handleClaimCollection(cat),
                    );
                  }}
                >
                  Claim +{COLLECTION_REWARD}
                </button>
              </Show>
            </Show>
          </div>
        </Show>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Show when={tab() === "animals"}>
            <button
              type="button"
              class={cn(
                "press-3d relative flex cursor-pointer flex-col items-center gap-1.5 rounded-double p-3 outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
                <CheckBadge />
              </Show>
              <Avatar shape={equippedShape()} size={72} />
              <span class="text-base font-semibold">No animal</span>
            </button>

            <For each={animalItemsToShow()}>
              {(item) => {
                const owned = (): boolean => isAnimalOwned(item.id);
                const equipped = (): boolean => isAnimalEquipped(item.id);
                const canAfford = (): boolean => coins() >= item.price;
                const disabled = (): boolean =>
                  (!owned() && !canAfford()) || animalPendingId() !== null;
                return (
                  <button
                    type="button"
                    class={cn(
                      "press-3d relative flex flex-col items-center gap-1.5 rounded-double p-3 outline-offset-2",
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
                      <CheckBadge />
                    </Show>
                    <img
                      src={item.image}
                      width={72}
                      height={72}
                      alt={item.name}
                    />
                    <span class="text-base font-semibold">{item.name}</span>
                    <Show when={!owned()}>
                      <span class="flex items-center gap-1 text-base">
                        <Show
                          when={animalPendingId() !== item.id}
                          fallback={<Fa icon="fa-circle-notch" spin />}
                        >
                          <Fa icon="fa-coins" />
                          {canAfford()
                            ? item.price
                            : `Need ${item.price - coins()} more`}
                        </Show>
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>

          <Show when={tab() === "style"}>
            <button
              type="button"
              class={cn(
                "press-3d relative flex cursor-pointer flex-col items-center gap-1.5 rounded-double p-3 outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                equippedId(category()) === undefined
                  ? "bg-main text-bg"
                  : "bg-sub-alt text-text hover:bg-text hover:text-bg",
              )}
              disabled={costumePendingId() !== null}
              onClick={() => {
                setPreview(undefined);
                void guardedCostumeAction("__unequip__", handleUnequip);
              }}
            >
              <Show when={equippedId(category()) === undefined}>
                <CheckBadge />
              </Show>
              <Avatar shape={equippedShape()} size={72} />
              <span class="text-base font-semibold">None</span>
            </button>

            <For each={itemsToShow()}>
              {(item) => {
                const owned = (): boolean => isOwned(item.id);
                const equipped = (): boolean => isEquipped(item);
                const trying = (): boolean => preview()?.id === item.id;
                return (
                  <button
                    type="button"
                    class={cn(
                      "press-3d relative flex cursor-pointer flex-col items-center gap-1.5 rounded-double p-3 outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                      equipped()
                        ? "bg-main text-bg"
                        : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                      trying() ? "outline-3 outline-main" : "",
                    )}
                    aria-pressed={equipped() || trying()}
                    disabled={costumePendingId() !== null}
                    onClick={() => {
                      if (owned()) {
                        setPreview(undefined);
                        void guardedCostumeAction(item.id, async () =>
                          handleEquip(item),
                        );
                      } else {
                        setPreview(trying() ? undefined : item);
                      }
                    }}
                  >
                    <Show when={equipped()}>
                      <CheckBadge />
                    </Show>
                    <Show when={item.seasonMonths !== undefined}>
                      <span class="absolute top-1 left-1 rounded bg-bg px-2 py-0.5 text-xs font-bold text-main">
                        {item.seasonMonths
                          ?.map((m) => MONTH_NAMES[m - 1]?.slice(0, 3))
                          .join("/")}{" "}
                        only
                      </span>
                    </Show>
                    <ItemThumb
                      item={item}
                      shape={equippedShape()}
                      color={
                        item.category === "color"
                          ? undefined
                          : lookValue("color")
                      }
                    />
                    <span class="text-base font-semibold">{item.name}</span>
                    <Show when={!owned()}>
                      <Show
                        when={costumePendingId() !== item.id}
                        fallback={<Fa icon="fa-circle-notch" spin />}
                      >
                        <span class="flex items-center gap-1 text-base">
                          <Show
                            when={item.requiresAchievement === undefined}
                            fallback={
                              <>
                                <Fa
                                  icon={
                                    isAchievementEarned(
                                      item.requiresAchievement ?? "",
                                    )
                                      ? "fa-gift"
                                      : "fa-lock"
                                  }
                                />
                                {isAchievementEarned(
                                  item.requiresAchievement ?? "",
                                )
                                  ? "Get it"
                                  : "Locked"}
                              </>
                            }
                          >
                            <Fa icon="fa-coins" />
                            {coinsNeeded(item) === 0
                              ? item.price
                              : `Need ${coinsNeeded(item)} more`}
                          </Show>
                        </span>
                      </Show>
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>

        <Show
          when={tab() === "style" && onlyMine() && itemsToShow().length === 0}
        >
          <p class="text-center text-base text-text">
            You don&apos;t have any yet. Tap My stuff again to see them all.
          </p>
        </Show>

        <Show when={tab() === "style"}>
          <section class="grid gap-2">
            <button
              type="button"
              class="flex min-h-12 items-center justify-between rounded-xl bg-sub-alt px-4 text-base font-semibold text-text"
              aria-expanded={moreOpen()}
              onClick={() => setMoreOpen((value) => !value)}
            >
              More
              <Fa
                icon="fa-chevron-down"
                class={cn(
                  "text-sub transition-transform",
                  moreOpen() ? "rotate-180" : "",
                )}
              />
            </button>
            <Show when={moreOpen()}>
              <div class="grid gap-3">
                <button
                  type="button"
                  class="press-3d min-h-12 cursor-pointer rounded-xl bg-main px-4 text-base font-semibold text-bg hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={costumePendingId() !== null}
                  onClick={() =>
                    void guardedCostumeAction("__surprise__", surpriseMe)
                  }
                >
                  <Fa icon="fa-random" class="mr-2" />
                  Surprise me
                </button>
                <TitlePicker
                  current={stateQuery.data?.title}
                  earned={earnedQuery.data}
                  onPick={pickTitle}
                />
              </div>
            </Show>
          </section>
        </Show>
      </div>
    </AnimatedModal>
  );
}

function CheckBadge(): JSXElement {
  return (
    <span class="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
      <Fa icon="fa-check" size={0.8} />
    </span>
  );
}

function ItemThumb(props: {
  item: AvatarItem;
  shape: AvatarShape;
  color: string | undefined;
}): JSXElement {
  const only = (cat: AvatarCategory): string | undefined =>
    props.item.category === cat ? props.item.id : undefined;
  return (
    <Show
      when={props.item.category === "color"}
      fallback={
        <Show
          when={props.item.category === "highlight"}
          fallback={
            <Avatar
              shape={props.shape}
              color={props.color}
              hair={only("hair")}
              hat={only("hat")}
              accessory={only("accessory")}
              face={only("face")}
              background={only("background")}
              size={72}
            />
          }
        >
          <span
            class="block h-14 w-14 rounded-full bg-bg"
            style={{
              "box-shadow": `0 0 0 2px ${props.item.value}, 0 0 6px ${props.item.value}`,
            }}
          ></span>
        </Show>
      }
    >
      <span
        class="block h-14 w-14 rounded-full shadow-inner ring-2 ring-bg"
        style={{ "background-color": props.item.value }}
      ></span>
    </Show>
  );
}

function TryOnPanel(props: {
  item: AvatarItem;
  coinsNeeded: number;
  achievementEarned: boolean;
  achievement: { name: string; description: string } | undefined;
  pending: boolean;
  onGet: () => void;
  onCancel: () => void;
}): JSXElement {
  const isAchievementItem = (): boolean =>
    props.item.requiresAchievement !== undefined;
  const canGet = (): boolean =>
    isAchievementItem() ? props.achievementEarned : props.coinsNeeded === 0;
  return (
    <div class="grid gap-3 rounded-xl bg-sub-alt p-4 text-center">
      <span class="text-base text-text">
        Trying on <span class="font-bold">{props.item.name}</span>
      </span>
      <Show when={isAchievementItem() && !props.achievementEarned}>
        <span class="text-base text-sub">
          <Fa icon="fa-lock" class="mr-1.5" />
          Finish &quot;{props.achievement?.name}&quot; first.{" "}
          {props.achievement?.description}
        </span>
      </Show>
      <Show when={!isAchievementItem() && props.coinsNeeded > 0}>
        <span class="text-base text-sub">
          You need {props.coinsNeeded} more coins. Finish a lesson to get them.
        </span>
      </Show>
      <div class="flex flex-wrap justify-center gap-2">
        <Show when={canGet()}>
          <button
            type="button"
            class="press-3d min-h-12 cursor-pointer rounded-xl bg-main px-5 text-base font-semibold text-bg hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.pending}
            onClick={() => props.onGet()}
          >
            <Show
              when={!props.pending}
              fallback={<Fa icon="fa-circle-notch" spin />}
            >
              <Show when={!isAchievementItem()} fallback="Get it">
                <Fa icon="fa-coins" class="mr-2" />
                Buy for {props.item.price}
              </Show>
            </Show>
          </button>
        </Show>
        <button
          type="button"
          class="press-3d min-h-12 cursor-pointer rounded-xl bg-bg px-5 text-base font-semibold text-text hover:bg-text hover:text-bg"
          onClick={() => props.onCancel()}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

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
  AVATAR_CATEGORY_LABELS,
  AVATAR_ITEMS,
  AvatarCategory,
  AvatarItem,
  AvatarShape,
  COLLECTION_CATEGORIES,
  COLLECTION_REWARD,
  collectionItems,
  findAvatarItem,
  RARITY_LABELS,
  rarityOf,
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

const RARITY_CLASS: Record<ReturnType<typeof rarityOf>, string> = {
  common: "text-sub",
  rare: "text-text",
  epic: "text-main",
  legendary: "text-main",
  limited: "text-main",
};

export function AvatarModal(): JSXElement {
  const currentMonth = japanMonth();
  const [tab, setTab] = createSignal<Tab>("style");
  const [category, setCategory] = createSignal<AvatarCategory>("color");
  const [onlyMine, setOnlyMine] = createSignal(false);
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
    <AnimatedModal id="Avatar" title="My Avatar">
      <div class="grid gap-4">
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
            size={120}
          />
          <div class="flex items-center gap-2 text-lg font-bold text-main">
            <Fa icon="fa-coins" />
            {coins()}
          </div>
        </div>

        <Show when={preview()} keyed>
          {(item) => (
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
                void guardedCostumeAction(item.id, async () => handleBuy(item))
              }
              onCancel={() => setPreview(undefined)}
            />
          )}
        </Show>

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
              <div class="grid gap-2 rounded bg-sub-alt p-3 text-center text-sm">
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
                    class="cursor-pointer rounded bg-main px-4 py-1.5 font-medium text-bg hover:opacity-80"
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
                    class="cursor-pointer rounded bg-bg px-4 py-1.5 text-text hover:bg-text hover:text-bg"
                    onClick={() => setPendingShape(undefined)}
                  >
                    Keep {SHAPES.find((s) => s.id === equippedShape())?.label}
                  </button>
                </div>
              </div>
            )}
          </Show>
        </Show>

        <Show when={tab() === "style"}>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              class="cursor-pointer rounded bg-main px-3 py-1.5 text-sm font-medium text-bg hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={costumePendingId() !== null}
              onClick={() =>
                void guardedCostumeAction("__surprise__", surpriseMe)
              }
            >
              <Fa icon="fa-random" class="mr-1.5" />
              Surprise me
            </button>
            <For each={OUTFIT_SLOTS}>
              {(slot) => (
                <div class="flex items-center gap-1 rounded bg-sub-alt p-1 pr-2">
                  <Show
                    when={savedOutfit(slot)}
                    fallback={
                      <span class="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-sub text-em-xs text-sub">
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
                          void guardedCostumeAction(`wear-${slot}`, async () =>
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
                          size={32}
                        />
                      </button>
                    )}
                  </Show>
                  <button
                    type="button"
                    class="cursor-pointer text-em-xs text-sub hover:text-text disabled:cursor-not-allowed"
                    title={`Save my look as outfit ${slot}`}
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
                    save
                  </button>
                </div>
              )}
            </For>
          </div>
          <TitlePicker
            current={stateQuery.data?.title}
            earned={earnedQuery.data}
            onPick={pickTitle}
          />
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
                aria-pressed={tab() === t}
                onClick={() => pickTab(t)}
              >
                {t}
              </button>
            )}
          </For>
        </div>

        <p class="text-center text-em-xs text-sub">
          {tab() === "style"
            ? "Tap something you own to wear it. Tap anything else to try it on first."
            : "Choose an animal to buy or equip it."}
        </p>

        <Show when={tab() === "style"}>
          <div class="flex flex-wrap items-center gap-1">
            <For each={AVATAR_CATEGORIES}>
              {(cat) => (
                <button
                  type="button"
                  class={cn(
                    "relative rounded px-2.5 py-1 text-em-xs transition-colors",
                    category() === cat
                      ? "bg-main text-bg"
                      : "bg-sub-alt text-sub hover:text-text",
                  )}
                  aria-pressed={category() === cat}
                  onClick={() => pickCategory(cat)}
                >
                  {AVATAR_CATEGORY_LABELS[cat]}
                  <Show when={hasNewFor(cat)}>
                    <span
                      class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-main ring-2 ring-bg"
                      title="You can get something new here"
                    ></span>
                  </Show>
                </button>
              )}
            </For>
            <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-em-xs text-sub">
              <input
                type="checkbox"
                checked={onlyMine()}
                onChange={(e) => {
                  setOnlyMine(e.currentTarget.checked);
                  setPreview(undefined);
                }}
              />
              Only mine
            </label>
          </div>
        </Show>

        <Show
          when={tab() === "style" && COLLECTION_CATEGORIES.includes(category())}
        >
          <div class="flex flex-wrap items-center gap-3 rounded bg-sub-alt px-3 py-2 text-em-xs">
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
                  class="cursor-pointer rounded bg-main px-3 py-1 font-bold text-bg hover:opacity-80 disabled:opacity-50"
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
                <CheckBadge />
              </Show>
              <Avatar shape={equippedShape()} size={48} />
              <span class="text-sm font-medium">Normal avatar</span>
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
                      <CheckBadge />
                      <span class="text-em-xs font-bold">Equipped</span>
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
                "relative flex cursor-pointer flex-col items-center gap-1.5 rounded p-3 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
              <Avatar shape={equippedShape()} size={48} />
              <span class="text-sm font-medium">None</span>
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
                      "relative flex cursor-pointer flex-col items-center gap-1.5 rounded p-3 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      equipped()
                        ? "bg-main text-bg"
                        : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                      trying() ? "ring-2 ring-main" : "",
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
                      <span class="text-em-xs font-bold">Equipped</span>
                    </Show>
                    <Show when={item.seasonMonths !== undefined}>
                      <span class="absolute top-1 left-1 rounded bg-bg px-1.5 py-0.5 text-[0.65em] font-bold text-main">
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
                    <span class="text-sm font-medium">{item.name}</span>
                    <Show when={rarityOf(item) !== "limited"}>
                      <span
                        class={cn(
                          "text-[0.65em] font-bold tracking-wide uppercase",
                          equipped() ? "text-bg" : RARITY_CLASS[rarityOf(item)],
                        )}
                      >
                        <Show when={rarityOf(item) === "legendary"}>
                          <Fa icon="fa-crown" class="mr-1" size={0.7} />
                        </Show>
                        {RARITY_LABELS[rarityOf(item)]}
                      </span>
                    </Show>
                    <Show when={!owned()}>
                      <Show
                        when={costumePendingId() !== item.id}
                        fallback={<Fa icon="fa-circle-notch" spin size={0.7} />}
                      >
                        <span class="flex items-center gap-1 text-em-xs">
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
                                  size={0.7}
                                />
                                {isAchievementEarned(
                                  item.requiresAchievement ?? "",
                                )
                                  ? "Claim!"
                                  : "Locked"}
                              </>
                            }
                          >
                            <Fa icon="fa-coins" size={0.7} />
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
          <div class="place-self-center text-em-xs text-sub">
            You don&apos;t own any of these yet - untick &quot;Only mine&quot;
            to see what you can get!
          </div>
        </Show>
      </div>
    </AnimatedModal>
  );
}

function CheckBadge(): JSXElement {
  return (
    <span class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg text-main ring-2 ring-main">
      <Fa icon="fa-check" size={0.6} />
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
              size={48}
            />
          }
        >
          <span
            class="block h-7 w-7 rounded-full bg-bg"
            style={{
              "box-shadow": `0 0 0 2px ${props.item.value}, 0 0 6px ${props.item.value}`,
            }}
          ></span>
        </Show>
      }
    >
      <span
        class="block h-7 w-7 rounded-full shadow-inner ring-2 ring-bg"
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
    <div class="grid gap-2 rounded bg-sub-alt p-3 text-center">
      <span class="text-sm text-sub">
        Trying on <span class="font-bold text-text">{props.item.name}</span>
      </span>
      <Show when={isAchievementItem() && !props.achievementEarned}>
        <span class="text-em-xs text-sub">
          <Fa icon="fa-lock" class="mr-1.5" />
          Unlock it with &quot;{props.achievement?.name}&quot;:{" "}
          {props.achievement?.description}
        </span>
      </Show>
      <Show when={!isAchievementItem() && props.coinsNeeded > 0}>
        <span class="text-em-xs text-sub">
          You need {props.coinsNeeded} more coins. Finish lessons to earn them!
        </span>
      </Show>
      <div class="flex justify-center gap-2">
        <Show when={canGet()}>
          <button
            type="button"
            class="cursor-pointer rounded bg-main px-4 py-1.5 font-medium text-bg hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.pending}
            onClick={() => props.onGet()}
          >
            <Show
              when={!props.pending}
              fallback={<Fa icon="fa-circle-notch" spin />}
            >
              <Show when={!isAchievementItem()} fallback="Claim it free!">
                <Fa icon="fa-coins" class="mr-1.5" />
                Buy for {props.item.price}
              </Show>
            </Show>
          </button>
        </Show>
        <button
          type="button"
          class="cursor-pointer rounded bg-bg px-4 py-1.5 text-text hover:bg-text hover:text-bg"
          onClick={() => props.onCancel()}
        >
          Take it off
        </button>
      </div>
    </div>
  );
}

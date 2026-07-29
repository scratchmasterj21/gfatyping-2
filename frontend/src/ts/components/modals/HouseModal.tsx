import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { getEquippedAvatar } from "../../avatar/avatar-state";
import { HOUSE_ITEMS, HouseItem } from "../../house/house-items";
import {
  claimDailyGreeting,
  getHouseState,
  HouseItemPosition,
  saveItemPosition,
} from "../../house/house-state";
import { PET_ITEMS, PetItem } from "../../pet-shop/pet-items";
import { getPetState } from "../../pet-shop/pet-state";
import { queryClient } from "../../queries";
import { getUserId, isAuthenticated } from "../../states/core";
import { isModalOpen, showModal } from "../../states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { AnimatedModal } from "../common/AnimatedModal";
import { Anime } from "../common/anime";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { Fa } from "../common/Fa";
import { PetSprite } from "../common/PetSprite";

const ROAM_INTERVAL_MS = 4500;
const POSITION_WRITE_DEBOUNCE_MS = 400;

function randomRoamPos(): { x: number; y: number } {
  // Keep the avatar clear of the room's edges, where furniture sits.
  return { x: 15 + Math.random() * 70, y: 35 + Math.random() * 40 };
}

function clampPct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const PET_ROAM_INTERVAL_MS: Record<PetItem["movement"], number> = {
  walk: 4500,
  fly: 2600,
};

// How long the glide between roam waypoints takes - shorter than the roam
// interval itself (same ratio the avatar's own roam glide uses) so the pet
// finishes arriving before the next waypoint is picked, rather than
// snapping. Flies faster than it walks.
const PET_GLIDE_MS: Record<PetItem["movement"], number> = {
  walk: 2200,
  fly: 1300,
};

function randomPetPos(item: PetItem): { x: number; y: number } {
  if (item.movement === "fly") {
    // Roams the whole room, including the upper "air" area above the floor.
    return { x: 10 + Math.random() * 80, y: 10 + Math.random() * 45 };
  }
  // Walkers stay in the floor band (below the baseboard line at 68%).
  return { x: 10 + Math.random() * 80, y: 72 + Math.random() * 22 };
}

/**
 * One roaming pet - independent position/facing/drag state per instance
 * (each <RoamingPet> gets its own closures), so multiple pets wander
 * independently instead of moving in lockstep. Dragging is a self-contained
 * pointer-capture on the pet's own element (no shared state with the
 * furniture drag system in HouseModal) and is purely a temporary nudge -
 * nothing is written to Firestore, so the pet just resumes autonomous
 * roaming on its next interval tick.
 */
function RoamingPet(props: { item: PetItem }): JSXElement {
  // props.item is a stable <For> key that never changes for this instance.
  // oxlint-disable-next-line solid/reactivity -- one-time initial value only
  const [pos, setPos] = createSignal(randomPetPos(props.item));
  const [facingLeft, setFacingLeft] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  const [reacting, setReacting] = createSignal(false);
  let reactTimeout: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (reactTimeout !== null) clearTimeout(reactTimeout);
  });

  createEffect(() => {
    const interval = setInterval(() => {
      if (dragging()) return;
      setPos((prev) => {
        const next = randomPetPos(props.item);
        setFacingLeft(next.x < prev.x);
        return next;
      });
    }, PET_ROAM_INTERVAL_MS[props.item.movement]);
    onCleanup(() => clearInterval(interval));
  });

  const handlePointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!dragging()) return;
    const room = (e.currentTarget as HTMLElement).closest("[data-house-room]");
    if (room === null) return;
    const rect = room.getBoundingClientRect();
    const nextX = clampPct(((e.clientX - rect.left) / rect.width) * 100, 4, 96);
    const nextY = clampPct(((e.clientY - rect.top) / rect.height) * 100, 8, 96);
    setPos((prev) => {
      setFacingLeft(nextX < prev.x);
      return { x: nextX, y: nextY };
    });
  };

  const handlePointerUp = (): void => {
    setDragging(false);
  };

  const handleClick = (): void => {
    setReacting(true);
    if (reactTimeout !== null) clearTimeout(reactTimeout);
    reactTimeout = setTimeout(() => setReacting(false), 600);
  };

  return (
    <Anime
      class="absolute -translate-x-1/2 -translate-y-1/2"
      initial={{ left: `${pos().x}%`, top: `${pos().y}%` }}
      animate={{
        left: `${pos().x}%`,
        top: `${pos().y}%`,
        // Instant (no glide) while actively being dragged, so it tracks the
        // pointer directly instead of lagging behind on a multi-second ease.
        duration: dragging() ? 0 : PET_GLIDE_MS[props.item.movement],
        easing: "easeInOutQuad",
      }}
    >
      <div
        class="flex cursor-pointer touch-none flex-col items-center select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        <Show when={reacting()}>
          <div class="pointer-events-none absolute -top-4 text-lg">❤️</div>
        </Show>
        <PetSprite
          species={props.item.species}
          sizePx={props.item.sizePx}
          facingLeft={facingLeft()}
        />
        <Show when={props.item.movement === "walk"}>
          <div
            class="bg-black/20 -mt-1 rounded-full blur-[2px]"
            style={{
              height: `${props.item.sizePx * 0.1}px`,
              width: `${props.item.sizePx * 0.5}px`,
            }}
          ></div>
        </Show>
      </div>
    </Anime>
  );
}

export function HouseModal(): JSXElement {
  const isOpen = (): boolean => isModalOpen("House");

  const equippedQuery = useQuery(() => ({
    queryKey: ["houseEquippedAvatar", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return {};
      return getEquippedAvatar(uid);
    },
    enabled: isOpen() && isAuthenticated(),
  }));

  const houseQuery = useQuery(() => ({
    queryKey: ["houseState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) {
        return { coins: 0, ownedItems: {}, layout: {}, storedItems: {} };
      }
      return getHouseState(uid);
    },
    enabled: isOpen() && isAuthenticated(),
  }));

  const petQuery = useQuery(() => ({
    queryKey: ["petState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedPets: {}, storedPets: {} };
      return getPetState(uid);
    },
    enabled: isOpen() && isAuthenticated(),
  }));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["houseState"] });
  };

  // Local copy of item positions, seeded once from the fetched layout (not
  // kept in sync afterward) so an in-progress or just-finished drag can't get
  // overwritten by a background refetch of stale server data.
  const [positions, setPositions] = createSignal<
    Record<string, HouseItemPosition>
  >({});
  createEffect(() => {
    const layout = houseQuery.data?.layout;
    if (layout === undefined) return;
    setPositions((prev) => (Object.keys(prev).length === 0 ? layout : prev));
  });

  const effectivePos = (item: HouseItem): HouseItemPosition =>
    positions()[item.id] ?? item.slot;

  // oxlint-disable-next-line no-unassigned-vars -- assigned via SolidJS ref
  let roomRef: HTMLDivElement | undefined;
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  let positionWriteTimeout: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (positionWriteTimeout !== null) clearTimeout(positionWriteTimeout);
  });

  const handleItemPointerDown = (item: HouseItem, e: PointerEvent): void => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(item.id);
  };

  const handleRoomPointerMove = (e: PointerEvent): void => {
    const id = draggingId();
    if (id === null || roomRef === undefined) return;
    const rect = roomRef.getBoundingClientRect();
    const xPct = clampPct(((e.clientX - rect.left) / rect.width) * 100, 4, 96);
    const yPct = clampPct(((e.clientY - rect.top) / rect.height) * 100, 8, 96);
    setPositions((prev) => ({ ...prev, [id]: { xPct, yPct } }));
  };

  const handleRoomPointerUp = (): void => {
    const id = draggingId();
    setDraggingId(null);
    if (id === null) return;
    const uid = getUserId();
    const pos = positions()[id];
    if (uid === null || pos === undefined) return;
    if (positionWriteTimeout !== null) clearTimeout(positionWriteTimeout);
    positionWriteTimeout = setTimeout(() => {
      void saveItemPosition(uid, id, pos);
    }, POSITION_WRITE_DEBOUNCE_MS);
  };

  // Simple two-state mood: a live streak means they've practiced recently
  // enough to keep it going, so the avatar looks energetic; a lapsed streak
  // (0) shows a sleepy face instead. Reuses the existing "sleepy" face art
  // from the avatar shop rather than drawing a new expression.
  const isEnergetic = (): boolean => (getSnapshot()?.streak ?? 0) > 0;

  const [pos, setPos] = createSignal(randomRoamPos());
  const [celebrating, setCelebrating] = createSignal(false);
  let celebrateTimeout: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (celebrateTimeout !== null) clearTimeout(celebrateTimeout);
  });

  // Roaming only runs while this modal is actually open.
  createEffect(() => {
    if (!isOpen()) return;
    const interval = setInterval(
      () => setPos(randomRoamPos()),
      ROAM_INTERVAL_MS,
    );
    onCleanup(() => clearInterval(interval));
  });

  const handleAvatarClick = async (): Promise<void> => {
    setCelebrating(true);
    if (celebrateTimeout !== null) clearTimeout(celebrateTimeout);
    celebrateTimeout = setTimeout(() => setCelebrating(false), 900);

    const uid = getUserId();
    if (uid === null) return;
    try {
      const result = await claimDailyGreeting(uid);
      if (result.claimed) {
        showNoticeNotification(`+${result.coins} coins for visiting today!`, {
          durationMs: 3000,
        });
        refresh();
      }
    } catch {
      showErrorNotification("Something went wrong");
    }
  };

  return (
    <AnimatedModal id="House" title="My House" modalClass="max-w-4xl">
      <div class="grid gap-4">
        <div class="flex items-center justify-end gap-3">
          <div class="flex items-center gap-1.5 font-bold text-main">
            <Fa icon="fa-coins" />
            {houseQuery.data?.coins ?? 0}
          </div>
          <Button
            text="furniture"
            fa={{ icon: "fa-store" }}
            onClick={() => showModal("HouseShop")}
          />
          <Button
            text="pets"
            fa={{ icon: "fa-paw" }}
            onClick={() => showModal("PetShop")}
          />
        </div>

        <div
          ref={roomRef}
          data-house-room
          class="relative h-112 w-full touch-none overflow-hidden rounded-xl"
          style={{
            background:
              "linear-gradient(to bottom, var(--bg-color) 0%, var(--bg-color) 68%, var(--sub-alt-color) 68%, var(--sub-alt-color) 100%)",
          }}
          onPointerMove={handleRoomPointerMove}
          onPointerUp={handleRoomPointerUp}
          onPointerCancel={handleRoomPointerUp}
        >
          {/* baseboard: where the wall meets the floor */}
          <div
            class="absolute inset-x-0 h-0.5"
            style={{ top: "68%", "background-color": "var(--sub-color)" }}
          ></div>

          <Show
            when={Object.keys(houseQuery.data?.ownedItems ?? {}).length === 0}
          >
            <div class="absolute inset-x-0 top-4 text-center text-sm text-sub">
              Your room is empty — visit the shop to decorate it!
            </div>
          </Show>

          <For each={HOUSE_ITEMS}>
            {(item) => (
              <Show
                when={
                  houseQuery.data?.ownedItems[item.id] === true &&
                  houseQuery.data?.storedItems[item.id] !== true
                }
              >
                <div
                  class="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none text-center select-none active:cursor-grabbing"
                  style={{
                    left: `${effectivePos(item).xPct}%`,
                    top: `${effectivePos(item).yPct}%`,
                  }}
                  title={item.name}
                  onPointerDown={(e) => handleItemPointerDown(item, e)}
                >
                  <div
                    style={{
                      "font-size": `${item.sizePx}px`,
                      "line-height": "1",
                    }}
                  >
                    {item.emoji}
                  </div>
                  <div
                    class="bg-black/20 mx-auto -mt-1 rounded-full blur-[2px]"
                    style={{
                      height: `${item.sizePx * 0.12}px`,
                      width: `${item.sizePx * 0.6}px`,
                    }}
                  ></div>
                </div>
              </Show>
            )}
          </For>

          <For each={PET_ITEMS}>
            {(item) => (
              <Show
                when={
                  petQuery.data?.ownedPets[item.id] === true &&
                  petQuery.data?.storedPets[item.id] !== true
                }
              >
                <RoamingPet item={item} />
              </Show>
            )}
          </For>

          <Anime
            class="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{ left: `${pos().x}%`, top: `${pos().y}%` }}
            animate={{
              left: `${pos().x}%`,
              top: `${pos().y}%`,
              duration: 2200,
              easing: "easeInOutQuad",
            }}
          >
            <div
              class="cursor-pointer"
              onClick={() => void handleAvatarClick()}
            >
              <Avatar
                color={equippedQuery.data?.color}
                shape={equippedQuery.data?.shape}
                hair={equippedQuery.data?.hair}
                hat={equippedQuery.data?.hat}
                accessory={equippedQuery.data?.accessory}
                face={
                  !isEnergetic() && !celebrating()
                    ? "sleepy"
                    : equippedQuery.data?.face
                }
                background={equippedQuery.data?.background}
                highlightColor={equippedQuery.data?.highlight}
                celebrate={celebrating()}
                size={80}
              />
            </div>
          </Anime>
        </div>

        <div class="text-center text-sm text-sub">
          Click your avatar to say hi!
          <Show
            when={Object.keys(houseQuery.data?.ownedItems ?? {}).length > 0}
          >
            {" "}
            Drag furniture to rearrange it.
          </Show>
          <Show when={Object.keys(petQuery.data?.ownedPets ?? {}).length > 0}>
            {" "}
            Pets can be picked up and moved too.
          </Show>
        </div>
      </div>
    </AnimatedModal>
  );
}

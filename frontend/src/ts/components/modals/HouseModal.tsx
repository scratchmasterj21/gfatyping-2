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
import {
  HOUSE_ITEMS,
  HouseItem,
  HouseSpriteItem,
} from "../../house/house-items";
import { HOUSE_SMALL_ITEMS } from "../../house/house-small-items";
import { HOUSE_SPRITE_ITEMS } from "../../house/house-sprite-items";
import {
  claimDailyGreeting,
  getHouseState,
  HouseItemPosition,
  saveItemPosition,
  saveItemScale,
  saveTouchOrder,
} from "../../house/house-state";
import {
  DEFAULT_HOUSE_THEME_ID,
  getHouseTheme,
  HouseTheme,
} from "../../house/house-themes";
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
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Anime } from "../common/anime";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { Fa } from "../common/Fa";
import { PetSprite } from "../common/PetSprite";

const ROAM_INTERVAL_MS = 4500;
const POSITION_WRITE_DEBOUNCE_MS = 400;
const MIN_ITEM_SCALE = 0.5;
const MAX_ITEM_SCALE = 2.5;
/** Odds a walking pet idles for one interval instead of picking a new waypoint. */
const REST_CHANCE = 0.35;
/** Odds a walking pet's next waypoint is near the avatar rather than anywhere on the floor. */
const FOLLOW_AVATAR_CHANCE = 0.2;

/**
 * Paints depth from vertical position: whatever sits lower in the room is
 * nearer the viewer, so it draws on top. Everything sharing the room (
 * furniture, pets, the avatar) is placed on this one scale, which is what
 * lets a pet pass behind a dresser and in front of the couch below it. Ties
 * fall back to DOM order, so the furniture bring-to-front ordering still
 * decides between two pieces at the same height.
 */
function depthZ(yPct: number): number {
  return Math.round(yPct * 10);
}

/** Small decor sits on top of the shared depth scale - a book set down "on" a table belongs in front of it, never behind. */
const SMALL_DECOR_Z = 2000;

/**
 * How far a fronted item jumps above the y-based depth range (0-1000), so it
 * beats every un-fronted piece in its layer no matter how low they sit.
 * Fronting is a deliberate button press rather than a side effect of
 * dragging - if every drag fronted an item, an arranged room would have
 * everything fronted and the pets could never pass behind any of it.
 */
const FRONT_Z_OFFSET = 1100;

/**
 * Items a pet is happy to walk over - rugs lie flat on the floor, so routing
 * around them looks broken rather than careful.
 */
const FLAT_ITEM_IDS = new Set([
  "rug",
  "blue-rug",
  "rug-oval-dark",
  "rug-oval-small",
  "rug-striped",
]);

function randomRoamPos(): { x: number; y: number } {
  // Keep the avatar clear of the room's edges, where furniture sits.
  return { x: 15 + Math.random() * 70, y: 35 + Math.random() * 40 };
}

function clampPct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Looks up any placeable item (emoji furniture, sprite furniture, or small decor) by id. */
function findPlaceableItem(
  id: string,
): { id: string; slot: HouseItemPosition; sizePx: number } | undefined {
  return (
    HOUSE_ITEMS.find((i) => i.id === id) ??
    HOUSE_SPRITE_ITEMS.find((i) => i.id === id) ??
    HOUSE_SMALL_ITEMS.find((i) => i.id === id)
  );
}

// width/height ratio of each sprite image, keyed by item id - filled in as
// images load (see SpriteItem's onLoad below). Emoji furniture has no entry
// here and falls back to an assumed 1:1 box, which is close enough for a
// text glyph. Module-level and never cleared since it's just intrinsic image
// geometry, identical for every student and every room.
const imageAspectRatios: Record<string, number> = {};

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
function RoamingPet(props: {
  item: PetItem;
  /** Supplied by the room so waypoints can steer around furniture and occasionally head for the avatar - both need state this component doesn't own. */
  pickPos: (item: PetItem) => { x: number; y: number };
}): JSXElement {
  // props.item is a stable <For> key that never changes for this instance.
  // oxlint-disable-next-line solid/reactivity -- one-time initial value only
  const [pos, setPos] = createSignal(randomPetPos(props.item));
  const [facingLeft, setFacingLeft] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  const [reacting, setReacting] = createSignal(false);
  // Walkers pause for a beat between roams instead of pacing nonstop.
  const [resting, setResting] = createSignal(false);
  let reactTimeout: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (reactTimeout !== null) clearTimeout(reactTimeout);
  });

  createEffect(() => {
    const interval = setInterval(() => {
      if (dragging()) return;
      // A rest lasts exactly one tick, so a pet never looks frozen for long.
      if (resting()) {
        setResting(false);
        return;
      }
      if (props.item.movement === "walk" && Math.random() < REST_CHANCE) {
        setResting(true);
        return;
      }
      setPos((prev) => {
        const next = props.pickPos(props.item);
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
      style={{ "z-index": `${depthZ(pos().y)}` }}
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
        <Show when={resting() && !reacting()}>
          <div class="pointer-events-none absolute -top-4 text-sm opacity-70">
            💤
          </div>
        </Show>
        <PetSprite
          species={props.item.species}
          sizePx={props.item.sizePx}
          facingLeft={facingLeft()}
          resting={resting()}
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

/**
 * A placed pixel-art sprite (furniture or small decor) - shared rendering
 * for both, since they're the same shape (HouseSpriteItem) and only differ
 * in which layer/list the caller puts them in.
 */
function SpriteItem(props: {
  item: HouseSpriteItem;
  pos: HouseItemPosition;
  scale: number;
  zIndex: number;
  editMode: boolean;
  onPointerDown: (e: PointerEvent) => void;
  onResizePointerDown: (e: PointerEvent) => void;
  onBringToFront: () => void;
  onImageReady: () => void;
}): JSXElement {
  return (
    <div
      class={cn(
        // w-max is load-bearing: this box is positioned with `left` alone, so
        // without it the box is shrink-to-fit and its available width is only
        // (room width - left). Near the right wall that collapses to a few
        // px, and Tailwind preflight's `img { max-width: 100% }` then scales
        // the sprite down to fit it - the item visibly shrank as it
        // approached the wall. max-content keeps the box at its natural size
        // (and keeps -translate-x-1/2 centering on the true width).
        "absolute w-max -translate-x-1/2 -translate-y-1/2 touch-none text-center select-none",
        props.editMode && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: `${props.pos.xPct}%`,
        top: `${props.pos.yPct}%`,
        "z-index": `${props.zIndex}`,
      }}
      title={props.item.name}
      onPointerDown={(e) => props.onPointerDown(e)}
    >
      <div class="relative inline-block">
        <img
          src={props.item.image}
          alt={props.item.name}
          // max-w-none opts out of preflight's `img { max-width: 100% }` so
          // the explicit pixel width below is always what renders.
          class="max-w-none"
          style={{
            width: `${props.item.sizePx * props.scale}px`,
            height: "auto",
            "image-rendering": "pixelated",
          }}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              imageAspectRatios[props.item.id] =
                img.naturalWidth / img.naturalHeight;
              props.onImageReady();
            }
          }}
        />
        <Show when={props.editMode}>
          <div
            data-item-control
            class="absolute -right-1 -bottom-1 flex size-4.5 cursor-nwse-resize items-center justify-center rounded-full border border-sub bg-bg text-[9px] text-sub opacity-70 hover:opacity-100"
            title="Resize"
            onPointerDown={(e) => props.onResizePointerDown(e)}
          >
            <Fa icon="fa-expand" />
          </div>
          <div
            data-item-control
            class="absolute -bottom-1 -left-1 flex size-4.5 cursor-pointer items-center justify-center rounded-full border border-sub bg-bg text-[9px] text-sub opacity-70 hover:opacity-100"
            title="Bring to front"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onBringToFront();
            }}
          >
            <Fa icon="fa-layer-group" />
          </div>
        </Show>
      </div>
    </div>
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
        return {
          coins: 0,
          ownedItems: {},
          layout: {},
          scale: {},
          storedItems: {},
          touchOrder: [],
          themeId: DEFAULT_HOUSE_THEME_ID,
        };
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
  let positionsUid: string | null | undefined;
  createEffect(() => {
    if (!isOpen()) {
      positionsUid = undefined;
      setPositions({});
      return;
    }
    const layout = houseQuery.data?.layout;
    if (layout === undefined) return;
    const uid = getUserId();
    if (positionsUid !== uid) {
      positionsUid = uid;
      setPositions(layout);
    }
  });

  // Local copy of item scales, same seed-once-then-locally-own reasoning as
  // positions above.
  const [scales, setScales] = createSignal<Record<string, number>>({});
  let scalesUid: string | null | undefined;
  createEffect(() => {
    if (!isOpen()) {
      scalesUid = undefined;
      setScales({});
      return;
    }
    const scale = houseQuery.data?.scale;
    if (scale === undefined) return;
    const uid = getUserId();
    if (scalesUid !== uid) {
      scalesUid = uid;
      setScales(scale);
    }
  });

  const effectiveScale = (item: { id: string }): number =>
    scales()[item.id] ?? 1;

  // Bumped whenever a sprite image finishes loading and fills in
  // imageAspectRatios - effectivePos below reads it just to stay reactive to
  // that change, since the cache itself is a plain object Solid can't track.
  const [aspectVersion, setAspectVersion] = createSignal(0);
  const onImageReady = (): void => {
    setAspectVersion((v) => v + 1);
  };

  // Keeps an item's full visible box inside the room, not just its center
  // point - a center clamped to e.g. 96% still lets a wide/tall item's other
  // half poke past the room edge, where the room's overflow-hidden clips it,
  // looking like the item shrank as it neared a wall. Applied to every
  // position read (default catalog slot, a dragged position, or after a
  // resize), not just during an active drag, so nothing can ever end up
  // parked somewhere that clips it.
  const clampToRoom = (
    sizePx: number,
    scale: number,
    aspect: number,
    pos: HouseItemPosition,
  ): HouseItemPosition => {
    if (roomRef === undefined) return pos;
    const rect = roomRef.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return pos;
    const widthPx = sizePx * scale;
    const heightPx = widthPx / aspect;
    const halfWPct = (widthPx / 2 / rect.width) * 100;
    const halfHPct = (heightPx / 2 / rect.height) * 100;
    return {
      xPct: clampPct(pos.xPct, halfWPct, 100 - halfWPct),
      yPct: clampPct(pos.yPct, halfHPct, 100 - halfHPct),
    };
  };

  const effectivePos = (item: {
    id: string;
    slot: HouseItemPosition;
    sizePx: number;
  }): HouseItemPosition => {
    aspectVersion();
    const raw = positions()[item.id] ?? item.slot;
    const aspect = imageAspectRatios[item.id] ?? 1;
    return clampToRoom(item.sizePx, effectiveScale(item), aspect, raw);
  };

  const activeTheme = (): HouseTheme =>
    getHouseTheme(houseQuery.data?.themeId ?? DEFAULT_HOUSE_THEME_ID);

  const isPlaced = (id: string): boolean =>
    houseQuery.data?.ownedItems[id] === true &&
    houseQuery.data?.storedItems[id] !== true;

  // Small decor (books, food, bottles...) always renders on its own layer
  // above furniture (see the two separate <For> blocks below) so e.g. a book
  // placed "on" a table shows in front of it, never behind. Within each
  // layer, untouched items are sorted by vertical position so depth still
  // reads naturally when two pieces overlap - but any item you've picked up
  // (dragged or resized) stays ahead of every untouched item from then on,
  // ordered by how recently it was touched (most recent on top), like
  // bringing windows to front one at a time rather than only remembering
  // the single last one.
  const [touchOrder, setTouchOrder] = createSignal<string[]>([]);
  let touchOrderUid: string | null | undefined;
  createEffect(() => {
    if (!isOpen()) {
      touchOrderUid = undefined;
      setTouchOrder([]);
      return;
    }
    const order = houseQuery.data?.touchOrder;
    if (order === undefined) return;
    const uid = getUserId();
    if (touchOrderUid !== uid) {
      touchOrderUid = uid;
      setTouchOrder(order);
    }
  });
  let touchOrderWriteTimeout: ReturnType<typeof setTimeout> | null = null;
  const bringToFront = (id: string): void => {
    setTouchOrder((prev) => {
      const next = [...prev.filter((existing) => existing !== id), id];
      const uid = getUserId();
      if (uid !== null) {
        if (touchOrderWriteTimeout !== null) {
          clearTimeout(touchOrderWriteTimeout);
        }
        touchOrderWriteTimeout = setTimeout(() => {
          void saveTouchOrder(uid, next);
        }, POSITION_WRITE_DEBOUNCE_MS);
      }
      return next;
    });
  };

  /**
   * Final stacking value for one item. Items nobody has explicitly fronted
   * sit on the shared y-based depth scale, interleaved with the pets and the
   * avatar. Fronted ones jump above that whole range and are ordered among
   * themselves by how recently they were fronted, which is what makes
   * "bring to front" stick permanently rather than just winning ties.
   * `base` separates the furniture layer from the small-decor layer, so
   * fronting a table still can't cover the book resting on it.
   */
  const layerZ = (id: string, yPct: number, base: number): number => {
    const rank = touchOrder().indexOf(id);
    return base + (rank === -1 ? depthZ(yPct) : FRONT_Z_OFFSET + rank);
  };

  const sortByDepth = <T,>(
    items: { value: T; id: string; y: number }[],
  ): T[] => {
    const order = touchOrder();
    return items
      .sort((a, b) => {
        const aRank = order.indexOf(a.id);
        const bRank = order.indexOf(b.id);
        if (aRank === -1 && bRank === -1) return a.y - b.y;
        if (aRank === -1) return -1;
        if (bRank === -1) return 1;
        return aRank - bRank;
      })
      .map((entry) => entry.value);
  };
  // Sort-key y is the raw (unclamped) position, not effectivePos - reading
  // through effectivePos here would make this recompute every time an image
  // load bumps aspectVersion, rebuilding the array on every recompute. <For>
  // only avoids tearing down and remounting components (which would reload
  // every <img>, re-triggering that same aspectVersion bump - an infinite
  // loop) when the array elements it receives are the *same* object
  // references across calls, so this must return the original catalog item
  // objects unwrapped, not fresh {kind, item} wrappers.
  const sortedFurniture = (): (HouseItem | HouseSpriteItem)[] => {
    const entries: (HouseItem | HouseSpriteItem)[] = [
      ...HOUSE_ITEMS.filter((i) => isPlaced(i.id)),
      ...HOUSE_SPRITE_ITEMS.filter((i) => isPlaced(i.id)),
    ];
    return sortByDepth(
      entries.map((item) => ({
        value: item,
        id: item.id,
        y: (positions()[item.id] ?? item.slot).yPct,
      })),
    );
  };
  const sortedSmallItems = (): HouseSpriteItem[] =>
    sortByDepth(
      HOUSE_SMALL_ITEMS.filter((i) => isPlaced(i.id)).map((item) => ({
        value: item,
        id: item.id,
        y: (positions()[item.id] ?? item.slot).yPct,
      })),
    );

  // Furniture can only be moved/resized in edit mode, so the room reads as a
  // clean, static display the rest of the time - resize handles clutter the
  // room otherwise and dragging every item accidentally is annoying. Pets
  // stay interactive regardless, since nudging them around is just play.
  const [editMode, setEditMode] = createSignal(false);
  createEffect(() => {
    if (!isOpen()) setEditMode(false);
  });

  // oxlint-disable-next-line no-unassigned-vars -- assigned via SolidJS ref
  let roomRef: HTMLDivElement | undefined;
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  let positionWriteTimeout: ReturnType<typeof setTimeout> | null = null;

  // Resizing is a separate drag gesture from moving, started from a small
  // handle on the item rather than the item itself - the handle's own
  // pointerdown stops propagation so it doesn't also start a move-drag.
  const [resizingId, setResizingId] = createSignal<string | null>(null);
  let resizeStart: { distance: number; scale: number } | null = null;
  let scaleWriteTimeout: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (positionWriteTimeout !== null) clearTimeout(positionWriteTimeout);
    if (scaleWriteTimeout !== null) clearTimeout(scaleWriteTimeout);
    if (touchOrderWriteTimeout !== null) clearTimeout(touchOrderWriteTimeout);
  });

  const handleItemPointerDown = (
    item: { id: string },
    e: PointerEvent,
  ): void => {
    if (!editMode() || resizingId() !== null) return;
    // Belt-and-suspenders alongside the resize handle's own
    // stopPropagation(): the handle sits right on top of the item's own
    // corner, so this guards against ever starting a move-drag from the
    // same pointerdown that should only resize.
    if ((e.target as HTMLElement).closest("[data-item-control]") !== null) {
      return;
    }
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(item.id);
  };

  const handleResizeHandlePointerDown = (
    item: { id: string; slot: HouseItemPosition; sizePx: number },
    e: PointerEvent,
  ): void => {
    if (!editMode() || draggingId() !== null) return;
    e.preventDefault();
    e.stopPropagation();
    if (roomRef === undefined) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = roomRef.getBoundingClientRect();
    const pos = effectivePos(item);
    const centerX = rect.left + (pos.xPct / 100) * rect.width;
    const centerY = rect.top + (pos.yPct / 100) * rect.height;
    resizeStart = {
      distance: Math.hypot(e.clientX - centerX, e.clientY - centerY),
      scale: effectiveScale(item),
    };
    setResizingId(item.id);
  };

  const handleRoomPointerMove = (e: PointerEvent): void => {
    const resizeId = resizingId();
    if (resizeId !== null && roomRef !== undefined && resizeStart !== null) {
      const item = findPlaceableItem(resizeId);
      if (item === undefined) return;
      const rect = roomRef.getBoundingClientRect();
      const pos = effectivePos(item);
      const centerX = rect.left + (pos.xPct / 100) * rect.width;
      const centerY = rect.top + (pos.yPct / 100) * rect.height;
      const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      // Avoid a huge jump if the pointer starts right on the center.
      const ratio = distance / Math.max(resizeStart.distance, 12);
      const nextScale = clampPct(
        resizeStart.scale * ratio,
        MIN_ITEM_SCALE,
        MAX_ITEM_SCALE,
      );
      setScales((prev) => ({ ...prev, [resizeId]: nextScale }));
      return;
    }

    const id = draggingId();
    if (id === null || roomRef === undefined) return;
    const rect = roomRef.getBoundingClientRect();
    // Raw pointer position, not yet clamped to the item's own footprint -
    // effectivePos re-clamps that precisely on every render (see above), so
    // the item visibly stays inside the room without needing that math here.
    const xPct = clampPct(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const yPct = clampPct(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    setPositions((prev) => ({ ...prev, [id]: { xPct, yPct } }));
  };

  const handleRoomPointerUp = (): void => {
    const resizeId = resizingId();
    if (resizeId !== null) {
      setResizingId(null);
      resizeStart = null;
      const uid = getUserId();
      const item = findPlaceableItem(resizeId);
      const scale = scales()[resizeId];
      if (uid !== null && scale !== undefined && item !== undefined) {
        // Resizing bigger can push the item's edge past the room boundary -
        // persist the same clamped position effectivePos already renders,
        // so the saved layout matches what's on screen.
        const clamped = effectivePos(item);
        setPositions((prev) => ({ ...prev, [resizeId]: clamped }));
        if (scaleWriteTimeout !== null) clearTimeout(scaleWriteTimeout);
        scaleWriteTimeout = setTimeout(() => {
          void saveItemScale(uid, resizeId, scale);
          void saveItemPosition(uid, resizeId, clamped);
        }, POSITION_WRITE_DEBOUNCE_MS);
      }
    }

    const id = draggingId();
    setDraggingId(null);
    if (id === null) return;
    const uid = getUserId();
    const item = findPlaceableItem(id);
    const pos = positions()[id];
    if (uid === null || pos === undefined || item === undefined) return;
    const clamped = effectivePos(item);
    setPositions((prev) => ({ ...prev, [id]: clamped }));
    if (positionWriteTimeout !== null) clearTimeout(positionWriteTimeout);
    positionWriteTimeout = setTimeout(() => {
      void saveItemPosition(uid, id, clamped);
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

  /** Footprints of the furniture a walking pet should route around, in room percentages. */
  const solidFurnitureBoxes = (): {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  }[] => {
    if (roomRef === undefined) return [];
    const rect = roomRef.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    const boxes = [];
    for (const item of [...HOUSE_ITEMS, ...HOUSE_SPRITE_ITEMS]) {
      if (!isPlaced(item.id) || FLAT_ITEM_IDS.has(item.id)) continue;
      const center = effectivePos(item);
      const widthPx = item.sizePx * effectiveScale(item);
      const heightPx = widthPx / (imageAspectRatios[item.id] ?? 1);
      const halfW = (widthPx / 2 / rect.width) * 100;
      const halfH = (heightPx / 2 / rect.height) * 100;
      boxes.push({
        x0: center.xPct - halfW,
        x1: center.xPct + halfW,
        y0: center.yPct - halfH,
        y1: center.yPct + halfH,
      });
    }
    return boxes;
  };

  /**
   * Picks a pet's next waypoint. Fliers go anywhere - they're above the
   * furniture. Walkers retry a handful of random spots until one isn't
   * standing on a piece of furniture, and simply accept the last try if the
   * room is too crowded to find a clear one, since a pet that refuses to move
   * looks far more broken than one briefly overlapping a table.
   */
  const pickPetPos = (item: PetItem): { x: number; y: number } => {
    if (item.movement === "fly") return randomPetPos(item);
    const boxes = solidFurnitureBoxes();
    const isClear = (c: { x: number; y: number }): boolean =>
      !boxes.some((b) => c.x > b.x0 && c.x < b.x1 && c.y > b.y0 && c.y < b.y1);
    // Every so often, wander over to the avatar instead of anywhere at all.
    if (Math.random() < FOLLOW_AVATAR_CHANCE) {
      const near = {
        x: clampPct(pos().x + (Math.random() * 24 - 12), 10, 90),
        y: clampPct(pos().y + (Math.random() * 10 - 5), 72, 94),
      };
      if (isClear(near)) return near;
    }
    let candidate = randomPetPos(item);
    for (let attempt = 0; attempt < 12 && !isClear(candidate); attempt++) {
      candidate = randomPetPos(item);
    }
    return candidate;
  };

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
          <Show
            when={Object.keys(houseQuery.data?.ownedItems ?? {}).length > 0}
          >
            <Button
              text={editMode() ? "done" : "edit room"}
              fa={{ icon: editMode() ? "fa-check" : "fa-pen" }}
              onClick={() => setEditMode((prev) => !prev)}
            />
          </Show>
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
          onPointerMove={handleRoomPointerMove}
          onPointerUp={handleRoomPointerUp}
          onPointerCancel={handleRoomPointerUp}
        >
          {/* Wall and floor are two stacked bands rather than one gradient, so
              a theme can give each its own pattern (tiles, planks, stripes). */}
          <div
            class="absolute inset-x-0 top-0"
            style={{ height: "68%", background: activeTheme().wall }}
          ></div>
          <div
            class="absolute inset-x-0 bottom-0"
            style={{ height: "32%", background: activeTheme().floor }}
          ></div>

          {/* baseboard: where the wall meets the floor */}
          <div
            class="absolute inset-x-0 h-0.5"
            style={{
              top: "68%",
              "background-color": activeTheme().baseboard,
            }}
          ></div>

          <Show
            when={Object.keys(houseQuery.data?.ownedItems ?? {}).length === 0}
          >
            <div class="absolute inset-x-0 top-4 text-center text-sm text-sub">
              Your room is empty — visit the shop to decorate it!
            </div>
          </Show>

          <For each={sortedFurniture()}>
            {(item) => {
              if ("image" in item) {
                return (
                  <SpriteItem
                    item={item}
                    pos={effectivePos(item)}
                    scale={effectiveScale(item)}
                    zIndex={layerZ(item.id, effectivePos(item).yPct, 0)}
                    editMode={editMode()}
                    onPointerDown={(e) => handleItemPointerDown(item, e)}
                    onResizePointerDown={(e) =>
                      handleResizeHandlePointerDown(item, e)
                    }
                    onBringToFront={() => bringToFront(item.id)}
                    onImageReady={onImageReady}
                  />
                );
              }
              return (
                <div
                  class={cn(
                    // w-max for the same reason as the sprite wrapper above -
                    // an emoji glyph can't be scaled down by max-width, but a
                    // squeezed box would still throw off -translate-x-1/2
                    // centering near the walls.
                    "absolute w-max -translate-x-1/2 -translate-y-1/2 touch-none text-center select-none",
                    editMode() && "cursor-grab active:cursor-grabbing",
                  )}
                  style={{
                    left: `${effectivePos(item).xPct}%`,
                    top: `${effectivePos(item).yPct}%`,
                    "z-index": `${layerZ(item.id, effectivePos(item).yPct, 0)}`,
                  }}
                  title={item.name}
                  onPointerDown={(e) => handleItemPointerDown(item, e)}
                >
                  <div class="relative">
                    <div
                      style={{
                        "font-size": `${item.sizePx * effectiveScale(item)}px`,
                        "line-height": "1",
                      }}
                    >
                      {item.emoji}
                    </div>
                    <div
                      class="bg-black/20 mx-auto -mt-1 rounded-full blur-[2px]"
                      style={{
                        height: `${item.sizePx * effectiveScale(item) * 0.12}px`,
                        width: `${item.sizePx * effectiveScale(item) * 0.6}px`,
                      }}
                    ></div>
                    <Show when={editMode()}>
                      <div
                        data-item-control
                        class="absolute -right-1 -bottom-1 flex size-4.5 cursor-nwse-resize items-center justify-center rounded-full border border-sub bg-bg text-[9px] text-sub opacity-70 hover:opacity-100"
                        title="Resize"
                        onPointerDown={(e) =>
                          handleResizeHandlePointerDown(item, e)
                        }
                      >
                        <Fa icon="fa-expand" />
                      </div>
                      <div
                        data-item-control
                        class="absolute -bottom-1 -left-1 flex size-4.5 cursor-pointer items-center justify-center rounded-full border border-sub bg-bg text-[9px] text-sub opacity-70 hover:opacity-100"
                        title="Bring to front"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          bringToFront(item.id);
                        }}
                      >
                        <Fa icon="fa-layer-group" />
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>

          <For each={PET_ITEMS}>
            {(item) => (
              <Show
                when={
                  petQuery.data?.ownedPets[item.id] === true &&
                  petQuery.data?.storedPets[item.id] !== true
                }
              >
                <RoamingPet item={item} pickPos={pickPetPos} />
              </Show>
            )}
          </For>

          <Anime
            class="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ "z-index": `${depthZ(pos().y)}` }}
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
                animalImage={equippedQuery.data?.animalImage}
              />
            </div>
          </Anime>

          {/* Small decor always renders above furniture/avatar/pets - see sortedSmallItems. */}
          <For each={sortedSmallItems()}>
            {(item) => (
              <SpriteItem
                item={item}
                pos={effectivePos(item)}
                scale={effectiveScale(item)}
                zIndex={layerZ(item.id, effectivePos(item).yPct, SMALL_DECOR_Z)}
                editMode={editMode()}
                onPointerDown={(e) => handleItemPointerDown(item, e)}
                onResizePointerDown={(e) =>
                  handleResizeHandlePointerDown(item, e)
                }
                onBringToFront={() => bringToFront(item.id)}
                onImageReady={onImageReady}
              />
            )}
          </For>
        </div>

        <div class="text-center text-sm text-sub">
          Click your avatar to say hi!
          <Show
            when={Object.keys(houseQuery.data?.ownedItems ?? {}).length > 0}
          >
            {" "}
            {editMode()
              ? "Drag furniture to rearrange it. Use the right corner handle to resize, or the left one to bring it to the front."
              : "Tap edit room to rearrange or resize your furniture."}
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

import {
  createSignal,
  For,
  JSX,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { game } from "../snack-shop/snack-art";
import { ZooHabitat, ZOO_INFO, ZooSpecies } from "./zoo-animals";
import { ZOO_DECOR, ZooDecorId } from "./zoo-decor";
import { ZooPenPosition } from "./zoo-state";
import { ZooAction, ZooAnimal, ZooMood } from "./ZooAnimal";
import { ZooDecor } from "./ZooDecor";

const GROUND: Record<ZooHabitat, string> = {
  grass: "bg-game-grass",
  farm: "bg-game-tan",
  jungle: "bg-game-frog",
  savanna: "bg-game-sunset",
  ice: "bg-game-mint",
};

type Size = { w: number; h: number };
/** Sizes as a share of the map (centres are stored as percentages). */
const PEN: Size = { w: 17, h: 27 };
const DECOR: Size = { w: 9, h: 13 };

/** Where a pen sits until it's dragged: a 5-wide grid in buying order. */
export function defaultPenSpot(index: number): ZooPenPosition {
  return {
    xPct: 11 + (index % 5) * 19.5,
    yPct: 19 + Math.floor(index / 5) * 31,
  };
}

/** Decorations start on the paths between pens, by catalog order. */
const DECOR_SPOTS: ZooPenPosition[] = [
  { xPct: 20.75, yPct: 36 },
  { xPct: 40.25, yPct: 36 },
  { xPct: 59.75, yPct: 36 },
  { xPct: 79.25, yPct: 36 },
  { xPct: 20.75, yPct: 67 },
  { xPct: 40.25, yPct: 67 },
  { xPct: 59.75, yPct: 67 },
  { xPct: 79.25, yPct: 67 },
  { xPct: 4.5, yPct: 36 },
  { xPct: 95.5, yPct: 36 },
];
export const defaultDecorSpot = (id: ZooDecorId): ZooPenPosition =>
  DECOR_SPOTS[ZOO_DECOR.findIndex((d) => d.id === id)] ?? {
    xPct: 50,
    yPct: 50,
  };

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const box = (p: ZooPenPosition, size: Size): JSX.CSSProperties => ({
  left: `${p.xPct - size.w / 2}%`,
  top: `${p.yPct - size.h / 2}%`,
  width: `${size.w}%`,
  height: `${size.h}%`,
});

export type ZooAnimalLook = {
  mood: ZooMood;
  action?: ZooAction;
  dirty?: boolean;
  /** small icon bubble over the pen (e.g. hungry) */
  bubble?: "fa-carrot" | "fa-heart";
};

type ItemId = ZooSpecies | ZooDecorId;

/**
 * The zoo grounds: one pen per animal plus decorations, placed where the
 * student dragged them. `editing` turns on dragging; positions are saved by
 * `onMove` on release.
 */
export function ZooMap(props: {
  animals: ZooSpecies[];
  decor?: ZooDecorId[];
  layout: Partial<Record<ItemId, ZooPenPosition>>;
  look: (species: ZooSpecies) => ZooAnimalLook;
  editing: boolean;
  /** care streak reward: a golden bowl in every pen */
  goldenBowls?: boolean;
  onMove?: (id: ItemId, pos: ZooPenPosition) => void;
}): JSXElement {
  let mapEl: HTMLDivElement | undefined;
  // items dragged on this device since the last save, shown right away
  const [moved, setMoved] = createSignal<
    Partial<Record<ItemId, ZooPenPosition>>
  >({});
  const [dragging, setDragging] = createSignal<ItemId | null>(null);
  let dragRect: DOMRect | null = null;
  let grab = { dx: 0, dy: 0 };
  let dragSize = PEN;

  const spot = (id: ItemId, fallback: ZooPenPosition): ZooPenPosition =>
    moved()[id] ?? props.layout[id] ?? fallback;

  const onDown = (
    e: PointerEvent,
    id: ItemId,
    size: Size,
    here: ZooPenPosition,
  ): void => {
    if (!props.editing || mapEl === undefined) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRect = mapEl.getBoundingClientRect();
    dragSize = size;
    grab = {
      dx: ((e.clientX - dragRect.left) / dragRect.width) * 100 - here.xPct,
      dy: ((e.clientY - dragRect.top) / dragRect.height) * 100 - here.yPct,
    };
    setDragging(id);
  };
  const onMoveEvent = (e: PointerEvent, id: ItemId): void => {
    if (dragging() !== id || dragRect === null) return;
    const p = {
      xPct: clamp(
        ((e.clientX - dragRect.left) / dragRect.width) * 100 - grab.dx,
        dragSize.w / 2,
        100 - dragSize.w / 2,
      ),
      yPct: clamp(
        ((e.clientY - dragRect.top) / dragRect.height) * 100 - grab.dy,
        dragSize.h / 2,
        100 - dragSize.h / 2,
      ),
    };
    setMoved((m) => ({ ...m, [id]: p }));
  };
  const onUp = (id: ItemId): void => {
    if (dragging() !== id) return;
    setDragging(null);
    dragRect = null;
    const p = moved()[id];
    if (p !== undefined) props.onMove?.(id, p);
  };

  return (
    // plain wrapper: as a grid item, an overflow-hidden aspect-ratio box gets
    // a zero-height row and spills over whatever comes after it
    <div class="w-full">
      <div
        ref={(el) => {
          mapEl = el;
        }}
        class={cn(
          "relative aspect-[16/10] w-full touch-none overflow-hidden rounded-double bg-game-grass-dark select-none",
          props.editing && "outline-4 outline-game-yellow outline-dashed",
        )}
      >
        {/* paths */}
        <div
          class="absolute inset-x-0 top-[34%] h-[4%] bg-game-tan/80"
          aria-hidden="true"
        ></div>
        <div
          class="absolute inset-x-0 top-[65%] h-[4%] bg-game-tan/80"
          aria-hidden="true"
        ></div>
        <div
          class="absolute inset-y-0 left-[48%] w-[4%] bg-game-tan/80"
          aria-hidden="true"
        ></div>

        <For each={props.animals}>
          {(s, i) => {
            const look = (): ZooAnimalLook => props.look(s);
            const pos = (): ZooPenPosition => spot(s, defaultPenSpot(i()));
            return (
              <div
                class={cn(
                  "absolute flex flex-col overflow-hidden rounded-xl border-[3px] border-game-brown shadow-[0_4px_0_var(--color-game-brown-dark)]",
                  GROUND[ZOO_INFO[s].habitat],
                  props.editing && "cursor-grab",
                  dragging() === s && "z-20 scale-105 cursor-grabbing",
                )}
                style={box(pos(), PEN)}
                onPointerDown={(e) => onDown(e, s, PEN, pos())}
                onPointerMove={(e) => onMoveEvent(e, s)}
                onPointerUp={() => onUp(s)}
                onPointerCancel={() => onUp(s)}
              >
                <div
                  class="h-1.5 shrink-0"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, var(--color-game-brown) 0 4px, transparent 4px 14px)",
                  }}
                  aria-hidden="true"
                ></div>
                <div class="relative flex min-h-0 flex-1 items-end justify-center">
                  <Show when={props.goldenBowls === true}>
                    <svg
                      viewBox="0 0 40 16"
                      class="absolute bottom-1 left-1 w-[22%]"
                      role="img"
                      aria-label="golden bowl"
                    >
                      <path
                        d="M2 4 h36 l-5 11 h-26 z"
                        fill={game("gold")}
                      ></path>
                      <path
                        d="M8 7 h6"
                        stroke={game("cloud")}
                        stroke-width="2"
                        stroke-linecap="round"
                      ></path>
                    </svg>
                  </Show>
                  <RoamingAnimal
                    species={s}
                    look={look()}
                    still={props.editing}
                    seed={i()}
                  />
                  <Show when={look().bubble} keyed>
                    {(icon) => (
                      <span class="absolute top-1 right-1 grid h-6 w-6 animate-game-bob place-items-center rounded-full bg-game-cloud text-xs text-game-ink shadow motion-reduce:animate-none">
                        <Fa
                          icon={icon}
                          class={icon === "fa-heart" ? "text-game-pink" : ""}
                        />
                      </span>
                    )}
                  </Show>
                </div>
                <div class="shrink-0 truncate bg-game-brown px-1 text-center text-[0.6rem] leading-4 font-bold text-game-cream sm:text-xs">
                  {ZOO_INFO[s].name}
                </div>
              </div>
            );
          }}
        </For>
        {/* decorations (in front, between the pens) */}
        <For each={props.decor ?? []}>
          {(id) => {
            const pos = (): ZooPenPosition => spot(id, defaultDecorSpot(id));
            return (
              <div
                class={cn(
                  "absolute flex items-end justify-center",
                  props.editing &&
                    "cursor-grab rounded-lg outline-2 outline-game-cloud/70 outline-dashed",
                  dragging() === id && "z-20 scale-110 cursor-grabbing",
                )}
                style={box(pos(), DECOR)}
                onPointerDown={(e) => onDown(e, id, DECOR, pos())}
                onPointerMove={(e) => onMoveEvent(e, id)}
                onPointerUp={() => onUp(id)}
                onPointerCancel={() => onUp(id)}
              >
                <ZooDecor id={id} class="h-full w-full" />
              </div>
            );
          }}
        </For>
        {/* a little life: cloud shadows drifting over, butterflies */}
        <div
          class="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <For each={[0, -14, -27]}>
            {(delay, i) => (
              <div
                class="absolute h-[30%] w-[40%] animate-game-drift rounded-full motion-reduce:hidden"
                style={{
                  top: `${10 + i() * 28}%`,
                  background:
                    "radial-gradient(ellipse at center, rgb(43 33 64 / 0.1), transparent 70%)",
                  "animation-duration": "42s",
                  "animation-delay": `${delay}s`,
                }}
              ></div>
            )}
          </For>
          <For each={[0, -13]}>
            {(delay, i) => (
              <div
                class="absolute inset-0 animate-zoo-flutter motion-reduce:hidden"
                style={{ "animation-delay": `${delay}s` }}
              >
                <Butterfly color={i() === 0 ? "pink" : "yellow"} />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function Butterfly(props: { color: "pink" | "yellow" }): JSXElement {
  return (
    <svg viewBox="0 0 24 20" class="w-[2.2%] min-w-4">
      <g
        class="animate-zoo-wing"
        style={{ "transform-box": "fill-box", "transform-origin": "center" }}
      >
        <ellipse cx="7" cy="7" rx="6" ry="5" fill={game(props.color)}></ellipse>
        <ellipse
          cx="17"
          cy="7"
          rx="6"
          ry="5"
          fill={game(props.color)}
        ></ellipse>
        <ellipse
          cx="8"
          cy="14"
          rx="4"
          ry="3.5"
          fill={game(props.color)}
        ></ellipse>
        <ellipse
          cx="16"
          cy="14"
          rx="4"
          ry="3.5"
          fill={game(props.color)}
        ></ellipse>
      </g>
      <rect x="11" y="4" width="2" height="13" rx="1" fill={game("ink")}></rect>
    </svg>
  );
}

/**
 * One animal living in its pen: wanders to new spots with a trot, hops,
 * turns to look around, and does a happy hop (with hearts) when tapped.
 * It stands still while it needs care, is doing a care job, or pens are
 * being moved.
 */
function RoamingAnimal(props: {
  species: ZooSpecies;
  look: ZooAnimalLook;
  still: boolean;
  seed: number;
}): JSXElement {
  const [x, setX] = createSignal(0);
  const [facing, setFacing] = createSignal(1);
  const [moveMs, setMoveMs] = createSignal(0);
  const [moving, setMoving] = createSignal(false);
  const [trick, setTrick] = createSignal<ZooAction | undefined>();
  const [hearts, setHearts] = createSignal<number[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const extra: ReturnType<typeof setTimeout>[] = [];
  let heartId = 0;

  const free = (): boolean =>
    !props.still &&
    props.look.action === undefined &&
    props.look.mood === "happy";
  const later = (ms: number): void => {
    clearTimeout(timer);
    timer = setTimeout(step, ms);
  };
  const rest = (): number => 900 + Math.random() * 2600;

  const step = (): void => {
    if (!free() || trick() !== undefined) {
      setMoving(false);
      later(1200);
      return;
    }
    const r = Math.random();
    if (r < 0.55) {
      // wander somewhere new in the pen
      const to = Math.random() * 60 - 30;
      const ms = Math.max(700, Math.abs(to - x()) * 85);
      setFacing(to >= x() ? 1 : -1);
      setMoveMs(ms);
      setMoving(true);
      setX(to);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setMoving(false);
        later(rest());
      }, ms);
    } else if (r < 0.72) {
      setTrick("cheer");
      clearTimeout(timer);
      timer = setTimeout(() => {
        setTrick(undefined);
        later(rest());
      }, 1300);
    } else if (r < 0.88) {
      setFacing((f) => -f); // look the other way
      later(rest());
    } else {
      later(rest() + 1500);
    }
  };

  onMount(() => later(300 + ((props.seed * 733) % 2200)));
  onCleanup(() => {
    clearTimeout(timer);
    extra.forEach(clearTimeout);
  });

  const tap = (): void => {
    if (props.still) return;
    sfx.pop();
    setTrick("cheer");
    const id = heartId++;
    setHearts((h) => [...h, id]);
    extra.push(
      setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1000),
      setTimeout(() => setTrick(undefined), 1300),
    );
  };

  return (
    <div
      class="relative flex h-full w-full cursor-pointer items-end justify-center"
      onClick={tap}
    >
      <div
        class="flex h-full w-full items-end justify-center"
        style={{
          transform: `translateX(${free() ? x() : 0}%)`,
          transition: `transform ${moving() ? moveMs() : 400}ms ${moving() ? "linear" : "ease-out"}`,
        }}
      >
        <div
          class="flex h-full w-full items-end justify-center transition-transform duration-200"
          style={{ transform: `scaleX(${free() ? facing() : 1})` }}
        >
          <ZooAnimal
            species={props.species}
            mood={props.look.mood}
            action={props.look.action ?? trick()}
            dirty={props.look.dirty}
            walking={moving() && free()}
            class="h-[88%] w-auto max-w-full"
          />
        </div>
      </div>
      <For each={hearts()}>
        {() => (
          <span
            class="pointer-events-none absolute top-0 left-1/2 block -translate-x-1/2 animate-game-float-up text-lg text-game-pink motion-reduce:hidden"
            aria-hidden="true"
          >
            ♥
          </span>
        )}
      </For>
    </div>
  );
}

import { createSignal, For, JSXElement, Show } from "solid-js";

import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";
import { ZooHabitat, ZOO_INFO, ZooSpecies } from "./zoo-animals";
import { ZooPenPosition } from "./zoo-state";
import { ZooAction, ZooAnimal, ZooMood } from "./ZooAnimal";

const GROUND: Record<ZooHabitat, string> = {
  grass: "bg-game-grass",
  farm: "bg-game-tan",
  jungle: "bg-game-frog",
  savanna: "bg-game-sunset",
  ice: "bg-game-mint",
};

/** Pen size as a share of the map (centres are stored as percentages). */
const PEN_W = 17;
const PEN_H = 27;

/** Where a pen sits until it's dragged: a 5-wide grid in buying order. */
export function defaultPenSpot(index: number): ZooPenPosition {
  return {
    xPct: 11 + (index % 5) * 19.5,
    yPct: 19 + Math.floor(index / 5) * 31,
  };
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export type ZooAnimalLook = {
  mood: ZooMood;
  action?: ZooAction;
  dirty?: boolean;
  /** small icon bubble over the pen (e.g. hungry) */
  bubble?: "fa-carrot" | "fa-heart";
};

/**
 * The zoo grounds: one pen per animal, placed where the student dragged it.
 * `editing` turns on dragging; positions are saved by `onMove` on release.
 */
export function ZooMap(props: {
  animals: ZooSpecies[];
  layout: Partial<Record<ZooSpecies, ZooPenPosition>>;
  look: (species: ZooSpecies) => ZooAnimalLook;
  editing: boolean;
  onMove?: (species: ZooSpecies, pos: ZooPenPosition) => void;
}): JSXElement {
  let mapEl: HTMLDivElement | undefined;
  // pens dragged on this device since the last save, shown right away
  const [moved, setMoved] = createSignal<
    Partial<Record<ZooSpecies, ZooPenPosition>>
  >({});
  const [dragging, setDragging] = createSignal<ZooSpecies | null>(null);
  let dragRect: DOMRect | null = null;
  let grab = { dx: 0, dy: 0 };

  const spot = (s: ZooSpecies, i: number): ZooPenPosition =>
    moved()[s] ?? props.layout[s] ?? defaultPenSpot(i);

  const toPct = (e: PointerEvent): ZooPenPosition | null => {
    if (dragRect === null) return null;
    return {
      xPct: clamp(
        ((e.clientX - dragRect.left) / dragRect.width) * 100 - grab.dx,
        PEN_W / 2,
        100 - PEN_W / 2,
      ),
      yPct: clamp(
        ((e.clientY - dragRect.top) / dragRect.height) * 100 - grab.dy,
        PEN_H / 2,
        100 - PEN_H / 2,
      ),
    };
  };

  const onDown = (e: PointerEvent, s: ZooSpecies, i: number): void => {
    if (!props.editing || mapEl === undefined) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRect = mapEl.getBoundingClientRect();
    const here = spot(s, i);
    grab = {
      dx: ((e.clientX - dragRect.left) / dragRect.width) * 100 - here.xPct,
      dy: ((e.clientY - dragRect.top) / dragRect.height) * 100 - here.yPct,
    };
    setDragging(s);
  };
  const onMoveEvent = (e: PointerEvent, s: ZooSpecies): void => {
    if (dragging() !== s) return;
    const p = toPct(e);
    if (p !== null) setMoved((m) => ({ ...m, [s]: p }));
  };
  const onUp = (s: ZooSpecies): void => {
    if (dragging() !== s) return;
    setDragging(null);
    dragRect = null;
    const p = moved()[s];
    if (p !== undefined) props.onMove?.(s, p);
  };

  return (
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
          const pos = (): ZooPenPosition => spot(s, i());
          const walking = (): boolean =>
            !props.editing &&
            look().action === undefined &&
            look().mood === "happy";
          return (
            <div
              class={cn(
                "absolute flex flex-col overflow-hidden rounded-xl border-[3px] border-game-brown shadow-[0_4px_0_var(--color-game-brown-dark)]",
                GROUND[ZOO_INFO[s].habitat],
                props.editing && "cursor-grab",
                dragging() === s && "z-10 scale-105 cursor-grabbing",
              )}
              style={{
                left: `${pos().xPct - PEN_W / 2}%`,
                top: `${pos().yPct - PEN_H / 2}%`,
                width: `${PEN_W}%`,
                height: `${PEN_H}%`,
              }}
              onPointerDown={(e) => onDown(e, s, i())}
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
                <div
                  class={cn(
                    "flex h-full w-full items-end justify-center",
                    walking() && "animate-zoo-pace motion-reduce:animate-none",
                  )}
                  style={{ "animation-delay": `${-i() * 2.3}s` }}
                >
                  <ZooAnimal
                    species={s}
                    mood={look().mood}
                    action={look().action}
                    dirty={look().dirty}
                    walking={walking()}
                    class="h-[88%] w-auto max-w-full"
                  />
                </div>
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
    </div>
  );
}

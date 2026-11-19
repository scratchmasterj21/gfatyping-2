import { createEffect, For, Index, JSXElement, on, Show } from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { cn } from "../../utils/cn";
import { kartUrl } from "./car-art";
import {
  FINAL_STRETCH,
  GameColor,
  placeName,
  TRACK_FEATURES,
  TrackId,
} from "./race-rules";

export type LaneCar = {
  id: string;
  name: string;
  color: GameColor;
  /** 0-1 */
  progress: number;
  /** emoji in the seat (computer racers, garage drivers) */
  driver?: string;
  sticker?: string;
  avatarUid?: string;
  me?: boolean;
  boosting?: boolean;
  airborne?: boolean;
  spinning?: boolean;
  slip?: boolean;
  pits?: boolean;
  /** crossed the line in this place */
  place?: number;
};

const SCENERY: Record<
  TrackId,
  { sky: string; ground: string; road: string; props: string[] }
> = {
  city: {
    sky: "bg-linear-to-b from-game-sky-top to-game-sky",
    ground: "bg-game-grass",
    road: "bg-game-navy",
    props: ["🏢", "🌳", "🏬", "🌳", "🏠", "🏢", "🌳", "🏬"],
  },
  desert: {
    sky: "bg-linear-to-b from-game-sunset to-game-tan",
    ground: "bg-game-tan",
    road: "bg-game-brown",
    props: ["🌵", "🏜️", "🌵", "🦂", "🌵", "🏜️", "🌵", "🐪"],
  },
  snow: {
    sky: "bg-linear-to-b from-game-sky to-game-cloud",
    ground: "bg-game-cloud",
    road: "bg-game-grey",
    props: ["🌲", "⛄", "🌲", "🏔️", "🌲", "⛄", "🌲", "🏔️"],
  },
  space: {
    sky: "bg-linear-to-b from-game-night to-game-dusk",
    ground: "bg-game-night",
    road: "bg-game-ink",
    props: ["🪐", "⭐", "🌙", "✨", "🛸", "⭐", "🌍", "✨"],
  },
};

/** Distance along the road as a CSS left. */
const along = (p: number): string =>
  `calc(3.5rem + (100% - 7rem) * ${Math.max(0, Math.min(1, p))})`;

/** The race track: themed scenery, lanes, ramps, the cars. */
export function RaceTrack(props: {
  cars: LaneCar[];
  /** my best race, drawn see-through in my lane */
  ghost?: number;
  track: TrackId;
  /** 3, 2, 1, 0 (= GO!) or null */
  countdown: number | null;
  banner?: string;
  features?: boolean;
}): JSXElement {
  const scene = (): (typeof SCENERY)[TrackId] => SCENERY[props.track];
  const lanes = (): number => Math.max(1, props.cars.length);
  const myLane = (): number => props.cars.findIndex((c) => c.me === true);
  return (
    <div class="relative flex h-full min-h-0 w-full flex-col overflow-hidden select-none">
      {/* scenery */}
      <div class={cn("relative h-[22%] min-h-12 shrink-0", scene().sky)}>
        <Show when={props.track === "space"}>
          <div class="absolute inset-0 animate-game-twinkle text-xs text-game-cream/80">
            <span class="absolute top-2 left-[12%]">✦</span>
            <span class="absolute top-6 left-[38%]">✦</span>
            <span class="absolute top-3 left-[64%]">✦</span>
            <span class="absolute top-8 left-[86%]">✦</span>
          </div>
        </Show>
        <div class="absolute inset-x-0 bottom-0 flex justify-around text-2xl sm:text-4xl">
          <For each={scene().props}>{(p) => <span>{p}</span>}</For>
        </div>
      </div>
      {/* kerb */}
      <div class="h-2 shrink-0 bg-[repeating-linear-gradient(90deg,var(--color-game-red)_0_24px,var(--color-game-cream)_24px_48px)]"></div>
      {/* road */}
      <div class={cn("relative min-h-0 flex-1", scene().road)}>
        {/* lane lines */}
        <Index each={Array.from({ length: lanes() - 1 })}>
          {(_, i) => (
            <div
              class="absolute inset-x-14 h-1 bg-[repeating-linear-gradient(90deg,var(--color-game-cream)_0_22px,transparent_22px_40px)] opacity-60"
              style={{ top: `${((i + 1) / lanes()) * 100}%` }}
            ></div>
          )}
        </Index>
        {/* start + finish */}
        <div class="absolute inset-y-0 left-14 w-1 bg-game-cream/80"></div>
        <div class="absolute inset-y-0 right-10 w-4 bg-[repeating-conic-gradient(var(--color-game-ink)_0_25%,var(--color-game-cream)_0_50%)] bg-size-[16px_16px]"></div>
        {/* final stretch marker */}
        <div
          class="absolute inset-y-0 w-0.5 bg-game-yellow/50"
          style={{ left: along(FINAL_STRETCH) }}
        ></div>
        <Show when={props.features !== false}>
          <For each={TRACK_FEATURES}>
            {(f) => (
              <div
                class={cn(
                  "absolute inset-y-1 w-5 -translate-x-1/2 rounded",
                  f.kind === "ramp"
                    ? "bg-[repeating-linear-gradient(180deg,var(--color-game-yellow)_0_10px,var(--color-game-orange)_10px_20px)] opacity-90 shadow-[2px_0_0_rgb(0_0_0/0.3)]"
                    : "grid animate-game-pulse place-items-center bg-game-blue/70 text-xs text-game-cream",
                )}
                style={{ left: along(f.at) }}
                title={f.kind === "ramp" ? "ramp" : "boost pad"}
              >
                {f.kind === "pad" ? "»" : ""}
              </div>
            )}
          </For>
        </Show>
        {/* ghost */}
        <Show when={props.ghost !== undefined && myLane() >= 0}>
          <div
            class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center opacity-35"
            style={{
              left: along(props.ghost ?? 0),
              top: `${((myLane() + 0.5) / lanes()) * 100}%`,
            }}
          >
            <img
              src={kartUrl("purple")}
              alt="your best race"
              class="h-auto w-16 sm:w-20"
            />
            <span class="text-xs font-bold text-game-cream">👻 best</span>
          </div>
        </Show>
        <Index each={props.cars}>
          {(car, i) => (
            <Car
              car={car()}
              top={((i + 0.5) / lanes()) * 100}
              small={lanes() > 5}
            />
          )}
        </Index>
      </div>
      <div class="h-2 shrink-0 bg-[repeating-linear-gradient(90deg,var(--color-game-red)_0_24px,var(--color-game-cream)_24px_48px)]"></div>
      <div class={cn("h-[6%] min-h-3 shrink-0", scene().ground)}></div>

      <Show when={props.banner}>
        {(b) => (
          <div class="pointer-events-none absolute top-[24%] left-1/2 z-20 -translate-x-1/2 animate-game-pop rounded-full bg-game-yellow px-5 py-1 text-lg font-bold whitespace-nowrap text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.25)] sm:text-2xl">
            {b()}
          </div>
        )}
      </Show>
      <Show when={props.countdown !== null}>
        <div class="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-game-ink/30">
          <Show when={props.countdown} keyed>
            {(n) => (
              <span class="animate-game-pop text-8xl font-bold text-game-yellow drop-shadow-[0_6px_0_var(--color-game-ink)]">
                {n}
              </span>
            )}
          </Show>
          <Show when={props.countdown === 0}>
            <span class="animate-game-pop text-7xl font-bold text-game-green drop-shadow-[0_6px_0_var(--color-game-ink)]">
              GO!
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function Car(props: { car: LaneCar; top: number; small: boolean }): JSXElement {
  let body: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.car.spinning === true,
      (spin) => {
        if (spin && body !== undefined) {
          body.animate(
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(-200deg)" },
              { transform: "rotate(-360deg)" },
            ],
            { duration: 600, easing: "ease-out" },
          );
        }
      },
    ),
  );
  return (
    <div
      class={cn(
        "absolute flex -translate-x-[70%] -translate-y-1/2 items-center",
        props.car.me === true ? "z-10" : "z-0",
      )}
      style={{ left: along(props.car.progress), top: `${props.top}%` }}
    >
      {/* speed lines / flame */}
      <Show when={props.car.boosting === true}>
        <div class="absolute top-1/2 right-[88%] flex -translate-y-1/2 flex-col gap-1">
          <div class="h-1 w-10 animate-pulse rounded-full bg-game-cream/80"></div>
          <div class="h-1.5 w-14 animate-pulse rounded-full bg-game-orange"></div>
          <div class="h-1 w-8 animate-pulse rounded-full bg-game-cream/80"></div>
        </div>
      </Show>
      <Show when={props.car.slip === true && props.car.boosting !== true}>
        <div class="absolute top-1/2 right-[90%] flex -translate-y-1/2 flex-col gap-2 opacity-70">
          <div class="h-0.5 w-8 animate-pulse rounded-full bg-game-cream"></div>
          <div class="h-0.5 w-6 animate-pulse rounded-full bg-game-cream"></div>
        </div>
      </Show>
      <div
        ref={(el) => {
          body = el;
        }}
        class={cn(
          "relative transition-transform duration-300",
          props.car.airborne === true && "-translate-y-1/2 scale-110",
        )}
      >
        <img
          src={kartUrl(props.car.color)}
          alt={props.car.name}
          class={cn("h-auto", props.small ? "w-12 sm:w-16" : "w-16 sm:w-24")}
        />
        {/* driver */}
        <div class="absolute top-[-8%] left-[30%] grid h-[42%] w-[22%] place-items-center overflow-hidden rounded-full">
          <Show
            when={props.car.driver}
            fallback={
              <Show when={props.car.avatarUid}>
                {(uid) => <UserAvatar uid={uid()} class="h-full w-full" />}
              </Show>
            }
          >
            {(d) => (
              <span
                class={
                  props.small ? "text-sm sm:text-base" : "text-lg sm:text-2xl"
                }
              >
                {d()}
              </span>
            )}
          </Show>
        </div>
        <Show when={props.car.sticker}>
          {(s) => (
            <span class="absolute top-[52%] left-[48%] text-xs sm:text-sm">
              {s()}
            </span>
          )}
        </Show>
        <Show when={props.car.airborne === true}>
          <div class="absolute -bottom-3 left-1/2 h-2 w-3/4 -translate-x-1/2 rounded-full bg-game-ink/30"></div>
        </Show>
      </div>
      {/* name tag */}
      <span
        class={cn(
          "absolute bottom-[88%] left-[40%] -translate-x-1/2 rounded-full px-2 text-[0.65rem] font-bold whitespace-nowrap sm:text-xs",
          props.car.me === true
            ? "bg-game-blue text-game-cream"
            : "bg-game-cream/90 text-game-ink",
        )}
      >
        {props.car.place !== undefined
          ? `${placeName(props.car.place)} · `
          : ""}
        {props.car.me === true ? "YOU" : props.car.name}
        {props.car.pits === true ? " 🔧" : ""}
      </span>
    </div>
  );
}

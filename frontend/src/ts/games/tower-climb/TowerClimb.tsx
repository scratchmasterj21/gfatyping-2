import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { Mascot, MascotMood } from "../../components/common/Mascot";
import { cn } from "../../utils/cn";
import { shuffled, useCountdown } from "../mini/mini-game-utils";
import { sfx } from "../mini/mini-sounds";
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TimeBar } from "../mini/TimeBar";
import {
  CRACKS_TO_SLIDE,
  initialTower,
  TowerDifficulty,
  towerOnTypo,
  towerOnWord,
  towerScore,
  towerStars,
  TowerState,
} from "./tower-rules";
import { TowerBlock } from "./TowerBlock";
import { TowerSky } from "./TowerSky";

/** Ground top, measured from the bottom of the scene (room for the input). */
const BASE = 124;
/** One floor: block height (44) + ledge (6). */
const STEP = 50;
const TAPPY = 64;
/** Space the HUD takes at the top of the scene. */
const HUD = 236;

const sideOffset = (floor: number): number =>
  floor === 0 ? 0 : floor % 2 === 0 ? -10 : 10;
const blockBottom = (floor: number): number => BASE + (floor - 1) * STEP;

const SPARKLES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { dx: `${Math.cos(a) * 56}px`, dy: `${Math.sin(a) * 56}px` };
});

/** Tappy climbs a candy keycap tower: each correct word is one block up. */
export function TowerClimb(p: MiniGamePlayProps<TowerDifficulty>): JSXElement {
  const settings = untrack(() => p.difficulty);
  const pool = shuffled(
    untrack(() => (p.words.length > 0 ? p.words : ["tap", "key", "jump"])),
  );
  let cursor = 0;
  const nextWord = (): string => {
    const w = pool[cursor % pool.length] as string;
    cursor++;
    return w;
  };

  const [state, setState] = createSignal<TowerState>(initialTower());
  // live score for the multiplayer scoreboard
  createEffect(() => p.onScore?.(towerScore(state())));
  const [word, setWord] = createSignal(nextWord());
  const [typed, setTyped] = createSignal("");
  const [wordClean, setWordClean] = createSignal(true);
  const [wrong, setWrong] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  let finished = false;

  // visual-only state
  const [viewH, setViewH] = createSignal(480);
  const [hop, setHop] = createSignal(0);
  const [sparkle, setSparkle] = createSignal(0);
  const [shake, setShake] = createSignal(0);
  const [pop, setPop] = createSignal<{ id: number; text: string } | null>(null);
  const [fallen, setFallen] = createSignal<{ id: number; floors: number[] }>({
    id: 0,
    floors: [],
  });
  const [mood, setMood] = createSignal<MascotMood | null>(null);
  let placedFrom = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let sceneEl: HTMLDivElement | undefined;

  onCleanup(() => timers.forEach(clearTimeout));

  const flash = (text: string): void => {
    setMessage(text);
    timers.push(setTimeout(() => setMessage(null), 1100));
  };
  const briefMood = (m: MascotMood): void => {
    setMood(m);
    timers.push(setTimeout(() => setMood(null), 900));
  };

  onMount(() => {
    if (sceneEl === undefined) return;
    const el = sceneEl;
    setViewH(el.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  const end = (): void => {
    if (finished) return;
    finished = true;
    const s = state();
    p.onFinish({
      score: towerScore(s),
      wave: Math.max(1, s.highest),
      headline: s.highest >= 20 ? "Sky high!" : "Nice climb!",
      stars: towerStars(s.highest, settings.seconds),
      stats: [
        { label: "highest floor", value: String(s.highest) },
        { label: "words", value: String(s.words) },
        { label: "double jumps", value: String(s.doubleJumps) },
        { label: "typos", value: String(s.typos) },
      ],
    });
  };

  const timer = useCountdown(settings.seconds, end);

  const onInput = (value: string): void => {
    const target = word();
    if (target.startsWith(value)) {
      setWrong(false);
      setTyped(value);
      if (value === target) {
        const before = state();
        const after = towerOnWord(before, wordClean());
        placedFrom = before.floor;
        setState(after);
        const jumped = after.floor - before.floor;
        setHop((n) => n + 1);
        setPop({ id: hop(), text: `+${jumped}` });
        if (jumped === 2) {
          flash("Double jump!");
          setSparkle((n) => n + 1);
          briefMood("cheer");
          sfx.great();
        } else {
          sfx.good();
        }
        setWord(nextWord());
        setTyped("");
        setWordClean(true);
      }
      return;
    }
    // typo: crack once per word, keep the correct part typed
    setWrong(true);
    if (wordClean()) {
      setWordClean(false);
      const before = state();
      const r = towerOnTypo(before, settings.slideFloors);
      setState(r.state);
      if (r.slid) {
        flash("Whoops - Tappy slid down!");
        const floors: number[] = [];
        for (let f = r.state.floor + 1; f <= before.floor; f++) floors.push(f);
        setFallen((x) => ({ id: x.id + 1, floors }));
        timers.push(
          setTimeout(() => setFallen((x) => ({ ...x, floors: [] })), 900),
        );
        setShake((n) => n + 1);
        briefMood("sad");
        sfx.bad();
      } else {
        sfx.oops();
      }
    }
  };

  const tappyBottom = (): number => BASE + state().floor * STEP;
  const floatBottom = (): number => tappyBottom() + TAPPY + 26;
  const camera = createMemo((): number =>
    Math.max(0, floatBottom() + STEP - Math.max(BASE + 200, viewH() - HUD)),
  );
  const builtFloors = createMemo((): number[] => {
    const top = state().floor;
    const list: number[] = [];
    for (let f = Math.max(1, top - 16); f <= top; f++) list.push(f);
    return list;
  });
  const tappyMood = (): MascotMood =>
    mood() ?? (wrong() ? "thinking" : "happy");

  return (
    <div class="relative h-full overflow-hidden font-kid">
      <TowerSky floor={state().floor} camera={camera()} />

      {/* the world: ground + tower, scrolled by the camera */}
      <div
        ref={(el) => {
          sceneEl = el;
        }}
        class="absolute inset-0"
        aria-hidden="true"
      >
        <For each={[shake()]}>
          {() => (
            <div
              class={cn(
                "absolute inset-0",
                shake() > 0 && "animate-game-shake motion-reduce:animate-none",
              )}
            >
              <div
                class="absolute inset-x-0 bottom-0 h-full transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `translateY(${camera()}px)` }}
              >
                <Ground />

                <Show when={state().highest > state().floor}>
                  <div
                    class="absolute inset-x-4 border-t-4 border-dashed border-game-gold transition-[bottom] duration-500"
                    style={{ bottom: `${blockBottom(state().highest) + 44}px` }}
                  >
                    <span class="absolute -top-4 right-0 rounded-full bg-game-gold px-2.5 py-0.5 text-xs font-bold text-game-ink">
                      best {state().highest}
                    </span>
                  </div>
                </Show>

                <For each={builtFloors()}>
                  {(f) => {
                    const drop = f > untrack(() => placedFrom);
                    return (
                      <div
                        class="absolute left-1/2"
                        style={{
                          bottom: `${blockBottom(f)}px`,
                          transform: `translateX(calc(-50% + ${sideOffset(f)}px))`,
                        }}
                      >
                        <TowerBlock
                          floor={f}
                          cracks={f === state().floor ? state().cracks : 0}
                          class={
                            drop
                              ? "animate-game-drop motion-reduce:animate-none"
                              : undefined
                          }
                        />
                        <Show when={f % 10 === 0}>
                          <MilestoneFlag floor={f} />
                        </Show>
                      </div>
                    );
                  }}
                </For>

                <For each={[fallen().id]}>
                  {() => (
                    <For each={fallen().floors}>
                      {(f) => (
                        <div
                          class="absolute left-1/2"
                          style={{
                            bottom: `${blockBottom(f)}px`,
                            transform: `translateX(calc(-50% + ${sideOffset(f)}px))`,
                          }}
                        >
                          <div
                            class="animate-game-fall motion-reduce:hidden"
                            style={{
                              "--spin": f % 2 === 0 ? "-30deg" : "30deg",
                            }}
                          >
                            <TowerBlock floor={f} cracks={3} />
                          </div>
                        </div>
                      )}
                    </For>
                  )}
                </For>

                {/* Tappy */}
                <div
                  class="absolute left-1/2 transition-[bottom,transform] duration-300 ease-out motion-reduce:transition-none"
                  style={{
                    bottom: `${tappyBottom() - 4}px`,
                    transform: `translateX(calc(-50% + ${sideOffset(state().floor)}px))`,
                  }}
                >
                  <For each={[hop()]}>
                    {() => (
                      <div
                        class={cn(
                          "origin-bottom",
                          hop() > 0 &&
                            "animate-game-hop motion-reduce:animate-none",
                        )}
                      >
                        <Mascot mood={tappyMood()} size={TAPPY} />
                      </div>
                    )}
                  </For>
                  <For each={[sparkle()]}>
                    {() => (
                      <Show when={sparkle() > 0}>
                        <For each={SPARKLES}>
                          {(s) => (
                            <span
                              class="absolute top-1/2 left-1/2 block h-3 w-3 rotate-45 animate-game-sparkle rounded-sm bg-game-gold motion-reduce:hidden"
                              style={{ "--dx": s.dx, "--dy": s.dy }}
                            ></span>
                          )}
                        </For>
                      </Show>
                    )}
                  </For>
                  <Show when={pop()} keyed>
                    {(x) => (
                      <span class="absolute -top-2 left-full block animate-game-float-up text-2xl font-bold text-game-cloud [text-shadow:0_2px_0_rgb(43_33_64/0.5)] motion-reduce:hidden">
                        {x.text}
                      </span>
                    )}
                  </Show>
                </div>

                {/* the next block, floating above Tappy */}
                <div
                  class="absolute left-1/2 -translate-x-1/2 transition-[bottom] duration-300 ease-out motion-reduce:transition-none"
                  style={{ bottom: `${floatBottom()}px` }}
                >
                  <div class="animate-game-bob motion-reduce:animate-none">
                    <TowerBlock
                      floor={state().floor + 1}
                      class={cn(
                        "outline-4 outline-offset-2 outline-game-cloud/70",
                        wrong() && "outline-game-red",
                      )}
                    >
                      <span class="rounded-lg bg-game-cream px-3 py-0.5 font-mono text-xl font-bold text-game-ink">
                        <span class="text-game-blue">{typed()}</span>
                        {word().slice(typed().length)}
                      </span>
                    </TowerBlock>
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* HUD + input on top of the scene */}
      <div class="pointer-events-none relative z-[1] flex h-full flex-col gap-3 p-4 pt-16">
        <TimeBar remaining={timer.remaining()} total={settings.seconds} />
        <div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-game-ink">
          <span class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]">
            <Fa icon="fa-building" class="mr-1.5 text-game-purple" />
            Floor {state().floor}
          </span>
          <span class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]">
            <Fa icon="fa-fire" class="mr-1.5 text-game-orange" />
            Streak {state().streak}
          </span>
          <span
            class="flex items-center gap-1 rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]"
            aria-label={`${state().cracks} of ${CRACKS_TO_SLIDE} cracks`}
          >
            Cracks
            <For each={Array.from({ length: CRACKS_TO_SLIDE }, (_, i) => i)}>
              {(i) => (
                <span
                  class={cn(
                    "h-2.5 w-2.5 rounded-full",
                    i < state().cracks ? "bg-game-red" : "bg-game-ink/15",
                  )}
                ></span>
              )}
            </For>
          </span>
        </div>
        <div class="flex justify-center" aria-live="polite" role="status">
          <Show when={message()} keyed>
            {(m) => (
              <div class="animate-game-pop rounded-full bg-game-yellow px-5 py-1.5 text-lg font-bold text-game-ink shadow-[0_4px_0_rgb(43_33_64/0.25)] motion-reduce:animate-none">
                {m}
              </div>
            )}
          </Show>
        </div>
        <div class="flex-1"></div>
        <div class="flex justify-center">
          <MiniTypingInput
            value={typed()}
            onInput={onInput}
            wrong={wrong()}
            placeholder={word()}
          />
        </div>
      </div>
    </div>
  );
}

/** Grassy hill the tower stands on, with a START sign. */
function Ground(): JSXElement {
  return (
    <div
      class="absolute inset-x-0 bottom-0"
      style={{ height: `${BASE + 30}px` }}
    >
      <svg
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        class="absolute inset-0 h-full w-full"
      >
        <path
          d="M0 40 Q100 10 200 30 T400 25 V140 H0 Z"
          fill="var(--color-game-grass-dark)"
        ></path>
        <path
          d="M0 50 Q120 24 220 42 T400 38 V140 H0 Z"
          fill="var(--color-game-grass)"
        ></path>
      </svg>
      <div class="absolute bottom-[54px] left-[12%] flex gap-6">
        <Flower color="var(--color-game-pink)" />
        <Flower color="var(--color-game-yellow)" />
      </div>
      <div class="absolute right-[10%] bottom-[54px]">
        <Flower color="var(--color-game-purple)" />
      </div>
      <div class="absolute bottom-[58px] left-[calc(50%-150px)] grid justify-items-center xs:left-[calc(50%-190px)]">
        <span class="rounded-md bg-game-orange px-2 py-0.5 text-xs font-bold text-game-cream shadow-[0_3px_0_rgb(43_33_64/0.3)]">
          START
        </span>
        <span class="h-5 w-1.5 bg-game-ink/60"></span>
      </div>
    </div>
  );
}

function Flower(props: { color: string }): JSXElement {
  return (
    <svg viewBox="0 0 20 28" width="20" height="28">
      <path
        d="M10 12 V28"
        stroke="var(--color-game-grass-dark)"
        stroke-width="2.5"
      ></path>
      <g fill={props.color}>
        <circle cx="10" cy="4" r="4"></circle>
        <circle cx="4" cy="9" r="4"></circle>
        <circle cx="16" cy="9" r="4"></circle>
        <circle cx="10" cy="14" r="4"></circle>
      </g>
      <circle cx="10" cy="9" r="3" fill="var(--color-game-yellow)"></circle>
    </svg>
  );
}

/** Waving flag planted on every 10th floor. */
function MilestoneFlag(props: { floor: number }): JSXElement {
  return (
    <div class="absolute bottom-1 left-full ml-2 flex items-start">
      <span class="h-14 w-1.5 rounded-full bg-game-ink/70"></span>
      <span class="mt-0.5 origin-left animate-game-wave rounded-r-md bg-game-red px-2 py-1 text-xs font-bold text-game-cream motion-reduce:animate-none">
        {props.floor}
      </span>
    </div>
  );
}

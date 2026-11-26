import {
  createEffect,
  createSignal,
  For,
  Index,
  JSXElement,
  Match,
  onCleanup,
  Show,
  Switch,
  untrack,
} from "solid-js";

import { Fa } from "../../components/common/Fa";
import { FaSolidIcon } from "../../types/font-awesome";
import { cn } from "../../utils/cn";
import { useCountdown } from "../mini/mini-game-utils";
import { sfx } from "../mini/mini-sounds";
import { MiniGamePlayProps } from "../mini/MiniGameShell";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TimeBar } from "../mini/TimeBar";
import { ZooDiet, ZooHabitat, ZOO_INFO, ZooSpecies } from "./zoo-animals";
import {
  initialZooShift,
  isStreak,
  nextGap,
  nextHappiness,
  pickNeedWord,
  pickZooSpecies,
  ZooDifficulty,
  ZOO_NEEDS,
  ZooNeed,
  zooOnCare,
  zooOnMiss,
  ZooShiftState,
  zooStars,
} from "./zoo-shift-rules";
import { ZooAction, ZooAnimal, ZooMood } from "./ZooAnimal";

type Request = { id: number; need: ZooNeed; word: string; startedAt: number };

type Pen = {
  species: ZooSpecies;
  happiness: number;
  request?: Request;
  lastNeed?: ZooNeed;
  action?: ZooAction;
  actionUntil?: number;
  sadUntil?: number;
};

const ACTION_FOR: Record<ZooNeed, ZooAction> = {
  food: "eat",
  water: "drink",
  bath: "wash",
  nap: "sleep",
  vet: "heal",
  play: "play",
};

const FOOD_ICON: Record<ZooDiet, FaSolidIcon> = {
  veg: "fa-carrot",
  seed: "fa-seedling",
  fruit: "fa-apple-alt",
  leaf: "fa-leaf",
  meat: "fa-drumstick-bite",
  fish: "fa-fish",
};

const NEED_ICON: Record<Exclude<ZooNeed, "food">, FaSolidIcon> = {
  water: "fa-tint",
  bath: "fa-soap",
  nap: "fa-bed",
  vet: "fa-band-aid",
  play: "fa-futbol",
};

const GROUND: Record<ZooHabitat, string> = {
  grass: "bg-game-grass",
  farm: "bg-game-tan",
  jungle: "bg-game-frog",
  savanna: "bg-game-sunset",
  ice: "bg-game-mint",
};

const ACTION_MS = 1700;
const SAD_MS = 2600;
const TICK_MS = 200;

const needIcon = (species: ZooSpecies, need: ZooNeed): FaSolidIcon =>
  need === "food" ? FOOD_ICON[ZOO_INFO[species].diet] : NEED_ICON[need];

/** Look after the zoo animals by typing what each one needs. */
export function ZooShift(p: MiniGamePlayProps<ZooDifficulty>): JSXElement {
  const settings = untrack(() => p.difficulty);
  const start = Date.now();

  const [pens, setPens] = createSignal<Pen[]>(
    pickZooSpecies(settings.pens, Math.random).map((species) => ({
      species,
      happiness: 70,
    })),
  );
  const [state, setState] = createSignal<ZooShiftState>(initialZooShift());
  createEffect(() => p.onScore?.(state().score));
  const [now, setNow] = createSignal(start);
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  const [pops, setPops] = createSignal<
    { id: number; pen: number; text: string }[]
  >([]);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let nextId = 0;
  let nextSpawnAt = start + 1200;
  let finished = false;

  const flash = (text: string): void => {
    setMessage(text);
    timers.push(setTimeout(() => setMessage(null), 1400));
  };

  const updatePen = (i: number, fn: (pen: Pen) => Pen): void => {
    setPens((list) => list.map((pen, j) => (j === i ? fn(pen) : pen)));
  };

  const end = (): void => {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    const s = state();
    p.onFinish({
      score: s.score,
      wave: Math.max(1, s.cared),
      headline: s.cared >= 12 ? "Super zookeeper!" : "The zoo is closed!",
      stars: zooStars(s.cared),
      stats: [
        { label: "animals helped", value: String(s.cared) },
        { label: "best streak", value: String(s.bestStreak) },
        { label: "missed", value: String(s.missed) },
        { label: "points", value: String(s.score) },
      ],
    });
  };

  const timer = useCountdown(settings.seconds, end);

  const spawn = (t: number): void => {
    const list = pens();
    const active = list.filter((pen) => pen.request !== undefined).length;
    if (active >= settings.maxActive || t < nextSpawnAt) return;
    const free = list
      .map((pen, i) => ({ pen, i }))
      .filter(
        ({ pen }) =>
          pen.request === undefined &&
          (pen.actionUntil ?? 0) <= t &&
          (pen.sadUntil ?? 0) <= t,
      );
    if (free.length === 0) return;
    const taken = new Set(
      list.flatMap((pen) =>
        pen.request === undefined ? [] : [pen.request.word.charAt(0)],
      ),
    );
    const choice = free[Math.floor(Math.random() * free.length)];
    if (choice === undefined) return;
    const needs = [...ZOO_NEEDS]
      .filter((n) => n !== choice.pen.lastNeed)
      .sort(() => Math.random() - 0.5);
    for (const need of needs) {
      const word = pickNeedWord(
        choice.pen.species,
        need,
        settings.level,
        taken,
        Math.random,
      );
      if (word === undefined) continue;
      updatePen(choice.i, (pen) => ({
        ...pen,
        request: { id: nextId++, need, word, startedAt: t },
        lastNeed: need,
      }));
      break;
    }
    const progress = (t - start) / (settings.seconds * 1000);
    nextSpawnAt = t + nextGap(settings.gap, progress, Math.random) * 1000;
  };

  const tick = setInterval(() => {
    if (finished) return;
    const t = Date.now();
    setNow(t);
    pens().forEach((pen, i) => {
      if (pen.action !== undefined && (pen.actionUntil ?? 0) <= t) {
        updatePen(i, (x) => ({ ...x, action: undefined }));
      }
      const r = pen.request;
      if (r === undefined) return;
      if (t - r.startedAt < settings.patience * 1000) return;
      setState(zooOnMiss(state()));
      if (typed() !== "" && r.word.startsWith(typed())) setTyped("");
      updatePen(i, (x) => ({
        ...x,
        request: undefined,
        happiness: nextHappiness(x.happiness, false),
        sadUntil: t + SAD_MS,
      }));
      flash(
        `The ${ZOO_INFO[pen.species].name.toLowerCase()} is sad. Try the next one!`,
      );
      sfx.bad();
    });
    spawn(t);
  }, TICK_MS);
  onCleanup(() => {
    clearInterval(tick);
    timers.forEach(clearTimeout);
    timer.stop();
  });

  const patienceLeft = (r: Request): number =>
    Math.max(0, 1 - (now() - r.startedAt) / (settings.patience * 1000));

  const patienceOf = (pen: Pen): number =>
    pen.request === undefined ? 0 : patienceLeft(pen.request);

  const onInput = (value: string): void => {
    if (value === "") {
      setTyped("");
      setWrong(false);
      return;
    }
    const list = pens();
    const i = list.findIndex(
      (pen) => pen.request?.word.startsWith(value) === true,
    );
    const pen = list[i];
    const r = pen?.request;
    if (pen === undefined || r === undefined) {
      if (!wrong()) sfx.oops();
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value !== r.word) return;

    const t = Date.now();
    const before = state();
    const after = zooOnCare(before, r.word, patienceLeft(r));
    setState(after);
    updatePen(i, (x) => ({
      ...x,
      request: undefined,
      happiness: nextHappiness(x.happiness, true),
      action: ACTION_FOR[r.need],
      actionUntil: t + ACTION_MS,
      sadUntil: undefined,
    }));
    const pop = {
      id: nextId++,
      pen: i,
      text: `+${after.score - before.score}`,
    };
    setPops((x) => [...x, pop]);
    timers.push(
      setTimeout(() => setPops((x) => x.filter((y) => y.id !== pop.id)), 900),
    );
    if (!isStreak(before) && isStreak(after)) {
      flash("Happy streak! x2");
      sfx.great();
    } else {
      sfx.good();
    }
    setTyped("");
  };

  const target = (): number =>
    typed() === ""
      ? -1
      : pens().findIndex(
          (pen) => pen.request?.word.startsWith(typed()) === true,
        );

  const zooHappiness = (): number => {
    const list = pens();
    return Math.round(
      list.reduce((sum, pen) => sum + pen.happiness, 0) /
        Math.max(1, list.length),
    );
  };

  const moodOf = (pen: Pen): ZooMood => {
    if (pen.action !== undefined) return "happy";
    if ((pen.sadUntil ?? 0) > now()) return "sad";
    const r = pen.request;
    if (r === undefined) return "happy";
    if (r.need === "nap") return "sleepy";
    return patienceLeft(r) < 0.35 || r.need === "vet" ? "sad" : "waiting";
  };

  const urgent = (): string => {
    const asks = pens().flatMap((pen) =>
      pen.request === undefined ? [] : [pen.request],
    );
    asks.sort((a, b) => a.startedAt - b.startedAt);
    return asks[0]?.word ?? "wait for an animal…";
  };

  const cols = (): string =>
    settings.pens === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : settings.pens <= 3
        ? "grid-cols-3"
        : "grid-cols-3";

  return (
    <div class="relative flex h-full flex-col gap-2 overflow-hidden bg-game-grass-dark p-3 pt-14 font-kid sm:p-4 sm:pt-16">
      {/* path */}
      <div
        class="absolute inset-x-0 bottom-0 h-28 bg-game-tan/70"
        aria-hidden="true"
      ></div>

      {/* HUD */}
      <div class="relative z-[1] grid gap-2">
        <TimeBar remaining={timer.remaining()} total={settings.seconds} />
        <div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-game-ink">
          <span class="rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]">
            <Fa icon="fa-star" class="mr-1.5 text-game-gold" />
            {state().score} pts
          </span>
          <span
            class={cn(
              "rounded-full px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]",
              isStreak(state())
                ? "animate-game-pulse bg-game-orange text-game-cream motion-reduce:animate-none"
                : "bg-game-cream",
            )}
          >
            <Fa icon="fa-bolt" class="mr-1.5" />
            {isStreak(state()) ? "Happy streak x2" : `Streak ${state().streak}`}
          </span>
          <span
            class="flex items-center gap-1.5 rounded-full bg-game-cream px-3 py-1 shadow-[0_3px_0_rgb(43_33_64/0.2)]"
            aria-label={`zoo happiness ${zooHappiness()} percent`}
          >
            <Fa icon="fa-heart" class="text-game-pink" />
            <span class="block h-2.5 w-16 overflow-hidden rounded-full bg-game-ink/10">
              <span
                class="block h-full rounded-full bg-game-pink transition-[width] duration-500"
                style={{ width: `${zooHappiness()}%` }}
              ></span>
            </span>
          </span>
        </div>
        <div
          class="flex min-h-9 justify-center"
          aria-live="polite"
          role="status"
        >
          <Show when={message()} keyed>
            {(m) => (
              <div class="animate-game-pop rounded-full bg-game-yellow px-4 py-1 text-base font-bold text-game-ink shadow-[0_4px_0_rgb(43_33_64/0.25)] motion-reduce:animate-none">
                {m}
              </div>
            )}
          </Show>
        </div>
      </div>

      {/* pens */}
      <div
        class={cn(
          "relative z-[1] grid min-h-0 flex-1 auto-rows-fr gap-2 sm:gap-3",
          cols(),
        )}
      >
        {/* Index, not For: pens are replaced on every change, and For would
            remount the animal (restarting its walk) each time */}
        <Index each={pens()}>
          {(pen, i) => (
            <PenView
              pen={pen()}
              index={i}
              mood={moodOf(pen())}
              targeted={target() === i}
              typed={target() === i ? typed() : ""}
              wrong={wrong()}
              patience={patienceOf(pen())}
              pops={pops().filter((x) => x.pen === i)}
            />
          )}
        </Index>
      </div>

      {/* input */}
      <div class="relative z-[1] flex justify-center pb-1">
        <MiniTypingInput
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          placeholder={urgent()}
        />
      </div>
    </div>
  );
}

function PenView(props: {
  pen: Pen;
  index: number;
  mood: ZooMood;
  targeted: boolean;
  typed: string;
  wrong: boolean;
  patience: number;
  pops: { id: number; text: string }[];
}): JSXElement {
  const info = (): (typeof ZOO_INFO)[ZooSpecies] => ZOO_INFO[props.pen.species];
  const r = (): Request | undefined => props.pen.request;
  const walking = (): boolean =>
    r() === undefined &&
    props.pen.action === undefined &&
    props.mood === "happy";

  return (
    <div
      class={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-4 border-game-brown shadow-[0_5px_0_var(--color-game-brown-dark)] transition-transform",
        GROUND[info().habitat],
        props.targeted && "scale-[1.03] border-game-yellow",
      )}
    >
      {/* fence */}
      <div
        class="h-3 shrink-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, var(--color-game-brown) 0 6px, transparent 6px 22px)",
        }}
        aria-hidden="true"
      ></div>

      {/* request bubble */}
      <div class="flex min-h-16 shrink-0 justify-center px-1.5 pt-1">
        <Show when={r()} keyed>
          {(req) => (
            <div class="relative w-full max-w-60 animate-game-pop rounded-xl bg-game-cloud px-2 py-1.5 text-center shadow-[0_4px_0_rgb(43_33_64/0.18)] motion-reduce:animate-none">
              <div class="flex items-center justify-center gap-1.5 text-xs font-bold text-game-ink/60">
                <Fa icon={needIcon(props.pen.species, req.need)} />
                {info().name}
              </div>
              <div
                class={cn(
                  "font-mono text-lg leading-tight font-bold break-words text-game-ink sm:text-xl",
                  props.targeted &&
                    props.wrong &&
                    "animate-game-shake motion-reduce:animate-none",
                )}
              >
                <span class="text-game-green">{props.typed}</span>
                {req.word.slice(props.typed.length)}
              </div>
              <div
                class="mx-auto mt-1 h-2 w-4/5 overflow-hidden rounded-full bg-game-ink/10"
                role="progressbar"
                aria-label="patience"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(props.patience * 100)}
              >
                <div
                  class={cn(
                    "h-full rounded-full transition-[width] duration-200 ease-linear",
                    props.patience > 0.6
                      ? "bg-game-green"
                      : props.patience > 0.3
                        ? "bg-game-yellow"
                        : "bg-game-red",
                  )}
                  style={{ width: `${props.patience * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* animal */}
      <div class="relative flex min-h-0 flex-1 items-end justify-center px-2 pb-1">
        <PenScenery habitat={info().habitat} />
        <div
          class={cn(
            "relative flex h-full max-h-64 w-full max-w-72 items-end justify-center",
            walking() && "animate-zoo-pace motion-reduce:animate-none",
          )}
          style={{ "animation-delay": `${-props.index * 2.3}s` }}
        >
          <ZooAnimal
            species={props.pen.species}
            mood={props.mood}
            action={props.pen.action}
            dirty={r()?.need === "bath"}
            walking={walking()}
            class="h-full max-h-full w-auto max-w-full"
          />
        </div>
        <For each={props.pops}>
          {(x) => (
            <span
              class="pointer-events-none absolute top-0 left-1/2 block -translate-x-1/2 animate-game-float-up text-2xl font-bold text-game-orange [text-shadow:0_2px_0_rgb(43_33_64/0.35)] motion-reduce:hidden"
              aria-hidden="true"
            >
              {x.text}
            </span>
          )}
        </For>
        <Show when={props.pen.action !== undefined}>
          <span
            class="pointer-events-none absolute top-2 right-3 block animate-game-float-up text-xl text-game-pink motion-reduce:hidden"
            aria-hidden="true"
          >
            <Fa icon="fa-heart" />
          </span>
        </Show>
      </div>

      {/* sign */}
      <div class="flex shrink-0 items-center justify-center gap-1.5 bg-game-brown px-2 py-0.5 text-xs font-bold text-game-cream">
        {info().name}
        <span class="block h-1.5 w-10 overflow-hidden rounded-full bg-game-brown-dark">
          <span
            class="block h-full rounded-full bg-game-pink transition-[width] duration-500"
            style={{ width: `${props.pen.happiness}%` }}
          ></span>
        </span>
      </div>
    </div>
  );
}

/** A little scenery behind the animal, by habitat. */
function PenScenery(props: { habitat: ZooHabitat }): JSXElement {
  const c = (name: string): string => `var(--color-game-${name})`;
  return (
    <svg
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMax meet"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full"
      aria-hidden="true"
    >
      <Switch>
        <Match when={props.habitat === "grass"}>
          <circle cx="22" cy="104" r="16" fill={c("grass-dark")}></circle>
          <circle cx="40" cy="108" r="12" fill={c("grass-dark")}></circle>
          <circle cx="180" cy="106" r="14" fill={c("grass-dark")}></circle>
          <circle cx="160" cy="112" r="3" fill={c("yellow")}></circle>
          <circle cx="60" cy="114" r="3" fill={c("pink")}></circle>
        </Match>
        <Match when={props.habitat === "farm"}>
          <rect
            x="6"
            y="84"
            width="40"
            height="30"
            rx="5"
            fill={c("gold")}
          ></rect>
          <path
            d="M6 94 h40 M6 104 h40"
            stroke={c("brown")}
            stroke-width="2"
          ></path>
          <path
            d="M150 114 v-26 M196 114 v-26 M146 94 h54 M146 106 h54"
            stroke={c("cream")}
            stroke-width="4"
            stroke-linecap="round"
          ></path>
        </Match>
        <Match when={props.habitat === "jungle"}>
          <ellipse
            cx="14"
            cy="30"
            rx="34"
            ry="12"
            fill={c("grass-dark")}
            transform="rotate(30 14 30)"
          ></ellipse>
          <ellipse
            cx="188"
            cy="40"
            rx="34"
            ry="12"
            fill={c("grass-dark")}
            transform="rotate(-35 188 40)"
          ></ellipse>
          <path
            d="M176 0 q-8 30 4 60"
            fill="none"
            stroke={c("grass-dark")}
            stroke-width="3"
          ></path>
        </Match>
        <Match when={props.habitat === "savanna"}>
          <path
            d="M28 116 v-46"
            stroke={c("brown-dark")}
            stroke-width="6"
          ></path>
          <ellipse
            cx="28"
            cy="66"
            rx="30"
            ry="10"
            fill={c("grass-dark")}
          ></ellipse>
          <ellipse cx="176" cy="114" rx="20" ry="6" fill={c("tan")}></ellipse>
        </Match>
        <Match when={props.habitat === "ice"}>
          <ellipse cx="160" cy="110" rx="36" ry="9" fill={c("sky")}></ellipse>
          <path d="M8 116 l10 -24 h18 l8 24 z" fill={c("cloud")}></path>
        </Match>
      </Switch>
    </svg>
  );
}

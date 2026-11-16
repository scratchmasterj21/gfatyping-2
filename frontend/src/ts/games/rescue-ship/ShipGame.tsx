import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  on,
  Show,
} from "solid-js";

import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { ASTEROID_ART, PET_ART, SHIP_ART } from "./ship-art";
import {
  PART_INFO,
  RUN_MS,
  ShipEvent,
  ShipSetup,
  ShipView,
  START_HP,
  Station,
  STATION_INFO,
  Task,
  ZONES,
} from "./ship-rules";

type Popup = { id: number; text: string; tone: "good" | "bad" | "pet" };

const normalize = (raw: string): string =>
  raw.toLowerCase().replace(/\s+/g, " ").replace(/^ /, "");

const ZONE_TINT: Record<string, string> = {
  "Asteroid Field": "from-game-night via-game-navy to-game-night",
  "Meteor Storm": "from-game-night via-game-dusk to-game-sunset",
  "Space Goo Cloud": "from-game-night via-game-navy to-game-frog",
  "Rescue Station": "from-game-navy via-game-sky-top to-game-sky",
};

/** Fixed star field (same every game). */
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 1 + (i % 3),
  delay: (i % 7) * 0.3,
}));

/**
 * The ship screen: the space view, the ship's health / shield / pets, the
 * crew panel and my station's words to type.
 */
export function ShipGame(props: {
  setup: ShipSetup;
  view: ShipView;
  myUid: string;
  now: number;
  startAt: number;
  /** all-hands tasks I've already typed */
  myHands: Set<string>;
  onDone: (task: Task) => void;
  onHands: (task: Task) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [sent, setSent] = createSignal<Set<string>>(new Set());
  const [popups, setPopups] = createSignal<Popup[]>([]);
  const [shake, setShake] = createSignal(false);
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  const bumpShip = (): void => {
    setShake(false);
    clearTimeout(shakeTimer);
    requestAnimationFrame(() => setShake(true));
    shakeTimer = setTimeout(() => setShake(false), 450);
  };
  let popupId = 0;
  let inputEl: HTMLInputElement | undefined;

  const me = createMemo(() =>
    props.setup.crew.find((c) => c.uid === props.myUid),
  );
  const myStation = (): Station | undefined => me()?.station;
  const t = (): number => props.view.t;
  const counting = (): boolean => props.now < props.startAt;

  const myTasks = createMemo(() =>
    props.view.open.filter(
      (task) => task.station === myStation() && !sent().has(task.id),
    ),
  );
  /** all-hands calls still waiting for me */
  const myCalls = createMemo(() =>
    props.view.open.filter(
      (task) =>
        task.kind === "hands" &&
        !props.myHands.has(task.id) &&
        !sent().has(task.id) &&
        myStation() !== undefined &&
        !props.view.away.has(myStation() as Station),
    ),
  );
  const candidates = (): Task[] => [...myCalls(), ...myTasks()];

  // the task I was typing went away: clear the box
  createEffect(
    on(candidates, (list) => {
      const value = normalize(typed());
      if (value !== "" && !list.some((task) => task.word.startsWith(value))) {
        clearInput();
      }
    }),
  );

  const popup = (text: string, tone: Popup["tone"]): void => {
    const id = ++popupId;
    setPopups((p) => [...p.slice(-4), { id, text, tone }]);
    setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 1400);
  };

  const clearInput = (): void => {
    setTyped("");
    setWrong(false);
    if (inputEl !== undefined) inputEl.value = "";
  };

  const onInput = (raw: string): void => {
    if (counting() || props.view.over) {
      clearInput();
      return;
    }
    const value = normalize(raw);
    const hit = candidates().find((task) => task.word === value);
    if (hit !== undefined) {
      setSent((s) => new Set([...s, hit.id]));
      clearInput();
      sfx.good();
      if (hit.kind === "hands") props.onHands(hit);
      else props.onDone(hit);
      return;
    }
    const ok = candidates().some((task) => task.word.startsWith(value));
    if (!ok && !wrong()) sfx.oops();
    setWrong(!ok);
    setTyped(raw);
  };

  // react to what just happened on the ship
  const describe = (e: ShipEvent): [string, Popup["tone"]] | null => {
    switch (e.kind) {
      case "dodge":
        return ["✨ Dodged!", "good"];
      case "block":
        return ["🛡️ Shield blocked it!", "good"];
      case "bump":
        return ["💥 Bump! -1 ❤️", "bad"];
      case "leak":
        return ["💨 Air leak! -1 ❤️", "bad"];
      case "break":
        return ["⚠️ Something broke!", "bad"];
      case "fix":
        return ["🔧 Fixed!", "good"];
      case "rescue":
        return ["🐾 Pet rescued!", "pet"];
      case "petLost":
        return ["😢 A pet floated away", "bad"];
      case "handsMiss":
        return ["🚨 Crew call missed!", "bad"];
      case "dock":
        return ["🏠 Docked! +3 pets", "pet"];
      default:
        return null;
    }
  };
  createEffect(
    on(
      () => props.view.events.length,
      (n, prev) => {
        if (prev === undefined || n <= prev) return;
        for (const e of props.view.events.slice(prev)) {
          const d = describe(e);
          if (d === null) continue;
          popup(d[0], d[1]);
          if (
            e.kind === "bump" ||
            e.kind === "leak" ||
            e.kind === "handsMiss"
          ) {
            bumpShip();
            sfx.bad();
          } else if (e.kind === "rescue" || e.kind === "dock") {
            sfx.great();
          }
        }
      },
    ),
  );

  const timeLeft = (): string => {
    const s = Math.max(0, Math.ceil((RUN_MS - t()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const countdown = (): number =>
    Math.max(0, Math.ceil((props.startAt - props.now) / 1000));
  const progress = (task: Task): number =>
    Math.max(0, Math.min(1, (t() - task.at) / task.window));

  const hazards = (): Task[] =>
    props.view.open.filter((task) => task.kind === "hazard");
  const pets = (): Task[] =>
    props.view.open.filter((task) => task.kind === "pet");
  const dark = (): boolean => props.view.broken.includes("lights");

  const stationStatus = (s: Station): { text: string; tone: string } => {
    const member = props.setup.crew.find((c) => c.station === s);
    const waiting = props.view.open.filter((task) => task.station === s);
    if (member?.uid === null || props.view.away.has(s)) {
      return { text: "🤖 helper", tone: "text-game-grey" };
    }
    if (waiting.length >= 2) {
      return { text: `⚠️ ${waiting.length} jobs`, tone: "text-game-yellow" };
    }
    if (waiting.length === 1) {
      return { text: "✍️ busy", tone: "text-game-cream" };
    }
    return { text: "✅ ready", tone: "text-game-green" };
  };

  return (
    <div class="relative flex h-full w-full flex-col overflow-hidden bg-game-night font-kid text-game-cream select-none">
      {/* HUD */}
      <div class="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 bg-game-ink/80 px-3 pt-16 pb-1.5 text-sm sm:pt-1.5 sm:pr-44 sm:pl-20">
        <span class="font-bold">
          {props.view.zone.emoji} {props.view.zone.name}
        </span>
        <span class="tabular-nums">⏱️ {timeLeft()}</span>
        <span class="flex items-center gap-1" title="Ship health">
          ❤️
          <span class="h-2.5 w-20 overflow-hidden rounded-full bg-game-ink">
            <span
              class={cn(
                "block h-full rounded-full transition-[width] duration-300",
                props.view.hp > START_HP / 2
                  ? "bg-game-green"
                  : props.view.hp > 2
                    ? "bg-game-yellow"
                    : "bg-game-red",
              )}
              style={{ width: `${(props.view.hp / START_HP) * 100}%` }}
            ></span>
          </span>
          <span class="tabular-nums">{props.view.hp}</span>
        </span>
        <span class="flex items-center gap-1" title="Shield">
          🛡️
          <span class="h-2.5 w-20 overflow-hidden rounded-full bg-game-ink">
            <span
              class="block h-full rounded-full bg-game-blue transition-[width] duration-300"
              style={{ width: `${props.view.shield}%` }}
            ></span>
          </span>
        </span>
        <span class="font-bold text-game-yellow">🐾 {props.view.pets}</span>
      </div>

      {/* space */}
      <div
        class={cn(
          "relative min-h-56 flex-1 overflow-hidden bg-linear-to-r transition-colors duration-1000",
          ZONE_TINT[props.view.zone.name] ?? ZONE_TINT["Asteroid Field"],
        )}
      >
        <For each={STARS}>
          {(s) => (
            <span
              class="absolute animate-game-twinkle rounded-full bg-game-cloud motion-reduce:animate-none"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                "animation-delay": `${s.delay}s`,
              }}
            ></span>
          )}
        </For>

        {/* zone progress */}
        <div class="absolute inset-x-4 top-2 flex gap-1">
          <For each={ZONES}>
            {(z) => (
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-game-ink/60">
                <div
                  class="h-full bg-game-yellow"
                  style={{
                    width: `${Math.max(0, Math.min(1, (t() - z.start) / (z.end - z.start))) * 100}%`,
                  }}
                ></div>
              </div>
            )}
          </For>
        </div>

        {/* the ship */}
        <div
          class={cn(
            "absolute top-1/2 left-[6%] w-36 -translate-y-1/2 sm:w-48",
            shake() && "animate-game-shake",
          )}
        >
          <img
            src={SHIP_ART}
            alt="Rescue ship"
            class="w-full animate-game-wave [image-rendering:pixelated] motion-reduce:animate-none"
          />
          <Show when={props.view.broken.includes("engine")}>
            <span class="absolute -top-2 left-1/3 animate-game-pulse text-2xl motion-reduce:animate-none">
              🔥
            </span>
          </Show>
          <Show when={props.view.broken.includes("leak")}>
            <span class="absolute -bottom-2 left-1/2 animate-game-pulse text-2xl motion-reduce:animate-none">
              💨
            </span>
          </Show>
          <Show when={props.view.shield > 20}>
            <span
              class="pointer-events-none absolute -inset-3 rounded-full border-2 border-game-sky"
              style={{ opacity: props.view.shield / 140 }}
            ></span>
          </Show>
        </div>

        {/* asteroids fly in from the right */}
        <For each={hazards()}>
          {(task) => (
            <img
              src={ASTEROID_ART}
              alt=""
              class={cn(
                "absolute w-12 [image-rendering:pixelated] sm:w-14",
                props.view.zone.name === "Meteor Storm" &&
                  "hue-rotate-[320deg] saturate-200",
              )}
              style={{
                left: `${92 - progress(task) * 62}%`,
                top: `${30 + ((Number(task.id.slice(1)) * 23) % 40)}%`,
                transform: `rotate(${progress(task) * 360}deg)`,
              }}
            />
          )}
        </For>

        {/* stranded pets float by */}
        <For each={pets()}>
          {(task) => (
            <div
              class="absolute grid h-16 w-16 place-items-center rounded-full border-2 border-game-sky bg-game-sky/20"
              style={{
                left: `${80 - progress(task) * 30}%`,
                top: `${14 + ((Number(task.id.slice(1)) * 31) % 50)}%`,
              }}
            >
              <img
                src={task.pet === undefined ? "" : PET_ART[task.pet]}
                alt={task.pet ?? "pet"}
                class="w-10 animate-game-wave [image-rendering:pixelated] motion-reduce:animate-none"
              />
            </div>
          )}
        </For>

        <Show when={dark()}>
          <div class="pointer-events-none absolute inset-0 bg-game-ink/75">
            <span class="absolute top-8 left-1/2 -translate-x-1/2 text-sm text-game-grey">
              💡 The lights are broken!
            </span>
          </div>
        </Show>

        {/* popups */}
        <div class="pointer-events-none absolute inset-x-0 top-6 grid justify-items-center gap-1">
          <For each={popups()}>
            {(p) => (
              <span
                class={cn(
                  "animate-game-pop rounded-full px-3 py-0.5 text-lg font-bold motion-reduce:animate-none",
                  p.tone === "good" && "bg-game-green text-game-ink",
                  p.tone === "bad" && "bg-game-red text-game-ink",
                  p.tone === "pet" && "bg-game-yellow text-game-ink",
                )}
              >
                {p.text}
              </span>
            )}
          </For>
        </div>

        {/* all hands */}
        <Show when={myCalls()[0]}>
          {(call) => (
            <div class="absolute inset-x-4 bottom-3 animate-game-pop rounded-2xl border-4 border-game-red bg-game-ink/95 p-3 text-center motion-reduce:animate-none">
              <div class="text-lg font-bold text-game-red">
                {call().dock === true
                  ? "🏠 Everyone! Dock at the Rescue Station:"
                  : "🚨 ALL HANDS! Everyone type:"}
              </div>
              <Words word={call().word} typed={typed()} big />
              <div class="mx-auto mt-1 h-1.5 max-w-sm overflow-hidden rounded-full bg-game-navy">
                <div
                  class="h-full bg-game-red"
                  style={{ width: `${(1 - progress(call())) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </Show>

        <Show when={counting()}>
          <div class="pointer-events-none absolute inset-0 grid place-items-center bg-game-ink/40">
            <span class="animate-game-pop text-8xl font-bold text-game-yellow motion-reduce:animate-none">
              {countdown()}
            </span>
          </div>
        </Show>
      </div>

      {/* crew + my station */}
      <div class="grid gap-2 bg-game-ink p-2 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div class="grid content-start gap-1 rounded-xl border-4 border-game-cream bg-game-navy p-2 text-sm">
          <For each={props.setup.crew}>
            {(c) => (
              <div
                class={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-0.5",
                  c.station === myStation() &&
                    "bg-game-ink ring-2 ring-game-yellow",
                )}
              >
                <span>{STATION_INFO[c.station].emoji}</span>
                <span class="flex-1 truncate font-bold">
                  {c.uid === props.myUid ? "You" : c.name}
                </span>
                <span class={stationStatus(c.station).tone}>
                  {stationStatus(c.station).text}
                </span>
              </div>
            )}
          </For>
        </div>

        <div class="min-h-32 rounded-xl border-4 border-game-cream bg-game-navy p-3">
          <Show
            when={myStation()}
            fallback={<div class="text-game-grey">Watching the crew…</div>}
          >
            {(station) => (
              <>
                <div class="mb-1 text-sm text-game-grey">
                  {STATION_INFO[station()].emoji} You are the{" "}
                  <b class="text-game-cream">{STATION_INFO[station()].name}</b>{" "}
                  - {STATION_INFO[station()].blurb.toLowerCase()}!
                  <Show when={props.view.away.has(station())}>
                    {" "}
                    (🤖 a helper is covering - type to jump back in!)
                  </Show>
                </div>
                <Show
                  when={myTasks().length > 0}
                  fallback={
                    <div class="py-3 text-center text-lg text-game-grey">
                      {counting()
                        ? "Get ready…"
                        : props.view.over
                          ? "Mission over!"
                          : "All clear - watch for the next one!"}
                    </div>
                  }
                >
                  <div class="grid gap-2">
                    <For each={myTasks().slice(0, 3)}>
                      {(task) => (
                        <div class="rounded-lg bg-game-ink px-3 py-1.5">
                          <div class="flex items-center justify-between text-xs text-game-grey">
                            <span>
                              {task.kind === "hazard"
                                ? "☄️ Asteroid! Dodge:"
                                : task.kind === "charge"
                                  ? "⚡ Charge the shield:"
                                  : task.kind === "break"
                                    ? `${PART_INFO[task.part ?? "engine"].emoji} ${PART_INFO[task.part ?? "engine"].name} broke - ${PART_INFO[task.part ?? "engine"].effect}! Fix:`
                                    : "🐾 A pet needs help! Rescue:"}
                            </span>
                          </div>
                          <Words word={task.word} typed={typed()} />
                          <Show when={task.kind !== "break"}>
                            <div class="h-1 overflow-hidden rounded-full bg-game-navy">
                              <div
                                class={cn(
                                  "h-full",
                                  progress(task) > 0.7
                                    ? "bg-game-red"
                                    : "bg-game-yellow",
                                )}
                                style={{
                                  width: `${(1 - progress(task)) * 100}%`,
                                }}
                              ></div>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </div>
      </div>

      {/* always mounted so the iPad keyboard stays up */}
      <div class="flex justify-center bg-game-ink px-3 pb-3">
        <MiniTypingInput
          value={typed()}
          onInput={onInput}
          wrong={wrong()}
          waiting={counting() || props.view.over}
          placeholder={
            myCalls().length > 0 ? "everyone type it!" : "type your words"
          }
          ref={(el) => (inputEl = el)}
        />
      </div>
    </div>
  );
}

/** Words to type, with the typed part coloured in. */
function Words(props: {
  word: string;
  typed: string;
  big?: boolean;
}): JSXElement {
  const done = (): number => {
    const t = normalize(props.typed);
    if (!props.word.startsWith(t)) return 0;
    return t.length;
  };
  return (
    <div
      class={cn(
        "text-center font-mono font-bold tracking-wide",
        props.big === true ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
      )}
    >
      <span class="text-game-green">{props.word.slice(0, done())}</span>
      <span>{props.word.slice(done())}</span>
    </div>
  );
}

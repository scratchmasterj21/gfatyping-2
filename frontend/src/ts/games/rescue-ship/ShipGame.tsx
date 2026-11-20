import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  JSXElement,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";

import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TypingTracker } from "../shared/typing-report";
import { ASTEROID_ART, PET_ART, SHIP_ART } from "./ship-art";
import {
  BOSS_INFO,
  boostId,
  memberIndex,
  PART_INFO,
  RUN_MS,
  shipBoss,
  ShipEvent,
  ShipSetup,
  ShipView,
  START_HP,
  Station,
  STATION_INFO,
  stationOf,
  STATIONS,
  Task,
  ZoneKind,
} from "./ship-rules";

type Popup = { id: number; text: string; tone: "good" | "bad" | "pet" };

type FxKind =
  | "swoosh"
  | "bits"
  | "sparks"
  | "ripple"
  | "beam"
  | "petFly"
  | "plus"
  | "wrench"
  | "puff"
  | "crate"
  | "flash"
  | "swimOff";
type Fx = {
  id: number;
  kind: FxKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  img?: string;
  tone?: "red" | "yellow" | "blue" | "gold";
};
const FX_MS: Record<FxKind, number> = {
  swoosh: 700,
  bits: 650,
  sparks: 600,
  ripple: 650,
  beam: 700,
  petFly: 700,
  plus: 950,
  wrench: 750,
  puff: 900,
  crate: 650,
  flash: 450,
  swimOff: 1600,
};

/** Perfect jobs in a row for a shield boost. */
const COMBO_FULL = 5;
const BREAK_URGENT_MS = 25_000;

const normalize = (raw: string): string =>
  raw.toLowerCase().replace(/\s+/g, " ").replace(/^ /, "");

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const ZONE_TINT: Record<ZoneKind, string> = {
  asteroids: "from-game-night via-game-navy to-game-night",
  meteors: "from-game-night via-game-dusk to-game-sunset",
  goo: "from-game-night via-game-navy to-game-frog",
  ice: "from-game-night via-game-navy to-game-sky-top",
  blackhole: "from-game-ink via-game-night to-game-dusk",
  boss: "from-game-night via-game-navy to-game-blue",
  station: "from-game-navy via-game-sky-top to-game-sky",
};

/** Fixed star field (same every game). */
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 1 + (i % 3),
  delay: (i % 7) * 0.3,
}));

const idNumber = (task: Task): number => Number(task.id.slice(1)) || 0;

/** Where a rock is on screen (% of the space view). */
function rockAt(task: Task, at: number): { x: number; y: number; r: number } {
  const p = clamp01((at - task.at) / task.window);
  const n = idNumber(task);
  return {
    x: 92 - p * 62,
    y: 26 + ((n * 23) % 40) + Math.sin(p * Math.PI * 2 + n) * 7,
    r: p * 540 + n * 40,
  };
}

/** Where a stranded pet (or crate) floats. */
function petAt(task: Task, at: number): { x: number; y: number } {
  const p = clamp01((at - task.at) / task.window);
  const n = idNumber(task) + (task.id.startsWith("x") ? 3 : 0);
  return {
    x: 82 - p * 30,
    y: 14 + ((n * 31) % 46) + Math.sin(p * Math.PI * 3 + n) * 4,
  };
}

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The ship screen: the space view, the ship's health / shield / pets, the
 * crew panel and my jobs to type.
 */
export function ShipGame(props: {
  setup: ShipSetup;
  tasks: Task[];
  view: ShipView;
  myUid: string;
  now: number;
  startAt: number;
  /** all-hands tasks I've already typed */
  myHands: Set<string>;
  tracker: TypingTracker;
  onDone: (task: Task) => void;
  onHands: (task: Task) => void;
  onBoost: (id: string) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [sent, setSent] = createSignal<Set<string>>(new Set());
  const [steps, setSteps] = createSignal<Record<string, number>>({});
  const [popups, setPopups] = createSignal<Popup[]>([]);
  const [fx, setFx] = createSignal<Fx[]>([]);
  const [shake, setShake] = createSignal(false);
  const [bossShake, setBossShake] = createSignal(false);
  const [swerve, setSwerve] = createSignal(0);
  const [combo, setCombo] = createSignal(0);
  const [banner, setBanner] = createSignal<{
    id: number;
    title: string;
    sub: string;
  } | null>(null);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  onCleanup(() => timers.forEach(clearTimeout));

  let popupId = 0;
  let inputEl: HTMLInputElement | undefined;
  let spaceEl: HTMLDivElement | undefined;
  let shipEl: HTMLDivElement | undefined;
  /** wrong keys while typing the current word */
  let wordMisses = 0;
  /** a mistake since the last finished job (breaks the combo) */
  let dirty = false;
  let boosts = 0;

  const bumpShip = (): void => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    later(450, () => setShake(false));
  };

  const captain = (): boolean => props.setup.captain === props.myUid;
  const mySlot = (): number =>
    captain() ? 0 : props.setup.crew.findIndex((c) => c.uid === props.myUid);
  const t = (): number => props.view.t;
  const myStation = (): Station | undefined =>
    captain()
      ? undefined
      : stationOf(props.setup, props.view.zones, props.myUid, t());
  const counting = (): boolean => props.now < props.startAt;
  const iAmAway = (): boolean => {
    const s = myStation();
    return s !== undefined && props.view.away.has(s);
  };

  const stepOf = (task: Task): number => steps()[task.id] ?? 0;
  /** what to type next for this task */
  const target = (task: Task): string =>
    task.steps === undefined
      ? task.word
      : (task.steps[stepOf(task)] ?? task.word);
  const deadline = (task: Task): number =>
    task.kind === "break" ? task.at + BREAK_URGENT_MS : task.at + task.window;

  const isMine = (task: Task): boolean =>
    task.kind !== "hands" &&
    !sent().has(task.id) &&
    (captain() || task.station === "any" || task.station === myStation());
  const myTasks = createMemo(() =>
    props.view.open.filter(isMine).sort((a, b) => deadline(a) - deadline(b)),
  );
  /** all-hands calls still waiting for me */
  const myCalls = createMemo(() =>
    props.view.open.filter(
      (task) =>
        task.kind === "hands" &&
        !props.myHands.has(task.id) &&
        !sent().has(task.id) &&
        (captain() || (myStation() !== undefined && !iAmAway())),
    ),
  );
  const candidates = (): Task[] => [...myCalls(), ...myTasks()];

  // the task I was typing went away: clear the box
  createEffect(
    on(candidates, (list) => {
      const value = normalize(typed());
      if (
        value !== "" &&
        !list.some((task) => target(task).startsWith(value))
      ) {
        clearInput();
      }
    }),
  );

  const popup = (text: string, tone: Popup["tone"]): void => {
    const id = ++popupId;
    setPopups((p) => [...p.slice(-3), { id, text, tone }]);
    later(1500, () => setPopups((p) => p.filter((q) => q.id !== id)));
  };

  let fxId = 0;
  const addFx = (f: Omit<Fx, "id">): void => {
    if (reducedMotion() && f.kind !== "plus") return;
    const id = ++fxId;
    setFx((list) => [...list.slice(-24), { ...f, id }]);
    later(FX_MS[f.kind] + 50, () =>
      setFx((list) => list.filter((x) => x.id !== id)),
    );
  };

  /** the ship's nose, in % of the space view */
  const shipPoint = (): { x: number; y: number } => {
    if (spaceEl === undefined || shipEl === undefined) return { x: 22, y: 50 };
    const a = spaceEl.getBoundingClientRect();
    const b = shipEl.getBoundingClientRect();
    if (a.width === 0 || a.height === 0) return { x: 22, y: 50 };
    return {
      x: ((b.left + b.width * 0.7 - a.left) / a.width) * 100,
      y: ((b.top + b.height / 2 - a.top) / a.height) * 100,
    };
  };

  const clearInput = (): void => {
    setTyped("");
    setWrong(false);
    if (inputEl !== undefined) inputEl.value = "";
  };

  const finishJob = (): void => {
    if (dirty) {
      dirty = false;
      setCombo(0);
      return;
    }
    const next = combo() + 1;
    if (next < COMBO_FULL) {
      setCombo(next);
      return;
    }
    setCombo(0);
    props.onBoost(boostId(Math.max(0, mySlot()), boosts++));
  };

  const onInput = (raw: string): void => {
    if (counting() || props.view.over) {
      clearInput();
      return;
    }
    const value = normalize(raw);
    const hit = candidates().find((task) => target(task) === value);
    if (hit !== undefined) {
      props.tracker.word(value, wordMisses);
      wordMisses = 0;
      clearInput();
      sfx.good();
      const step = stepOf(hit);
      if (hit.steps !== undefined && step < hit.steps.length - 1) {
        // a repair step: on to the next one
        setSteps((s) => ({ ...s, [hit.id]: step + 1 }));
        const p = shipPoint();
        addFx({ kind: "wrench", x: p.x - 6, y: p.y - 8 });
        return;
      }
      setSent((s) => new Set([...s, hit.id]));
      finishJob();
      if (hit.kind === "hands") props.onHands(hit);
      else props.onDone(hit);
      return;
    }
    const ok = candidates().some((task) => target(task).startsWith(value));
    if (!ok && !wrong()) {
      sfx.oops();
      props.tracker.miss();
      wordMisses++;
      dirty = true;
      setCombo(0);
    }
    setWrong(!ok);
    setTyped(raw);
  };

  // ------------------------------------------------ react to the ship
  const taskById = createMemo(
    () => new Map(props.tasks.map((task) => [task.id, task])),
  );
  const boss = createMemo(() => BOSS_INFO[shipBoss(props.setup.seed)]);

  const onEvent = (e: ShipEvent): void => {
    const task = e.taskId === undefined ? undefined : taskById().get(e.taskId);
    const ship = shipPoint();
    switch (e.kind) {
      case "dodge": {
        popup("✨ Dodged!", "good");
        const rock = task === undefined ? null : rockAt(task, e.t);
        if (rock !== null) {
          addFx({ kind: "swoosh", x: rock.x, y: rock.y });
          setSwerve(rock.y > 50 ? -26 : 26);
          later(420, () => setSwerve(0));
        }
        break;
      }
      case "block":
        popup("🛡️ Shield blocked it!", "good");
        addFx({ kind: "ripple", x: ship.x - 6, y: ship.y, tone: "blue" });
        addFx({ kind: "sparks", x: ship.x + 4, y: ship.y, tone: "blue" });
        addFx({ kind: "bits", x: ship.x + 8, y: ship.y });
        break;
      case "bump":
        popup("💥 Bump! -1 ❤️", "bad");
        addFx({ kind: "flash", x: 0, y: 0, tone: "red" });
        addFx({ kind: "bits", x: ship.x, y: ship.y });
        bumpShip();
        sfx.bad();
        break;
      case "leak":
        popup("💨 Air leak! -1 ❤️", "bad");
        addFx({ kind: "puff", x: ship.x - 8, y: ship.y + 8, text: "💨" });
        bumpShip();
        sfx.bad();
        break;
      case "break":
        popup(`⚠️ ${PART_INFO[task?.part ?? "engine"].name} broke!`, "bad");
        addFx({ kind: "sparks", x: ship.x - 8, y: ship.y - 6, tone: "yellow" });
        break;
      case "fix":
        popup("🔧 Fixed!", "good");
        addFx({ kind: "wrench", x: ship.x - 6, y: ship.y - 8 });
        addFx({ kind: "sparks", x: ship.x - 6, y: ship.y - 4, tone: "yellow" });
        addFx({ kind: "puff", x: ship.x - 10, y: ship.y - 10, text: "☁️" });
        break;
      case "rescue": {
        const worth = e.amount ?? 1;
        popup(
          task?.golden === true
            ? "🌟 Golden pet! +3 🐾"
            : task?.sos === true
              ? "🆘 Saved! +2 🐾"
              : "🐾 Pet rescued!",
          "pet",
        );
        if (task !== undefined) {
          const p = petAt(task, e.t);
          addFx({ kind: "beam", x: ship.x, y: ship.y, x2: p.x, y2: p.y });
          addFx({
            kind: "petFly",
            x: p.x,
            y: p.y,
            x2: ship.x - 4,
            y2: ship.y,
            img: task.pet === undefined ? "" : PET_ART[task.pet],
          });
          addFx({ kind: "plus", x: p.x, y: p.y - 8, text: `+${worth} 🐾` });
        }
        sfx.great();
        break;
      }
      case "petLost":
        popup("😢 A pet floated away", "bad");
        break;
      case "handsMiss":
        popup("🚨 Crew call missed!", "bad");
        addFx({ kind: "flash", x: 0, y: 0, tone: "red" });
        bumpShip();
        sfx.bad();
        break;
      case "dock":
        popup("🏠 Docked! +3 pets", "pet");
        sfx.great();
        break;
      case "supply":
        popup("📦 Supplies! +2 ❤️", "good");
        addFx({ kind: "crate", x: 90, y: 30, x2: ship.x, y2: ship.y });
        addFx({ kind: "plus", x: ship.x, y: ship.y - 14, text: "+2 ❤️" });
        sfx.great();
        break;
      case "flareBlock":
        popup("☀️ Flare blocked!", "good");
        addFx({ kind: "ripple", x: ship.x - 6, y: ship.y, tone: "gold" });
        break;
      case "flareHit":
        popup("☀️ Solar flare! -1 ❤️", "bad");
        addFx({ kind: "flash", x: 0, y: 0, tone: "yellow" });
        bumpShip();
        sfx.bad();
        break;
      case "bossHit":
        setBossShake(false);
        requestAnimationFrame(() => setBossShake(true));
        later(420, () => setBossShake(false));
        addFx({ kind: "plus", x: 74, y: 26, text: "💫" });
        break;
      case "bossWin":
        popup(`🎉 ${boss().win} +3 🐾`, "pet");
        addFx({ kind: "swimOff", x: 74, y: 48, text: boss().emoji });
        sfx.great();
        break;
      case "bossLeft":
        popup(`${boss().emoji} It wandered off…`, "good");
        break;
      case "boost":
        if (e.by === props.myUid) {
          popup("⚡ Perfect streak! Shield boost!", "good");
        }
        addFx({ kind: "ripple", x: ship.x - 6, y: ship.y, tone: "blue" });
        break;
      default:
        break;
    }
  };
  // memo: online, the game object is new on every room update and on()
  // re-runs on each one (it doesn't compare values) - only react to a real change
  const eventCount = createMemo(() => props.view.events.length);
  createEffect(
    on(eventCount, (n, prev) => {
      if (prev === undefined || n <= prev) return;
      for (const e of props.view.events.slice(prev)) onEvent(e);
    }),
  );

  // a new zone (and maybe a new job): tell everyone
  const showBanner = (title: string, sub: string): void => {
    const id = ++popupId;
    setBanner({ id, title, sub });
    later(2800, () => setBanner((b) => (b?.id === id ? null : b)));
  };
  createEffect(
    on(
      () => (counting() ? -1 : props.view.zone.index),
      (index, prev) => {
        if (index < 0 || index === prev) return;
        const z = props.view.zone;
        const s = myStation();
        const swap =
          props.setup.rotate === true &&
          index > 0 &&
          index < 3 &&
          s !== undefined
            ? ` 🔄 Job swap - you're the ${STATION_INFO[s].emoji} ${STATION_INFO[s].name} now!`
            : "";
        showBanner(`${z.emoji} ${z.name}`, `${z.tip}${swap}`);
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
    clamp01((t() - task.at) / task.window);

  const hazards = (): Task[] =>
    props.view.open.filter((task) => task.kind === "hazard");
  const floaters = (): Task[] =>
    props.view.open.filter(
      (task) => task.kind === "pet" || task.kind === "supply",
    );
  const dark = (): boolean => props.view.broken.includes("lights");
  const flareOn = (): boolean =>
    props.view.open.some((task) => task.kind === "flare");
  const bossHere = (): boolean =>
    props.view.zone.kind === "boss" && props.view.boss === undefined;

  /** who's at a station right now */
  const memberAt = (s: Station): { uid: string | null; name: string } => {
    const i = memberIndex(props.setup, props.view.zones, s, t());
    return props.setup.crew[i] ?? { uid: null, name: "Helper" };
  };
  const stationStatus = (s: Station): { text: string; tone: string } => {
    const member = memberAt(s);
    const waiting = props.view.open.filter((task) => task.station === s);
    const helper = member.uid === null || props.view.away.has(s);
    if (helper && !captain()) {
      return { text: "🤖 helper", tone: "text-game-grey" };
    }
    if (waiting.length >= 2) {
      return { text: `⚠️ ${waiting.length} jobs`, tone: "text-game-yellow" };
    }
    if (waiting.length === 1) {
      return { text: "✍️ 1 job", tone: "text-game-cream" };
    }
    return {
      text: captain() ? "🤖 backup" : "✅ ready",
      tone: "text-game-green",
    };
  };

  /** the crew's answers to an all-hands call */
  const callAnswers = (task: Task): { name: string; done: boolean }[] => {
    const typedBy = new Set(
      props.view.events
        .filter((e) => e.kind === "hands" && e.taskId === task.id)
        .map((e) => e.by),
    );
    if (props.myHands.has(task.id)) typedBy.add(props.myUid);
    const humans = captain()
      ? [{ uid: props.myUid, name: "You" }]
      : props.setup.crew.filter((c) => c.uid !== null);
    return humans.map((c) => ({
      name: c.uid === props.myUid ? "You" : c.name,
      done: typedBy.has(c.uid ?? ""),
    }));
  };

  const label = (task: Task): string => {
    const part = PART_INFO[task.part ?? "engine"];
    switch (task.kind) {
      case "hazard":
        return task.frozen === true
          ? "🧊 Frozen rock! Dodge:"
          : "☄️ Asteroid! Dodge:";
      case "charge":
        return "⚡ Charge the shield:";
      case "break":
        return `${part.emoji} ${part.name} broke - ${part.effect}! Fix:`;
      case "pet":
        return task.golden === true
          ? "🌟 A GOLDEN pet! Rescue:"
          : task.sos === true
            ? "🆘 SOS! Quick, rescue:"
            : "🐾 A pet needs help! Rescue:";
      case "supply":
        return "📦 Supply crate! Catch it:";
      case "flare":
        return "☀️ Solar flare coming! Shields:";
      case "boss":
        return `${boss().emoji} ${boss().name}:`;
      default:
        return "";
    }
  };

  const cabin = (): ShipView["rescued"] => props.view.rescued.slice(-16);

  return (
    <div class="game-motion relative flex h-full w-full flex-col overflow-hidden bg-game-night font-kid text-game-cream select-none">
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
        <span
          class="flex items-center gap-0.5"
          title={`Perfect streak: ${COMBO_FULL} jobs with no mistakes = shield boost`}
        >
          ⚡
          <For each={Array.from({ length: COMBO_FULL }, (_, i) => i)}>
            {(i) => (
              <span
                class={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  i < combo() ? "bg-game-yellow" : "bg-game-navy",
                )}
              ></span>
            )}
          </For>
        </span>
      </div>

      {/* space */}
      <div
        ref={(el) => (spaceEl = el)}
        class={cn(
          "relative min-h-56 flex-1 overflow-hidden bg-linear-to-r transition-colors duration-1000",
          ZONE_TINT[props.view.zone.kind],
        )}
      >
        <For each={STARS}>
          {(s, i) => (
            <span
              class={cn(
                "absolute animate-game-twinkle motion-reduce:animate-none",
                props.view.zone.kind === "ice" && i() % 4 === 0
                  ? "text-xs text-game-cloud"
                  : "rounded-full bg-game-cloud",
              )}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                "animation-delay": `${s.delay}s`,
              }}
            >
              {props.view.zone.kind === "ice" && i() % 4 === 0 ? "❄" : ""}
            </span>
          )}
        </For>

        {/* zone scenery */}
        <Show when={props.view.zone.kind === "blackhole"}>
          <div class="absolute top-[10%] right-[6%] grid h-28 w-28 place-items-center">
            <div class="absolute inset-0 animate-spin rounded-full border-8 border-dashed border-game-purple [animation-duration:5s] motion-reduce:animate-none"></div>
            <div class="h-16 w-16 rounded-full bg-game-ink ring-4 ring-game-dusk"></div>
          </div>
        </Show>
        <Show when={props.view.zone.kind === "goo"}>
          <span class="absolute top-[12%] right-[10%] animate-game-bob text-5xl opacity-70 motion-reduce:animate-none">
            👾
          </span>
          <span class="absolute right-[28%] bottom-[22%] animate-game-bob text-3xl opacity-60 [animation-delay:0.6s] motion-reduce:animate-none">
            🟢
          </span>
        </Show>
        <Show when={props.view.zone.kind === "station"}>
          <span class="absolute top-[22%] right-[8%] animate-game-bob text-7xl motion-reduce:animate-none">
            🛰️
          </span>
        </Show>

        {/* zone progress */}
        <div class="absolute inset-x-4 top-2 flex gap-1">
          <Index each={props.view.zones}>
            {(z) => (
              <div
                class="h-1.5 overflow-hidden rounded-full bg-game-ink/60"
                style={{ flex: `${z().end - z().start} 1 0` }}
                title={z().name}
              >
                <div
                  class="h-full bg-game-yellow"
                  style={{
                    width: `${clamp01((t() - z().start) / (z().end - z().start)) * 100}%`,
                  }}
                ></div>
              </div>
            )}
          </Index>
        </div>

        {/* the ship */}
        <div
          ref={(el) => (shipEl = el)}
          class="absolute top-1/2 left-[6%] w-36 transition-transform duration-300 ease-out sm:w-48"
          style={{ transform: `translateY(calc(-50% + ${swerve()}px))` }}
        >
          <div class={cn(shake() && "animate-game-shake")}>
            <span class="absolute top-1/2 -left-7 h-3 w-10 -translate-y-1/2 animate-game-pulse rounded-full bg-linear-to-l from-game-orange to-game-yellow/0 motion-reduce:animate-none"></span>
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
                class="pointer-events-none absolute -inset-3 rounded-full border-2 border-game-sky bg-game-sky/10"
                style={{ opacity: props.view.shield / 140 }}
              ></span>
            </Show>
          </div>
        </div>

        {/* asteroids fly in from the right, tumbling */}
        <For each={hazards()}>
          {(task) => {
            const pos = (): { x: number; y: number; r: number } =>
              rockAt(task, t());
            return (
              <img
                src={ASTEROID_ART}
                alt=""
                class={cn(
                  "absolute w-12 -translate-x-1/2 -translate-y-1/2 [image-rendering:pixelated] sm:w-14",
                  props.view.zone.kind === "meteors" &&
                    "hue-rotate-[320deg] saturate-200",
                  task.frozen === true &&
                    "rounded-full bg-game-sky/40 ring-4 ring-game-sky",
                )}
                style={{
                  left: `${pos().x}%`,
                  top: `${pos().y}%`,
                  rotate: `${pos().r}deg`,
                }}
              />
            );
          }}
        </For>

        {/* stranded pets (and crates) float by */}
        <For each={floaters()}>
          {(task) => {
            const pos = (): { x: number; y: number } => petAt(task, t());
            return (
              <div
                class={cn(
                  "absolute grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2",
                  task.golden === true
                    ? "animate-game-pulse border-game-gold bg-game-gold/30 motion-reduce:animate-none"
                    : task.sos === true
                      ? "border-game-red bg-game-red/20"
                      : task.kind === "supply"
                        ? "border-game-orange bg-game-orange/20"
                        : "border-game-sky bg-game-sky/20",
                )}
                style={{ left: `${pos().x}%`, top: `${pos().y}%` }}
              >
                <Show
                  when={task.kind === "pet"}
                  fallback={<span class="text-4xl">📦</span>}
                >
                  <img
                    src={task.pet === undefined ? "" : PET_ART[task.pet]}
                    alt={task.pet ?? "pet"}
                    class="w-10 animate-game-wave [image-rendering:pixelated] motion-reduce:animate-none"
                  />
                </Show>
                <Show when={task.sos === true}>
                  <span class="absolute -top-3 rounded-full bg-game-red px-1.5 text-xs font-bold text-game-ink">
                    SOS
                  </span>
                </Show>
              </div>
            );
          }}
        </For>

        {/* the big visitor */}
        <Show when={bossHere()}>
          <div class="absolute top-[48%] left-[74%] grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1">
            <span
              class={cn(
                "text-[6rem] leading-none sm:text-[8rem]",
                bossShake()
                  ? "animate-game-shake"
                  : "animate-game-bob motion-reduce:animate-none",
              )}
            >
              {boss().emoji}
            </span>
            <div class="h-2 w-28 overflow-hidden rounded-full bg-game-ink/70">
              <div
                class="h-full bg-game-yellow transition-[width] duration-300"
                style={{
                  width: `${(props.view.bossHits / Math.max(1, props.view.bossMax)) * 100}%`,
                }}
              ></div>
            </div>
            <span class="rounded-full bg-game-ink/70 px-2 text-xs">
              {shipBoss(props.setup.seed) === "whale" ? "😴 → 😮" : "🤗 → 👋"}
            </span>
          </div>
        </Show>

        {/* effects */}
        <For each={fx()}>{(f) => <FxView fx={f} />}</For>

        <Show when={dark()}>
          <div class="pointer-events-none absolute inset-0 bg-game-ink/75">
            <span class="absolute top-8 left-1/2 -translate-x-1/2 text-sm text-game-grey">
              💡 The lights are broken!
            </span>
          </div>
        </Show>
        <Show when={flareOn()}>
          <div class="pointer-events-none absolute inset-0 animate-game-pulse bg-game-yellow/15 motion-reduce:animate-none"></div>
        </Show>

        {/* pet cabin */}
        <div class="absolute inset-x-0 bottom-0 flex h-9 items-center gap-1 overflow-hidden bg-game-ink/70 px-2">
          <span class="shrink-0 text-xs font-bold text-game-grey">
            🐾 Cabin
          </span>
          <Show
            when={props.view.rescued.length > 0}
            fallback={
              <span class="text-xs text-game-grey">
                - rescued pets ride here
              </span>
            }
          >
            <Show when={props.view.rescued.length > cabin().length}>
              <span class="text-xs text-game-grey">
                +{props.view.rescued.length - cabin().length}
              </span>
            </Show>
            <Index each={cabin()}>
              {(r) => (
                <img
                  src={PET_ART[r().pet]}
                  alt={r().pet}
                  class={cn(
                    "h-7 w-7 shrink-0 animate-game-hop [image-rendering:pixelated] motion-reduce:animate-none",
                    r().golden &&
                      "rounded-full bg-game-gold/40 ring-2 ring-game-gold",
                  )}
                />
              )}
            </Index>
          </Show>
        </div>

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

        {/* zone / job swap banner */}
        <Show when={banner()}>
          {(b) => (
            <div class="pointer-events-none absolute inset-x-0 top-1/3 grid justify-items-center">
              <div class="max-w-lg animate-game-pop rounded-2xl border-4 border-game-yellow bg-game-ink/90 px-5 py-2 text-center motion-reduce:animate-none">
                <div class="text-3xl font-bold text-game-yellow">
                  {b().title}
                </div>
                <div class="text-base">{b().sub}</div>
              </div>
            </div>
          )}
        </Show>

        {/* all hands */}
        <Show when={myCalls()[0]}>
          {(call) => (
            <>
              <div class="pointer-events-none absolute inset-0 animate-game-pulse border-8 border-game-red/70 motion-reduce:animate-none"></div>
              <div class="absolute inset-x-4 bottom-11 animate-game-pop rounded-2xl border-4 border-game-red bg-game-ink/95 p-3 text-center motion-reduce:animate-none">
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
                <div class="mt-1 flex flex-wrap justify-center gap-1 text-xs">
                  <For each={callAnswers(call())}>
                    {(a) => (
                      <span
                        class={cn(
                          "rounded-full px-2 py-0.5 font-bold",
                          a.done
                            ? "bg-game-green text-game-ink"
                            : "bg-game-navy text-game-grey",
                        )}
                      >
                        {a.done ? "✅" : "⏳"} {a.name}
                      </span>
                    )}
                  </For>
                </div>
              </div>
            </>
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

      {/* crew + my jobs */}
      <div class="grid gap-2 bg-game-ink p-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div class="grid content-start gap-1 rounded-xl border-4 border-game-cream bg-game-navy p-2 text-sm">
          <For each={STATIONS}>
            {(s) => (
              <div
                class={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-0.5",
                  s === myStation() && "bg-game-ink ring-2 ring-game-yellow",
                )}
              >
                <span>{STATION_INFO[s].emoji}</span>
                <span class="flex-1 truncate font-bold">
                  {captain()
                    ? STATION_INFO[s].name
                    : memberAt(s).uid === props.myUid
                      ? "You"
                      : memberAt(s).uid === null
                        ? STATION_INFO[s].name
                        : memberAt(s).name}
                </span>
                <span class={stationStatus(s).tone}>
                  {stationStatus(s).text}
                </span>
              </div>
            )}
          </For>
        </div>

        <div class="min-h-32 rounded-xl border-4 border-game-cream bg-game-navy p-2">
          <div class="mb-1 text-sm text-game-grey">
            <Show
              when={myStation()}
              fallback={
                <Show
                  when={captain()}
                  fallback={<span>Watching the crew…</span>}
                >
                  👩‍✈️ You are the <b class="text-game-cream">Captain</b> - type
                  ANY job! Helpers only step in late.
                </Show>
              }
            >
              {(station) => (
                <>
                  {STATION_INFO[station()].emoji} You are the{" "}
                  <b class="text-game-cream">{STATION_INFO[station()].name}</b>{" "}
                  - {STATION_INFO[station()].blurb.toLowerCase()}!
                  <Show when={iAmAway()}>
                    {" "}
                    (🤖 a helper is covering - type to jump back in!)
                  </Show>
                </>
              )}
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
            <div class={cn("grid gap-2", captain() && "sm:grid-cols-2")}>
              <For each={myTasks().slice(0, captain() ? 4 : 3)}>
                {(task) => (
                  <div
                    class={cn(
                      "rounded-lg bg-game-ink px-3 py-1.5",
                      task.golden === true && "ring-2 ring-game-gold",
                      task.kind === "boss" && "ring-2 ring-game-blue",
                    )}
                  >
                    <div class="truncate text-xs text-game-grey">
                      {label(task)}
                    </div>
                    <Show
                      when={task.steps !== undefined && task.steps.length > 1}
                    >
                      <div class="flex flex-wrap justify-center gap-1 text-xs">
                        <For each={task.steps}>
                          {(step, i) => (
                            <span
                              class={cn(
                                "rounded-full px-2",
                                i() < stepOf(task)
                                  ? "bg-game-green text-game-ink line-through"
                                  : i() === stepOf(task)
                                    ? "bg-game-yellow text-game-ink"
                                    : "bg-game-navy text-game-grey",
                              )}
                            >
                              {i() + 1}. {step}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Words word={target(task)} typed={typed()} />
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
            <Show when={myTasks().length > (captain() ? 4 : 3)}>
              <div class="mt-1 text-center text-xs text-game-yellow">
                +{myTasks().length - (captain() ? 4 : 3)} more jobs waiting!
              </div>
            </Show>
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
            myCalls().length > 0 ? "everyone type it!" : "type a job's words"
          }
          ref={(el) => (inputEl = el)}
        />
      </div>
    </div>
  );
}

const TONE_BG: Record<NonNullable<Fx["tone"]>, string> = {
  red: "bg-game-red",
  yellow: "bg-game-yellow",
  blue: "bg-game-sky",
  gold: "bg-game-gold",
};
const TONE_BORDER: Record<NonNullable<Fx["tone"]>, string> = {
  red: "border-game-red",
  yellow: "border-game-yellow",
  blue: "border-game-sky",
  gold: "border-game-gold",
};

/** One short effect, animated with the Web Animations API. */
function FxView(props: { fx: Fx }): JSXElement {
  const els: HTMLElement[] = [];
  const keep = (el: Element): void => {
    els.push(el as HTMLElement);
  };
  const f = (): Fx => props.fx;
  const at = (): { left: string; top: string } => ({
    left: `${f().x}%`,
    top: `${f().y}%`,
  });

  onMount(() => {
    const fx = f();
    requestAnimationFrame(() => {
      els.forEach((el, i) => {
        const frames = framesFor(fx, i, els.length);
        if (frames.length === 0) return;
        el.animate(frames, {
          duration: FX_MS[fx.kind],
          easing:
            fx.kind === "petFly" || fx.kind === "crate"
              ? "ease-in"
              : "ease-out",
          fill: "forwards",
        });
      });
    });
  });

  return (
    <Switch>
      <Match when={f().kind === "flash"}>
        <div
          ref={keep}
          class={cn(
            "pointer-events-none absolute inset-0 opacity-0",
            TONE_BG[f().tone ?? "red"],
          )}
        ></div>
      </Match>
      <Match when={f().kind === "beam"}>
        <svg
          ref={keep}
          class="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        >
          <line
            x1={`${f().x}%`}
            y1={`${f().y}%`}
            x2={`${f().x2 ?? f().x}%`}
            y2={`${f().y2 ?? f().y}%`}
            class="stroke-game-sky"
            stroke-width="16"
            stroke-opacity="0.35"
            stroke-linecap="round"
          ></line>
          <line
            x1={`${f().x}%`}
            y1={`${f().y}%`}
            x2={`${f().x2 ?? f().x}%`}
            y2={`${f().y2 ?? f().y}%`}
            class="stroke-game-cloud"
            stroke-width="4"
            stroke-linecap="round"
          ></line>
        </svg>
      </Match>
      <Match when={f().kind === "ripple"}>
        <div
          ref={keep}
          class={cn(
            "pointer-events-none absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-8",
            TONE_BORDER[f().tone ?? "blue"],
          )}
          style={at()}
        ></div>
      </Match>
      <Match when={f().kind === "sparks" || f().kind === "bits"}>
        <For each={Array.from({ length: 8 }, (_, i) => i)}>
          {() => (
            <span
              ref={keep}
              class={cn(
                "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2",
                f().kind === "bits"
                  ? "h-2.5 w-2.5 rounded-sm bg-game-grey"
                  : cn("h-2 w-2 rounded-full", TONE_BG[f().tone ?? "yellow"]),
              )}
              style={at()}
            ></span>
          )}
        </For>
      </Match>
      <Match when={f().kind === "swoosh" || f().kind === "petFly"}>
        <img
          ref={keep}
          src={f().kind === "swoosh" ? ASTEROID_ART : f().img}
          alt=""
          class={cn(
            "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 [image-rendering:pixelated]",
            f().kind === "swoosh" ? "w-12 sm:w-14" : "w-10",
          )}
          style={at()}
        />
      </Match>
      <Match when={f().kind === "plus"}>
        <span
          class="pointer-events-none absolute -translate-x-1/2 animate-game-float-up text-xl font-bold text-game-yellow motion-reduce:animate-none"
          style={at()}
        >
          {f().text}
        </span>
      </Match>
      <Match when={f().kind === "swimOff"}>
        <span
          ref={keep}
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[6rem] leading-none sm:text-[8rem]"
          style={at()}
        >
          {f().text}
        </span>
      </Match>
      <Match when={true}>
        <span
          ref={keep}
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-3xl"
          style={at()}
        >
          {f().kind === "crate"
            ? "📦"
            : f().kind === "wrench"
              ? "🔧"
              : f().text}
        </span>
      </Match>
    </Switch>
  );
}

/** Keyframes for one effect element (i of n). */
function framesFor(f: Fx, i: number, n: number): Keyframe[] {
  const base = "translate(-50%, -50%)";
  switch (f.kind) {
    case "flash":
      return [{ opacity: 0.55 }, { opacity: 0 }];
    case "beam":
      return [
        { opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0 },
      ];
    case "ripple":
      return [
        { transform: `${base} scale(0.5)`, opacity: 0.9 },
        { transform: `${base} scale(1.5)`, opacity: 0 },
      ];
    case "sparks":
    case "bits": {
      const angle = (i / n) * Math.PI * 2 + (f.kind === "bits" ? 0.4 : 0);
      const dist = f.kind === "bits" ? 70 : 55;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      return [
        { transform: `${base} translate(0, 0) scale(1)`, opacity: 1 },
        {
          transform: `${base} translate(${dx}px, ${dy}px) scale(0.3) rotate(${f.kind === "bits" ? 220 : 0}deg)`,
          opacity: 0,
        },
      ];
    }
    case "swoosh":
      return [
        { transform: `${base} rotate(0deg) scale(1)`, opacity: 1 },
        {
          transform: `${base} translate(-260%, ${f.y > 50 ? 180 : -180}%) rotate(-400deg) scale(0.4)`,
          opacity: 0,
        },
      ];
    case "petFly":
    case "crate":
      return [
        {
          left: `${f.x}%`,
          top: `${f.y}%`,
          transform: `${base} scale(1)`,
          opacity: 1,
        },
        {
          left: `${f.x2 ?? f.x}%`,
          top: `${f.y2 ?? f.y}%`,
          transform: `${base} scale(0.3)`,
          opacity: 0.2,
        },
      ];
    case "wrench":
      return [
        { transform: `${base} rotate(0deg) scale(0.6)`, opacity: 1 },
        { transform: `${base} rotate(540deg) scale(1.2)`, opacity: 0 },
      ];
    case "puff":
      return [
        { transform: `${base} scale(0.6)`, opacity: 0.9 },
        { transform: `${base} translate(-30px, -40px) scale(1.6)`, opacity: 0 },
      ];
    case "swimOff":
      return [
        { transform: `${base} scaleX(-1)`, opacity: 1 },
        { transform: `${base} translate(60vw, -30%) scaleX(-1)`, opacity: 0.4 },
      ];
    default:
      return [];
  }
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
        props.big === true ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
      )}
    >
      <span class="text-game-green">{props.word.slice(0, done())}</span>
      <span>{props.word.slice(done())}</span>
    </div>
  );
}

import {
  createEffect,
  createSignal,
  For,
  Index,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";

import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TypingReport, TypingTracker } from "../shared/typing-report";
import {
  HOT_HAND,
  Stall,
  STALLS,
  Target,
  TargetKind,
  TossDifficulty,
  TossEvent,
  TossSim,
} from "./toss-rules";

export type TossEnd = {
  tickets: number;
  words: number;
  misses: number;
  accuracy: number;
  wpm: number;
  bestStreak: number;
  timeMs: number;
  report: TypingReport;
};

/** Online: the shared stall. */
export type TossShared = {
  myUid: string;
  startAt: number;
  now: () => number;
  kills: () => Record<string, string>;
  claim: (id: string) => void;
  report: (tickets: number, done: boolean) => void;
  others: () => { name: string; score: number }[];
};

const EMOJI: Record<TargetKind, string> = {
  duck: "🦆",
  can: "🥫",
  mole: "🐹",
  golden: "🏆",
  time: "⏱️",
  double: "✨",
  trap: "💣",
};

type Fx = {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: "ball" | "fall" | "pop" | "points";
};

/** The stall: targets, throws, the typing box. */
export function TossGame(props: {
  stall: Stall;
  words: string[];
  seed: number;
  difficulty: TossDifficulty;
  shared?: TossShared;
  onEnd: (e: TossEnd) => void;
}): JSXElement {
  const shared = untrack(() => props.shared);
  const stall = untrack(() => props.stall);
  const sim = new TossSim({
    stall,
    words: untrack(() => props.words),
    seed: untrack(() => props.seed),
    difficulty: untrack(() => props.difficulty),
  });
  const tracker = new TypingTracker();
  const [frame, setFrame] = createSignal(0);
  const [value, setValue] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [banner, setBanner] = createSignal<string>();
  const [fx, setFx] = createSignal<Fx[]>([]);
  let fxId = 0;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let ended = false;
  let wordMisses = 0;
  let lastReport = 0;
  const seen = new Set<string>();
  const mine = new Set<string>();

  const live = <T,>(read: () => T): T => {
    frame();
    return read();
  };
  const say = (text: string, ms = 1500): void => {
    clearTimeout(bannerTimer);
    setBanner(text);
    bannerTimer = setTimeout(() => setBanner(undefined), ms);
  };
  const addFx = (
    x: number,
    y: number,
    text: string,
    kind: Fx["kind"],
    ms = 700,
  ): void => {
    const id = ++fxId;
    setFx((f) => [...f.slice(-12), { id, x, y, text, kind }]);
    setTimeout(() => setFx((f) => f.filter((e) => e.id !== id)), ms);
  };

  const handle = (events: TossEvent[]): void => {
    for (const e of events) {
      switch (e.type) {
        case "hit":
          addFx(e.x, e.y, "⚾", "ball", 260);
          setTimeout(() => {
            addFx(
              e.x,
              e.y,
              EMOJI[e.kind],
              e.kind === "mole" ? "pop" : "fall",
              800,
            );
            addFx(e.x, e.y - 8, `+${e.tickets} 🎟️`, "points", 900);
          }, 200);
          sfx.good();
          if (e.kind === "golden") say("🏆 GOLDEN PRIZE! 5× tickets!", 1600);
          if (shared !== undefined) {
            mine.add(e.id);
            shared.claim(e.id);
          }
          break;
        case "stack":
          sfx.great();
          say(`🥫 Whole stack down! +${e.bonus} 🎟️`, 1500);
          break;
        case "trap":
          sfx.bad();
          addFx(e.x, e.y, "💥", "pop", 700);
          say("💣 Oops - a trap! -5 seconds", 1600);
          break;
        case "time":
          sfx.great();
          say("⏱️ +5 seconds!", 1200);
          break;
        case "double":
          sfx.great();
          say("✨ Double tickets for 8 seconds!", 1400);
          break;
        case "hot":
          sfx.great();
          say(`🔥 HOT HAND! ${HOT_HAND} in a row = 2× tickets`, 1600);
          break;
        case "miss":
          sfx.oops();
          tracker.miss();
          wordMisses++;
          break;
        case "over":
          finish();
          break;
      }
    }
  };

  const finish = (): void => {
    if (ended) return;
    ended = true;
    shared?.report(sim.tickets, true);
    sfx.finish();
    setTimeout(
      () =>
        props.onEnd({
          tickets: sim.tickets,
          words: sim.words,
          misses: sim.misses,
          accuracy: sim.accuracy(),
          wpm: tracker.report().wpm,
          bestStreak: sim.bestStreak,
          timeMs: sim.t,
          report: tracker.report(),
        }),
      900,
    );
  };

  const onInput = (raw: string): void => {
    const word = raw.trim().toLowerCase();
    const events = sim.type(raw);
    const done = events.some((e) => e.type === "hit" || e.type === "trap");
    if (done && events.some((e) => e.type === "hit")) {
      tracker.word(word, wordMisses);
      wordMisses = 0;
    }
    handle(events);
    setValue(done ? "" : raw);
    setWrong(
      !done &&
        sim.typed !== "" &&
        !sim.targets.some((t) => t.word.startsWith(sim.typed)),
    );
    setFrame((f) => f + 1);
  };

  // online: others' hits
  createEffect(() => {
    if (shared === undefined) return;
    for (const [id, uid] of Object.entries(shared.kills())) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (uid !== shared.myUid && !mine.has(id)) handle(sim.remoteHit(id));
    }
  });

  onMount(() => {
    let raf = 0;
    let last = shared?.now() ?? performance.now();
    const loop = (): void => {
      const now = shared?.now() ?? performance.now();
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      if (!ended && (shared === undefined || now >= shared.startAt)) {
        tracker.tick(dt);
        handle(sim.step(dt));
        if (shared !== undefined && now - lastReport > 500) {
          lastReport = now;
          shared.report(sim.tickets, false);
        }
      }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      clearTimeout(bannerTimer);
    });
  });

  const targets = (): Target[] =>
    live(() => sim.targets.map((t) => ({ ...t })));
  const typedFor = (w: string): number =>
    live(() =>
      sim.typed !== "" && w.startsWith(sim.typed) ? sim.typed.length : 0,
    );
  const countdown = (): number =>
    live(() =>
      shared === undefined
        ? 0
        : Math.ceil((shared.startAt - shared.now()) / 1000),
    );
  const secs = (): number => live(() => Math.ceil(sim.left / 1000));

  return (
    <div class="relative flex h-full w-full flex-col overflow-hidden bg-game-night font-kid select-none">
      {/* HUD */}
      <div class="z-20 flex flex-wrap items-center gap-2 bg-game-ink px-3 pt-16 pb-1.5 text-sm font-bold text-game-cream sm:pt-1.5 sm:pr-48 sm:pl-20">
        <span>
          {STALLS[stall].emoji} {STALLS[stall].name}
        </span>
        <span
          class={cn(
            "rounded-full px-2",
            secs() <= 10 ? "bg-game-red" : "bg-game-cream/15",
          )}
        >
          ⏱ {secs()}s
        </span>
        <span class="text-game-yellow">🎟️ {live(() => sim.tickets)}</span>
        <span class="flex items-center gap-1">
          🔥
          <Index each={Array.from({ length: HOT_HAND })}>
            {(_, i) => (
              <span
                class={cn(
                  "h-2.5 w-2.5 rounded-full",
                  live(() => Math.min(sim.streak, HOT_HAND)) > i
                    ? "bg-game-orange"
                    : "bg-game-cream/25",
                )}
              ></span>
            )}
          </Index>
          <Show when={live(() => sim.hot)}>
            <span class="rounded-full bg-game-orange px-2 text-game-ink">
              2×
            </span>
          </Show>
        </span>
        <Show when={live(() => sim.double)}>
          <span class="rounded-full bg-game-yellow px-2 text-game-ink">
            ✨ 2×
          </span>
        </Show>
        <Show when={shared !== undefined}>
          <For each={shared?.others() ?? []}>
            {(o) => (
              <span class="rounded-full bg-game-cream/15 px-2 font-normal">
                {o.name}: 🎟️ {o.score}
              </span>
            )}
          </For>
        </Show>
      </div>

      {/* awning */}
      <div class="h-6 shrink-0 bg-[repeating-linear-gradient(90deg,var(--color-game-red)_0_32px,var(--color-game-cream)_32px_64px)] shadow-[0_4px_0_rgb(0_0_0/0.25)]"></div>

      {/* the stall */}
      <div
        class={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          stall === "ducks"
            ? "bg-game-sky"
            : stall === "cans"
              ? "bg-game-tan"
              : "bg-game-grass",
        )}
      >
        <Show when={stall === "ducks"}>
          <div class="absolute inset-x-0 top-[44%] h-[8%] bg-game-blue/60"></div>
          <div class="absolute inset-x-0 top-[76%] h-[8%] bg-game-blue/60"></div>
          <div class="absolute inset-x-0 top-[47%] text-center text-2xl tracking-[0.5em] text-game-cream/70">
            〰〰〰〰〰〰〰〰〰〰
          </div>
        </Show>
        <Show when={stall === "cans"}>
          <div class="absolute inset-x-[20%] top-[80%] h-4 rounded bg-game-brown-dark shadow-[0_4px_0_rgb(0_0_0/0.3)]"></div>
        </Show>
        <Show when={stall === "moles"}>
          <For
            each={[
              [20, 40],
              [50, 40],
              [80, 40],
              [20, 75],
              [50, 75],
              [80, 75],
            ]}
          >
            {([x, y]) => (
              <div
                class="absolute h-8 w-24 -translate-x-1/2 rounded-[100%] bg-game-brown-dark"
                style={{ left: `${x}%`, top: `${(y ?? 0) + 5}%` }}
              ></div>
            )}
          </For>
        </Show>

        <Index each={targets()}>
          {(t) => (
            <div
              class={cn(
                "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
                t().kind === "mole" && "motion-safe:animate-game-pop",
              )}
              style={{ left: `${t().x}%`, top: `${t().y}%` }}
            >
              <span
                class={cn(
                  "leading-none drop-shadow",
                  t().kind === "can" ? "text-5xl" : "text-5xl sm:text-6xl",
                  ["golden", "time", "double"].includes(t().kind) &&
                    "animate-game-bob",
                  t().kind === "trap" && "animate-pulse",
                )}
              >
                {EMOJI[t().kind]}
              </span>
              <span
                class={cn(
                  "rounded-lg px-2 font-mono text-lg font-bold shadow sm:text-xl",
                  t().kind === "trap"
                    ? "bg-game-red text-game-cream"
                    : t().kind === "golden"
                      ? "bg-game-gold text-game-ink"
                      : "bg-game-cream text-game-ink",
                )}
              >
                <span class="text-game-green">
                  {t().word.slice(0, typedFor(t().word))}
                </span>
                {t().word.slice(typedFor(t().word))}
              </span>
            </div>
          )}
        </Index>

        <For each={fx()}>
          {(f) => (
            <span
              class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 font-bold"
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
              ref={(el) => {
                if (f.kind !== "ball") return;
                // start once the ball is on the page
                requestAnimationFrame(() => {
                  el.animate(
                    [
                      {
                        left: "50%",
                        top: "100%",
                        transform: "translate(-50%,-50%) scale(1.6)",
                      },
                      {
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        transform: "translate(-50%,-50%) scale(0.8)",
                      },
                    ],
                    { duration: 220, easing: "ease-out", fill: "forwards" },
                  );
                });
              }}
            >
              <span
                class={cn(
                  f.kind === "points"
                    ? "inline-block animate-game-float-up text-xl text-game-ink"
                    : f.kind === "pop"
                      ? "inline-block animate-game-pop text-5xl"
                      : f.kind === "ball"
                        ? "text-3xl"
                        : "inline-block animate-game-fall text-5xl",
                )}
              >
                {f.text}
              </span>
            </span>
          )}
        </For>

        <Show when={banner()}>
          {(b) => (
            <div class="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 animate-game-pop rounded-full bg-game-yellow px-5 py-1 text-center text-base font-bold whitespace-nowrap text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.25)] sm:text-xl">
              {b()}
            </div>
          )}
        </Show>
        <Show when={countdown() > 0}>
          <div class="absolute inset-0 z-30 grid place-items-center bg-game-ink/40 text-8xl font-bold text-game-yellow">
            {countdown()}
          </div>
        </Show>
      </div>

      {/* counter */}
      <div class="z-20 flex justify-center border-t-8 border-game-brown bg-game-brown-dark px-3 pt-2 pb-3">
        <MiniTypingInput
          value={value()}
          onInput={onInput}
          wrong={wrong()}
          waiting={countdown() > 0}
          placeholder="type a target's word"
        />
      </div>
    </div>
  );
}

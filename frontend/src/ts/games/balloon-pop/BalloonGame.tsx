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

import type { ArcadeSend } from "../shared/arcade-room";

import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TypingReport, TypingTracker } from "../shared/typing-report";
import {
  Balloon,
  BalloonColor,
  BalloonSim,
  goalMet,
  goalText,
  Level,
  POWER_INFO,
  PopEvent,
  START_LIVES,
  Tally,
  Theme,
  VERSUS_MS,
} from "./balloon-rules";

export type BalloonEnd = {
  score: number;
  wave: number;
  cleared: boolean;
  hits: number;
  misses: number;
  accuracy: number;
  bestStreak: number;
  tally: Tally;
  report: TypingReport;
};

/** Versus: the other player, and balloons sent to me. */
export type BalloonVersus = {
  myUid: string;
  startAt: number;
  now: () => number;
  sends: () => Record<string, ArcadeSend>;
  opponent: () =>
    | { name: string; score: number; lives: number; done: boolean }
    | undefined;
  send: (word: string) => void;
  report: (score: number, lives: number, done: boolean) => void;
};

const THEME: Record<Theme, { sky: string; ground: string; props: string[] }> = {
  garden: {
    sky: "bg-linear-to-b from-game-sky-top to-game-sky",
    ground: "bg-game-grass",
    props: ["🌻", "🌷", "🌳", "🌼", "🌻", "🌳", "🌷", "🌼"],
  },
  beach: {
    sky: "bg-linear-to-b from-game-sky to-game-sunset",
    ground: "bg-game-tan",
    props: ["🌴", "🏖️", "🐚", "🌴", "⛱️", "🦀", "🌴", "🐚"],
  },
  party: {
    sky: "bg-linear-to-b from-game-dusk to-game-pink",
    ground: "bg-game-purple",
    props: ["🎉", "🎂", "🎁", "🎊", "🎉", "🧁", "🎁", "🎊"],
  },
};

const FILL: Record<BalloonColor, string> = {
  red: "var(--color-game-red)",
  blue: "var(--color-game-blue)",
  yellow: "var(--color-game-yellow)",
  green: "var(--color-game-green)",
  purple: "var(--color-game-purple)",
  pink: "var(--color-game-pink)",
  orange: "var(--color-game-orange)",
};

type Fx = {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: "pop" | "points" | "bird" | "bad";
};

/** The balloons, the scenery and the typing box. */
export function BalloonGame(props: {
  level: Level;
  words: string[];
  seed: number;
  versus?: BalloonVersus;
  onEnd: (e: BalloonEnd) => void;
}): JSXElement {
  const vs = untrack(() => props.versus);
  const level = untrack(() => props.level);
  const sim = new BalloonSim({
    level,
    words: untrack(() => props.words),
    seed: untrack(() => props.seed),
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
  const seenSends = new Set<string>();

  const live = <T,>(read: () => T): T => {
    frame();
    return read();
  };
  const say = (text: string, ms = 1600): void => {
    clearTimeout(bannerTimer);
    setBanner(text);
    bannerTimer = setTimeout(() => setBanner(undefined), ms);
  };
  const addFx = (
    x: number,
    y: number,
    text: string,
    tone: Fx["tone"],
    ms = 800,
  ): void => {
    const id = ++fxId;
    setFx((f) => [...f.slice(-14), { id, x, y, text, tone }]);
    setTimeout(() => setFx((f) => f.filter((e) => e.id !== id)), ms);
  };

  const handle = (events: PopEvent[]): void => {
    for (const e of events) {
      switch (e.type) {
        case "pop":
          // the pop rises in pitch as the streak grows
          sfx.note(Math.min(7, sim.streak - 1));
          addFx(e.x, e.y, "🎊", "pop");
          addFx(e.x, e.y - 8, `+${e.points}`, "points");
          if (e.count > 1) say("🎈🎈🎈 Bunch pop!", 1000);
          if (sim.streak > 0 && sim.streak % 5 === 0) {
            say(`🔥 ${sim.streak} in a row!`, 1100);
          }
          break;
        case "power":
          sfx.great();
          say(
            `${POWER_INFO[e.kind].emoji} ${POWER_INFO[e.kind].name}! ${POWER_INFO[e.kind].tip}`,
            2000,
          );
          break;
        case "bonus":
          addFx(e.x, e.y - 14, `🎁 +${e.points}`, "points");
          break;
        case "boom":
          sfx.bad();
          addFx(e.x, e.y, "💥", "bad");
          say("💣 Oops - that was a bomb balloon!", 1800);
          break;
        case "escape":
          sfx.oops();
          addFx(e.x, 6, "🐦🎈", "bird", 1200);
          break;
        case "phew":
          say("😅 Phew! The bomb floated away.", 1200);
          break;
        case "miss":
          sfx.oops();
          tracker.miss();
          wordMisses++;
          break;
        case "send":
          if (vs !== undefined) {
            vs.send(sim.sendWord());
            say("📨 Sent a balloon to your rival!", 1100);
          }
          break;
        case "wave":
          if (level.waves > 0) say(`🎈 Wave ${e.wave} of ${level.waves}`, 1500);
          else say(`🎈 Wave ${e.wave}`, 1300);
          break;
        case "waveClear":
          say(`✨ Wave ${e.wave} done!`, 1500);
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
    vs?.report(sim.score, sim.lives, true);
    if (sim.cleared) sfx.finish();
    setTimeout(
      () =>
        props.onEnd({
          score: sim.score,
          wave: sim.cleared ? sim.wave : Math.max(1, sim.wave - 1),
          cleared: sim.cleared,
          hits: sim.tally.popped,
          misses: sim.misses,
          accuracy: sim.accuracy(),
          bestStreak: sim.bestStreak,
          tally: { ...sim.tally },
          report: tracker.report(),
        }),
      1200,
    );
  };

  const onInput = (raw: string): void => {
    const word = raw.trim().toLowerCase();
    const events = sim.type(raw);
    const done = events.some((e) => e.type === "pop" || e.type === "boom");
    if (done) {
      tracker.word(word, wordMisses);
      wordMisses = 0;
    }
    handle(events);
    setValue(done ? "" : raw);
    setWrong(
      !done &&
        sim.typed !== "" &&
        !sim.targets().some((b) => b.word.startsWith(sim.typed)),
    );
    setFrame((f) => f + 1);
  };

  // versus: balloons sent to me
  createEffect(() => {
    if (vs === undefined) return;
    for (const [n, s] of Object.entries(vs.sends())) {
      if (seenSends.has(n)) continue;
      seenSends.add(n);
      sim.receive(s.word);
      say("📨 Your rival sent you a balloon!", 1100);
    }
  });

  onMount(() => {
    let raf = 0;
    let last = vs?.now() ?? performance.now();
    const loop = (): void => {
      const now = vs?.now() ?? performance.now();
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      if (!ended && (vs === undefined || now >= vs.startAt)) {
        tracker.tick(dt);
        handle(sim.step(dt));
        if (vs !== undefined && sim.t >= VERSUS_MS) handle(sim.timeUp());
        if (vs !== undefined && now - lastReport > 500) {
          lastReport = now;
          vs.report(sim.score, sim.lives, sim.over);
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

  // fresh copies each frame, so <Index> sees the new positions
  const balloons = (): Balloon[] =>
    live(() => sim.balloons.map((b) => ({ ...b })));
  const typedFor = (b: Balloon): number =>
    live(() =>
      sim.typed !== "" &&
      b.word.startsWith(sim.typed) &&
      !(b.kind === "cloud" && b.y > 45)
        ? sim.typed.length
        : 0,
    );
  const countdown = (): number =>
    live(() =>
      vs === undefined ? 0 : Math.ceil((vs.startAt - vs.now()) / 1000),
    );
  const goalDone = (): boolean =>
    live(() =>
      goalMet(level.goal, sim.tally, {
        bestStreak: sim.bestStreak,
        accuracy: sim.accuracy(),
      }),
    );

  return (
    <div class="relative flex h-full w-full flex-col overflow-hidden font-kid text-game-ink select-none">
      {/* HUD */}
      <div class="z-20 flex flex-wrap items-center gap-2 bg-game-cream/90 px-3 pt-16 pb-1.5 text-sm font-bold sm:pt-1.5 sm:pr-48 sm:pl-20">
        <Show
          when={level.id > 0}
          fallback={<span>🎈 Wave {live(() => sim.wave)}</span>}
        >
          <span>
            Level {level.id} · Wave {live(() => sim.wave)}/{level.waves}
          </span>
        </Show>
        <span>⭐ {live(() => sim.score)}</span>
        <span>
          {"❤️".repeat(live(() => sim.lives))}
          {"🤍".repeat(Math.max(0, START_LIVES - live(() => sim.lives)))}
        </span>
        <Show when={live(() => sim.streak) >= 3}>
          <span class="rounded-full bg-game-orange px-2 text-game-cream">
            🔥 {sim.streak}
          </span>
        </Show>
        <Show when={live(() => sim.double)}>
          <span>🌈 x2</span>
        </Show>
        <Show when={live(() => sim.t < sim.wandUntil)}>
          <span>🫧 slow</span>
        </Show>
        <Show when={level.id > 0}>
          <span
            class={cn(
              "rounded-full px-2",
              goalDone() ? "bg-game-green text-game-cream" : "bg-game-ink/10",
            )}
          >
            🎯 {goalText(level.goal)} {goalDone() ? "✓" : ""}
          </span>
        </Show>
        <Show when={vs !== undefined}>
          <span>
            ⏱ {live(() => Math.max(0, Math.ceil((VERSUS_MS - sim.t) / 1000)))}s
          </span>
        </Show>
        <Show when={vs?.opponent()}>
          {(o) => (
            <span class="rounded-full bg-game-ink/10 px-2">
              🆚 {o().name}: ⭐ {o().score} {"❤️".repeat(o().lives)}
              {o().done ? " (out)" : ""}
            </span>
          )}
        </Show>
      </div>

      {/* the sky */}
      <div
        class={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          THEME[level.theme].sky,
        )}
      >
        <div class="absolute top-[8%] left-[10%] animate-game-drift text-5xl opacity-80">
          ☁️
        </div>
        <div class="absolute top-[22%] left-[60%] animate-game-drift text-4xl opacity-70">
          ☁️
        </div>
        <div
          class={cn(
            "absolute inset-x-0 bottom-0 h-[10%]",
            THEME[level.theme].ground,
          )}
        >
          <div class="absolute inset-x-0 -top-7 flex justify-around text-3xl">
            <For each={THEME[level.theme].props}>{(p) => <span>{p}</span>}</For>
          </div>
        </div>
        <Index each={balloons()}>
          {(b) => {
            const hidden = (): boolean => b().kind === "cloud" && b().y > 45;
            return (
              <div
                class="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${b().x}%`, top: `${b().y}%` }}
              >
                <div class="relative">
                  <svg
                    viewBox="0 0 40 56"
                    class={cn(
                      b().kind === "big"
                        ? "w-20 sm:w-24"
                        : b().kind === "bunch"
                          ? "w-11 sm:w-14"
                          : "w-14 sm:w-[4.5rem]",
                    )}
                  >
                    <ellipse
                      cx="20"
                      cy="20"
                      rx="17"
                      ry="20"
                      fill={
                        b().kind === "bomb"
                          ? "var(--color-game-ink)"
                          : FILL[b().color]
                      }
                    ></ellipse>
                    <ellipse
                      cx="13"
                      cy="12"
                      rx="4"
                      ry="6"
                      fill="white"
                      opacity="0.45"
                    ></ellipse>
                    <path
                      d="M17 39 L23 39 L20 43 Z"
                      fill={
                        b().kind === "bomb"
                          ? "var(--color-game-ink)"
                          : FILL[b().color]
                      }
                    ></path>
                    <path
                      d="M20 43 Q16 49 20 56"
                      stroke="var(--color-game-ink)"
                      stroke-width="1"
                      fill="none"
                      opacity="0.5"
                    ></path>
                  </svg>
                  <span class="absolute top-[22%] left-1/2 -translate-x-1/2 text-lg">
                    {b().kind === "gift"
                      ? "🎁"
                      : b().kind === "bomb"
                        ? "💣"
                        : b().kind === "sent"
                          ? "📨"
                          : ""}
                  </span>
                  <Show when={hidden()}>
                    <span class="absolute -inset-3 text-5xl">☁️</span>
                  </Show>
                </div>
                <Show
                  when={
                    b().kind !== "bunch" ||
                    balloons().find(
                      (x) => x.word === b().word && x.kind === "bunch",
                    ) === b()
                  }
                >
                  <span
                    class={cn(
                      "-mt-1 rounded-lg px-2 font-mono text-base font-bold shadow sm:text-lg",
                      b().kind === "bomb"
                        ? "bg-game-red text-game-cream"
                        : "bg-game-cream text-game-ink",
                    )}
                  >
                    <Show when={!hidden()} fallback="???">
                      <span class="text-game-green">
                        {b().word.slice(0, typedFor(b()))}
                      </span>
                      {b().word.slice(typedFor(b()))}
                      {b().kind === "bunch" ? " ×3" : ""}
                    </Show>
                  </span>
                </Show>
              </div>
            );
          }}
        </Index>
        <For each={fx()}>
          {(f) => (
            <span
              class={cn(
                "pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 font-bold",
                f.tone === "points"
                  ? "animate-game-float-up text-lg text-game-ink"
                  : f.tone === "bird"
                    ? "animate-game-float-up text-3xl"
                    : "animate-game-pop text-4xl",
              )}
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
            >
              {f.text}
            </span>
          )}
        </For>
        <Show when={banner()}>
          {(t) => (
            <div class="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 animate-game-pop rounded-full bg-game-yellow px-5 py-1 text-center text-base font-bold whitespace-nowrap text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.25)] sm:text-xl">
              {t()}
            </div>
          )}
        </Show>
        <Show when={countdown() > 0}>
          <div class="absolute inset-0 z-30 grid place-items-center bg-game-ink/30 text-8xl font-bold text-game-yellow">
            {countdown()}
          </div>
        </Show>
      </div>

      <div class="z-20 flex justify-center bg-game-cream px-3 pt-2 pb-3">
        <MiniTypingInput
          value={value()}
          onInput={onInput}
          wrong={wrong()}
          waiting={countdown() > 0}
          placeholder="type a balloon's word"
        />
      </div>
    </div>
  );
}

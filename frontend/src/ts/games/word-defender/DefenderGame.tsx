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

import type { ArcadeFx } from "../shared/arcade-room";

import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TypingReport, TypingTracker } from "../shared/typing-report";
import {
  BASE_Y,
  comboTier,
  DefEvent,
  DefenderOpts,
  DefenderSim,
  POWER_INFO,
  PowerKind,
  Ship,
  ShipKind,
  START_LIVES,
  UpgradeId,
  UPGRADES,
} from "./defender-rules";

export type DefenderEnd = {
  score: number;
  wave: number;
  hits: number;
  misses: number;
  cleared: boolean;
  bestStreak: number;
  report: TypingReport;
};

/** Co-op: what the room tells this game, and what it sends back. */
export type DefenderCoop = {
  isHost: boolean;
  myUid: string;
  /** server-clock start */
  startAt: number;
  now: () => number;
  kills: () => Record<string, string>;
  hits: () => Record<string, boolean>;
  fx: () => Record<string, ArcadeFx>;
  claim: (id: string) => void;
  markHit: (id: string) => void;
  sendFx: (n: string, kind: PowerKind) => void;
  report: (score: number, lives: number, done: boolean) => void;
};

const SHIP_EMOJI: Record<ShipKind, string> = {
  basic: "👾",
  shield: "👾",
  splitter: "🦠",
  zigzag: "🛸",
  scout: "🚀",
  cloak: "👻",
  mini: "🦠",
};
const LASER = [
  "var(--color-game-blue)",
  "var(--color-game-green)",
  "var(--color-game-purple)",
  "var(--color-game-gold)",
];
const TIER_NAME = [
  "",
  "🔥 COMBO x2!",
  "⚡ SUPER COMBO x3!",
  "🌈 MEGA COMBO x4!",
];

type Fx = {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: "boom" | "points" | "shield";
};

/** The battle: space, ships, the cannon at the bottom, the typing box. */
export function DefenderGame(props: {
  opts: DefenderOpts;
  coop?: DefenderCoop;
  onEnd: (e: DefenderEnd) => void;
}): JSXElement {
  const coop = untrack(() => props.coop);
  const sim = new DefenderSim(untrack(() => props.opts));
  const tracker = new TypingTracker();
  const [frame, setFrame] = createSignal(0);
  const [value, setValue] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [banner, setBanner] = createSignal<string>();
  const [fx, setFx] = createSignal<Fx[]>([]);
  const [laser, setLaser] = createSignal<{
    id: number;
    x: number;
    y: number;
    tier: number;
  } | null>(null);
  const [shake, setShake] = createSignal(0);
  let fxId = 0;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let ended = false;
  let wordMisses = 0;
  const seenKills = new Set<string>();
  const seenFx = new Set<string>();
  const myClaims = new Set<string>();
  let fxCount = 0;
  let lastReport = 0;

  const say = (text: string, ms = 1800): void => {
    clearTimeout(bannerTimer);
    setBanner(text);
    bannerTimer = setTimeout(() => setBanner(undefined), ms);
  };
  const fire = (x: number, y: number): void => {
    const id = ++fxId;
    setLaser({ id, x, y, tier: comboTier(sim.streak) });
    setTimeout(() => setLaser((l) => (l?.id === id ? null : l)), 220);
  };
  const addFx = (
    x: number,
    y: number,
    text: string,
    tone: Fx["tone"],
  ): void => {
    const id = ++fxId;
    setFx((f) => [...f.slice(-10), { id, x, y, text, tone }]);
    setTimeout(() => setFx((f) => f.filter((e) => e.id !== id)), 700);
  };

  const handle = (events: DefEvent[], typedWord?: string): void => {
    for (const e of events) {
      switch (e.type) {
        case "zap":
          addFx(e.x, e.y, "💥", "boom");
          if (e.points > 0) {
            addFx(e.x, e.y - 6, `+${e.points}`, "points");
            fire(e.x, e.y);
            sfx.good();
            if (coop !== undefined) {
              myClaims.add(e.id);
              coop.claim(e.id);
            }
          }
          break;
        case "shieldBreak":
          addFx(e.x, e.y, "🛡️💥", "shield");
          fire(e.x, e.y);
          sfx.pop();
          say("🛡️ Shield down - type it again!", 1200);
          break;
        case "split":
          say("🦠 It split in two!", 1000);
          break;
        case "power":
          sfx.great();
          say(
            `${POWER_INFO[e.kind].emoji} ${POWER_INFO[e.kind].name}! ${POWER_INFO[e.kind].tip}`,
          );
          if (coop !== undefined) {
            coop.claim(e.id);
            coop.sendFx(`${coop.myUid.slice(0, 6)}${++fxCount}`, e.kind);
          }
          break;
        case "bossPart":
          sfx.great();
          setShake((n) => n + 1);
          say(
            e.part === "core"
              ? "💥 Core destroyed!"
              : e.part === "shield"
                ? "🛡️ Shield down - hit the core!"
                : "💥 Cannon down!",
            1300,
          );
          if (coop !== undefined) coop.claim(e.id);
          break;
        case "bossDown":
          sfx.finish();
          setShake((n) => n + 1);
          say("🎉 MOTHERSHIP DESTROYED!", 2200);
          break;
        case "bossHit":
          say("💢 The mothership hit your base!", 2000);
          break;
        case "hit":
          setShake((n) => n + 1);
          if (e.shielded) {
            sfx.pop();
            say("🛡️ Your shield blocked a ship!", 1200);
          } else {
            sfx.bad();
            if (coop?.isHost === true && !e.id.startsWith("boss")) {
              coop.markHit(e.id);
            }
            if (coop?.isHost === true && e.id === "boss") {
              coop.markHit(`boss${sim.wave}a`);
              coop.markHit(`boss${sim.wave}b`);
            }
          }
          break;
        case "drone":
          addFx(50, 80, "🛸 zap!", "points");
          break;
        case "miss":
          sfx.oops();
          tracker.miss();
          wordMisses++;
          break;
        case "combo":
          say(TIER_NAME[e.tier] ?? "", 1400);
          sfx.great();
          break;
        case "wave":
          say(
            e.boss ? "⚠️ MOTHERSHIP INCOMING! ⚠️" : `🌊 Wave ${e.wave}`,
            2000,
          );
          break;
        case "waveClear":
          say(`✨ Wave ${e.wave} cleared! +${e.bonus}`, 2000);
          break;
        case "over":
          finish();
          break;
      }
    }
    if (typedWord !== undefined) {
      tracker.word(typedWord, wordMisses);
      wordMisses = 0;
    }
  };

  const finish = (): void => {
    if (ended) return;
    ended = true;
    coop?.report(sim.score, sim.lives, true);
    setTimeout(
      () =>
        props.onEnd({
          score: sim.score,
          wave: sim.wave,
          hits: sim.hits,
          misses: sim.misses,
          cleared: sim.cleared,
          bestStreak: sim.bestStreak,
          report: tracker.report(),
        }),
      1200,
    );
  };

  const onInput = (raw: string): void => {
    if (sim.offer !== null) {
      const pick = sim.offer.find(
        (u) => UPGRADES[u].word === raw.trim().toLowerCase(),
      );
      if (pick !== undefined) choose(pick);
      else setValue(raw);
      return;
    }
    const before = sim.targets().map((t) => t.word);
    const events = sim.type(raw);
    const done = events.some((e) =>
      ["zap", "shieldBreak", "power", "bossPart"].includes(e.type),
    );
    const word = before.find(
      (w) => w === raw.trim().toLowerCase().replace(/\s+/g, " "),
    );
    handle(events, done ? word : undefined);
    setValue(done ? "" : raw);
    setWrong(
      !done &&
        sim.typed !== "" &&
        !sim.targets().some((t) => t.word.startsWith(sim.typed)),
    );
    setFrame((f) => f + 1);
  };

  const choose = (u: UpgradeId): void => {
    sim.choose(u);
    sfx.great();
    say(`${UPGRADES[u].emoji} ${UPGRADES[u].name}!`, 1400);
    setValue("");
    setFrame((f) => f + 1);
  };

  // co-op: other players' kills, power-ups and base hits
  createEffect(() => {
    if (coop === undefined) return;
    const kills = coop.kills();
    for (const [id, uid] of Object.entries(kills)) {
      if (seenKills.has(id)) continue;
      seenKills.add(id);
      if (uid !== coop.myUid && !myClaims.has(id)) handle(sim.remoteKill(id));
    }
    for (const [n, f] of Object.entries(coop.fx())) {
      if (seenFx.has(n)) continue;
      seenFx.add(n);
      if (f.uid !== coop.myUid) {
        handle(sim.applyPower(f.kind as PowerKind, [], false));
        say(
          `${POWER_INFO[f.kind as PowerKind]?.emoji ?? "✨"} A friend used ${POWER_INFO[f.kind as PowerKind]?.name ?? "a power-up"}!`,
          1500,
        );
      }
    }
    if (!coop.isHost) {
      handle(sim.setLives(START_LIVES - Object.keys(coop.hits()).length));
    }
  });

  onMount(() => {
    let raf = 0;
    let last = coop?.now() ?? performance.now();
    const loop = (): void => {
      const now = coop?.now() ?? performance.now();
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      if (!ended && (coop === undefined || now >= coop.startAt)) {
        if (sim.offer === null) tracker.tick(dt);
        handle(sim.step(dt));
        if (coop !== undefined && now - lastReport > 500) {
          lastReport = now;
          coop.report(sim.score, sim.lives, sim.over);
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

  // ---------------------------------------------------------- view helpers
  /** Read the game's state, re-rendered every frame. */
  const live = <T,>(read: () => T): T => {
    frame();
    return read();
  };
  // fresh copies each frame, so <Index> sees the new positions
  const ships = (): Ship[] => {
    frame();
    return sim.ships.map((x) => ({ ...x }));
  };
  const countdown = (): number => {
    frame();
    return coop === undefined
      ? 0
      : Math.ceil((coop.startAt - coop.now()) / 1000);
  };
  const typedFor = (word: string): number => {
    frame();
    return sim.typed !== "" && word.startsWith(sim.typed)
      ? sim.typed.length
      : 0;
  };

  return (
    <div
      class="relative flex h-full w-full flex-col overflow-hidden bg-linear-to-b from-game-night to-game-ink font-kid text-game-cream select-none"
      ref={(el) => {
        createEffect(() => {
          if (shake() > 0) {
            el.animate(
              [
                { transform: "translate(0,0)" },
                { transform: "translate(-6px,3px)" },
                { transform: "translate(5px,-3px)" },
                { transform: "translate(0,0)" },
              ],
              { duration: 280 },
            );
          }
        });
      }}
    >
      {/* HUD */}
      <div class="z-20 flex flex-wrap items-center gap-2 bg-game-ink/70 px-3 pt-16 pb-1.5 text-sm font-bold sm:pt-1.5 sm:pr-48 sm:pl-20">
        <span>🌊 Wave {live(() => sim.wave)}</span>
        <span class="text-game-yellow">⭐ {live(() => sim.score)}</span>
        <span>
          {"❤️".repeat(
            Math.max(
              0,
              live(() => sim.lives),
            ),
          )}
        </span>
        <Show when={live(() => sim.shields) > 0}>
          <span>🛡️×{sim.shields}</span>
        </Show>
        <Show when={live(() => sim.mult) > 1}>
          <span class="rounded-full bg-game-orange px-2 text-game-ink">
            x{sim.mult} · {sim.streak} in a row
          </span>
        </Show>
        <Show when={live(() => sim.t < sim.freezeUntil)}>
          <span>❄️</span>
        </Show>
        <Show when={live(() => sim.t < sim.empUntil)}>
          <span>⚡</span>
        </Show>
        <Show when={live(() => sim.multiReady)}>
          <span>🎯 ready</span>
        </Show>
        <Show when={live(() => sim.owned.length) > 0}>
          <span class="font-normal opacity-80">
            {sim.owned.map((u) => UPGRADES[u].emoji).join("")}
          </span>
        </Show>
      </div>

      {/* the field */}
      <div class="relative min-h-0 flex-1 overflow-hidden">
        <div class="absolute inset-0 animate-game-twinkle text-xs text-game-cream/60">
          <For each={[8, 22, 37, 51, 66, 79, 91]}>
            {(x, i) => (
              <span
                class="absolute"
                style={{ left: `${x}%`, top: `${((i() * 37) % 80) + 4}%` }}
              >
                ✦
              </span>
            )}
          </For>
        </div>
        {/* base */}
        <div
          class="absolute inset-x-0 bottom-0 border-t-4 border-game-blue/60 bg-game-navy/80"
          style={{ height: `${100 - BASE_Y}%` }}
        >
          <Show when={live(() => sim.shields) > 0}>
            <div class="absolute inset-x-0 -top-6 h-6 rounded-t-[100%] border-t-4 border-game-blue/80 bg-game-blue/20"></div>
          </Show>
          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl">
            🏰
          </div>
        </div>
        {/* laser */}
        <Show when={laser()} keyed>
          {(l) => (
            <svg
              class="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <line
                x1="50"
                y1="96"
                x2={l.x}
                y2={l.y}
                stroke={LASER[l.tier] ?? LASER[0]}
                stroke-width="1.2"
                stroke-linecap="round"
              ></line>
            </svg>
          )}
        </Show>
        {/* mothership */}
        <Show when={live(() => sim.boss)}>
          {(b) => (
            <div
              class="absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center"
              style={{ top: `${live(() => b().y)}%` }}
            >
              <span class="text-7xl drop-shadow-[0_0_12px_var(--color-game-purple)]">
                🛸
              </span>
              <div class="flex flex-wrap justify-center gap-1">
                <For each={live(() => b().parts)}>
                  {(p) => {
                    const open = (): boolean =>
                      live(() => sim.bossTarget().some((x) => x.id === p.id));
                    return (
                      <span
                        class={cn(
                          "rounded-lg px-2 py-0.5 font-mono text-sm font-bold",
                          p.done
                            ? "bg-game-ink/50 text-game-grey line-through"
                            : open()
                              ? "bg-game-cream text-game-ink"
                              : "bg-game-ink/60 text-game-grey",
                        )}
                      >
                        {p.name === "cannon"
                          ? "🔫"
                          : p.name === "shield"
                            ? "🛡️"
                            : "❤️"}{" "}
                        <Word
                          word={p.word}
                          typed={open() ? typedFor(p.word) : 0}
                        />
                      </span>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </Show>
        {/* ships */}
        <Index each={ships()}>
          {(s) => (
            <div
              class="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${s().x}%`, top: `${s().y}%` }}
            >
              <span
                class={cn(
                  "relative leading-none",
                  s().kind === "mini" ? "text-3xl" : "text-5xl",
                  s().kind === "scout" && "rotate-180",
                )}
              >
                {SHIP_EMOJI[s().kind]}
                <Show when={s().kind === "shield" && s().hp > 1}>
                  <span class="absolute -inset-2 rounded-full border-2 border-game-blue bg-game-blue/20"></span>
                </Show>
              </span>
              <span
                class="rounded-lg bg-game-cream px-2 font-mono text-lg font-bold text-game-ink shadow sm:text-xl"
                style={{
                  opacity:
                    s().kind === "cloak"
                      ? `${0.15 + 0.85 * Math.abs(Math.sin(sim.t / 700))}`
                      : "1",
                }}
              >
                <Word word={s().word} typed={typedFor(s().word)} />
              </span>
            </div>
          )}
        </Index>
        {/* power-up orbs */}
        <Index each={live(() => sim.orbs.map((o) => ({ ...o })))}>
          {(o) => (
            <div
              class="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 animate-game-bob flex-col items-center"
              style={{ left: `${o().x}%`, top: `${o().y}%` }}
            >
              <span class="grid h-11 w-11 place-items-center rounded-full border-2 border-game-yellow bg-game-yellow/30 text-2xl">
                {POWER_INFO[o().kind].emoji}
              </span>
              <span class="rounded-lg bg-game-yellow px-2 font-mono font-bold text-game-ink">
                <Word word={o().word} typed={typedFor(o().word)} />
              </span>
            </div>
          )}
        </Index>
        {/* effects */}
        <For each={fx()}>
          {(f) => (
            <span
              class={cn(
                "pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 font-bold",
                f.tone === "points"
                  ? "animate-game-float-up text-lg text-game-yellow"
                  : "animate-game-pop text-4xl",
              )}
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
            >
              {f.text}
            </span>
          )}
        </For>
        <Show when={banner()}>
          {(b) => (
            <div class="pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 animate-game-pop rounded-full bg-game-yellow px-5 py-1 text-center text-base font-bold text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.3)] sm:text-xl">
              {b()}
            </div>
          )}
        </Show>
        <Show when={countdown() > 0}>
          <div class="absolute inset-0 z-30 grid place-items-center bg-game-ink/40 text-8xl font-bold text-game-yellow">
            {countdown()}
          </div>
        </Show>
        {/* upgrade picker */}
        <Show when={live(() => sim.offer)}>
          {(offer) => (
            <div class="absolute inset-0 z-30 grid place-items-center bg-game-ink/70 p-4">
              <div class="grid w-full max-w-xl gap-3">
                <div class="text-center text-2xl font-bold text-game-yellow">
                  ⭐ Pick an upgrade!
                </div>
                <div class="text-center text-sm">Type its word or tap it.</div>
                <div class="grid gap-2 sm:grid-cols-3">
                  <For each={offer()}>
                    {(u) => (
                      <button
                        type="button"
                        class="grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-game-yellow bg-game-navy p-3 text-center hover:bg-game-ink"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => choose(u)}
                      >
                        <span class="text-4xl">{UPGRADES[u].emoji}</span>
                        <span class="font-bold">{UPGRADES[u].name}</span>
                        <span class="text-xs opacity-80">
                          {UPGRADES[u].tip}
                        </span>
                        <span class="rounded bg-game-cream px-2 font-mono font-bold text-game-ink">
                          <Word
                            word={UPGRADES[u].word}
                            typed={
                              value().trim().length > 0 &&
                              UPGRADES[u].word.startsWith(
                                value().trim().toLowerCase(),
                              )
                                ? value().trim().length
                                : 0
                            }
                          />
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* typing */}
      <div class="z-20 flex justify-center bg-game-navy px-3 pt-2 pb-3">
        <MiniTypingInput
          value={value()}
          onInput={onInput}
          wrong={wrong()}
          waiting={countdown() > 0}
          placeholder={
            live(() => sim.offer !== null)
              ? "type an upgrade"
              : "type a ship's word"
          }
        />
      </div>
    </div>
  );
}

/** A word with the typed part in green. */
function Word(props: { word: string; typed: number }): JSXElement {
  return (
    <>
      <span class="text-game-green">{props.word.slice(0, props.typed)}</span>
      {props.word.slice(props.typed)}
    </>
  );
}

import {
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";

import type { MonsterKind } from "./wave-appearance";

import { UserAvatar } from "../../components/common/UserAvatar";
import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { monsterSvg } from "./art";
import {
  BattleState,
  canUse,
  heroMove,
  MONSTER_TRICK,
  monsterMove,
  MoveId,
  MOVE_IDS,
  MOVES,
  newBattle,
  wordsForMove,
  xpForLevel,
} from "./battle-engine";

export type Encounter = {
  name: string;
  kind: MonsterKind;
  wave: number;
  floorIndex: number;
  hp: number;
  maxHp: number;
  attack: number;
};

export type HeroStatus = {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  potions: number;
};

export type BattleEnd = {
  won: boolean;
  heroHp: number;
  potions: number;
  hits: number;
  mistakes: number;
};

type Phase = "intro" | "menu" | "typing" | "show" | "end";

/** Battle backgrounds for Moss Grove, Crystal Hollow, Ember Trail, Moonlit Ruins. */
const SKY = [
  "from-game-sky-top via-game-sky to-game-grass",
  "from-game-dusk via-game-purple to-game-mint",
  "from-game-sunset via-game-orange to-game-tan",
  "from-game-night via-game-navy to-game-dusk",
];
const PLATFORM = [
  "bg-game-grass-dark",
  "bg-game-purple",
  "bg-game-brown",
  "bg-game-navy",
];

const sleep = async (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * A turn-based monster battle: the monster on its platform top right, the
 * hero bottom left, HP boxes, a message box and the move menu. Pick a move
 * by typing its name, then type its words before the timer runs out.
 */
export function BattleScreen(props: {
  encounter: Encounter;
  hero: HeroStatus;
  words: string[];
  turnSeconds: number;
  avatarUid?: string;
  onEnd: (e: BattleEnd) => void;
}): JSXElement {
  const enc = untrack(() => props.encounter);
  const state: BattleState = newBattle({
    hero: untrack(() => ({
      hp: props.hero.hp,
      maxHp: props.hero.maxHp,
      level: props.hero.level,
      potions: props.hero.potions,
    })),
    monster: {
      name: enc.name,
      kind: enc.kind,
      hp: enc.hp,
      maxHp: enc.maxHp,
      attack: enc.attack,
    },
  });
  const [tick, setTick] = createSignal(0);
  const [flash, setFlash] = createSignal(true);
  const [phase, setPhase] = createSignal<Phase>("intro");
  const [line, setLine] = createSignal("");
  const [move, setMove] = createSignal<MoveId>("quick");
  const [targets, setTargets] = createSignal<string[]>([]);
  const [done, setDone] = createSignal(0);
  const [value, setValue] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [timeLeft, setTimeLeft] = createSignal(1);
  const [pop, setPop] = createSignal<{
    id: number;
    who: "hero" | "monster";
    text: string;
  } | null>(null);
  let heroEl: HTMLDivElement | undefined;
  let monsterEl: HTMLDivElement | undefined;
  let mistakes = 0;
  let totalMistakes = 0;
  let hits = 0;
  let turnStart = 0;
  let turnUsed = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let alive = true;
  let popId = 0;
  const rng = Math.random;

  const refresh = (): void => {
    setTick((t) => t + 1);
  };
  const live = <T,>(read: () => T): T => {
    tick();
    return read();
  };

  /** Type a line into the message box, then wait a moment. */
  const say = async (text: string, wait = 650): Promise<void> => {
    for (let i = 1; i <= text.length && alive; i++) {
      setLine(text.slice(0, i));
      await sleep(22);
    }
    await sleep(wait);
  };

  const animate = (
    el: HTMLElement | undefined,
    frames: Keyframe[],
    ms: number,
  ): void => {
    el?.animate(frames, { duration: ms, easing: "ease-out" });
  };
  const lunge = (who: "hero" | "monster"): void => {
    const dx = who === "hero" ? 60 : -60;
    const dy = who === "hero" ? -30 : 30;
    animate(
      who === "hero" ? heroEl : monsterEl,
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${dx}px,${dy}px)` },
        { transform: "translate(0,0)" },
      ],
      380,
    );
  };
  const hurt = (who: "hero" | "monster", text: string): void => {
    animate(
      who === "hero" ? heroEl : monsterEl,
      [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: "translate(-8px,0)", opacity: 0.3 },
        { transform: "translate(8px,0)", opacity: 1 },
        { transform: "translate(-4px,0)", opacity: 0.4 },
        { transform: "translate(0,0)", opacity: 1 },
      ],
      450,
    );
    const id = ++popId;
    setPop({ id, who, text });
    setTimeout(() => setPop((p) => (p?.id === id ? null : p)), 900);
  };

  const finish = async (): Promise<void> => {
    setPhase("end");
    if (state.won) {
      sfx.finish();
      animate(
        monsterEl,
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(40px)", opacity: 0 },
        ],
        700,
      );
      await sleep(700);
    }
    props.onEnd({
      won: state.won,
      heroHp: state.hero.hp,
      potions: state.hero.potions,
      hits,
      mistakes: totalMistakes,
    });
  };

  const openMenu = async (): Promise<void> => {
    if (!alive) return;
    setValue("");
    setWrong(false);
    setPhase("menu");
    setLine("What will you do? Type a move!");
  };

  const choose = (m: MoveId): void => {
    if (phase() !== "menu" || !canUse(state, m)) return;
    sfx.tick();
    setMove(m);
    setTargets(wordsForMove(m, props.words, rng));
    setDone(0);
    setValue("");
    mistakes = 0;
    turnStart = performance.now();
    turnUsed = 0;
    setTimeLeft(1);
    setPhase("typing");
    setLine(`${MOVES[m].emoji} ${MOVES[m].name}! Type the words!`);
    clearInterval(timer);
    timer = setInterval(() => {
      if (document.hidden) {
        // paused while the page is hidden
        turnStart += 100;
        return;
      }
      turnUsed = (performance.now() - turnStart) / (props.turnSeconds * 1000);
      setTimeLeft(Math.max(0, 1 - turnUsed));
      if (turnUsed >= 1) void resolve();
    }, 100);
  };

  const resolve = async (): Promise<void> => {
    if (phase() !== "typing") return;
    clearInterval(timer);
    setPhase("show");
    setValue("");
    const m = move();
    if (m === "quick" || m === "power") lunge("hero");
    await sleep(250);
    const out = heroMove(
      state,
      { move: m, wordsDone: done(), mistakes, timeUsed: Math.min(1, turnUsed) },
      rng,
    );
    if (out.damage > 0) {
      hurt("monster", `-${out.damage}${out.crit ? "!" : ""}`);
      if (out.crit) sfx.great();
      else sfx.good();
    }
    if (out.healed > 0) {
      sfx.great();
      const id = ++popId;
      setPop({ id, who: "hero", text: `+${out.healed}` });
    }
    if (out.dodged) sfx.oops();
    refresh();
    for (const l of out.lines) await say(l);
    if (state.over) {
      await finish();
      return;
    }
    // the monster's turn
    lunge("monster");
    await sleep(250);
    const mo = monsterMove(state, rng);
    hurt("hero", `-${mo.damage}`);
    sfx.bad();
    refresh();
    for (const l of mo.lines) await say(l);
    if (state.over) {
      await finish();
      return;
    }
    await openMenu();
  };

  const onInput = (raw: string): void => {
    const v = raw.trim().toLowerCase();
    if (phase() === "menu") {
      const pick = MOVE_IDS.find((m) => MOVES[m].word === v);
      if (pick !== undefined && canUse(state, pick)) {
        choose(pick);
        return;
      }
      setWrong(v !== "" && !MOVE_IDS.some((m) => MOVES[m].word.startsWith(v)));
      setValue(raw);
      return;
    }
    if (phase() !== "typing") {
      setValue("");
      return;
    }
    const target = targets()[done()] ?? "";
    if (v === target) {
      hits++;
      sfx.pop();
      setDone((d) => d + 1);
      setValue("");
      setWrong(false);
      if (done() >= targets().length) void resolve();
      return;
    }
    const ok = target.startsWith(v);
    if (!ok && !wrong()) {
      mistakes++;
      totalMistakes++;
      sfx.oops();
    }
    setWrong(!ok);
    setValue(raw);
  };

  onMount(() => {
    void (async () => {
      sfx.boom?.();
      await sleep(350);
      setFlash(false);
      await sleep(150);
      await say(`Look out! ${enc.name} jumps out!`, 500);
      await say(MONSTER_TRICK[enc.kind], 900);
      await openMenu();
    })();
  });
  onCleanup(() => {
    alive = false;
    clearInterval(timer);
  });

  const hpColor = (hp: number, max: number): string =>
    hp / max > 0.5
      ? "bg-game-green"
      : hp / max > 0.2
        ? "bg-game-yellow"
        : "bg-game-red";
  const monsterSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monsterSvg(enc.kind, enc.floorIndex))}`;

  return (
    <div class="absolute inset-0 z-30 flex flex-col overflow-hidden font-kid">
      {/* the arena */}
      <div
        class={cn(
          "relative min-h-0 flex-1 bg-linear-to-b",
          SKY[enc.floorIndex % SKY.length],
        )}
      >
        {/* entry flash (removed on a timer, whatever the animation does) */}
        <Show when={flash()}>
          <div class="pointer-events-none absolute inset-0 z-20 animate-pulse bg-game-cream"></div>
        </Show>

        {/* monster HP box (top left) */}
        <div class="absolute top-16 left-3 z-10 w-[min(46%,18rem)] rounded-2xl border-4 border-game-ink bg-game-cream px-3 py-2 text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.3)] sm:top-4 sm:left-20">
          <div class="flex items-baseline justify-between gap-2">
            <span class="truncate text-base font-bold sm:text-lg">
              {enc.name}
            </span>
            <span class="text-sm font-bold">Lv{enc.wave + 1}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs font-bold text-game-orange">HP</span>
            <div class="h-3 flex-1 overflow-hidden rounded-full border-2 border-game-ink bg-game-ink/20">
              <div
                class={cn(
                  "h-full transition-[width] duration-500",
                  live(() => hpColor(state.monster.hp, state.monster.maxHp)),
                )}
                style={{
                  width: `${live(() => (state.monster.hp / state.monster.maxHp) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
          <Show when={live(() => state.monster.armour)}>
            <div class="mt-1 text-xs font-bold">🛡️ armour</div>
          </Show>
        </div>

        {/* monster on its platform (top right) */}
        <div class="absolute top-[18%] right-[8%] flex flex-col items-center sm:right-[14%]">
          <div
            ref={(el) => {
              monsterEl = el;
            }}
            class="relative z-10"
          >
            <img
              src={monsterSrc}
              alt={enc.name}
              class="h-28 w-28 drop-shadow-xl sm:h-40 sm:w-40"
              ref={(el) => {
                requestAnimationFrame(() => {
                  el.animate(
                    [
                      {
                        transform: "translateY(-120px) scale(0.6)",
                        opacity: 0,
                      },
                      {
                        transform: "translateY(10px) scale(1.05)",
                        opacity: 1,
                        offset: 0.7,
                      },
                      { transform: "translateY(0) scale(1)" },
                    ],
                    { duration: 700, easing: "ease-out" },
                  );
                });
              }}
            />
            <Show when={pop()?.who === "monster" ? pop() : null} keyed>
              {(p) => (
                <span class="absolute -top-4 left-1/2 -translate-x-1/2 animate-game-float-up text-3xl font-bold text-game-red drop-shadow">
                  {p.text}
                </span>
              )}
            </Show>
          </div>
          <div
            class={cn(
              "-mt-5 h-8 w-44 rounded-[100%] opacity-80 sm:w-60",
              PLATFORM[enc.floorIndex % PLATFORM.length],
            )}
          ></div>
        </div>

        {/* hero on its platform (bottom left) */}
        <div class="absolute bottom-[6%] left-[8%] flex flex-col items-center sm:left-[14%]">
          <div
            ref={(el) => {
              heroEl = el;
            }}
            class="relative z-10"
          >
            <div class="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-game-cream bg-game-sky shadow-xl sm:h-36 sm:w-36">
              <Show
                when={props.avatarUid}
                fallback={<span class="text-6xl">🧒</span>}
              >
                {(uid) => <UserAvatar uid={uid()} class="h-full w-full" />}
              </Show>
            </div>
            <span class="absolute -right-3 -bottom-1 text-4xl">🗡️</span>
            <Show when={live(() => state.hero.guarding)}>
              <span class="absolute top-1/3 -left-4 text-4xl">🛡️</span>
            </Show>
            <Show when={pop()?.who === "hero" ? pop() : null} keyed>
              {(p) => (
                <span
                  class={cn(
                    "absolute -top-4 left-1/2 -translate-x-1/2 animate-game-float-up text-3xl font-bold drop-shadow",
                    p.text.startsWith("+")
                      ? "text-game-green"
                      : "text-game-red",
                  )}
                >
                  {p.text}
                </span>
              )}
            </Show>
          </div>
          <div
            class={cn(
              "-mt-5 h-8 w-48 rounded-[100%] opacity-80 sm:w-64",
              PLATFORM[enc.floorIndex % PLATFORM.length],
            )}
          ></div>
        </div>

        {/* hero HP box (bottom right) */}
        <div class="absolute right-3 bottom-[8%] z-10 w-[min(46%,18rem)] rounded-2xl border-4 border-game-ink bg-game-cream px-3 py-2 text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.3)] sm:right-8">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-base font-bold sm:text-lg">You</span>
            <span class="text-sm font-bold">
              Lv{live(() => state.hero.level)}
            </span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs font-bold text-game-orange">HP</span>
            <div class="h-3 flex-1 overflow-hidden rounded-full border-2 border-game-ink bg-game-ink/20">
              <div
                class={cn(
                  "h-full transition-[width] duration-500",
                  live(() => hpColor(state.hero.hp, state.hero.maxHp)),
                )}
                style={{
                  width: `${live(() => (state.hero.hp / state.hero.maxHp) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
          <div class="mt-0.5 flex justify-between text-xs font-bold">
            <span>
              {live(() => state.hero.hp)}/{state.hero.maxHp}
            </span>
            <span>💚×{live(() => state.hero.potions)}</span>
          </div>
          <div
            class="mt-1 h-1.5 overflow-hidden rounded-full bg-game-ink/15"
            title="XP"
          >
            <div
              class="h-full bg-game-blue"
              style={{
                width: `${Math.min(100, (props.hero.xp / xpForLevel(props.hero.level)) * 100)}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* message box + menu */}
      <div class="z-10 grid gap-2 border-t-8 border-game-ink bg-game-navy p-3 sm:grid-cols-[1fr_auto]">
        <div class="grid gap-2">
          <div class="min-h-14 rounded-xl border-4 border-game-cream bg-game-ink px-4 py-2 text-lg font-bold text-game-cream sm:text-xl">
            {line()}
          </div>
          <Show when={phase() === "typing"}>
            <div class="flex flex-wrap items-center gap-2">
              <For each={targets()}>
                {(w, i) => (
                  <span
                    class={cn(
                      "rounded-lg px-3 py-1 font-mono text-xl font-bold",
                      i() < done()
                        ? "bg-game-green text-game-ink line-through"
                        : i() === done()
                          ? "bg-game-yellow text-game-ink"
                          : "bg-game-cream/20 text-game-cream",
                    )}
                  >
                    {w}
                  </span>
                )}
              </For>
              <div class="h-3 min-w-24 flex-1 overflow-hidden rounded-full bg-game-ink">
                <div
                  class={cn(
                    "h-full",
                    timeLeft() < 0.25 ? "bg-game-red" : "bg-game-green",
                  )}
                  style={{ width: `${timeLeft() * 100}%` }}
                ></div>
              </div>
            </div>
          </Show>
          <div class="flex justify-center">
            <MiniTypingInput
              value={value()}
              onInput={onInput}
              wrong={wrong()}
              waiting={phase() !== "menu" && phase() !== "typing"}
              placeholder={
                phase() === "menu"
                  ? "type a move: quick, power, guard, heal"
                  : phase() === "typing"
                    ? (targets()[done()] ?? "")
                    : "…"
              }
            />
          </div>
        </div>
        {/* moves */}
        <div class="grid grid-cols-2 gap-2 sm:w-80">
          <For each={MOVE_IDS}>
            {(m) => {
              const usable = (): boolean => live(() => canUse(state, m));
              return (
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={phase() !== "menu" || !usable()}
                  class={cn(
                    "grid rounded-xl border-4 px-2 py-1.5 text-left",
                    phase() === "menu" && usable()
                      ? "cursor-pointer border-game-cream bg-game-cream text-game-ink hover:bg-game-yellow"
                      : "border-game-cream/30 bg-game-ink text-game-cream/50",
                    phase() === "typing" &&
                      move() === m &&
                      "border-game-yellow bg-game-yellow text-game-ink",
                  )}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(m)}
                >
                  <span class="text-sm font-bold sm:text-base">
                    {MOVES[m].emoji} {MOVES[m].name}
                    {m === "heal" ? ` ×${live(() => state.hero.potions)}` : ""}
                  </span>
                  <span class="text-[0.65rem] opacity-80 sm:text-xs">
                    type <b class="font-mono">{MOVES[m].word}</b> ·{" "}
                    {MOVES[m].tip}
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}

import {
  createEffect,
  createSignal,
  For,
  Index,
  JSXElement,
  on,
  Show,
} from "solid-js";

import { Mascot } from "../../components/common/Mascot";
import { UserAvatar } from "../../components/common/UserAvatar";
import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import {
  BLOCK_INFO,
  BlockKind,
  DIG_DEPTH,
  DigBlock,
  DRILL_BLOCKS,
  GEM_SIGHT,
  gemCount,
  GEMS,
  lavaMs,
  TOOL_CHARGE,
  TOOL_IDS,
  ToolId,
  TOOLS,
  WorldId,
  wordToType,
} from "./dig-rules";

export type DigLane = {
  id: string;
  name: string;
  uid?: string;
  isBot?: boolean;
  isMe?: boolean;
  depth: number;
  gems: number;
  finished: boolean;
  online?: boolean;
};

/** How many blocks of the shaft are visible below the digger. */
const VISIBLE = 4;
const LANTERN_BLOCKS = 8;

const WORLD_STYLE: Record<
  WorldId,
  { sky: string; shaft: string; dirt: string; edge: string; top: string }
> = {
  garden: {
    sky: "from-game-sky-top to-game-sky",
    shaft: "bg-game-brown-dark/90",
    dirt: "bg-game-brown",
    edge: "border-game-brown-dark",
    top: "bg-game-grass-dark",
  },
  crystal: {
    sky: "from-game-night to-game-dusk",
    shaft: "bg-game-ink/90",
    dirt: "bg-game-navy",
    edge: "border-game-ink",
    top: "bg-game-purple",
  },
  lava: {
    sky: "from-game-ink to-game-red",
    shaft: "bg-game-ink/90",
    dirt: "bg-game-brown-dark",
    edge: "border-game-ink",
    top: "bg-game-orange",
  },
  dino: {
    sky: "from-game-sunset to-game-tan",
    shaft: "bg-game-brown-dark/90",
    dirt: "bg-game-tan",
    edge: "border-game-brown",
    top: "bg-game-frog",
  },
};

function Face(props: { lane: DigLane; size: "sm" | "md" }): JSXElement {
  const px = (): string => (props.size === "sm" ? "h-7 w-7" : "h-12 w-12");
  return (
    <Show
      when={!props.lane.isBot && props.lane.uid}
      fallback={<Mascot mood="happy" size={props.size === "sm" ? 28 : 48} />}
    >
      {(uid) => <UserAvatar uid={uid()} class={px()} />}
    </Show>
  );
}

const kindOf = (b: DigBlock): BlockKind =>
  b.kind ?? (b.rock ? "stone" : "dirt");

/** One block of the shaft. */
function Block(props: {
  block: DigBlock;
  world: WorldId;
  current: boolean;
  word: string;
  typed: string;
  /** gem visible (close by, or lantern) */
  seeGem: boolean;
  cracked: boolean;
  /** lava: share of time left, 0-1 */
  lavaLeft?: number;
}): JSXElement {
  const style = (): (typeof WORLD_STYLE)[WorldId] => WORLD_STYLE[props.world];
  const kind = (): BlockKind => kindOf(props.block);
  return (
    <div
      class={cn(
        "relative flex h-16 items-center justify-center overflow-hidden rounded-xl border-b-4 sm:h-20",
        kind() === "stone"
          ? "border-game-ink/40 bg-game-grey"
          : kind() === "ice"
            ? "border-game-blue bg-game-sky"
            : kind() === "lava"
              ? "border-game-red bg-game-orange"
              : kind() === "treasure"
                ? "border-game-brown bg-game-gold"
                : cn(style().edge, style().dirt),
        !props.current && "opacity-60",
      )}
    >
      {/* speckles */}
      <span class="absolute top-2 left-3 h-2 w-2 rounded-full bg-game-ink/15"></span>
      <span class="absolute right-5 bottom-3 h-3 w-3 rounded-full bg-game-ink/15"></span>
      <span class="absolute top-4 right-10 h-1.5 w-1.5 rounded-full bg-game-cream/20"></span>
      <Show when={kind() === "lava"}>
        <span class="absolute inset-0 animate-pulse bg-game-red/30"></span>
        <Show when={props.lavaLeft !== undefined}>
          <span
            class="absolute bottom-0 left-0 h-1.5 bg-game-yellow"
            style={{ width: `${(props.lavaLeft ?? 0) * 100}%` }}
          ></span>
        </Show>
      </Show>
      <Show when={kind() === "ice" && props.cracked}>
        <span class="absolute inset-0 grid place-items-center text-5xl opacity-40">
          💥
        </span>
      </Show>
      <span class="absolute left-2 text-xl">
        {kind() === "stone"
          ? "🪨"
          : kind() === "ice"
            ? "🧊"
            : kind() === "lava"
              ? "🌋"
              : kind() === "treasure"
                ? "🎁"
                : ""}
      </span>
      <Show when={gemCount(props.block) > 0}>
        <span
          class="absolute right-2 text-2xl drop-shadow motion-safe:animate-pulse"
          aria-label="gem"
        >
          {props.seeGem && props.block.gemId !== undefined
            ? GEMS[props.block.gemId].emoji.repeat(gemCount(props.block))
            : "✨"}
        </span>
      </Show>
      <span
        class={cn(
          "relative rounded-full px-3 py-0.5 font-mono font-bold",
          props.current
            ? "bg-game-cream text-2xl text-game-ink shadow-[0_3px_0_rgb(0_0_0/0.25)] sm:text-3xl"
            : "text-lg text-game-cream",
        )}
      >
        <Show when={props.current} fallback={props.block.word}>
          <span class="text-game-green">{props.typed}</span>
          {props.word.slice(props.typed.length)}
          <Show when={kind() === "ice"}>
            <span class="ml-1 text-sm text-game-blue">
              ×{props.cracked ? 1 : 2}
            </span>
          </Show>
        </Show>
      </span>
    </div>
  );
}

type Fx = {
  id: number;
  text: string;
  left: number;
  tone: "burst" | "gem" | "bad";
};

/**
 * Gem Dig play view: your shaft on the left (type the word on the top block
 * to dig it), everyone's race to the treasure on the right.
 */
export function GemDig(props: {
  shaft: DigBlock[];
  world: WorldId;
  me: DigLane;
  lanes: DigLane[];
  /** ms until digging starts (countdown), 0 once started */
  startsInMs: number;
  timeLeftMs: number;
  /** someone reached the treasure: the rest have a short time left */
  hurry: boolean;
  over: boolean;
  /** dug this many blocks (2 with dynamite) */
  onDig: (blocks: number) => void;
  /** lava pushed me back up a block */
  onPushBack: () => void;
  /** a finished word, with wrong keys while typing it */
  onWord?: (word: string, misses: number) => void;
  onMiss?: () => void;
  /** online: emoji reactions */
  reactions?: string[];
  onReact?: (e: string) => void;
  toast?: string;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [bump, setBump] = createSignal(0);
  const [cracked, setCracked] = createSignal(false);
  const [charge, setCharge] = createSignal(0);
  const [tools, setTools] = createSignal<Record<ToolId, number>>({
    dynamite: 0,
    drill: 0,
    lantern: 0,
  });
  const [dynamite, setDynamite] = createSignal(false);
  const [drillLeft, setDrillLeft] = createSignal(0);
  const [lanternLeft, setLanternLeft] = createSignal(0);
  const [lavaUntil, setLavaUntil] = createSignal(0);
  const [banner, setBanner] = createSignal<string>();
  const [fx, setFx] = createSignal<Fx[]>([]);
  let misses = 0;
  let fxId = 0;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let shaftEl: HTMLDivElement | undefined;

  const say = (text: string, ms = 1500): void => {
    clearTimeout(bannerTimer);
    setBanner(text);
    bannerTimer = setTimeout(() => setBanner(undefined), ms);
  };
  const addFx = (text: string, tone: Fx["tone"]): void => {
    const id = ++fxId;
    setFx((f) => [
      ...f.slice(-8),
      { id, text, left: 30 + Math.random() * 40, tone },
    ]);
    setTimeout(() => setFx((f) => f.filter((x) => x.id !== id)), 900);
  };
  const shake = (): void => {
    shaftEl?.animate(
      [
        { transform: "translate(0,0)" },
        { transform: "translate(-4px,2px)" },
        { transform: "translate(4px,-2px)" },
        { transform: "translate(0,0)" },
      ],
      { duration: 220 },
    );
  };

  const current = (): DigBlock | undefined => props.shaft[props.me.depth];
  const target = (): string => {
    const b = current();
    return b === undefined ? "" : wordToType(b, drillLeft() > 0);
  };
  const canDig = (): boolean =>
    !props.over && !props.me.finished && props.startsInMs <= 0;
  const visible = (): DigBlock[] =>
    props.shaft.slice(props.me.depth, props.me.depth + VISIBLE);
  const treasureInView = (): boolean => props.me.depth + VISIBLE >= DIG_DEPTH;

  // a new block on top: reset, start the lava clock
  createEffect(
    on(
      () => props.me.depth,
      () => {
        setTyped("");
        setWrong(false);
        setCracked(false);
        setBump((b) => b + 1);
        const b = current();
        setLavaUntil(
          b !== undefined && kindOf(b) === "lava"
            ? Date.now() + lavaMs(b.word)
            : 0,
        );
        if (b !== undefined && kindOf(b) !== "dirt") {
          const info = BLOCK_INFO[kindOf(b)];
          say(`${info.name}: ${info.tip}`, 1400);
        }
      },
      { defer: true },
    ),
  );
  // lava clock (the parent re-renders every 100 ms through timeLeftMs)
  createEffect(() => {
    void props.timeLeftMs;
    const until = lavaUntil();
    if (until === 0 || !canDig() || Date.now() < until) return;
    setLavaUntil(0);
    sfx.bad();
    say("🌋 Too slow - the lava pushed you up!", 1600);
    addFx("🔥", "bad");
    props.onPushBack();
    // same block again (if depth didn't change, restart the clock)
    const b = current();
    if (b !== undefined && kindOf(b) === "lava") {
      setLavaUntil(Date.now() + lavaMs(b.word));
    }
  });

  const lavaLeft = (): number | undefined => {
    void props.timeLeftMs;
    const until = lavaUntil();
    const b = current();
    if (until === 0 || b === undefined) return undefined;
    return Math.max(0, Math.min(1, (until - Date.now()) / lavaMs(b.word)));
  };

  const earnTool = (): void => {
    const id =
      TOOL_IDS[Math.floor(Math.random() * TOOL_IDS.length)] ?? "dynamite";
    setTools((t) => ({ ...t, [id]: t[id] + 1 }));
    sfx.great();
    say(
      `${TOOLS[id].emoji} You got ${TOOLS[id].name}! Tap it to use it.`,
      2000,
    );
  };

  const useTool = (id: ToolId): void => {
    if (tools()[id] <= 0 || !canDig()) return;
    setTools((t) => ({ ...t, [id]: t[id] - 1 }));
    sfx.pop();
    if (id === "dynamite") {
      setDynamite(true);
      say("🧨 Dynamite ready - the next word blasts 2 blocks!", 1600);
    }
    if (id === "drill") {
      setDrillLeft(DRILL_BLOCKS);
      setTyped("");
      say("🔩 Drill boost - short words!", 1400);
    }
    if (id === "lantern") {
      setLanternLeft(LANTERN_BLOCKS);
      say("🔦 Now you can see the gems ahead!", 1400);
    }
  };

  const finishBlock = (): void => {
    const b = current();
    if (b === undefined) return;
    if (kindOf(b) === "ice" && !cracked()) {
      setCracked(true);
      setTyped("");
      sfx.pop();
      shake();
      say("🧊 Cracked! Type it again!", 1000);
      return;
    }
    props.onWord?.(target(), misses);
    // clean blocks charge a tool
    if (misses === 0) {
      const next = charge() + 1;
      if (next >= TOOL_CHARGE) {
        setCharge(0);
        earnTool();
      } else {
        setCharge(next);
      }
    }
    misses = 0;
    const n = dynamite() ? 2 : 1;
    if (dynamite()) {
      setDynamite(false);
      sfx.boom?.();
      say("💥 BOOM! Two blocks!", 1200);
    }
    const gems = props.shaft
      .slice(props.me.depth, props.me.depth + n)
      .reduce((g, x) => g + gemCount(x), 0);
    if (gems > 0) {
      sfx.great();
      const block = props.shaft[props.me.depth];
      addFx(
        `+${block?.gemId === undefined ? "💎" : GEMS[block.gemId].emoji.repeat(gems)}`,
        "gem",
      );
    } else {
      sfx.good();
    }
    addFx(
      kindOf(b) === "stone" ? "🪨" : kindOf(b) === "ice" ? "❄️" : "💥",
      "burst",
    );
    shake();
    setDrillLeft((d) => Math.max(0, d - n));
    setLanternLeft((l) => Math.max(0, l - n));
    props.onDig(n);
  };

  const onInput = (value: string): void => {
    const word = target();
    if (!canDig() || word === "") {
      setTyped("");
      return;
    }
    if (!word.startsWith(value)) {
      if (!wrong()) {
        misses++;
        setCharge(0);
        props.onMiss?.();
        sfx.oops();
      }
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value === word) finishBlock();
  };

  const secs = (): number => Math.max(0, Math.ceil(props.timeLeftMs / 1000));
  const style = (): (typeof WORLD_STYLE)[WorldId] => WORLD_STYLE[props.world];

  return (
    <div
      class={cn(
        "relative flex h-full flex-col gap-3 bg-linear-to-b p-3 pt-16 font-kid sm:p-4 sm:pt-16",
        style().sky,
      )}
    >
      {/* HUD */}
      <div class="flex flex-wrap items-center justify-center gap-2 text-base font-bold sm:text-lg">
        <span class="rounded-full bg-game-ink/80 px-3 py-1 text-game-cream">
          ⛏️ {props.me.depth}/{DIG_DEPTH}
        </span>
        <span class="rounded-full bg-game-ink/80 px-3 py-1 text-game-cream">
          💎 {props.me.gems}
        </span>
        <span
          class={cn(
            "rounded-full px-3 py-1",
            props.hurry || secs() <= 15
              ? "bg-game-red text-game-cream"
              : "bg-game-ink/80 text-game-cream",
          )}
        >
          ⏱ {secs()}s
        </span>
        {/* tool charge */}
        <span class="flex items-center gap-1 rounded-full bg-game-ink/80 px-3 py-1 text-sm text-game-cream">
          🧰
          <Index each={Array.from({ length: TOOL_CHARGE })}>
            {(_, i) => (
              <span
                class={cn(
                  "h-2.5 w-2.5 rounded-full",
                  i < charge() ? "bg-game-yellow" : "bg-game-cream/30",
                )}
              ></span>
            )}
          </Index>
        </span>
      </div>

      <div class="flex min-h-0 flex-1 gap-3">
        {/* my shaft */}
        <div
          ref={(el) => {
            shaftEl = el;
          }}
          class={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-[inset_0_6px_0_rgb(0_0_0/0.25)]",
            style().shaft,
          )}
        >
          <div class={cn("h-4 shrink-0", style().top)}></div>
          <div class="flex items-end justify-center pt-1">
            <div class="flex flex-col items-center">
              <Show when={`dig-${bump()}`} keyed>
                {(_key) => (
                  <div class="motion-safe:animate-game-pop">
                    <Face lane={props.me} size="md" />
                  </div>
                )}
              </Show>
              <span class="-mt-1 text-xl">
                {dynamite() ? "🧨" : drillLeft() > 0 ? "🔩" : "⛏️"}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-2 px-2 pb-2 sm:px-3">
            <Index each={visible()}>
              {(block, i) => (
                <Block
                  block={block()}
                  world={props.world}
                  current={i === 0}
                  word={i === 0 ? target() : block().word}
                  typed={i === 0 ? typed() : ""}
                  seeGem={i <= GEM_SIGHT || lanternLeft() > i}
                  cracked={i === 0 && cracked()}
                  {...(i === 0 ? { lavaLeft: lavaLeft() } : {})}
                />
              )}
            </Index>
            <Show when={treasureInView()}>
              <div class="flex h-16 items-center justify-center rounded-xl bg-game-gold/90 text-4xl shadow-[0_0_24px_rgb(255_198_26/0.7)] sm:h-20">
                🧰✨
              </div>
            </Show>
          </div>
          {/* effects */}
          <For each={fx()}>
            {(f) => (
              <span
                class={cn(
                  "pointer-events-none absolute top-24 z-10 -translate-x-1/2 font-bold",
                  f.tone === "gem"
                    ? "animate-game-float-up text-3xl"
                    : "animate-game-pop text-4xl",
                )}
                style={{ left: `${f.left}%` }}
              >
                {f.text}
              </span>
            )}
          </For>
          <Show when={banner()}>
            {(b) => (
              <div class="pointer-events-none absolute inset-x-2 top-20 z-10 animate-game-pop rounded-full bg-game-yellow px-3 py-1 text-center text-sm font-bold text-game-ink shadow sm:text-base">
                {b()}
              </div>
            )}
          </Show>
          <Show when={props.me.finished}>
            <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-game-ink/60 text-center text-game-cream">
              <div class="text-5xl">🏆</div>
              <div class="text-2xl font-bold">You found the treasure!</div>
            </div>
          </Show>
        </div>

        {/* race lanes */}
        <Show when={props.lanes.length > 1}>
          <div
            class={cn(
              "flex shrink-0 gap-1 rounded-2xl bg-game-ink/70 p-2 sm:w-auto sm:min-w-44 sm:gap-2",
              props.lanes.length > 4 ? "w-44" : "w-28",
            )}
          >
            <For each={props.lanes}>
              {(lane) => (
                <div class="flex min-w-0 flex-1 flex-col items-center">
                  <div
                    class={cn(
                      "relative w-full flex-1 overflow-hidden rounded-lg bg-game-brown",
                      lane.isMe && "ring-2 ring-game-yellow",
                      lane.online === false && "opacity-50",
                    )}
                  >
                    <div
                      class="absolute inset-x-0 top-0 bg-game-brown-dark transition-[height] duration-500"
                      style={{ height: `${(lane.depth / DIG_DEPTH) * 100}%` }}
                    ></div>
                    <div class="absolute inset-x-0 bottom-0 flex h-5 items-center justify-center bg-game-gold text-xs">
                      🧰
                    </div>
                    <div
                      class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 transition-[top] duration-500"
                      style={{
                        top: `calc(${(lane.depth / DIG_DEPTH) * 100}% - ${(lane.depth / DIG_DEPTH) * 20}px + 14px)`,
                      }}
                    >
                      <div class="overflow-hidden rounded-full ring-2 ring-game-cream">
                        <Face lane={lane} size="sm" />
                      </div>
                    </div>
                  </div>
                  <div class="mt-1 w-full truncate text-center text-[11px] font-bold text-game-cream">
                    {lane.isMe ? "You" : lane.name}
                  </div>
                  <div class="text-[11px] text-game-cream/80">
                    {lane.finished ? "🏆" : `💎${lane.gems}`}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* countdown / hurry / reactions */}
      <Show when={props.startsInMs > 0}>
        <div class="absolute inset-0 z-30 flex items-center justify-center bg-game-ink/40">
          <div class="animate-game-pop rounded-3xl bg-game-yellow px-10 py-4 text-6xl font-bold text-game-ink shadow-lg motion-reduce:animate-none">
            {Math.ceil(props.startsInMs / 1000)}
          </div>
        </div>
      </Show>
      <Show when={props.hurry && !props.me.finished && !props.over}>
        <div class="absolute inset-x-0 top-28 z-10 flex justify-center">
          <div class="rounded-full bg-game-red px-4 py-1 text-lg font-bold text-game-cream shadow motion-safe:animate-pulse">
            Treasure found! Hurry - {secs()}s left
          </div>
        </div>
      </Show>
      <Show when={props.toast}>
        {(t) => (
          <div class="pointer-events-none absolute top-40 left-1/2 z-30 -translate-x-1/2 animate-game-pop rounded-full bg-game-cream px-4 py-1 text-xl font-bold text-game-ink shadow">
            {t()}
          </div>
        )}
      </Show>

      <div class="flex min-h-16 flex-wrap items-center justify-center gap-2">
        {/* tools */}
        <div class="flex gap-1">
          <For each={TOOL_IDS}>
            {(id) => (
              <button
                type="button"
                tabIndex={-1}
                disabled={tools()[id] <= 0 || !canDig()}
                title={`${TOOLS[id].name}: ${TOOLS[id].tip}`}
                class={cn(
                  "relative grid h-12 w-12 place-items-center rounded-xl border-2 text-2xl",
                  tools()[id] > 0
                    ? "cursor-pointer border-game-yellow bg-game-ink/80 motion-safe:animate-game-bob"
                    : "border-transparent bg-game-ink/30 opacity-50",
                )}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => useTool(id)}
              >
                {TOOLS[id].emoji}
                <Show when={tools()[id] > 0}>
                  <span class="absolute -top-1 -right-1 rounded-full bg-game-red px-1.5 text-xs font-bold text-game-cream">
                    {tools()[id]}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
        {/* mounted through the countdown so the iPad keeps focus + keyboard */}
        <Show
          when={!props.over && !props.me.finished}
          fallback={
            <div class="text-lg font-bold text-game-ink/70">
              {props.me.finished ? "Waiting for the others…" : ""}
            </div>
          }
        >
          <div class="min-w-0 flex-1">
            <MiniTypingInput
              value={typed()}
              onInput={onInput}
              wrong={wrong()}
              waiting={!canDig()}
              placeholder={canDig() ? target() : "get ready…"}
            />
          </div>
        </Show>
        <Show when={props.reactions}>
          {(list) => (
            <div class="flex gap-1">
              <For each={list()}>
                {(e) => (
                  <button
                    type="button"
                    tabIndex={-1}
                    class="cursor-pointer rounded-full bg-game-ink/70 px-2 py-1 text-lg"
                    onPointerDown={(ev) => ev.preventDefault()}
                    onClick={() => props.onReact?.(e)}
                  >
                    {e}
                  </button>
                )}
              </For>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

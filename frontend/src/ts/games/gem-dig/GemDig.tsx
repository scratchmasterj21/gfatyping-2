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
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { DIG_DEPTH, DigBlock } from "./dig-rules";

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

/** One dirt / rock block of the shaft. */
function Block(props: {
  block: DigBlock;
  current: boolean;
  typed: string;
}): JSXElement {
  return (
    <div
      class={cn(
        "relative flex h-16 items-center justify-center rounded-xl border-b-4 sm:h-20",
        props.block.rock
          ? "border-game-ink/40 bg-game-grey"
          : "border-game-brown-dark bg-game-brown",
        !props.current && "opacity-60",
      )}
    >
      {/* soil speckles */}
      <span class="absolute top-2 left-3 h-2 w-2 rounded-full bg-game-ink/15"></span>
      <span class="absolute right-5 bottom-3 h-3 w-3 rounded-full bg-game-ink/15"></span>
      <span class="absolute top-4 right-10 h-1.5 w-1.5 rounded-full bg-game-cream/20"></span>
      <Show when={props.block.gem}>
        <span
          class={cn(
            "absolute right-2 text-2xl drop-shadow motion-safe:animate-pulse",
            !props.current && "opacity-70",
          )}
          aria-label="gem"
        >
          💎
        </span>
      </Show>
      <Show when={props.block.rock}>
        <span class="absolute left-2 text-xl" aria-label="rock">
          🪨
        </span>
      </Show>
      <span
        class={cn(
          "rounded-full px-3 py-0.5 font-mono font-bold",
          props.current
            ? "bg-game-cream text-2xl text-game-ink shadow-[0_3px_0_rgb(0_0_0/0.25)] sm:text-3xl"
            : "text-lg text-game-cream",
        )}
      >
        <Show when={props.current} fallback={props.block.word}>
          <span class="text-game-green">{props.typed}</span>
          {props.block.word.slice(props.typed.length)}
        </Show>
      </span>
    </div>
  );
}

/**
 * Gem Dig play view: your shaft on the left (type the word on the top block
 * to dig it), everyone's race to the treasure on the right.
 */
export function GemDig(props: {
  shaft: DigBlock[];
  me: DigLane;
  lanes: DigLane[];
  /** ms until digging starts (countdown), 0 once started */
  startsInMs: number;
  timeLeftMs: number;
  /** someone reached the treasure: the rest have a short time left */
  hurry: boolean;
  over: boolean;
  onDig: () => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [bump, setBump] = createSignal(0);

  createEffect(
    on(
      () => props.me.depth,
      () => {
        setTyped("");
        setWrong(false);
        setBump((b) => b + 1);
      },
      { defer: true },
    ),
  );

  const current = (): DigBlock | undefined => props.shaft[props.me.depth];
  const canDig = (): boolean =>
    !props.over && !props.me.finished && props.startsInMs <= 0;
  const visible = (): DigBlock[] =>
    props.shaft.slice(props.me.depth, props.me.depth + VISIBLE);
  const treasureInView = (): boolean => props.me.depth + VISIBLE >= DIG_DEPTH;

  const onInput = (value: string): void => {
    const word = current()?.word;
    if (!canDig() || word === undefined) {
      setTyped("");
      return;
    }
    if (!word.startsWith(value)) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value === word) props.onDig();
  };

  const secs = (): number => Math.max(0, Math.ceil(props.timeLeftMs / 1000));

  return (
    <div class="relative flex h-full flex-col gap-3 bg-linear-to-b from-game-sky-top to-game-sky p-3 pt-16 font-kid sm:p-4 sm:pt-16">
      {/* HUD */}
      <div class="flex items-center justify-center gap-2 text-base font-bold sm:text-lg">
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
      </div>

      <div class="flex min-h-0 flex-1 gap-3">
        {/* my shaft */}
        <div class="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-game-brown-dark/90 shadow-[inset_0_6px_0_rgb(0_0_0/0.25)]">
          <div class="h-4 shrink-0 bg-game-grass-dark"></div>
          <div class="flex items-end justify-center pt-1">
            <div class="flex flex-col items-center">
              <Show when={`dig-${bump()}`} keyed>
                {(_key) => (
                  <div class="motion-safe:animate-game-pop">
                    <Face lane={props.me} size="md" />
                  </div>
                )}
              </Show>
              <span class="-mt-1 text-xl">⛏️</span>
            </div>
          </div>
          <div class="flex flex-col gap-2 px-2 pb-2 sm:px-3">
            <Index each={visible()}>
              {(block, i) => (
                <Block block={block()} current={i === 0} typed={typed()} />
              )}
            </Index>
            <Show when={treasureInView()}>
              <div class="flex h-16 items-center justify-center rounded-xl bg-game-gold/90 text-4xl shadow-[0_0_24px_rgb(255_198_26/0.7)] sm:h-20">
                🧰✨
              </div>
            </Show>
          </div>
          <Show when={props.me.finished}>
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-game-ink/60 text-center text-game-cream">
              <div class="text-5xl">🏆</div>
              <div class="text-2xl font-bold">You found the treasure!</div>
            </div>
          </Show>
        </div>

        {/* race lanes */}
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
                      top: `calc(${(lane.depth / DIG_DEPTH) * 100}% - ${
                        (lane.depth / DIG_DEPTH) * 20
                      }px + 14px)`,
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
      </div>

      {/* countdown / hurry banners */}
      <Show when={props.startsInMs > 0}>
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-game-ink/40">
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

      <div class="flex min-h-16 items-center justify-center">
        {/* mounted through the countdown so the iPad keeps focus + keyboard */}
        <Show
          when={!props.over && !props.me.finished}
          fallback={
            <div class="text-lg font-bold text-game-ink/70">
              {props.me.finished ? "Waiting for the others…" : ""}
            </div>
          }
        >
          <MiniTypingInput
            value={typed()}
            onInput={onInput}
            wrong={wrong()}
            waiting={!canDig()}
            placeholder={canDig() ? current()?.word : "get ready…"}
          />
        </Show>
      </div>
    </div>
  );
}

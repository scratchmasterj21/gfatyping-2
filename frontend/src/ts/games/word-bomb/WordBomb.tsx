import {
  createEffect,
  createSignal,
  For,
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
  bombLive,
  BombState,
  DANGER_MS,
  explodeAt,
  START_LIVES,
} from "./bomb-rules";

export type BombSeat = { name: string; uid?: string; isBot?: boolean };

/** Seat position round the circle, in % of the box; "me" sits at the bottom. */
function seatAngle(index: number, myIndex: number, n: number): number {
  return ((90 + ((index - myIndex) * 360) / n) * Math.PI) / 180;
}

function Seat(props: {
  seat: BombSeat;
  lives: number;
  holder: boolean;
  boomed: boolean;
  me: boolean;
  x: number;
  y: number;
}): JSXElement {
  const out = (): boolean => props.lives <= 0;
  return (
    <div
      class="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 sm:w-28"
      style={{ left: `${props.x}%`, top: `${props.y}%` }}
    >
      <div
        class={cn(
          "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-game-cream ring-4 transition-transform duration-200 sm:h-16 sm:w-16",
          props.holder ? "scale-115 ring-game-orange" : "ring-game-cream/40",
          out() && "opacity-40 grayscale",
        )}
      >
        <Show
          when={props.seat.isBot !== true && props.seat.uid}
          fallback={
            <Mascot mood={props.holder ? "thinking" : "happy"} size={52} />
          }
        >
          {(uid) => <UserAvatar uid={uid()} class="h-full w-full" />}
        </Show>
        <Show when={out()}>
          <span class="absolute inset-0 flex items-center justify-center text-3xl">
            😵
          </span>
        </Show>
      </div>
      <Show when={props.boomed}>
        <span class="pointer-events-none absolute -top-6 animate-game-pop text-6xl motion-reduce:animate-none">
          💥
        </span>
      </Show>
      <div
        class={cn(
          "max-w-full truncate rounded-full px-2 text-sm font-bold",
          props.me ? "bg-game-yellow text-game-ink" : "text-game-cream",
        )}
      >
        {props.me ? "You" : props.seat.name}
      </div>
      <div class="text-sm leading-none tracking-tight">
        <For each={Array.from({ length: START_LIVES }, (_, i) => i)}>
          {(i) => <span>{i < props.lives ? "❤️" : "🖤"}</span>}
        </For>
      </div>
    </div>
  );
}

/**
 * The Word Bomb table: everyone in a circle, the bomb in the middle leaning
 * toward whoever holds it. The holder types the word to pass it on; everyone
 * else watches their letters appear. Nobody knows when it will blow...
 */
export function WordBomb(props: {
  game: BombState;
  /** current time on the same clock as the game's times */
  now: number;
  myId: string;
  seats: Record<string, BombSeat>;
  /** what the holder has typed so far (when it isn't me) */
  holderTyped: string;
  onPass: () => void;
  onTyping?: (text: string) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);

  const n = (): number => props.game.order.length;
  const myIndex = (): number =>
    Math.max(0, props.game.order.indexOf(props.myId));
  const live = (): boolean => bombLive(props.game, props.now);
  const mine = (): boolean => props.game.holder === props.myId && live();
  const danger = (): boolean =>
    live() && props.now >= explodeAt(props.game) - DANGER_MS;
  const boomShowing = (): boolean =>
    props.game.lastBoom !== undefined &&
    (props.game.over || props.now < props.game.roundStartAt);
  const iAmOut = (): boolean => (props.game.lives[props.myId] ?? 0) <= 0;
  const nameOf = (id: string): string =>
    id === props.myId ? "You" : (props.seats[id]?.name ?? "Player");

  const pos = (id: string, radius: number): { x: number; y: number } => {
    const a = seatAngle(props.game.order.indexOf(id), myIndex(), n());
    return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
  };
  const bombPos = (): { x: number; y: number } =>
    pos(props.game.holder, n() === 2 ? 20 : 17);

  // a new holder or round: clear the box
  createEffect(
    on(
      () => props.game.seq,
      () => {
        setTyped("");
        setWrong(false);
      },
    ),
  );

  // tick-tock: once a second, fast near the end
  createEffect(
    on(
      () =>
        live()
          ? `${props.game.roundNo}-${Math.floor(
              (props.now - props.game.roundStartAt) / (danger() ? 250 : 1000),
            )}`
          : "",
      (bucket) => {
        if (bucket !== "") sfx.tick();
      },
    ),
  );

  const onInput = (value: string): void => {
    if (!mine()) {
      setTyped("");
      return;
    }
    const v = value.trim().toLowerCase();
    if (!props.game.word.startsWith(v)) {
      if (!wrong()) sfx.oops();
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(v);
    props.onTyping?.(v);
    if (v === props.game.word) {
      sfx.good();
      props.onPass();
    }
  };

  const shownTyped = (): string =>
    props.game.holder === props.myId ? typed() : props.holderTyped;

  const banner = (): string | undefined => {
    const g = props.game;
    if (g.over) {
      return g.winner === props.myId
        ? "🏆 You win!"
        : g.winner !== undefined
          ? `🏆 ${nameOf(g.winner)} wins!`
          : "Game over";
    }
    if (boomShowing() && g.lastBoom !== undefined) {
      const id = g.lastBoom.id;
      const out = (g.lives[id] ?? 0) <= 0;
      if (id === props.myId) {
        return out ? "💥 BOOM! You're out!" : "💥 BOOM! You lose a life!";
      }
      return out
        ? `💥 BOOM! ${nameOf(id)} is out!`
        : `💥 BOOM! ${nameOf(id)} loses a life!`;
    }
    if (props.now < g.roundStartAt) return "Get ready… 💣";
    return undefined;
  };

  return (
    <div
      class={cn(
        "relative flex h-full flex-col items-center gap-2 bg-linear-to-b from-game-night to-game-dusk p-3 pt-16 font-kid sm:p-4 sm:pt-16",
        boomShowing() &&
          !props.game.over &&
          "animate-game-shake motion-reduce:animate-none",
      )}
    >
      <div class="text-sm font-bold text-game-cream/80">
        Round {props.game.roundNo} · {props.game.passes} passes
      </div>

      <div
        class="relative min-h-0 w-full flex-1"
        style={{ "container-type": "size" }}
      >
        <div
          class="relative mx-auto aspect-square"
          style={{ width: "min(100cqw, 100cqh)" }}
        >
          {/* table */}
          <div class="absolute inset-[16%] rounded-full bg-game-navy/60 shadow-[inset_0_6px_0_rgb(0_0_0/0.3)]"></div>

          <For each={props.game.order}>
            {(id) => (
              <Seat
                seat={props.seats[id] ?? { name: "Player" }}
                lives={props.game.lives[id] ?? 0}
                holder={props.game.holder === id && !boomShowing()}
                boomed={boomShowing() && props.game.lastBoom?.id === id}
                me={id === props.myId}
                x={pos(id, 40).x}
                y={pos(id, 40).y}
              />
            )}
          </For>

          {/* the bomb, leaning toward its holder */}
          <Show when={!boomShowing()}>
            <div
              class="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-300 ease-out"
              style={{ left: `${bombPos().x}%`, top: `${bombPos().y}%` }}
            >
              <div
                class={cn(
                  "relative text-5xl sm:text-6xl",
                  danger() &&
                    "animate-game-shake [animation-iteration-count:infinite] motion-reduce:animate-none",
                )}
              >
                💣
                <Show when={live()}>
                  <span class="absolute -top-3 -right-2 animate-game-twinkle text-2xl motion-reduce:animate-none">
                    ✨
                  </span>
                </Show>
              </div>
            </div>
          </Show>

          {/* the word */}
          <div class="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
            <Show when={live()}>
              <div class="text-xs font-bold tracking-wide text-game-cream/80 uppercase sm:text-sm">
                {mine()
                  ? "Your turn - type it!"
                  : `${nameOf(props.game.holder)} is typing`}
              </div>
              <div
                class={cn(
                  "rounded-xl px-4 py-1.5 font-mono text-2xl font-bold shadow-[0_4px_0_rgb(0_0_0/0.25)] sm:text-4xl",
                  mine()
                    ? "bg-game-yellow text-game-ink"
                    : "bg-game-cream text-game-ink",
                )}
              >
                <span class="text-game-green">{shownTyped()}</span>
                {props.game.word.slice(shownTyped().length)}
              </div>
            </Show>
          </div>

          <Show when={banner()}>
            {(text) => (
              <div class="pointer-events-none absolute inset-x-[18%] top-1/2 flex -translate-y-1/2 justify-center">
                <div class="animate-game-pop rounded-full bg-game-yellow px-5 py-2 text-center text-lg font-bold text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.25)] motion-reduce:animate-none sm:text-xl">
                  {text()}
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>

      {/* stays mounted between turns so the iPad keeps focus + keyboard */}
      <div class="flex min-h-16 w-full items-center justify-center">
        <Show when={!props.game.over}>
          <MiniTypingInput
            value={mine() ? typed() : ""}
            onInput={onInput}
            wrong={mine() && wrong()}
            waiting={!mine()}
            placeholder={
              iAmOut()
                ? "you're out - watch the rest!"
                : mine()
                  ? props.game.word
                  : live()
                    ? "pass it when it comes to you!"
                    : "get ready…"
            }
          />
        </Show>
      </div>
    </div>
  );
}

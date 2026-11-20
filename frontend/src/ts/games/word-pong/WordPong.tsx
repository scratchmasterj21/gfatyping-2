import {
  createEffect,
  createSignal,
  For,
  Index,
  JSXElement,
  on,
  onCleanup,
  Show,
  createMemo,
} from "solid-js";

import type { PongGame } from "./pong-multiplayer";

import { Mascot } from "../../components/common/Mascot";
import { UserAvatar } from "../../components/common/UserAvatar";
import { cn } from "../../utils/cn";
import { sfx } from "../mini/mini-sounds";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TypingTracker } from "../shared/typing-report";
import {
  BallKind,
  HitOpts,
  otherSide,
  POWER_WORDS,
  powerWord,
  SHOT_INFO,
  SHOTS,
  Side,
  SMASH_SHARE,
  WIN_POINTS,
} from "./pong-rules";

type Player = { name: string; uid?: string; isBot?: boolean; emoji?: string };
type Reaction = { e: string; at: number };

const REACTION_MS = 2200;

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One paddle with its player's face above it. */
function PaddlePlayer(props: {
  player: Player;
  color: "red" | "blue";
  active: boolean;
  swing: boolean;
  reaction?: string;
}): JSXElement {
  return (
    <div class="relative flex flex-col items-center gap-1">
      <Show when={props.reaction}>
        {(e) => (
          <span class="absolute -top-12 animate-game-float-up text-4xl motion-reduce:animate-none">
            {e()}
          </span>
        )}
      </Show>
      <div
        class={cn(
          "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-4 transition-transform",
          props.color === "red" ? "ring-game-red" : "ring-game-blue",
          props.active && "scale-110",
        )}
      >
        <Show
          when={!props.player.isBot && props.player.uid}
          fallback={
            <Show
              when={props.player.emoji}
              fallback={
                <Mascot mood={props.active ? "thinking" : "happy"} size={52} />
              }
            >
              {(e) => <span class="text-4xl">{e()}</span>}
            </Show>
          }
        >
          {(uid) => <UserAvatar uid={uid()} class="h-14 w-14" />}
        </Show>
      </div>
      <div
        class={cn(
          "h-14 w-4 rounded-full shadow transition-transform duration-150",
          props.color === "red"
            ? "origin-bottom bg-game-red"
            : "origin-bottom bg-game-blue",
          props.swing &&
            (props.color === "red" ? "rotate-[35deg]" : "-rotate-[35deg]"),
        )}
      ></div>
      <div class="max-w-20 truncate text-sm font-bold text-game-cream sm:max-w-24">
        {props.player.name}
      </div>
    </div>
  );
}

/** Rally mode: the ball bounces off a wall. */
function Wall(): JSXElement {
  return (
    <div class="flex flex-col items-center gap-1">
      <div class="grid h-40 w-8 grid-cols-2 gap-0.5 rounded-md bg-game-brown-dark p-0.5 shadow">
        <For each={Array.from({ length: 16 }, (_, i) => i)}>
          {() => <span class="rounded-sm bg-game-brown"></span>}
        </For>
      </div>
      <div class="text-sm font-bold text-game-cream">Wall</div>
    </div>
  );
}

/**
 * The ping-pong table. Always drawn from the player's side: you're on the
 * left, your opponent (Tappy, a bot or a friend) on the right. Type the word
 * on the ball before it reaches your paddle to hit it back. While the ball
 * is on the other side, type power words to charge a special shot.
 */
export function WordPong(props: {
  game: PongGame;
  /** current time on the same clock as game.sentAt */
  now: number;
  mySide: Side;
  me: Player;
  opponent: Player;
  /** words for power words */
  pool: string[];
  tracker: TypingTracker;
  onHit: (opts: HitOpts) => void;
  /** rally mode: a wall instead of an opponent */
  rally?: boolean;
  /** shown under the scoreboard (tournament match, today's best...) */
  subtitle?: string;
  /** online: show the best-of-3 series */
  showSeries?: boolean;
  reactions?: Partial<Record<Side, Reaction>>;
  onReact?: (emoji: string) => void;
  reactionChoices?: string[];
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);
  const [meter, setMeter] = createSignal(0);
  const [powerN, setPowerN] = createSignal(0);
  const [ready, setReady] = createSignal<BallKind | null>(null);
  const [swing, setSwing] = createSignal<Side | null>(null);
  const [shake, setShake] = createSignal(false);
  const [popup, setPopup] = createSignal<{ id: number; text: string } | null>(
    null,
  );
  const [flyOff, setFlyOff] = createSignal<{
    id: number;
    side: Side;
  } | null>(null);
  let ballMisses = 0;
  let popupId = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  onCleanup(() => timers.forEach(clearTimeout));

  const showPopup = (text: string): void => {
    const id = ++popupId;
    setPopup({ id, text });
    later(1300, () => setPopup((p) => (p?.id === id ? null : p)));
  };

  const mine = (): boolean =>
    !props.game.over && props.game.toSide === props.mySide;
  const waiting = (): boolean => props.now < props.game.sentAt;
  const powering = (): boolean =>
    props.rally !== true && !props.game.over && !mine() && ready() === null;
  const target = (): number => props.game.target ?? WIN_POINTS;

  // memo: online, the game object is new on every room update and on()
  // re-runs on each one (it doesn't compare values) - only react to a real change
  const ballSeq = createMemo(() => props.game.seq);
  // a new ball: clear the box, show what just happened
  createEffect(
    on(ballSeq, (_, prevSeq) => {
      setTyped("");
      setWrong(false);
      ballMisses = 0;
      if (prevSeq === undefined) return;
      const g = props.game;
      if (g.hits > 0) {
        // somebody hit it back
        const hitter = otherSide(g.toSide);
        setSwing(hitter);
        later(220, () => setSwing(null));
        if (g.smash === true) {
          showPopup("💥 SMASH!");
          setShake(true);
          later(400, () => setShake(false));
        } else if (g.ball !== undefined && g.ball !== "normal") {
          const info = SHOT_INFO[g.ball];
          showPopup(`${info.emoji} ${info.name} - ${info.tip}`);
        }
      } else if (g.lastPoint !== undefined) {
        setFlyOff({ id: g.seq, side: otherSide(g.lastPoint) });
        later(900, () => setFlyOff((f) => (f?.id === g.seq ? null : f)));
      }
    }),
  );

  /** time used, 0-1 */
  const timeUsed = (): number =>
    Math.max(
      0,
      Math.min(1, (props.now - props.game.sentAt) / props.game.speedMs),
    );
  /**
   * Where the ball is, 0-1. A smash (or fire ball) rockets over the net
   * and then slows down near the paddle; other balls fly evenly.
   */
  const progress = (): number => {
    const t = timeUsed();
    return props.game.smash === true || props.game.ball === "fire"
      ? 1 - (1 - t) ** 3
      : t;
  };
  // ball x in %: travels toward whoever has to answer (you are on the left)
  const xAt = (p: number): number => (mine() ? 84 - 68 * p : 16 + 68 * p);
  /** one bounce on the receiver's half */
  const liftAt = (p: number): number =>
    p < 0.7
      ? Math.sin((Math.PI * p) / 0.7) * 46
      : Math.sin((Math.PI * (p - 0.7)) / 0.3) * 20;
  const ballX = (): number => xAt(progress());
  const ballLift = (): number => liftAt(progress());
  const fast = (): boolean =>
    props.game.hits >= 4 ||
    props.game.smash === true ||
    props.game.ball === "fire";
  const trail = (): { x: number; lift: number; o: number }[] => {
    if (!fast() || waiting() || reducedMotion()) return [];
    const p = progress();
    return [1, 2, 3, 4]
      .map((k) => ({ p: p - k * 0.035, o: 0.5 - k * 0.1 }))
      .filter((t) => t.p > 0)
      .map((t) => ({ x: xAt(t.p), lift: liftAt(t.p), o: t.o }));
  };
  const myScore = (): number => props.game.score[props.mySide];
  const theirScore = (): number => props.game.score[otherSide(props.mySide)];
  const matchPoint = (): boolean =>
    !props.game.over &&
    props.rally !== true &&
    (myScore() === target() - 1 || theirScore() === target() - 1);

  const power = (): string => powerWord(props.pool, powerN());

  const onInput = (value: string): void => {
    if (props.game.over) {
      setTyped("");
      return;
    }
    // the ball is on the other side: power words
    if (!mine()) {
      if (!powering()) {
        setTyped("");
        return;
      }
      const word = power();
      if (!word.startsWith(value)) {
        if (!wrong()) {
          sfx.oops();
          props.tracker.miss();
        }
        setWrong(true);
        return;
      }
      setWrong(false);
      setTyped(value);
      if (value === word) {
        props.tracker.word(word, 0);
        setTyped("");
        setPowerN((n) => n + 1);
        const next = meter() + 1;
        if (next >= POWER_WORDS) {
          setMeter(0);
          const shot = SHOTS[powerN() % SHOTS.length] ?? "fire";
          setReady(shot);
          sfx.great();
          showPopup(`${SHOT_INFO[shot].emoji} ${SHOT_INFO[shot].name} ready!`);
        } else {
          setMeter(next);
          sfx.good();
        }
      }
      return;
    }
    if (waiting()) {
      setTyped("");
      return;
    }
    const word = props.game.word;
    if (!word.startsWith(value)) {
      if (!wrong()) {
        ballMisses++;
        props.tracker.miss();
      }
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value === word) {
      props.tracker.word(word, ballMisses);
      const elapsed = props.now - props.game.sentAt;
      const opts: HitOpts = {};
      if (
        props.rally !== true &&
        ballMisses === 0 &&
        elapsed < props.game.speedMs * SMASH_SHARE
      ) {
        opts.smash = true;
      }
      const shot = ready();
      if (shot !== null) {
        opts.shot = shot;
        setReady(null);
      }
      props.onHit(opts);
    }
  };

  const reactionFor = (side: Side): string | undefined => {
    const r = props.reactions?.[side];
    return r !== undefined && props.now - r.at < REACTION_MS ? r.e : undefined;
  };

  const ballClass = (): string => {
    const g = props.game;
    if (g.ball === "fire") return "bg-game-orange ring-game-red";
    if (g.golden === true) return "bg-game-gold ring-game-yellow";
    if (g.ball === "ghost") return "bg-game-cloud/60 ring-game-grey";
    return "bg-game-cream ring-game-orange";
  };

  return (
    <div
      class={cn(
        "relative flex h-full flex-col gap-3 bg-linear-to-b from-game-night to-game-dusk p-4 pt-16 font-kid",
        shake() && "animate-game-shake",
      )}
    >
      {/* scoreboard */}
      <Show
        when={props.rally !== true}
        fallback={
          <div class="flex items-center justify-center gap-3 text-lg font-bold">
            <span class="rounded-full bg-game-red px-4 py-1 text-game-cream">
              🔥 Rally:{" "}
              <For each={[Math.ceil(props.game.hits / 2)]}>
                {(h) => (
                  <span class="inline-block animate-game-pop tabular-nums motion-reduce:animate-none">
                    {h}
                  </span>
                )}
              </For>{" "}
              hits
            </span>
          </div>
        }
      >
        <div class="flex items-center justify-center gap-3 text-lg font-bold">
          <span class="rounded-full bg-game-red px-4 py-1 text-game-cream">
            You{" "}
            <For each={[myScore()]}>
              {(n) => (
                <span class="inline-block animate-game-pop tabular-nums motion-reduce:animate-none">
                  {n}
                </span>
              )}
            </For>
          </span>
          <span class="text-game-cream/70">first to {target()}</span>
          <span class="rounded-full bg-game-blue px-4 py-1 text-game-cream">
            <For each={[theirScore()]}>
              {(n) => (
                <span class="inline-block animate-game-pop tabular-nums motion-reduce:animate-none">
                  {n}
                </span>
              )}
            </For>{" "}
            {props.opponent.name}
          </span>
        </div>
      </Show>
      <Show
        when={
          props.subtitle !== undefined ||
          (props.showSeries === true && props.game.series !== undefined)
        }
      >
        <div class="-mt-2 text-center text-sm text-game-cream/80">
          {props.subtitle}
          <Show when={props.showSeries === true && props.game.series}>
            {(s) => (
              <span>
                {props.subtitle === undefined ? "" : " · "}Series (best of 3):
                You {s()[props.mySide]} - {s()[otherSide(props.mySide)]}
              </span>
            )}
          </Show>
        </div>
      </Show>

      {/* table */}
      <div class="relative flex min-h-0 flex-1 items-center">
        <div
          class={cn(
            "absolute inset-x-[19%] top-1/2 h-[46%] max-h-72 -translate-y-1/2 rounded-double border-4 bg-game-blue shadow-[0_10px_0_rgb(0_0_0/0.25)] transition-colors sm:inset-x-[8%]",
            props.game.golden === true
              ? "border-game-gold"
              : "border-game-cream",
          )}
        >
          <div class="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-game-cream"></div>
          <div class="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-game-cream/50"></div>
        </div>
        <div class="absolute top-1/2 left-[1%] -translate-y-1/2">
          <PaddlePlayer
            player={props.me}
            color="red"
            active={mine()}
            swing={swing() === props.mySide}
            reaction={reactionFor(props.mySide)}
          />
        </div>
        <div class="absolute top-1/2 right-[1%] -translate-y-1/2">
          <Show when={props.rally !== true} fallback={<Wall />}>
            <PaddlePlayer
              player={props.opponent}
              color="blue"
              active={!mine() && !props.game.over}
              swing={swing() === otherSide(props.mySide)}
              reaction={reactionFor(otherSide(props.mySide))}
            />
          </Show>
        </div>

        {/* rally counter */}
        <Show
          when={
            props.rally !== true && props.game.hits >= 3 && !props.game.over
          }
        >
          <div
            class={cn(
              "pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 font-bold",
              props.game.hits >= 10
                ? "text-4xl text-game-red"
                : props.game.hits >= 6
                  ? "text-3xl text-game-orange"
                  : "text-2xl text-game-yellow",
            )}
          >
            <For each={[props.game.hits]}>
              {(h) => (
                <span class="inline-block animate-game-pop motion-reduce:animate-none">
                  🔥 {h} hits!
                </span>
              )}
            </For>
          </div>
        </Show>

        {/* shadow, trail and the ball with its word */}
        <Show when={!props.game.over && !waiting()}>
          <span
            class="pointer-events-none absolute top-1/2 h-2 w-6 -translate-x-1/2 translate-y-3 rounded-full bg-game-ink/40"
            style={{ left: `${ballX()}%`, opacity: 1 - ballLift() / 70 }}
          ></span>
        </Show>
        <Index each={trail()}>
          {(t) => (
            <span
              class={cn(
                "pointer-events-none absolute top-1/2 h-6 w-6 rounded-full",
                props.game.ball === "fire" ? "bg-game-orange" : "bg-game-cream",
              )}
              style={{
                left: `${t().x}%`,
                opacity: t().o,
                transform: `translate(-50%, calc(-50% - ${t().lift}px))`,
              }}
            ></span>
          )}
        </Index>
        <Show when={!props.game.over}>
          <div
            class="absolute top-1/2 flex -translate-x-1/2 flex-col items-center"
            style={{
              left: `${ballX()}%`,
              transform: `translate(-50%, calc(-50% - ${ballLift()}px))`,
            }}
          >
            <span
              class={cn(
                "mb-1 rounded-full px-3 py-1 font-mono font-bold shadow-[0_4px_0_rgb(0_0_0/0.25)]",
                props.game.ball === "giant"
                  ? "text-3xl sm:text-4xl"
                  : "text-2xl sm:text-3xl",
                mine()
                  ? props.game.golden === true
                    ? "bg-game-gold text-game-ink"
                    : "bg-game-yellow text-game-ink"
                  : "bg-game-cream text-game-ink/60",
                props.game.ball === "ghost" &&
                  mine() &&
                  "animate-pulse motion-reduce:animate-none",
              )}
            >
              <Show when={mine()} fallback={props.game.word}>
                <span class="text-game-green">{typed()}</span>
                <Show
                  when={props.game.ball === "spin"}
                  fallback={props.game.word.slice(typed().length)}
                >
                  <Index each={props.game.word.slice(typed().length).split("")}>
                    {(ch, i) => (
                      <span
                        class="inline-block animate-game-wave motion-reduce:animate-none"
                        style={{ "animation-delay": `${i * 0.12}s` }}
                      >
                        {ch()}
                      </span>
                    )}
                  </Index>
                </Show>
              </Show>
            </span>
            <span
              class={cn(
                "relative block rounded-full shadow-[0_4px_0_rgb(0_0_0/0.3)] ring-2",
                props.game.ball === "giant" ? "h-11 w-11" : "h-7 w-7",
                ballClass(),
              )}
            >
              <Show when={props.game.ball === "fire"}>
                <span class="absolute -top-3 -right-4 text-xl">🔥</span>
              </Show>
            </span>
          </div>
        </Show>

        {/* a missed ball flies off the table */}
        <Show when={flyOff()}>
          {(f) => {
            const near = f().side === props.mySide;
            return (
              <span
                ref={(el) =>
                  requestAnimationFrame(() =>
                    el.animate(
                      [
                        { left: near ? "12%" : "88%", top: "50%", opacity: 1 },
                        { left: near ? "-6%" : "106%", top: "95%", opacity: 0 },
                      ],
                      { duration: 800, easing: "ease-in", fill: "forwards" },
                    ),
                  )
                }
                class="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-game-cream ring-2 ring-game-orange"
              ></span>
            );
          }}
        </Show>

        {/* banners */}
        <div class="pointer-events-none absolute inset-x-0 top-12 grid justify-items-center gap-1">
          <Show when={popup()}>
            {(p) => (
              <div class="animate-game-pop rounded-full bg-game-orange px-5 py-1.5 text-xl font-bold text-game-ink shadow motion-reduce:animate-none">
                {p().text}
              </div>
            )}
          </Show>
          <Show when={waiting() && props.game.lastPoint !== undefined}>
            <div class="animate-game-pop rounded-full bg-game-yellow px-5 py-1.5 text-xl font-bold text-game-ink shadow motion-reduce:animate-none">
              {props.game.lastPoint === props.mySide
                ? "🎉 Your point!"
                : `Point to ${props.opponent.name}`}
            </div>
          </Show>
          <Show when={waiting() && props.game.golden === true}>
            <div class="animate-game-pop rounded-full bg-game-gold px-5 py-1.5 text-lg font-bold text-game-ink shadow motion-reduce:animate-none">
              🌟 Golden ball - this point is worth 2!
            </div>
          </Show>
          <Show when={waiting() && matchPoint()}>
            <div class="animate-game-pop rounded-full bg-game-red px-5 py-1.5 text-lg font-bold text-game-cream shadow motion-reduce:animate-none">
              ⚠️ Match point!
            </div>
          </Show>
        </div>
      </div>

      {/* power meter */}
      <Show when={props.rally !== true && !props.game.over}>
        <div class="flex items-center justify-center gap-2 text-sm font-bold text-game-cream">
          <Show
            when={ready()}
            fallback={
              <>
                <span>⚡ Power</span>
                <span class="flex gap-1">
                  <For each={Array.from({ length: POWER_WORDS }, (_, i) => i)}>
                    {(i) => (
                      <span
                        class={cn(
                          "h-3 w-8 rounded-full transition-colors",
                          i < meter() ? "bg-game-yellow" : "bg-game-ink/60",
                        )}
                      ></span>
                    )}
                  </For>
                </span>
                <Show when={powering()}>
                  <span class="rounded-full bg-game-ink/60 px-3 py-0.5 font-mono text-lg">
                    power word: <span class="text-game-green">{typed()}</span>
                    <span class="text-game-yellow">
                      {power().slice(typed().length)}
                    </span>
                  </span>
                </Show>
              </>
            }
          >
            {(shot) => (
              <span class="animate-game-pulse rounded-full bg-game-orange px-3 py-0.5 text-game-ink motion-reduce:animate-none">
                {SHOT_INFO[shot() as Exclude<BallKind, "normal">].emoji}{" "}
                {SHOT_INFO[shot() as Exclude<BallKind, "normal">].name} ready -
                your next hit sends it!
              </span>
            )}
          </Show>
        </div>
      </Show>

      {/* reactions (online) */}
      <Show when={props.onReact !== undefined && !props.game.over}>
        <div class="flex justify-center gap-2">
          <For each={props.reactionChoices ?? []}>
            {(e) => (
              <button
                type="button"
                tabIndex={-1}
                class="cursor-pointer rounded-full bg-game-ink/50 px-2 py-0.5 text-xl hover:bg-game-ink"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => props.onReact?.(e)}
              >
                {e}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* stays mounted between turns so the iPad keeps focus + keyboard */}
      <div class="flex min-h-16 items-center justify-center">
        <Show when={!props.game.over}>
          <MiniTypingInput
            value={typed()}
            onInput={onInput}
            wrong={wrong()}
            waiting={mine() ? waiting() : !powering()}
            placeholder={
              mine()
                ? waiting()
                  ? "get ready…"
                  : props.game.word
                : powering()
                  ? `power word: ${power()}`
                  : props.rally === true
                    ? "here it comes…"
                    : `${props.opponent.name} is typing…`
            }
          />
        </Show>
      </div>
    </div>
  );
}

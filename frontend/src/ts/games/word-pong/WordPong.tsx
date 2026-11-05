import { createEffect, createSignal, JSXElement, on, Show } from "solid-js";

import type { PongGame } from "./pong-multiplayer";

import { Mascot } from "../../components/common/Mascot";
import { UserAvatar } from "../../components/common/UserAvatar";
import { cn } from "../../utils/cn";
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { otherSide, Side, WIN_POINTS } from "./pong-rules";

type Player = { name: string; uid?: string; isBot?: boolean };

/** One paddle with its player's face above it. */
function PaddlePlayer(props: {
  player: Player;
  color: "red" | "blue";
  active: boolean;
}): JSXElement {
  return (
    <div class="flex flex-col items-center gap-1">
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
            <Mascot mood={props.active ? "thinking" : "happy"} size={52} />
          }
        >
          {(uid) => <UserAvatar uid={uid()} class="h-14 w-14" />}
        </Show>
      </div>
      <div
        class={cn(
          "h-14 w-4 rounded-full shadow",
          props.color === "red" ? "bg-game-red" : "bg-game-blue",
        )}
      ></div>
      <div class="max-w-20 truncate text-sm font-bold text-game-cream sm:max-w-24">
        {props.player.name}
      </div>
    </div>
  );
}

/**
 * The ping-pong table. Always drawn from the player's side: you're on the
 * left, your opponent (Tappy or a friend) on the right. Type the word on the
 * ball before it reaches your paddle to hit it back.
 */
export function WordPong(props: {
  game: PongGame;
  /** current time on the same clock as game.sentAt */
  now: number;
  mySide: Side;
  me: Player;
  opponent: Player;
  onHit: () => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);

  // a new ball: clear the box
  createEffect(
    on(
      () => props.game.seq,
      () => {
        setTyped("");
        setWrong(false);
      },
    ),
  );

  const mine = (): boolean =>
    !props.game.over && props.game.toSide === props.mySide;
  const progress = (): number =>
    Math.max(
      0,
      Math.min(1, (props.now - props.game.sentAt) / props.game.speedMs),
    );
  // ball x in %: travels toward whoever has to answer (you are on the left)
  const ballX = (): number =>
    mine() ? 84 - 68 * progress() : 16 + 68 * progress();
  const ballLift = (): number => Math.sin(Math.PI * progress()) * 34;
  const waiting = (): boolean => props.now < props.game.sentAt;
  const myScore = (): number => props.game.score[props.mySide];
  const theirScore = (): number => props.game.score[otherSide(props.mySide)];

  const onInput = (value: string): void => {
    if (!mine() || waiting()) {
      setTyped("");
      return;
    }
    const word = props.game.word;
    if (!word.startsWith(value)) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(value);
    if (value === word) props.onHit();
  };

  return (
    <div class="relative flex h-full flex-col gap-3 bg-linear-to-b from-game-night to-game-dusk p-4 pt-16 font-kid">
      {/* scoreboard */}
      <div class="flex items-center justify-center gap-3 text-lg font-bold">
        <span class="rounded-full bg-game-red px-4 py-1 text-game-cream">
          You {myScore()}
        </span>
        <span class="text-game-cream/70">first to {WIN_POINTS}</span>
        <span class="rounded-full bg-game-blue px-4 py-1 text-game-cream">
          {theirScore()} {props.opponent.name}
        </span>
      </div>

      {/* table */}
      <div class="relative flex min-h-0 flex-1 items-center">
        <div class="absolute inset-x-[19%] top-1/2 h-[46%] max-h-72 -translate-y-1/2 rounded-double border-4 border-game-cream bg-game-blue shadow-[0_10px_0_rgb(0_0_0/0.25)] sm:inset-x-[8%]">
          <div class="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-game-cream"></div>
          <div class="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-game-cream/50"></div>
        </div>
        <div class="absolute top-1/2 left-[1%] -translate-y-1/2">
          <PaddlePlayer player={props.me} color="red" active={mine()} />
        </div>
        <div class="absolute top-1/2 right-[1%] -translate-y-1/2">
          <PaddlePlayer
            player={props.opponent}
            color="blue"
            active={!mine() && !props.game.over}
          />
        </div>

        {/* the ball with its word */}
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
                "mb-1 rounded-full px-3 py-1 font-mono text-2xl font-bold shadow-[0_4px_0_rgb(0_0_0/0.25)] sm:text-3xl",
                mine()
                  ? "bg-game-yellow text-game-ink"
                  : "bg-game-cream text-game-ink/60",
              )}
            >
              <Show when={mine()} fallback={props.game.word}>
                <span class="text-game-green">{typed()}</span>
                {props.game.word.slice(typed().length)}
              </Show>
            </span>
            <span class="block h-7 w-7 rounded-full bg-game-cream shadow-[0_4px_0_rgb(0_0_0/0.3)] ring-2 ring-game-orange"></span>
          </div>
        </Show>

        {/* point banner */}
        <Show when={waiting() && props.game.lastPoint !== undefined}>
          <div class="absolute inset-x-0 top-4 flex justify-center">
            <div class="animate-game-pop rounded-full bg-game-yellow px-5 py-1.5 text-xl font-bold text-game-ink shadow motion-reduce:animate-none">
              {props.game.lastPoint === props.mySide
                ? "🎉 Your point!"
                : `Point to ${props.opponent.name}`}
            </div>
          </div>
        </Show>
      </div>

      <div class="flex min-h-16 items-center justify-center">
        <Show
          when={mine()}
          fallback={
            <div class="text-lg font-bold text-game-cream/80">
              {props.game.over ? "" : `${props.opponent.name} is typing…`}
            </div>
          }
        >
          <MiniTypingInput
            value={typed()}
            onInput={onInput}
            wrong={wrong()}
            placeholder={waiting() ? "get ready…" : props.game.word}
          />
        </Show>
      </div>
    </div>
  );
}

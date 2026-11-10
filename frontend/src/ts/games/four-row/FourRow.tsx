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
import { MiniTypingInput } from "../mini/MiniTypingInput";
import { TimeBar } from "../mini/TimeBar";
import {
  BOARDS_TO_WIN,
  cellIndex,
  COLS,
  Disc,
  FourState,
  matchColumn,
  otherDisc,
  roundOpen,
  ROWS,
} from "./four-rules";

type Player = { name: string; uid?: string; isBot?: boolean };

const discBg = (d: string | undefined): string =>
  d === "r" ? "bg-game-red" : d === "y" ? "bg-game-yellow" : "bg-game-night";

function PlayerBadge(props: {
  player: Player;
  disc: Disc;
  wins: number;
  done: boolean;
  right?: boolean;
}): JSXElement {
  return (
    <div
      class={cn(
        "flex min-w-0 items-center gap-2",
        props.right === true && "flex-row-reverse short:flex-row",
      )}
    >
      <div
        class={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-4",
          props.disc === "r" ? "ring-game-red" : "ring-game-yellow",
        )}
      >
        <Show
          when={props.player.isBot !== true && props.player.uid}
          fallback={
            <Mascot mood={props.done ? "happy" : "thinking"} size={40} />
          }
        >
          {(uid) => <UserAvatar uid={uid()} class="h-11 w-11" />}
        </Show>
      </div>
      <div
        class={cn(
          "min-w-0",
          props.right === true && "text-right short:text-left",
        )}
      >
        <div class="truncate text-base font-bold text-game-cream">
          {props.player.name}
        </div>
        <div
          class={cn(
            "flex gap-1",
            props.right === true && "justify-end short:justify-start",
          )}
        >
          <For each={Array.from({ length: BOARDS_TO_WIN })}>
            {(_, i) => (
              <span
                class={cn(
                  "h-3 w-3 rounded-full ring-2 ring-game-cream/60",
                  i() < props.wins ? discBg(props.disc) : "bg-transparent",
                )}
              ></span>
            )}
          </For>
          <Show when={props.done}>
            <span class="ml-1 text-xs font-bold text-game-green">
              ✓ dropped
            </span>
          </Show>
        </div>
      </div>
    </div>
  );
}

/**
 * The Four in a Row board, drawn the same for both players. Each column
 * shows a word: type it to drop your piece there. The first letter you type
 * picks the column (every column starts with a different letter).
 */
export function FourRow(props: {
  game: FourState;
  /** current time on the same clock as game.roundStartAt */
  now: number;
  myDisc: Disc;
  me: Player;
  opponent: Player;
  onDrop: (col: number) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const [wrong, setWrong] = createSignal(false);

  const theirDisc = (): Disc => otherDisc(props.myDisc);
  const pausing = (): boolean => props.now < props.game.roundStartAt;
  /** the finished board stays up during the pause before the next one */
  const showingLast = (): boolean =>
    props.game.last !== undefined &&
    (props.game.over || (pausing() && props.game.round === 1));
  const board = (): string =>
    showingLast() ? (props.game.last?.board ?? "") : props.game.board;
  const winLine = (): Set<number> =>
    new Set(showingLast() ? (props.game.last?.line ?? []) : []);
  const iMoved = (): boolean => props.game.moved[props.myDisc];
  const canType = (): boolean =>
    !iMoved() && !showingLast() && roundOpen(props.game, props.now);
  const target = (): number => matchColumn(props.game.words, typed());
  const remaining = (): number =>
    pausing()
      ? props.game.roundMs / 1000
      : Math.max(
          0,
          (props.game.roundStartAt + props.game.roundMs - props.now) / 1000,
        );

  // new round, or a column's word changed under my typing: clear the box
  createEffect(
    on(
      () => props.game.round + props.game.boardNo * 100,
      () => {
        setTyped("");
        setWrong(false);
      },
    ),
  );
  createEffect(
    on(
      () => props.game.words.join(","),
      () => {
        if (typed() !== "" && target() < 0) setTyped("");
      },
    ),
  );

  const onInput = (value: string): void => {
    if (!canType()) {
      setTyped("");
      return;
    }
    const v = value.trim().toLowerCase();
    const col = matchColumn(props.game.words, v);
    if (v !== "" && col < 0) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setTyped(v);
    if (col >= 0 && v === props.game.words[col]) {
      setTyped("");
      props.onDrop(col);
    }
  };

  const banner = (): string | undefined => {
    const g = props.game;
    if (showingLast()) {
      const w = g.last?.winner;
      if (g.over) {
        if (g.matchWinner === "draw") return "It's a tie match!";
        return g.matchWinner === props.myDisc
          ? "🏆 You win the match!"
          : `${props.opponent.name} wins the match`;
      }
      if (w === "draw") return "Board full - it's a draw! Play again";
      return w === props.myDisc
        ? "🎉 You win this board!"
        : `${props.opponent.name} wins this board`;
    }
    if (pausing()) {
      return g.round === 1 ? `Board ${g.boardNo} - get ready!` : undefined;
    }
    return undefined;
  };

  const dropFrom = (cell: number): string => {
    const row = Math.floor(cell / COLS);
    return `${-(ROWS - row + 0.5) * 110}%`;
  };

  return (
    <div class="relative flex h-full flex-col items-center gap-3 bg-linear-to-b from-game-night to-game-dusk p-3 pt-16 font-kid sm:p-4 sm:pt-16 short:grid short:grid-cols-[15rem_1fr] short:grid-rows-[auto_auto_1fr] short:items-start short:gap-x-6">
      {/* players + boards won (a side panel on short screens) */}
      <div class="grid w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2 short:grid-cols-1 short:gap-3">
        <PlayerBadge
          player={props.me}
          disc={props.myDisc}
          wins={props.game.wins[props.myDisc]}
          done={iMoved() && !pausing()}
        />
        <div class="text-center text-sm font-bold text-game-cream/80 short:order-first short:text-left">
          Board {props.game.boardNo}
          <div class="text-xs font-normal">best of 3</div>
        </div>
        <PlayerBadge
          player={props.opponent}
          disc={theirDisc()}
          wins={props.game.wins[theirDisc()]}
          done={props.game.moved[theirDisc()] && !pausing()}
          right
        />
      </div>

      <div class="w-full max-w-xl short:col-start-1">
        <TimeBar remaining={remaining()} total={props.game.roundMs / 1000} />
      </div>

      {/* the board */}
      <div
        class="relative min-h-0 w-full max-w-xl flex-1 short:col-start-2 short:row-span-3 short:row-start-1 short:h-full short:max-w-none"
        style={{ "container-type": "size" }}
      >
        <div
          class="mx-auto flex h-full flex-col justify-center"
          // as big as fits: full width, or the height minus the word rows
          style={{ width: "min(100%, calc((100cqh - 4.75rem) * 7 / 6))" }}
        >
          {/* words zig-zag on two lines so long ones get room on small screens */}
          <div class="grid grid-cols-7 gap-1 px-1.5 pb-2 sm:gap-2 sm:px-2.5">
            <For each={Array.from({ length: COLS }, (_, c) => c)}>
              {(col) => {
                const word = (): string => props.game.words[col] ?? "";
                const active = (): boolean => target() === col && canType();
                return (
                  <div
                    class={cn(
                      "relative flex h-16 justify-center",
                      col % 2 === 0 ? "items-start" : "items-end",
                    )}
                  >
                    <span
                      class={cn(
                        "absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-game-cream/30",
                        col % 2 === 0 ? "top-8" : "hidden",
                      )}
                    ></span>
                    <Show when={word() !== "" && !showingLast()}>
                      <span
                        class={cn(
                          "relative z-10 rounded-lg px-1.5 py-0.5 text-center font-mono text-base leading-tight font-bold whitespace-nowrap shadow-[0_3px_0_rgb(0_0_0/0.25)] sm:px-2 sm:text-lg",
                          active()
                            ? "scale-110 bg-game-yellow text-game-ink"
                            : canType()
                              ? "bg-game-cream text-game-ink"
                              : "bg-game-cream/50 text-game-ink/60",
                        )}
                      >
                        <Show when={active()} fallback={word()}>
                          <span class="text-game-green">{typed()}</span>
                          {word().slice(typed().length)}
                        </Show>
                      </span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
          <div class="grid aspect-7/6 w-full grid-cols-7 gap-1 overflow-hidden rounded-2xl bg-game-blue p-1.5 shadow-[0_8px_0_rgb(0_0_0/0.3)] sm:gap-2 sm:p-2.5">
            <For
              each={Array.from(
                { length: ROWS * COLS },
                // draw top row first
                (_, i) => cellIndex(ROWS - 1 - Math.floor(i / COLS), i % COLS),
              )}
            >
              {(cell) => {
                const disc = (): string | undefined => board()[cell];
                const isNew = (): boolean =>
                  props.game.lastDrop?.cell === cell &&
                  disc() === props.game.lastDrop.disc;
                const col = cell % COLS;
                return (
                  <div
                    class={cn(
                      "relative aspect-square rounded-full bg-game-night/80 shadow-[inset_0_3px_0_rgb(0_0_0/0.35)]",
                      target() === col && canType() && "bg-game-night/50",
                    )}
                  >
                    <Show when={disc() === "r" || disc() === "y"}>
                      <span
                        class={cn(
                          "absolute inset-0 rounded-full shadow-[inset_0_-4px_0_rgb(0_0_0/0.2)]",
                          discBg(disc()),
                          isNew() &&
                            "animate-game-drop motion-reduce:animate-none",
                          winLine().has(cell) &&
                            "animate-game-pulse ring-4 ring-game-cream",
                        )}
                        style={isNew() ? { "--drop-from": dropFrom(cell) } : {}}
                      ></span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        <Show when={banner()}>
          {(text) => (
            <div class="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
              <div class="animate-game-pop rounded-full bg-game-yellow px-5 py-2 text-xl font-bold text-game-ink shadow-[0_4px_0_rgb(0_0_0/0.25)] motion-reduce:animate-none">
                {text()}
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* stays mounted between rounds so the iPad keeps focus + keyboard */}
      <div class="flex min-h-16 w-full items-center justify-center short:col-start-1">
        <Show when={!props.game.over}>
          <MiniTypingInput
            value={canType() ? typed() : ""}
            onInput={onInput}
            wrong={canType() && wrong()}
            waiting={!canType()}
            placeholder={
              showingLast() || pausing()
                ? "get ready…"
                : iMoved()
                  ? `${props.opponent.name} is typing…`
                  : !roundOpen(props.game, props.now)
                    ? "time's up!"
                    : "type a word"
            }
          />
        </Show>
      </div>
    </div>
  );
}

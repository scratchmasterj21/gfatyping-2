import type Phaser from "phaser";

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { showErrorNotification } from "../../states/notifications";
import { cn } from "../../utils/cn";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { createTypeRacerGame } from "./game-config";
import {
  createRacerRoom,
  finishRacerRoom,
  joinRacerRoom,
  leaveRacerRoom,
  markRacerRoomPlaying,
  RacerPlayer,
  RacerRoom,
  startRacerRoom,
  subscribeRacerRoom,
  updateRacerPlayer,
} from "./type-racer-multiplayer";

const OPTIONS = getWordListOptions();

function grouped(
  options: WordListOption[],
): { group: string; items: WordListOption[] }[] {
  const map = new Map<string, WordListOption[]>();
  for (const o of options) {
    const list = map.get(o.group) ?? [];
    list.push(o);
    map.set(o.group, list);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

type Props = {
  open: boolean;
  onClose: () => void;
  multiplayerUnlocked?: boolean;
  onResult?: (score: number, wave: number) => void;
};

type Difficulty = { label: string; wpm: number };
const DIFFICULTIES: Difficulty[] = [
  { label: "Easy", wpm: 20 },
  { label: "Medium", wpm: 35 },
  { label: "Hard", wpm: 55 },
];

export function TypeRacerModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<Difficulty>(
    DIFFICULTIES[0] as Difficulty,
  );
  const [durationSec, setDurationSec] = createSignal<30 | 60>(60);
  const [visualProgress, setVisualProgress] = createSignal(0);
  const [raceActive, setRaceActive] = createSignal(false);
  const [phase, setPhase] = createSignal<
    "pick" | "loading" | "lobby" | "playing" | "results"
  >("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<RacerRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let game: Phaser.Game | null = null;
  let unsubscribeRoom: (() => void) | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let multiplayerGameStarted = false;
  let lastProgressWrite = 0;

  const groups = createMemo(() => grouped(OPTIONS));

  const players = createMemo(() =>
    Object.values(room()?.players ?? {}).sort((a, b) => {
      if (a.finished && b.finished) return a.finishedAt - b.finishedAt;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    }),
  );

  const startGame = async (multiplayerRoom?: RacerRoom): Promise<void> => {
    const opt = selected();
    const cpuWpm = difficulty().wpm;
    const onClose = props.onClose;
    const onResult = props.onResult;
    setPhase("loading");
    const words = multiplayerRoom?.words ?? (await opt.getWords());
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    game = await createTypeRacerGame(
      containerRef,
      words,
      cpuWpm,
      multiplayerRoom?.durationSec ?? durationSec(),
      multiplayerRoom !== undefined,
      multiplayerRoom?.targetChars,
    );
    setRaceActive(true);
    game.events.on("type-racer-race-active", setRaceActive);
    game.events.on("type-racer-player-progress", (progress: number) => {
      setVisualProgress(Math.max(0, Math.min(1, progress)));
    });
    if (multiplayerRoom !== undefined) {
      game.events.on(
        "type-racer-local-stats",
        (
          stats: Pick<
            RacerPlayer,
            "progress" | "wpm" | "accuracy" | "finished"
          >,
        ) => {
          if (!stats.finished && Date.now() - lastProgressWrite < 200) return;
          lastProgressWrite = Date.now();
          void updateRacerPlayer(multiplayerRoom.code, stats);
        },
      );
    }
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      onResult?.(data.score, data.wave);
    });
    game.events.on("exit-game", () => {
      onClose();
    });
  };

  const cleanup = (): void => {
    if (game !== null) {
      game.destroy(true);
      game = null;
    }
    setVisualProgress(0);
    setRaceActive(false);
    setPhase("pick");
  };

  const disconnectRoom = async (): Promise<void> => {
    const code = roomCode();
    unsubscribeRoom?.();
    unsubscribeRoom = undefined;
    if (startTimer !== undefined) clearTimeout(startTimer);
    startTimer = undefined;
    setRoom(undefined);
    setRoomCode(undefined);
    multiplayerGameStarted = false;
    if (code !== undefined) await leaveRacerRoom(code).catch(() => undefined);
  };

  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    setRoomCode(code);
    setPhase("lobby");
    unsubscribeRoom = subscribeRacerRoom(code, (next) => {
      if (next === null) {
        setRoom(undefined);
        setRoomCode(undefined);
        setPhase("pick");
        showErrorNotification("The race room was closed");
        return;
      }
      setRoom(next);
      const me = getAuthenticatedUser()?.uid;
      const opponent = Object.values(next.players ?? {})
        .filter((player) => player.uid !== me)
        .sort((a, b) => b.progress - a.progress)[0];
      if (opponent !== undefined) {
        game?.events.emit("type-racer-opponent", opponent);
      }
      if (next.status === "countdown" && next.startAt !== undefined) {
        if (startTimer !== undefined) clearTimeout(startTimer);
        startTimer = setTimeout(
          () => {
            if (next.hostUid === me) void markRacerRoomPlaying(code);
          },
          Math.max(0, next.startAt - Date.now()),
        );
      }
      if (next.status === "playing" && !multiplayerGameStarted) {
        multiplayerGameStarted = true;
        untrack(() => void startGame(next));
      }
      if (next.status === "finished") {
        if (game !== null) {
          game.destroy(true);
          game = null;
        }
        setPhase("results");
      }
    });
  };

  const createRoom = async (): Promise<void> => {
    if (props.multiplayerUnlocked !== true) return;
    setRoomBusy(true);
    try {
      const option = selected();
      watchRoom(
        await createRacerRoom({
          durationSec: durationSec(),
          wordListLabel: option.label,
          words: await option.getWords(),
        }),
      );
    } catch (error) {
      showErrorNotification("Could not create race room", { error });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    if (!/^\d{6}$/.test(joinCode())) {
      showErrorNotification("Enter the 6-digit room code");
      return;
    }
    setRoomBusy(true);
    try {
      watchRoom(await joinRacerRoom(joinCode()));
    } catch (error) {
      showErrorNotification("Could not join race room", { error });
    } finally {
      setRoomBusy(false);
    }
  };

  createEffect(() => {
    if (!props.open) {
      cleanup();
      void disconnectRoom();
    }
  });
  onCleanup(() => {
    cleanup();
    void disconnectRoom();
  });

  createEffect(() => {
    const current = room();
    if (
      current?.status !== "playing" ||
      current.hostUid !== getAuthenticatedUser()?.uid
    ) {
      return;
    }
    const online = Object.values(current.players ?? {}).filter(
      (player) => player.online,
    );
    if (online.length > 0 && online.every((player) => player.finished)) {
      void finishRacerRoom(current.code);
    }
  });

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/95">
        <div
          class={cn(
            "relative flex flex-col overflow-hidden rounded-xl border border-main/30 bg-bg shadow-2xl",
            phase() === "playing"
              ? "h-[90vh] w-[95vw] max-w-5xl"
              : "max-h-[94vh] w-full max-w-lg overflow-y-auto p-5",
          )}
        >
          <button
            type="button"
            class="absolute top-3 right-3 z-10 flex min-h-10 items-center justify-center rounded bg-sub-alt px-3 text-sm font-semibold text-sub hover:text-text"
            onClick={() => {
              props.onClose();
            }}
          >
            ← Back to lessons
          </button>

          <Show when={phase() === "pick"}>
            <h2 class="mb-1 pr-40 text-lg font-bold text-text">Type Racer</h2>
            <p class="mt-2 text-em-xs font-bold tracking-wider text-main uppercase">
              How to play
            </p>
            <p class="mb-4 text-em-sm text-sub">
              {mode() === "solo"
                ? "Race the CPU — type words to speed your car to the finish line!"
                : "Race classmates on the same words. Fast, accurate typing moves your car!"}
            </p>

            <div class="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                class={cn(
                  "rounded px-3 py-1.5 text-sm font-semibold",
                  mode() === "solo" ? "bg-main text-bg" : "bg-sub-alt text-sub",
                )}
                onClick={() => setMode("solo")}
              >
                Race CPU
              </button>
              <button
                type="button"
                class={cn(
                  "rounded px-3 py-1.5 text-sm font-semibold",
                  mode() === "together"
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-sub",
                )}
                disabled={props.multiplayerUnlocked !== true}
                onClick={() => {
                  if (props.multiplayerUnlocked === true) setMode("together");
                }}
              >
                {props.multiplayerUnlocked === true
                  ? "Race classmates"
                  : "🔒 Race classmates"}
              </button>
            </div>
            <Show when={props.multiplayerUnlocked !== true}>
              <p class="mb-3 text-center text-em-xs text-sub">
                Finish your first lesson to race classmates.
              </p>
            </Show>

            <Show when={mode() === "solo"}>
              <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
                Choose difficulty
              </p>
              <div class="mb-4 flex gap-2">
                <For each={DIFFICULTIES}>
                  {(d) => (
                    <button
                      type="button"
                      class={cn(
                        "flex-1 rounded px-3 py-1.5 text-em-sm font-semibold transition-colors",
                        difficulty().label === d.label
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-sub hover:text-text",
                      )}
                      onClick={() => setDifficulty(d)}
                    >
                      {d.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
              Race length
            </p>
            <div class="mb-4 grid grid-cols-2 gap-2">
              <For each={[30, 60] as const}>
                {(seconds) => (
                  <button
                    type="button"
                    class={cn(
                      "rounded px-3 py-1.5 text-em-sm font-semibold transition-colors",
                      durationSec() === seconds
                        ? "bg-main text-bg"
                        : "bg-sub-alt text-sub hover:text-text",
                    )}
                    onClick={() => setDurationSec(seconds)}
                  >
                    {seconds === 30 ? "Quick · 30s" : "Standard · 60s"}
                  </button>
                )}
              </For>
            </div>

            <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
              Choose a word list
            </p>

            <div class="max-h-72 overflow-y-auto rounded border border-main/20 bg-sub-alt">
              <For each={groups()}>
                {(g) => (
                  <div>
                    <div class="sticky top-0 bg-sub-alt px-3 py-1.5 text-em-xs font-bold tracking-widest text-sub uppercase">
                      {g.group}
                    </div>
                    <For each={g.items}>
                      {(opt) => (
                        <button
                          type="button"
                          class={cn(
                            "w-full px-4 py-2 text-left text-em-sm transition-colors",
                            selected().id === opt.id
                              ? "bg-main/20 text-text"
                              : "text-sub hover:bg-main/10 hover:text-text",
                          )}
                          onClick={() => {
                            setSelected(opt);
                          }}
                        >
                          {opt.label}
                        </button>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>

            <Show
              when={mode() === "together"}
              fallback={
                <button
                  type="button"
                  class="button primary mt-4"
                  onClick={() => void startGame()}
                >
                  Start race →
                </button>
              }
            >
              <div class="mt-4 grid gap-2 rounded bg-sub-alt p-3">
                <button
                  type="button"
                  class="button primary"
                  disabled={roomBusy()}
                  onClick={() => void createRoom()}
                >
                  {roomBusy() ? "Please wait…" : "Create race room"}
                </button>
                <div class="text-center text-em-xs text-sub">
                  or join a room
                </div>
                <div class="flex gap-2">
                  <input
                    class="min-w-0 flex-1 rounded bg-bg px-3 py-2 text-center font-bold tracking-widest text-text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={joinCode()}
                    onInput={(event) =>
                      setJoinCode(
                        event.currentTarget.value
                          .replace(/\D/g, "")
                          .slice(0, 6),
                      )
                    }
                  />
                  <button
                    type="button"
                    class="button"
                    disabled={roomBusy()}
                    onClick={() => void joinRoom()}
                  >
                    Join
                  </button>
                </div>
              </div>
            </Show>
          </Show>

          <Show when={phase() === "loading"}>
            <div class="flex items-center justify-center py-12 text-sub">
              Loading…
            </div>
          </Show>

          <Show when={phase() === "lobby"}>
            <div class="grid gap-4 pt-12">
              <div class="text-center">
                <div class="text-em-xs font-bold tracking-widest text-sub uppercase">
                  room code
                </div>
                <div class="text-4xl font-bold tracking-[0.25em] text-main">
                  {roomCode()}
                </div>
                <div class="mt-2 text-sm text-sub">
                  {room()?.wordListLabel} · {room()?.durationSec}s
                </div>
              </div>
              <div class="grid gap-2">
                <For each={players()}>
                  {(player) => (
                    <div class="flex items-center gap-3 rounded bg-sub-alt px-3 py-2">
                      <UserAvatar uid={player.uid} class="h-8 w-8" />
                      <span class="flex-1 truncate text-text">
                        {player.name}
                        {player.uid === room()?.hostUid ? " · host" : ""}
                      </span>
                      <span class={player.online ? "text-main" : "text-sub"}>
                        {player.online ? "ready" : "offline"}
                      </span>
                    </div>
                  )}
                </For>
              </div>
              <Show
                when={room()?.status === "countdown"}
                fallback={
                  <Show
                    when={room()?.hostUid === getAuthenticatedUser()?.uid}
                    fallback={
                      <div class="text-center text-sub">Waiting for host…</div>
                    }
                  >
                    <button
                      type="button"
                      class="button primary"
                      disabled={
                        players().filter((player) => player.online).length < 2
                      }
                      onClick={() => {
                        const code = roomCode();
                        if (code !== undefined) void startRacerRoom(code);
                      }}
                    >
                      Start race →
                    </button>
                  </Show>
                }
              >
                <div class="text-center text-xl font-bold text-main">
                  Get ready…
                </div>
              </Show>
            </div>
          </Show>

          <Show when={phase() === "playing"}>
            <Show when={roomCode() !== undefined}>
              <div class="pointer-events-none absolute top-3 left-3 z-20 rounded bg-bg/90 px-3 py-2 text-em-xs shadow">
                <div class="font-bold text-main">Race {roomCode()}</div>
                <For each={players()}>
                  {(player, index) => (
                    <div class="flex min-w-44 items-center gap-2 text-sub">
                      <span>{index() + 1}.</span>
                      <span class="max-w-24 flex-1 truncate">
                        {player.name}
                      </span>
                      <span>{Math.round(player.progress * 100)}%</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={raceActive()}>
              <div
                class="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-1 ring-text/60 transition-[left] duration-75 ease-linear"
                style={{
                  left: `calc(60px + ${visualProgress() * 100}% - ${visualProgress() * 120}px)`,
                  top: "calc(34.5% - 19px)",
                }}
              >
                <Show when={getAuthenticatedUser()?.uid}>
                  {(uid) => <UserAvatar uid={uid()} class="h-5 w-5" />}
                </Show>
              </div>
            </Show>
            <div
              ref={(el) => {
                containerRef = el;
              }}
              class="h-full w-full"
            ></div>
          </Show>

          <Show when={phase() === "results"}>
            <div class="grid gap-4 pt-12">
              <div class="text-center text-2xl font-bold text-main">
                Race complete!
              </div>
              <For each={players()}>
                {(player, index) => (
                  <div class="flex items-center gap-3 rounded bg-sub-alt px-3 py-2">
                    <span class="w-6 font-bold text-main">{index() + 1}</span>
                    <UserAvatar uid={player.uid} class="h-9 w-9" />
                    <span class="min-w-0 flex-1 truncate text-text">
                      {player.name}
                    </span>
                    <span class="text-right text-em-xs text-sub">
                      {player.wpm} WPM · {player.accuracy}%
                    </span>
                  </div>
                )}
              </For>
              <button
                type="button"
                class="button primary"
                onClick={() => props.onClose()}
              >
                Back to lessons
              </button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

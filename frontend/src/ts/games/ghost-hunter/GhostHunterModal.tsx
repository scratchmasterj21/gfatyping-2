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
import {
  createGhostHunterGame,
  GHOST_DIFFICULTIES,
  GameDifficulty,
} from "./game-config";
import {
  awardGhostPlayer,
  createGhostRoom,
  finishGhostRoom,
  GhostAction,
  GhostRoom,
  GhostWorld,
  joinGhostRoom,
  leaveGhostRoom,
  markGhostPlayerFinished,
  markGhostRoomPlaying,
  publishGhostWorld,
  startGhostRoom,
  submitGhostAction,
  subscribeGhostActions,
  subscribeGhostRoom,
  subscribeGhostWorld,
  updateGhostPlayerPosition,
} from "./ghost-multiplayer";

const OPTIONS = getWordListOptions();
const MULTIPLAYER_OPTIONS = OPTIONS.slice(
  Math.max(
    0,
    OPTIONS.findIndex((option) => option.id === "all-keys"),
  ),
);

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
  lessonWords?: string[];
  onResult?: (
    score: number,
    wave: number,
    difficultyLabel: string,
    wordListGroup: string,
  ) => void;
};

export function GhostHunterModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<GameDifficulty>(
    GHOST_DIFFICULTIES[0] as GameDifficulty,
  );
  const [phase, setPhase] = createSignal<
    "pick" | "loading" | "lobby" | "playing" | "results"
  >("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [maxWave, setMaxWave] = createSignal<5 | 10>(5);
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<GhostRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [localPlayerPosition, setLocalPlayerPosition] = createSignal(0.5);
  let containerRef: HTMLDivElement | undefined;
  let game: Phaser.Game | null = null;
  let unsubscribeRoom: (() => void) | undefined;
  let unsubscribeWorld: (() => void) | undefined;
  let unsubscribeActions: (() => void) | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let multiplayerGameStarted = false;
  let lastPositionWrite = 0;

  const groups = createMemo(() =>
    grouped(mode() === "together" ? MULTIPLAYER_OPTIONS : OPTIONS),
  );
  const availableDifficulties = createMemo(() =>
    mode() === "together"
      ? GHOST_DIFFICULTIES.filter((item) => item.label !== "Easy")
      : GHOST_DIFFICULTIES,
  );
  const multiplayerPlayers = createMemo(() =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    ),
  );
  const playerXOffset = (uid: string): number => {
    if (uid === getAuthenticatedUser()?.uid) return 0;
    const teammates = multiplayerPlayers().filter(
      (player) => player.uid !== getAuthenticatedUser()?.uid,
    );
    const index = teammates.findIndex((player) => player.uid === uid);
    const offsets = [-28, 28, -52, 52, -76, 76, 100];
    return offsets[index] ?? 0;
  };

  const startGame = async (
    wordsOverride?: string[],
    multiplayerDifficulty?: GameDifficulty,
    multiplayerRole?: "host" | "guest",
    multiplayerMaxWave?: 5 | 10,
  ): Promise<void> => {
    const easyDiff = GHOST_DIFFICULTIES[0] as GameDifficulty;
    const onClose = props.onClose;
    const onResult = props.onResult;
    const multiplayerCode = roomCode();
    setPhase("loading");
    const words = wordsOverride ?? (await selected().getWords());
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    const usedDifficulty =
      multiplayerDifficulty ??
      (wordsOverride !== undefined ? easyDiff : difficulty());
    const usedGroup = selected().group;
    game = await createGhostHunterGame(
      containerRef,
      words,
      usedDifficulty,
      multiplayerRole !== undefined
        ? (multiplayerMaxWave ?? 5)
        : wordsOverride !== undefined
          ? 5
          : 0,
      multiplayerRole,
    );
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      if (multiplayerCode === undefined) {
        onResult?.(data.score, data.wave, usedDifficulty.label, usedGroup);
        return;
      }
      void markGhostPlayerFinished(multiplayerCode, data.wave);
    });
    game.events.on("ui-wave", (wave: number) => {
      game?.registry.set("multiplayerWave", wave);
    });
    if (multiplayerCode !== undefined) {
      game.events.on("multiplayer-world-out", (world: GhostWorld) => {
        void publishGhostWorld(multiplayerCode, world);
      });
      game.events.on("multiplayer-word-action", (word: string) => {
        void submitGhostAction(multiplayerCode, word);
      });
      game.events.on(
        "multiplayer-player-award",
        (award: { uid?: string; points: number; wave: number }) => {
          const uid = award.uid ?? getAuthenticatedUser()?.uid;
          if (uid !== undefined) {
            void awardGhostPlayer(
              multiplayerCode,
              uid,
              award.points,
              award.wave,
            );
          }
        },
      );
      if (multiplayerRole === "host") {
        unsubscribeActions = subscribeGhostActions(
          multiplayerCode,
          (action: GhostAction) => {
            game?.events.emit("multiplayer-remote-action", action);
          },
        );
      } else {
        unsubscribeWorld = subscribeGhostWorld(
          multiplayerCode,
          (world: GhostWorld | null) => {
            if (world !== null) {
              game?.events.emit("multiplayer-world-snapshot", world);
            }
          },
        );
      }
    }
    game.events.on(
      "multiplayer-player-position",
      (data: { position: number; facing: "left" | "right" }) => {
        setLocalPlayerPosition(data.position);
        if (
          multiplayerCode === undefined ||
          Date.now() - lastPositionWrite < 250
        ) {
          return;
        }
        lastPositionWrite = Date.now();
        void updateGhostPlayerPosition(
          multiplayerCode,
          data.position,
          data.facing,
        );
      },
    );
    game.events.on("exit-game", () => {
      onClose();
    });
  };

  const cleanup = (): void => {
    if (game !== null) {
      game.destroy(true);
      game = null;
    }
    setLocalPlayerPosition(0.5);
    setPhase("pick");
  };

  const disconnectRoom = async (): Promise<void> => {
    const code = roomCode();
    unsubscribeRoom?.();
    unsubscribeWorld?.();
    unsubscribeActions?.();
    unsubscribeRoom = undefined;
    unsubscribeWorld = undefined;
    unsubscribeActions = undefined;
    if (startTimer !== undefined) clearTimeout(startTimer);
    startTimer = undefined;
    setRoom(undefined);
    setRoomCode(undefined);
    multiplayerGameStarted = false;
    if (code !== undefined) await leaveGhostRoom(code).catch(() => undefined);
  };

  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    setRoomCode(code);
    setPhase("lobby");
    unsubscribeRoom = subscribeGhostRoom(code, (next) => {
      if (next === null) {
        setRoom(undefined);
        setRoomCode(undefined);
        setPhase("pick");
        showErrorNotification("The multiplayer room was closed");
        return;
      }
      setRoom(next);
      if (next.status === "countdown" && next.startAt !== undefined) {
        if (startTimer !== undefined) clearTimeout(startTimer);
        const delay = Math.max(0, next.startAt - Date.now());
        startTimer = setTimeout(() => {
          if (next.hostUid === getAuthenticatedUser()?.uid) {
            void markGhostRoomPlaying(code);
          }
        }, delay);
      }
      if (next.status === "playing" && !multiplayerGameStarted) {
        multiplayerGameStarted = true;
        const selectedDifficulty =
          GHOST_DIFFICULTIES.find((d) => d.label === next.difficultyLabel) ??
          (GHOST_DIFFICULTIES[0] as GameDifficulty);
        const role =
          next.hostUid === getAuthenticatedUser()?.uid ? "host" : "guest";
        untrack(() => {
          void startGame(
            next.words,
            selectedDifficulty,
            role,
            next.maxWave ?? 5,
          );
        });
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
    if (props.multiplayerUnlocked !== true) {
      showErrorNotification("Unlock All keys to play together");
      return;
    }
    setRoomBusy(true);
    try {
      const words = await selected().getWords();
      const code = await createGhostRoom({
        difficultyLabel: difficulty().label,
        maxWave: maxWave(),
        wordListLabel: selected().label,
        words,
      });
      watchRoom(code);
    } catch (error) {
      showErrorNotification("Could not create multiplayer room", { error });
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
      watchRoom(await joinGhostRoom(joinCode()));
    } catch (error) {
      showErrorNotification("Could not join multiplayer room", { error });
    } finally {
      setRoomBusy(false);
    }
  };

  createEffect(() => {
    if (!props.open) {
      cleanup();
      void disconnectRoom();
      return;
    }
    const words = props.lessonWords;
    if (words !== undefined) {
      void startGame(words);
    }
  });

  onCleanup(() => {
    cleanup();
    void disconnectRoom();
  });

  createEffect(() => {
    const current = room();
    if (
      current === undefined ||
      current.status !== "playing" ||
      current.hostUid !== getAuthenticatedUser()?.uid
    ) {
      return;
    }
    const players = Object.values(current.players ?? {}).filter(
      (p) => p.online,
    );
    if (players.length > 0 && players.every((p) => p.finished)) {
      void finishGhostRoom(current.code);
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
              : "max-h-[94vh] w-full max-w-lg overflow-y-auto p-4 sm:p-5",
          )}
        >
          <button
            type="button"
            class="absolute top-3 right-3 z-10 flex min-h-10 items-center justify-center rounded bg-sub-alt px-3 text-sm font-semibold text-sub hover:text-text"
            onClick={() => props.onClose()}
          >
            ← Back to lessons
          </button>

          {/* Picker — hidden in lesson mode */}
          <Show when={phase() === "pick" && props.lessonWords === undefined}>
            <h2 class="mb-1 pr-40 text-lg font-bold text-text">Ghost Hunter</h2>
            <p class="mt-1 text-em-xs font-bold tracking-wider text-main uppercase">
              How to play
            </p>
            <p class="mb-3 text-em-xs leading-snug text-sub">
              {mode() === "together"
                ? "Move ↑/↓ · face ←/→ · type the shared ghosts with your team. Everyone protects the same logs."
                : "Move ↑/↓ · face ←/→ · type a ghost's word. Type ❄️ freeze or 🧨 tnt, then press ENTER to use it."}
            </p>

            <div class="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                class={cn(
                  "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
                  mode() === "solo"
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-sub hover:text-text",
                )}
                onClick={() => setMode("solo")}
              >
                Play solo
              </button>
              <button
                type="button"
                class={cn(
                  "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
                  mode() === "together"
                    ? "bg-main text-bg"
                    : "bg-sub-alt text-sub hover:text-text",
                )}
                disabled={props.multiplayerUnlocked !== true}
                onClick={() => {
                  if (props.multiplayerUnlocked !== true) return;
                  setMode("together");
                  setSelected(MULTIPLAYER_OPTIONS[0] as WordListOption);
                  if (difficulty().label === "Easy") {
                    setDifficulty(GHOST_DIFFICULTIES[1] as GameDifficulty);
                  }
                }}
              >
                {props.multiplayerUnlocked === true
                  ? "Play together"
                  : "🔒 Play together"}
              </button>
            </div>

            <Show when={props.multiplayerUnlocked !== true}>
              <p class="mb-3 text-center text-em-xs text-sub">
                Unlock the All keys lessons to play multiplayer.
              </p>
            </Show>

            <p class="mb-1 text-em-xs font-semibold tracking-wider text-sub uppercase">
              Choose difficulty
            </p>
            <div class="mb-3 flex gap-2">
              <For each={availableDifficulties()}>
                {(d) => (
                  <button
                    type="button"
                    class={cn(
                      "flex-1 rounded px-2 py-1 text-em-xs font-semibold transition-colors",
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

            <Show when={mode() === "together"}>
              <p class="mb-1 text-em-xs font-semibold tracking-wider text-sub uppercase">
                Match length
              </p>
              <div class="mb-3 grid grid-cols-2 gap-2">
                <For each={[5, 10] as const}>
                  {(waves) => (
                    <button
                      type="button"
                      class={cn(
                        "rounded px-2 py-1 text-em-xs font-semibold transition-colors",
                        maxWave() === waves
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-sub hover:text-text",
                      )}
                      onClick={() => setMaxWave(waves)}
                    >
                      {waves} waves
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <p class="mb-1 text-em-xs font-semibold tracking-wider text-sub uppercase">
              Choose a word list
            </p>
            <div class="max-h-40 overflow-y-auto rounded border border-main/20 bg-sub-alt sm:max-h-52">
              <For each={groups()}>
                {(g) => (
                  <div>
                    <div class="sticky top-0 bg-sub-alt px-3 py-1 text-em-xs font-bold tracking-widest text-sub uppercase">
                      {g.group}
                    </div>
                    <For each={g.items}>
                      {(opt) => (
                        <button
                          type="button"
                          class={cn(
                            "w-full px-4 py-1.5 text-left text-em-xs transition-colors",
                            selected().id === opt.id
                              ? "bg-main/20 text-text"
                              : "text-sub hover:bg-main/10 hover:text-text",
                          )}
                          onClick={() => setSelected(opt)}
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
                  Start solo game →
                </button>
              }
            >
              <div class="mt-3 grid gap-2 rounded bg-sub-alt p-3">
                <button
                  type="button"
                  class="button primary"
                  disabled={roomBusy()}
                  onClick={() => void createRoom()}
                >
                  {roomBusy() ? "Please wait…" : "Create multiplayer room"}
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
            <div class="grid gap-4 p-6 pt-16">
              <div class="text-center">
                <div class="text-em-xs font-bold tracking-widest text-sub uppercase">
                  room code
                </div>
                <div class="text-4xl font-bold tracking-[0.25em] text-main">
                  {roomCode()}
                </div>
                <div class="mt-2 text-sm text-sub">
                  {room()?.wordListLabel} · {room()?.difficultyLabel} ·{" "}
                  {room()?.maxWave ?? 5} waves
                </div>
              </div>
              <div class="grid gap-2">
                <div class="font-semibold text-text">
                  Players ({Object.keys(room()?.players ?? {}).length}/8)
                </div>
                <For each={Object.values(room()?.players ?? {})}>
                  {(player) => (
                    <div class="flex items-center justify-between rounded bg-sub-alt px-3 py-2">
                      <span class="text-text">
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
                      <div class="text-center text-sub">
                        Waiting for the host to start…
                      </div>
                    }
                  >
                    <button
                      type="button"
                      class="button primary"
                      disabled={Object.keys(room()?.players ?? {}).length < 2}
                      onClick={() => {
                        const code = roomCode();
                        if (code !== undefined) void startGhostRoom(code);
                      }}
                    >
                      Start team game →
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
                <div class="font-bold text-main">Team room {roomCode()}</div>
                <For each={Object.values(room()?.players ?? {})}>
                  {(player) => (
                    <div class="flex min-w-44 justify-between gap-4 text-sub">
                      <span class="max-w-28 truncate">{player.name}</span>
                      <span>{player.score}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <div class="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              <Show
                when={roomCode() === undefined && getAuthenticatedUser()?.uid}
              >
                {(uid) => (
                  <div
                    class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-[top] duration-100 ease-linear"
                    style={{
                      left: "50%",
                      top: `calc(68% + ${28 + localPlayerPosition() * 130}px)`,
                    }}
                  >
                    <div class="relative z-10 h-8 w-8 overflow-hidden rounded-full bg-sub-alt ring-2 ring-main">
                      <UserAvatar uid={uid()} class="h-8 w-8" />
                    </div>
                  </div>
                )}
              </Show>
              <For each={multiplayerPlayers()}>
                {(player) => (
                  <div
                    class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-[top] duration-200 ease-linear"
                    style={{
                      left: `calc(50% + ${playerXOffset(player.uid)}px)`,
                      top: `calc(68% + ${
                        28 +
                        (player.uid === getAuthenticatedUser()?.uid
                          ? localPlayerPosition()
                          : (player.position ?? 0.5)) *
                          130
                      }px)`,
                    }}
                  >
                    <div class="relative z-10 h-8 w-8 overflow-hidden rounded-full bg-sub-alt ring-2 ring-main">
                      <UserAvatar uid={player.uid} class="h-8 w-8" />
                    </div>
                    <Show when={player.uid !== getAuthenticatedUser()?.uid}>
                      <div
                        class="-mt-1 h-7 w-5 rounded bg-main opacity-80"
                        style={{
                          transform:
                            player.facing === "left"
                              ? "scaleX(-1)"
                              : "scaleX(1)",
                        }}
                      ></div>
                      <span class="mt-0.5 max-w-20 truncate rounded bg-bg/80 px-1 text-[10px] text-text">
                        {player.name}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <div
              ref={(el) => {
                containerRef = el;
              }}
              class="h-full w-full"
            ></div>
          </Show>

          <Show when={phase() === "results"}>
            <div class="grid gap-4 p-6 pt-16">
              <div class="text-center text-2xl font-bold text-main">
                Team game complete!
              </div>
              <div class="grid gap-2">
                <For
                  each={Object.values(room()?.players ?? {}).sort(
                    (a, b) => b.score - a.score,
                  )}
                >
                  {(player, index) => (
                    <div class="flex items-center gap-3 rounded bg-sub-alt px-3 py-2">
                      <span class="w-6 font-bold text-main">{index() + 1}</span>
                      <span class="min-w-0 flex-1 truncate text-text">
                        {player.name}
                      </span>
                      <span class="font-bold text-text">{player.score}</span>
                      <span class="text-em-xs text-sub">
                        wave {player.wave}
                      </span>
                    </div>
                  )}
                </For>
              </div>
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

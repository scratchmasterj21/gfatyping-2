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
  createTypeTossGame,
  TYPE_TOSS_DIFFICULTIES,
  GameDifficulty,
} from "./game-config";
import {
  createTossRoom,
  finishTossRoom,
  joinTossRoom,
  leaveTossRoom,
  markTossRoomPlaying,
  startTossRoom,
  subscribeTossRoom,
  TossPlayer,
  TossRoom,
  updateTossPlayer,
} from "./type-toss-multiplayer";

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
  lessonWords?: string[];
  onResult?: (
    score: number,
    wave: number,
    difficultyLabel: string,
    wordListGroup: string,
  ) => void;
};

export function TypeTossModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<GameDifficulty>(
    TYPE_TOSS_DIFFICULTIES[1] as GameDifficulty,
  );
  const [phase, setPhase] = createSignal<
    "pick" | "loading" | "lobby" | "playing" | "results"
  >("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [matchLength, setMatchLength] = createSignal<30 | 60>(60);
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<TossRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [avatarVisible, setAvatarVisible] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let game: Phaser.Game | null = null;
  let unsubscribeRoom: (() => void) | undefined;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let multiplayerGameStarted = false;

  const groups = createMemo(() => grouped(OPTIONS));
  const players = createMemo(() =>
    Object.values(room()?.players ?? {}).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.words !== a.words) return b.words - a.words;
      return b.accuracy - a.accuracy;
    }),
  );

  const startGame = async (
    wordsOverride?: string[],
    multiplayerRoom?: TossRoom,
  ): Promise<void> => {
    const onClose = props.onClose;
    const onResult = props.onResult;
    setPhase("loading");
    const words = wordsOverride ?? (await selected().getWords());
    setPhase("playing");
    await Promise.resolve();
    if (containerRef === undefined) return;
    const usedDifficulty =
      multiplayerRoom === undefined
        ? difficulty()
        : ({
            label: "Medium",
            cols: 3,
            time: multiplayerRoom.durationSec,
          } satisfies GameDifficulty);
    const usedGroup = selected().group;
    game = await createTypeTossGame(
      containerRef,
      words,
      usedDifficulty,
      multiplayerRoom !== undefined,
      multiplayerRoom?.seed,
    );
    setAvatarVisible(true);
    game.events.on("game-avatar-visible", setAvatarVisible);
    game.events.on("game-result", (data: { score: number; wave: number }) => {
      setAvatarVisible(false);
      if (multiplayerRoom === undefined) {
        onResult?.(data.score, data.wave, usedDifficulty.label, usedGroup);
      }
    });
    if (multiplayerRoom !== undefined) {
      game.events.on(
        "type-toss-local-stats",
        (
          stats: Pick<TossPlayer, "score" | "words" | "accuracy" | "finished">,
        ) => void updateTossPlayer(multiplayerRoom.code, stats),
      );
    }
    game.events.on("exit-game", () => {
      onClose();
    });
  };

  const cleanup = (): void => {
    if (game !== null) {
      game.destroy(true);
      game = null;
    }
    setPhase("pick");
    setAvatarVisible(false);
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
    if (code !== undefined) await leaveTossRoom(code).catch(() => undefined);
  };

  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    setRoomCode(code);
    setPhase("lobby");
    unsubscribeRoom = subscribeTossRoom(code, (next) => {
      if (next === null) {
        setRoom(undefined);
        setRoomCode(undefined);
        setPhase("pick");
        showErrorNotification("The Type Toss room was closed");
        return;
      }
      setRoom(next);
      if (next.status === "countdown" && next.startAt !== undefined) {
        if (startTimer !== undefined) clearTimeout(startTimer);
        startTimer = setTimeout(
          () => {
            if (next.hostUid === getAuthenticatedUser()?.uid) {
              void markTossRoomPlaying(code);
            }
          },
          Math.max(0, next.startAt - Date.now()),
        );
      }
      if (next.status === "playing" && !multiplayerGameStarted) {
        multiplayerGameStarted = true;
        untrack(() => void startGame(next.words, next));
      }
      if (next.status === "finished") {
        if (game !== null) {
          game.destroy(true);
          game = null;
        }
        setAvatarVisible(false);
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
        await createTossRoom({
          durationSec: matchLength(),
          wordListLabel: option.label,
          words: await option.getWords(),
        }),
      );
    } catch (error) {
      showErrorNotification("Could not create Type Toss room", { error });
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
      watchRoom(await joinTossRoom(joinCode()));
    } catch (error) {
      showErrorNotification("Could not join Type Toss room", { error });
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
      current?.status !== "playing" ||
      current.hostUid !== getAuthenticatedUser()?.uid
    ) {
      return;
    }
    const online = Object.values(current.players ?? {}).filter(
      (player) => player.online,
    );
    if (online.length > 0 && online.every((player) => player.finished)) {
      void finishTossRoom(current.code);
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
            onClick={() => props.onClose()}
          >
            ← Back to lessons
          </button>

          <Show when={phase() === "pick" && props.lessonWords === undefined}>
            <h2 class="mb-1 pr-40 text-lg font-bold text-text">Type Toss</h2>
            <p class="mt-2 text-em-xs font-bold tracking-wider text-main uppercase">
              How to play
            </p>
            <p class="mb-4 text-em-sm text-sub">
              {mode() === "solo"
                ? "Type as many words as you can before time runs out! Watch for ⏱️ bonus time and ✨ double points — avoid the 💣 trap."
                : "Everyone gets the same starting board and words. Score the most points before time runs out!"}
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
                Play solo
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
                  ? "Play together"
                  : "🔒 Play together"}
              </button>
            </div>
            <Show when={props.multiplayerUnlocked !== true}>
              <p class="mb-3 text-center text-em-xs text-sub">
                Complete Full Home Row to play multiplayer.
              </p>
            </Show>

            <Show
              when={mode() === "solo"}
              fallback={
                <>
                  <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
                    Match length
                  </p>
                  <div class="mb-4 grid grid-cols-2 gap-2">
                    <For each={[30, 60] as const}>
                      {(seconds) => (
                        <button
                          type="button"
                          class={cn(
                            "rounded px-3 py-1.5 text-em-sm font-semibold",
                            matchLength() === seconds
                              ? "bg-main text-bg"
                              : "bg-sub-alt text-sub",
                          )}
                          onClick={() => setMatchLength(seconds)}
                        >
                          {seconds}s
                        </button>
                      )}
                    </For>
                  </div>
                </>
              }
            >
              <p class="mb-2 text-em-sm font-semibold tracking-wider text-sub uppercase">
                Choose difficulty
              </p>
              <div class="mb-4 flex gap-2">
                <For each={TYPE_TOSS_DIFFICULTIES}>
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
                      <span class="block">{d.label}</span>
                      <span class="block text-xs opacity-70">
                        {d.time}s · {d.cols * 3} targets
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

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
                  Start game →
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
                        if (code !== undefined) void startTossRoom(code);
                      }}
                    >
                      Start match →
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
                <div class="font-bold text-main">Type Toss {roomCode()}</div>
                <For each={players()}>
                  {(player, index) => (
                    <div class="flex min-w-44 gap-2 text-sub">
                      <span>{index() + 1}.</span>
                      <span class="max-w-24 flex-1 truncate">
                        {player.name}
                      </span>
                      <span>{player.score}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={avatarVisible() && getAuthenticatedUser()?.uid}>
              {(uid) => (
                <div class="pointer-events-none absolute bottom-8 left-[4.5%] z-10 flex flex-col items-center">
                  <UserAvatar
                    uid={uid()}
                    class="h-10 w-10 rounded-full bg-sub-alt ring-2 ring-main"
                  />
                  <div class="-mt-1 h-9 w-6 rounded-t-lg bg-main/80"></div>
                </div>
              )}
            </Show>
            <div
              ref={(el) => {
                containerRef = el;
              }}
              class="h-full w-full"
            ></div>
          </Show>

          <Show when={phase() === "results"}>
            <div class="grid gap-3 pt-12">
              <div class="text-center text-2xl font-bold text-main">
                Match complete!
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
                      {player.score} pts · {player.accuracy}%
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

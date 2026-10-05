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
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GameMultiplayerRoomFooter } from "../components/GameMultiplayerRoomFooter";
import { GamePickLayout } from "../components/GamePickLayout";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { groupWordListOptions } from "../components/groupWordListOptions";
import { MULTIPLAYER_UNLOCK_HINT_TYPE_RACER } from "../components/multiplayer-unlock-hints";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
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

const GROUPS = groupWordListOptions(OPTIONS);

type Props = {
  open: boolean;
  onClose: () => void;
  multiplayerUnlocked?: boolean;
  initialMode?: "solo" | "together";
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
    if (props.open) {
      setMode(
        props.initialMode === "together" && props.multiplayerUnlocked === true
          ? "together"
          : "solo",
      );
    } else {
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

  const frameLayout = createMemo((): "pick" | "playing" | "compact" => {
    if (phase() === "playing") return "playing";
    if (phase() === "pick") return "pick";
    return "compact";
  });

  return (
    <Show when={props.open}>
      <GameModalFrame layout={frameLayout()} onClose={() => props.onClose()}>
        <Show when={phase() === "pick"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Type Racer"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Start race"
                    onClick={() => void startGame()}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  createLabel="Create race room"
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <p class="text-em-sm text-sub">
                {mode() === "solo"
                  ? "Race the CPU — type words to speed your car to the finish line!"
                  : "Race classmates on the same words. Fast, accurate typing moves your car!"}
              </p>
            </GameSetupSection>

            <GameSetupSection title="Mode">
              <SoloTogetherToggle
                mode={mode()}
                soloLabel="Race CPU"
                togetherLabel="Race classmates"
                multiplayerUnlocked={props.multiplayerUnlocked === true}
                unlockHint={MULTIPLAYER_UNLOCK_HINT_TYPE_RACER}
                onModeChange={setMode}
              />
            </GameSetupSection>

            <Show when={mode() === "solo"}>
              <GameSetupSection title="Choose difficulty">
                <DifficultySegmented
                  options={DIFFICULTIES}
                  selectedLabel={difficulty().label}
                  onSelect={(d) => setDifficulty(d)}
                />
              </GameSetupSection>
            </Show>

            <GameSetupSection title="Race length">
              <div class="grid grid-cols-2 gap-2">
                <For each={[30, 60] as const}>
                  {(seconds) => (
                    <button
                      type="button"
                      class={cn(
                        "rounded-lg px-3 py-2 text-em-sm font-semibold",
                        durationSec() === seconds
                          ? "bg-main text-bg"
                          : "bg-sub-alt text-sub",
                      )}
                      onClick={() => setDurationSec(seconds)}
                    >
                      {seconds === 30 ? "Quick · 30s" : "Standard · 60s"}
                    </button>
                  )}
                </For>
              </div>
            </GameSetupSection>

            <GameSetupSection title="Choose a word list">
              <WordListPicker
                groups={GROUPS}
                selectedId={selected().id}
                onSelect={setSelected}
              />
            </GameSetupSection>
          </GamePickLayout>
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
                  <GameSetupPrimaryAction
                    text="Start race"
                    disabled={
                      players().filter((player) => player.online).length < 2
                    }
                    onClick={() => {
                      const code = roomCode();
                      if (code !== undefined) void startRacerRoom(code);
                    }}
                  />
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
                    <span class="max-w-24 flex-1 truncate">{player.name}</span>
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
            <GameSetupPrimaryAction
              text="Back to lessons"
              showArrow={false}
              onClick={() => props.onClose()}
            />
          </div>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

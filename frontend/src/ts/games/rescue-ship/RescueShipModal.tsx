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
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GameMultiplayerRoomFooter } from "../components/GameMultiplayerRoomFooter";
import { GamePickLayout } from "../components/GamePickLayout";
import {
  GameResultOverlay,
  GameResultView,
} from "../components/GameResultOverlay";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { InviteClassmates } from "../components/InviteClassmates";
import { MULTIPLAYER_UNLOCK_HINT_GENERIC } from "../components/multiplayer-unlock-hints";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import { PET_ART } from "./ship-art";
import {
  createShipRoom,
  finishShipRoom,
  joinShipRoom,
  leaveShipRoom,
  roomCrew,
  setMyStation,
  ShipRoom,
  shipNow,
  startShipRoom,
  subscribeShipRoom,
  syncShipClock,
  writeDone,
  writeHands,
} from "./ship-multiplayer";
import {
  buildCrew,
  CREW_SIZE,
  SHIP_DIFFICULTIES,
  shipAwards,
  shipDifficultyFor,
  ShipDifficulty,
  ShipFacts,
  shipScore,
  ShipSetup,
  shipStars,
  shipTasks,
  shipView,
  START_PAUSE_MS,
  Station,
  STATION_INFO,
  STATIONS,
  Task,
} from "./ship-rules";
import { ShipGame } from "./ShipGame";

const GAME_ID = "rescue-ship";
const ME = "me";
const RESULT_PAUSE_MS = 1800;

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

type Phase = "pick" | "lobby" | "playing" | "result";

export function RescueShipModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  multiplayerUnlocked?: boolean;
  onClose: () => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [station, setStation] = createSignal<Station>("pilot");
  const [difficulty, setDifficulty] = createSignal<ShipDifficulty>(
    SHIP_DIFFICULTIES[0] as ShipDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  let resultTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  // solo
  const [solo, setSolo] = createSignal<{
    setup: ShipSetup;
    facts: ShipFacts;
  } | null>(null);

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<ShipRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number => (mode() === "together" ? shipNow() : Date.now());

  createEffect(() => {
    if (phase() !== "playing" && phase() !== "result") return;
    const t = setInterval(() => setNow(clock()), 100);
    onCleanup(() => clearInterval(t));
  });

  // ---------------------------------------------------------- the run
  const setup = createMemo((): ShipSetup | null => {
    if (mode() === "solo") return solo()?.setup ?? null;
    const r = room();
    if (r === null || r.crew === undefined) return null;
    return {
      seed: r.seed,
      difficulty: shipDifficultyFor(r.difficultyLabel),
      crew: roomCrew(r),
    };
  });
  const tasks = createMemo(() => {
    const s = setup();
    return s === null ? [] : shipTasks(s.seed, s.difficulty);
  });
  const facts = createMemo((): ShipFacts | null => {
    if (mode() === "solo") return solo()?.facts ?? null;
    const r = room();
    if (r === null || r.startAt === undefined) return null;
    return { startAt: r.startAt, done: r.done ?? {}, hands: r.hands ?? {} };
  });
  const view = createMemo(() => {
    const s = setup();
    const f = facts();
    return s === null || f === null ? null : shipView(s, tasks(), f, now());
  });
  const myHands = createMemo(
    () =>
      new Set(
        Object.entries(facts()?.hands ?? {})
          .filter(([, by]) => by?.[myId()] !== undefined)
          .map(([id]) => id),
      ),
  );

  const onDone = (task: Task): void => {
    if (mode() === "solo") {
      setSolo((s) =>
        s === null || s.facts.done[task.id] !== undefined
          ? s
          : {
              ...s,
              facts: {
                ...s.facts,
                done: {
                  ...s.facts.done,
                  [task.id]: { by: ME, at: Date.now() },
                },
              },
            },
      );
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      // someone (or a helper) may have got it first - that's fine
      void writeDone(code, task.id).catch(() => undefined);
    }
  };

  const onHands = (task: Task): void => {
    if (mode() === "solo") {
      setSolo((s) =>
        s === null
          ? s
          : {
              ...s,
              facts: {
                ...s.facts,
                hands: {
                  ...s.facts.hands,
                  [task.id]: { ...s.facts.hands[task.id], [ME]: Date.now() },
                },
              },
            },
      );
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeHands(code, task.id).catch(() => undefined);
    }
  };

  // the run is over: results and coins
  createEffect(() => {
    const v = view();
    const s = setup();
    if (v === null || s === null || !v.over || finished) return;
    finished = true;
    const mine = v.stats[myId()] ?? {
      dodges: 0,
      charges: 0,
      fixes: 0,
      rescues: 0,
      hands: 0,
    };
    const score = shipScore({ view: v, mine });
    if (v.reason === "home") sfx.finish();
    const r = untrack(room);
    if (r !== null && r.hostUid === uid() && r.status === "playing") {
      void finishShipRoom(r.code).catch(() => undefined);
    }
    const awards = mode() === "together" ? shipAwards(s.crew, v.stats) : [];
    resultTimer = setTimeout(() => {
      resultTimer = undefined;
      setResult({
        headline:
          v.reason === "home"
            ? `Home safe with ${v.pets} pets! 🎉`
            : "The ship needs repairs - back to base!",
        score,
        stars: shipStars(v),
        stats: [
          { label: "pets rescued", value: `🐾 ${v.pets}` },
          { label: "ship health", value: `❤️ ${v.hp}` },
          {
            label: "your jobs done",
            value: String(
              mine.dodges + mine.charges + mine.fixes + mine.rescues,
            ),
          },
          { label: "crew calls", value: `⚡ ${mine.hands}` },
          ...awards.map((a) => ({
            label: `${a.icon} ${a.title}`,
            value: `${a.names.join(" & ")} (${a.value})`,
          })),
        ],
      });
      setPhase("result");
      setClaim("pending");
      void claimMiniGameReward(GAME_ID, score).then(setClaim);
    }, RESULT_PAUSE_MS);
  });

  // ---------------------------------------------------------- solo
  const startSolo = (): void => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
    finished = false;
    setResult(null);
    setSolo({
      setup: {
        seed: Math.floor(Math.random() * 2 ** 31),
        difficulty: difficulty(),
        crew: buildCrew([
          { uid: ME, name: getSnapshot()?.name ?? "You", station: station() },
        ]),
      },
      facts: { startAt: Date.now() + START_PAUSE_MS, done: {}, hands: {} },
    });
    setNow(Date.now());
    setPhase("playing");
  };

  // ---------------------------------------------------------- together
  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    finished = false;
    setRoomCode(code);
    setPhase("lobby");
    void syncShipClock();
    unsubscribeRoom = subscribeShipRoom(code, (next) =>
      untrack(() => onRoom(next)),
    );
  };

  const onRoom = (next: ShipRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (phase() !== "result") {
        setPhase("pick");
        showErrorNotification("The Rescue Ship room was closed");
      }
      return;
    }
    setRoom(next);
    if (next.status === "playing" && phase() === "lobby") {
      if (!roomCrew(next).some((c) => c.uid === uid())) {
        showErrorNotification("The ship left without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      setNow(shipNow());
      setPhase("playing");
    }
  };

  const createRoom = async (): Promise<void> => {
    if (props.multiplayerUnlocked !== true) {
      showErrorNotification(MULTIPLAYER_UNLOCK_HINT_GENERIC);
      return;
    }
    setRoomBusy(true);
    try {
      watchRoom(
        await createShipRoom({
          difficultyLabel: difficulty().label,
          station: station(),
        }),
      );
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await joinShipRoom(joinCode(), station()));
    } catch (e) {
      showErrorNotification("Could not join", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const leaveRoom = async (): Promise<void> => {
    const code = roomCode();
    unsubscribeRoom?.();
    unsubscribeRoom = undefined;
    setRoom(null);
    setRoomCode(undefined);
    if (code !== undefined) await leaveShipRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
    finished = false;
    setSolo(null);
    setResult(null);
    setPhase("pick");
    void leaveRoom();
  };
  createEffect(() => {
    if (!props.open) {
      untrack(reset);
    } else {
      setMode(
        props.initialMode === "together" && props.multiplayerUnlocked === true
          ? "together"
          : "solo",
      );
    }
  });
  onCleanup(() => {
    clearTimeout(resultTimer);
    void leaveRoom();
  });

  const lobbyPlayers = (): ShipRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );
  const onlineCount = (): number =>
    lobbyPlayers().filter((p) => p.online).length;
  const takenByOthers = (): Set<Station | undefined> =>
    new Set(
      lobbyPlayers()
        .filter((p) => p.uid !== uid() && p.online)
        .map((p) => p.station),
    );

  return (
    <Show when={props.open}>
      <GameModalFrame
        layout={
          phase() === "playing" || phase() === "result" ? "playing" : "pick"
        }
        needsKeyboard={false}
        onClose={() => props.onClose()}
      >
        <Show when={phase() === "pick"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Rescue Ship"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Launch the ship!"
                    onClick={startSolo}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId={GAME_ID}
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                  createLabel="Host a ship for friends"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <div class="mb-2 flex justify-center gap-2">
                <For each={["bunny", "pup", "kitty", "duck"] as const}>
                  {(p) => (
                    <img
                      src={PET_ART[p]}
                      alt=""
                      class="h-8 w-8 [image-rendering:pixelated]"
                    />
                  )}
                </For>
              </div>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>🚀 Fly your ship through space and rescue lost pets!</li>
                <li>
                  👩‍🚀 Everyone has a job - type the words for YOUR station.
                </li>
                <li>
                  🚨 ALL HANDS! means everyone types the same word - quick!
                </li>
                <li>🏠 Get home safe with as many pets as you can.</li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Pick your station">
              <StationPicker selected={station()} onSelect={setStation} />
            </GameSetupSection>
            <GameSetupSection title="Who do you want to play with?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={props.multiplayerUnlocked === true}
                unlockHint={MULTIPLAYER_UNLOCK_HINT_GENERIC}
                onModeChange={setMode}
                soloLabel="me + helpers"
                togetherLabel={`friends (up to ${CREW_SIZE})`}
              />
            </GameSetupSection>
            <GameSetupSection title="Words">
              <DifficultySegmented
                options={SHIP_DIFFICULTIES}
                selectedLabel={difficulty().label}
                onSelect={(d) => setDifficulty(() => d)}
              />
            </GameSetupSection>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "lobby"}>
          <div class="grid gap-4 p-6 pt-12 font-kid">
            <div class="text-center">
              <div class="text-sm font-bold tracking-widest text-sub uppercase">
                Room code - tell your friends!
              </div>
              <div class="text-5xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                {shipDifficultyFor(room()?.difficultyLabel ?? "").label} words ·{" "}
                {lobbyPlayers().length}/{CREW_SIZE} crew · helpers run empty
                stations
              </div>
            </div>
            <For each={lobbyPlayers()}>
              {(player) => (
                <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-2">
                  <UserAvatar uid={player.uid} class="h-9 w-9" />
                  <span class="flex-1 truncate text-lg font-bold text-text">
                    {player.name}
                    {player.uid === room()?.hostUid ? " · host" : ""}
                  </span>
                  <Show when={player.station}>
                    {(st) => (
                      <span class="text-text">
                        {STATION_INFO[st()].emoji} {STATION_INFO[st()].name}
                      </span>
                    )}
                  </Show>
                  <span class={player.online ? "text-main" : "text-sub"}>
                    {player.online ? "ready" : "offline"}
                  </span>
                </div>
              )}
            </For>
            <div>
              <div class="mb-2 text-sm font-bold text-sub">Your station</div>
              <StationPicker
                selected={room()?.players[uid() ?? ""]?.station ?? station()}
                taken={takenByOthers()}
                onSelect={(st) => {
                  setStation(st);
                  const code = roomCode();
                  if (code !== undefined) {
                    void setMyStation(code, st).catch(() => undefined);
                  }
                }}
              />
            </div>
            <Show when={onlineCount() < 2}>
              <div class="text-center text-sub">
                Waiting for crew to join… (need 2)
              </div>
            </Show>
            <InviteClassmates
              gameId={GAME_ID}
              code={roomCode()}
              show={room()?.hostUid === uid()}
            />
            <Show
              when={room()?.hostUid === uid()}
              fallback={
                <div class="text-center text-sub">
                  Waiting for the captain to launch…
                </div>
              }
            >
              <GameSetupPrimaryAction
                text="Launch the ship!"
                disabled={onlineCount() < 2}
                onClick={() => {
                  const r = room();
                  if (r !== null) void startShipRoom(r);
                }}
              />
            </Show>
            <button
              type="button"
              class="text-center text-sm text-sub underline"
              onClick={() => {
                void leaveRoom();
                setPhase("pick");
              }}
            >
              Leave room
            </button>
          </div>
        </Show>

        <Show when={phase() === "playing" || phase() === "result"}>
          <Show when={setup()}>
            {(s) => (
              <Show when={view()}>
                {(v) => (
                  <ShipGame
                    setup={s()}
                    view={v()}
                    myUid={myId()}
                    now={now()}
                    startAt={facts()?.startAt ?? 0}
                    myHands={myHands()}
                    onDone={onDone}
                    onHands={onHands}
                  />
                )}
              </Show>
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                note={claimNote(claim())}
                onPlayAgain={mode() === "solo" ? startSolo : undefined}
                onExit={() => props.onClose()}
              />
            )}
          </Show>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

function StationPicker(props: {
  selected: Station;
  taken?: Set<Station | undefined>;
  onSelect: (s: Station) => void;
}): JSXElement {
  return (
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <For each={STATIONS}>
        {(s) => {
          const taken = (): boolean => props.taken?.has(s) === true;
          return (
            <button
              type="button"
              disabled={taken()}
              class={cn(
                "press-3d grid cursor-pointer justify-items-center gap-1 rounded-xl p-3 text-center font-kid",
                props.selected === s
                  ? "bg-main text-bg"
                  : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                taken() && "cursor-not-allowed opacity-40",
              )}
              onClick={() => props.onSelect(s)}
            >
              <span class="text-3xl">{STATION_INFO[s].emoji}</span>
              <span class="text-lg font-bold">{STATION_INFO[s].name}</span>
              <span class="text-xs leading-tight opacity-80">
                {taken() ? "taken" : STATION_INFO[s].blurb}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}

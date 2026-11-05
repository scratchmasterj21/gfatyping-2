import {
  createEffect,
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
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import { GameModalHeader } from "../components/GameModalHeader";
import { GameMultiplayerRoomFooter } from "../components/GameMultiplayerRoomFooter";
import { GamePickLayout } from "../components/GamePickLayout";
import {
  GameResultOverlay,
  GameResultView,
} from "../components/GameResultOverlay";
import { GameSetupMore } from "../components/GameSetupMore";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { groupWordListOptions } from "../components/groupWordListOptions";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import {
  createPongRoom,
  difficultyFor,
  finishPongRoom,
  joinPongRoom,
  leavePongRoom,
  missPongBall,
  PongGame,
  PongRoom,
  POINT_PAUSE_MS,
  returnPongBall,
  serverNow,
  startPongRoom,
  subscribePongRoom,
  syncServerClock,
} from "./pong-multiplayer";
import {
  botReturn,
  initialPong,
  onMiss,
  onReturn,
  PONG_DIFFICULTIES,
  PongDifficulty,
  pongScore,
  PongState,
  pongStars,
  Side,
  speedFor,
  WIN_POINTS,
  wordForRally,
} from "./pong-rules";
import { WordPong } from "./WordPong";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);
/** If the receiver goes quiet this long past the deadline, the other player calls the miss. */
const STALL_GRACE_MS = 3000;

type Phase = "pick" | "loading" | "lobby" | "playing" | "result";

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

export function WordPongModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  onClose: () => void;
  onResult?: (score: number) => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<PongDifficulty>(
    PONG_DIFFICULTIES[0] as PongDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");

  // solo
  const [soloGame, setSoloGame] = createSignal<PongGame | null>(null);
  let soloWords: string[] = [];
  let botTimer: ReturnType<typeof setTimeout> | undefined;

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<PongRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let reportedSeq = 0;

  const me = (): string | undefined => getAuthenticatedUser()?.uid;
  const myName = (): string => getSnapshot()?.name ?? "You";

  // clock for the ball: local in solo, database time online
  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(
      () => setNow(mode() === "together" ? serverNow() : Date.now()),
      50,
    );
    onCleanup(() => clearInterval(t));
  });

  const finishMatch = (myPoints: number, won: boolean): void => {
    const score = pongScore(myPoints, won);
    if (won) sfx.finish();
    setResult({
      headline: won ? "You win! 🏓" : "Good game!",
      score,
      stars: pongStars(myPoints, won),
      stats: [
        { label: "your points", value: String(myPoints) },
        { label: "result", value: won ? "win" : "loss" },
      ],
    });
    setPhase("result");
    props.onResult?.(score);
    setClaim("pending");
    void claimMiniGameReward("word-pong", score).then(setClaim);
  };

  // ---------------- solo vs Tappy ----------------
  /** Tappy's roll for the ball now headed its way. */
  let botPlan: { seq: number; returns: boolean } = { seq: -1, returns: false };

  /**
   * Put a new ball in play. Balls to Tappy fly only as long as Tappy takes to
   * "type" the word, so a kid never waits out a full slow ball for Tappy.
   */
  const sendSolo = (state: PongState, delayMs: number): void => {
    const d = difficulty();
    let speedMs = speedFor(d, state.hits);
    if (state.toSide === "right" && !state.over) {
      const bot = botReturn(d, state.word, Math.random);
      botPlan = {
        seq: state.seq,
        returns: bot.returns && bot.delayMs < speedMs,
      };
      speedMs = Math.min(speedMs, bot.delayMs + 250);
    }
    setSoloGame({ ...state, sentAt: Date.now() + delayMs, speedMs });
  };

  const scheduleBot = (g: PongGame): void => {
    clearTimeout(botTimer);
    if (g.over || g.toSide !== "right" || botPlan.seq !== g.seq) return;
    const wait = Math.max(0, g.sentAt - Date.now());
    if (botPlan.returns) {
      botTimer = setTimeout(
        () => {
          const cur = soloGame();
          if (cur === null || cur.seq !== g.seq) return;
          sfx.good();
          sendSolo(
            onReturn(cur, wordForRally(soloWords, cur.hits + 1, cur.seq + 1)),
            0,
          );
        },
        wait + g.speedMs - 250,
      );
    } else {
      botTimer = setTimeout(() => missSolo(g.seq), wait + g.speedMs);
    }
  };

  const missSolo = (seq: number): void => {
    const cur = soloGame();
    if (cur === null || cur.seq !== seq || cur.over) return;
    if (cur.toSide === "left") sfx.bad();
    else sfx.great();
    const next = onMiss(cur, wordForRally(soloWords, 0, cur.seq + 1));
    sendSolo(next, POINT_PAUSE_MS);
    if (next.over) finishMatch(next.score.left, next.score.left >= WIN_POINTS);
  };

  createEffect(() => {
    const g = soloGame();
    if (g !== null && mode() === "solo") untrack(() => scheduleBot(g));
  });
  // my miss: the ball reached my paddle
  createEffect(() => {
    const g = soloGame();
    if (mode() !== "solo" || g === null || g.over || g.toSide !== "left") {
      return;
    }
    if (now() >= g.sentAt + g.speedMs) untrack(() => missSolo(g.seq));
  });
  onCleanup(() => clearTimeout(botTimer));

  const startSolo = async (): Promise<void> => {
    setPhase("loading");
    soloWords = await selected().getWords();
    setResult(null);
    sendSolo(
      initialPong(wordForRally(soloWords, 0, 1), "left"),
      POINT_PAUSE_MS,
    );
    setPhase("playing");
  };

  const hitSolo = (): void => {
    const cur = soloGame();
    if (cur === null || cur.toSide !== "left" || cur.over) return;
    sfx.good();
    sendSolo(
      onReturn(cur, wordForRally(soloWords, cur.hits + 1, cur.seq + 1)),
      0,
    );
  };

  // ---------------- together ----------------
  const mySide = (): Side => room()?.players[me() ?? ""]?.side ?? "left";
  const opponent = (): { name: string; uid?: string } => {
    const r = room();
    const other = Object.values(r?.players ?? {}).find((p) => p.uid !== me());
    return other === undefined
      ? { name: "Friend" }
      : { name: other.name, uid: other.uid };
  };

  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    reportedSeq = 0;
    setRoomCode(code);
    setPhase("lobby");
    void syncServerClock();
    unsubscribeRoom = subscribePongRoom(code, (next) =>
      untrack(() => onRoom(code, next)),
    );
  };

  const onRoom = (code: string, next: PongRoom | null): void => {
    {
      if (next === null) {
        setRoom(null);
        setRoomCode(undefined);
        if (untrack(phase) !== "result") {
          setPhase("pick");
          showErrorNotification("The ping-pong room was closed");
        }
        return;
      }
      const prev = untrack(room);
      setRoom(next);
      const g = next.game;
      if (next.status === "playing" && g !== undefined) {
        if (untrack(phase) === "lobby") setPhase("playing");
        // sounds for what just happened
        if (prev?.game !== undefined && g.seq !== prev.game.seq) {
          if (g.hits === 0 && g.lastPoint !== undefined) {
            if (g.lastPoint === untrack(mySide)) sfx.great();
            else sfx.bad();
          } else {
            sfx.good();
          }
        }
        if (g.over && untrack(phase) === "playing") {
          const side = untrack(mySide);
          const mine = g.score[side];
          finishMatch(mine, mine >= WIN_POINTS);
          if (next.hostUid === me()) void finishPongRoom(code);
        }
      }
    }
  };

  // report misses: my own at the deadline, the other side's if they stall
  createEffect(() => {
    const r = room();
    const g = r?.game;
    if (mode() !== "together" || r === null || g === undefined || g.over) {
      return;
    }
    if (reportedSeq === g.seq) return;
    const deadline = g.sentAt + g.speedMs;
    const late =
      g.toSide === mySide()
        ? now() >= deadline
        : now() >= deadline + STALL_GRACE_MS;
    if (late) {
      reportedSeq = g.seq;
      void missPongBall(r, g);
    }
  });

  const hitTogether = (): void => {
    const r = room();
    const g = r?.game;
    if (r === null || g === undefined || g.toSide !== mySide()) return;
    reportedSeq = g.seq;
    void returnPongBall(r, g);
  };

  const createRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      const words = await selected().getWords();
      const code = await createPongRoom({
        difficultyLabel: difficulty().label,
        wordListLabel: selected().label,
        words,
      });
      watchRoom(code);
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      const code = await joinPongRoom(joinCode());
      watchRoom(code);
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
    if (code !== undefined) await leavePongRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
    clearTimeout(botTimer);
    setSoloGame(null);
    setResult(null);
    setPhase("pick");
    void leaveRoom();
  };
  createEffect(() => {
    if (!props.open) untrack(reset);
    else setMode(props.initialMode ?? "solo");
  });
  onCleanup(() => void leaveRoom());

  const players = (): PongRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort((a, b) =>
      a.side === b.side ? 0 : a.side === "left" ? -1 : 1,
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
                title="Word Ping-Pong"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Play Tappy"
                    onClick={() => void startSolo()}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  roomBusy={roomBusy()}
                  joinCode={joinCode()}
                  onJoinCodeChange={setJoinCode}
                  onCreateRoom={() => void createRoom()}
                  onJoinRoom={() => void joinRoom()}
                  createLabel="Create a room for a friend"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>🏓 A ball with a word flies to you.</li>
                <li>
                  ⌨️ Type the word before it reaches your paddle to hit it back.
                </li>
                <li>
                  ⚡ Every hit makes the ball faster and the words longer.
                </li>
                <li>
                  🏆 Miss and the other side scores. First to {WIN_POINTS} wins!
                </li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Who do you want to play?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={true}
                unlockHint=""
                onModeChange={setMode}
                soloLabel="vs Tappy"
                togetherLabel="vs a friend"
              />
            </GameSetupSection>
            <GameSetupSection title="Ball speed">
              <DifficultySegmented
                options={PONG_DIFFICULTIES}
                selectedLabel={difficulty().label}
                onSelect={(d) => setDifficulty(() => d)}
              />
            </GameSetupSection>
            <GameSetupMore>
              <GameSetupSection title="Choose a word list">
                <WordListPicker
                  groups={GROUPS}
                  selectedId={selected().id}
                  onSelect={setSelected}
                />
              </GameSetupSection>
            </GameSetupMore>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "loading"}>
          <div class="py-12 text-center text-sub">Loading…</div>
        </Show>

        <Show when={phase() === "lobby"}>
          <div class="grid gap-4 p-6 pt-12 font-kid">
            <div class="text-center">
              <div class="text-sm font-bold tracking-widest text-sub uppercase">
                Room code - tell your friend!
              </div>
              <div class="text-5xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                {room()?.wordListLabel} ·{" "}
                {difficultyFor(room()?.difficultyLabel ?? "").label} ball
              </div>
            </div>
            <For each={players()}>
              {(player) => (
                <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-2">
                  <UserAvatar uid={player.uid} class="h-9 w-9" />
                  <span class="flex-1 truncate text-lg font-bold text-text">
                    {player.side === "left" ? "🔴 " : "🔵 "}
                    {player.name}
                    {player.uid === room()?.hostUid ? " · host" : ""}
                  </span>
                  <span class={player.online ? "text-main" : "text-sub"}>
                    {player.online ? "ready" : "offline"}
                  </span>
                </div>
              )}
            </For>
            <Show when={players().length < 2}>
              <div class="text-center text-sub">
                Waiting for a friend to join…
              </div>
            </Show>
            <Show
              when={room()?.hostUid === me()}
              fallback={
                <div class="text-center text-sub">
                  Waiting for the host to start…
                </div>
              }
            >
              <GameSetupPrimaryAction
                text="Start match"
                disabled={players().filter((p) => p.online).length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== null) void startPongRoom(r);
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
          <Show
            when={mode() === "solo" ? soloGame() : room()?.game}
            keyed={false}
          >
            {(g) => (
              <WordPong
                game={g()}
                now={now()}
                mySide={mode() === "solo" ? "left" : mySide()}
                me={{ name: myName(), uid: me() }}
                opponent={
                  mode() === "solo"
                    ? { name: "Tappy", isBot: true }
                    : opponent()
                }
                onHit={() => (mode() === "solo" ? hitSolo() : hitTogether())}
              />
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                note={claimNote(claim())}
                onPlayAgain={
                  mode() === "solo" ? () => void startSolo() : undefined
                }
                onExit={() => props.onClose()}
              />
            )}
          </Show>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

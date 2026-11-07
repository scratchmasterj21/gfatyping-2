import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  on,
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
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import {
  createFourRoom,
  dropFourPiece,
  finishFourRoom,
  FourRoom,
  joinFourRoom,
  leaveFourRoom,
  serverNow,
  startFourRoom,
  subscribeFourRoom,
  syncServerClock,
  timeoutFourRound,
} from "./four-multiplayer";
import {
  applyDrop,
  applyTimeout,
  botColumn,
  botTypingMs,
  Disc,
  FOUR_DIFFICULTIES,
  FourDifficulty,
  fourDifficultyFor,
  fourScore,
  FourState,
  fourStars,
  LATE_GRACE_MS,
  newMatch,
} from "./four-rules";
import { FourRow } from "./FourRow";

type Phase = "pick" | "lobby" | "playing" | "result";

/** Time to look at the final board before the result card. */
const RESULT_DELAY_MS = 2500;
const TAPPY: Disc = "y";

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

export function FourRowModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  onClose: () => void;
  onResult?: (score: number) => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [difficulty, setDifficulty] = createSignal<FourDifficulty>(
    FOUR_DIFFICULTIES[0] as FourDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  let resultTimer: ReturnType<typeof setTimeout> | undefined;

  // solo
  const [soloGame, setSoloGame] = createSignal<FourState | null>(null);
  let botTimer: ReturnType<typeof setTimeout> | undefined;

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<FourRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let reportedSeq = 0;

  const me = (): string | undefined => getAuthenticatedUser()?.uid;
  const myName = (): string => getSnapshot()?.name ?? "You";
  const clock = (): number =>
    mode() === "together" ? serverNow() : Date.now();

  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 50);
    onCleanup(() => clearInterval(t));
  });

  const finishMatch = (g: FourState, myDisc: Disc): void => {
    if (untrack(phase) !== "playing" || resultTimer !== undefined) return;
    const score = fourScore(g, myDisc);
    const won = g.matchWinner === myDisc;
    if (won) sfx.finish();
    resultTimer = setTimeout(() => {
      resultTimer = undefined;
      setResult({
        headline: won
          ? "You win! 🔴🟡"
          : g.matchWinner === "draw"
            ? "It's a tie!"
            : "Good game!",
        score,
        stars: fourStars(g, myDisc),
        stats: [
          { label: "boards won", value: String(g.wins[myDisc]) },
          { label: "pieces dropped", value: String(g.drops[myDisc]) },
        ],
      });
      setPhase("result");
      props.onResult?.(score);
      setClaim("pending");
      void claimMiniGameReward("four-row", score).then(setClaim);
    }, RESULT_DELAY_MS);
  };

  /** Sounds for what just changed on the board. */
  const playSounds = (
    prev: FourState | null | undefined,
    g: FourState,
    myDisc: Disc,
  ): void => {
    if (prev === null || prev === undefined || prev.seq === g.seq) return;
    if (g.wins.r + g.wins.y > prev.wins.r + prev.wins.y) {
      const iWon = g.wins[myDisc] > prev.wins[myDisc];
      if (iWon) sfx.great();
      else sfx.bad();
    } else if (g.drops.r + g.drops.y > prev.drops.r + prev.drops.y) {
      sfx.good();
    }
  };

  // ---------------- solo vs Tappy ----------------
  const setSolo = (next: FourState): void => {
    playSounds(untrack(soloGame), next, "r");
    setSoloGame(next);
    if (next.over) finishMatch(next, "r");
  };

  const pool = (): string[] => difficulty().words;

  /** Plan Tappy's drop for the round that's starting. */
  const scheduleBot = (g: FourState): void => {
    clearTimeout(botTimer);
    if (g.over || g.moved[TAPPY]) return;
    const d = difficulty();
    const firstPick = botColumn(g.board, TAPPY, true, Math.random);
    const typingMs = botTypingMs(d, g.words[firstPick] ?? "word", Math.random);
    if (typingMs > g.roundMs) return; // too slow this round: Tappy misses
    const wait = Math.max(0, g.roundStartAt - Date.now()) + typingMs;
    const key = `${g.boardNo}-${g.round}`;
    botTimer = setTimeout(() => {
      const cur = untrack(soloGame);
      if (cur === null || `${cur.boardNo}-${cur.round}` !== key) return;
      // look again: react to the player's piece if it already landed
      const col = botColumn(
        cur.board,
        TAPPY,
        Math.random() < d.botSmart,
        Math.random,
      );
      const next = applyDrop(cur, TAPPY, col, pool(), Date.now(), Math.random);
      if (next !== null) setSolo(next);
    }, wait);
  };

  createEffect(
    on(
      () => {
        const g = soloGame();
        return g === null || mode() !== "solo"
          ? undefined
          : `${g.boardNo}-${g.round}`;
      },
      (key) => {
        const g = untrack(soloGame);
        if (key !== undefined && g !== null) scheduleBot(g);
      },
    ),
  );
  // time's up for the round
  createEffect(() => {
    const g = soloGame();
    if (mode() !== "solo" || g === null || g.over) return;
    if (now() >= g.roundStartAt + g.roundMs + LATE_GRACE_MS) {
      const next = untrack(() => applyTimeout(g, Date.now()));
      if (next !== null) untrack(() => setSolo(next));
    }
  });
  onCleanup(() => {
    clearTimeout(botTimer);
    clearTimeout(resultTimer);
  });

  const startSolo = (): void => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
    setResult(null);
    const d = difficulty();
    setSoloGame(newMatch(d.words, d.roundMs, Date.now(), Math.random));
    setNow(Date.now());
    setPhase("playing");
  };

  const dropSolo = (col: number): void => {
    const cur = soloGame();
    if (cur === null) return;
    const next = applyDrop(cur, "r", col, pool(), Date.now(), Math.random);
    if (next !== null) setSolo(next);
  };

  // ---------------- together ----------------
  const myDisc = (): Disc => room()?.players[me() ?? ""]?.disc ?? "r";
  const opponent = (): { name: string; uid?: string } => {
    const other = Object.values(room()?.players ?? {}).find(
      (p) => p.uid !== me(),
    );
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
    unsubscribeRoom = subscribeFourRoom(code, (next) =>
      untrack(() => onRoom(code, next)),
    );
  };

  const onRoom = (code: string, next: FourRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (untrack(phase) !== "result") {
        setPhase("pick");
        showErrorNotification("The Four in a Row room was closed");
      }
      return;
    }
    const prev = untrack(room);
    setRoom(next);
    const g = next.game;
    if (next.status !== "playing" || g === undefined) return;
    if (untrack(phase) === "lobby") {
      setNow(serverNow());
      setPhase("playing");
    }
    playSounds(prev?.game, g, untrack(myDisc));
    if (g.over) {
      finishMatch(g, untrack(myDisc));
      if (next.hostUid === me()) void finishFourRoom(code);
    }
  };

  // either player moves the round on when its time is up
  createEffect(() => {
    const r = room();
    const g = r?.game;
    if (mode() !== "together" || r === null || g === undefined || g.over) {
      return;
    }
    if (reportedSeq === g.seq) return;
    if (now() >= g.roundStartAt + g.roundMs + LATE_GRACE_MS + 100) {
      reportedSeq = g.seq;
      void timeoutFourRound(r, g);
    }
  });

  const dropTogether = (col: number): void => {
    const r = room();
    const g = r?.game;
    if (r === null || g === undefined) return;
    void dropFourPiece(r, g, myDisc(), col);
  };

  const createRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await createFourRoom(difficulty().label));
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await joinFourRoom(joinCode()));
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
    if (code !== undefined) await leaveFourRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
    clearTimeout(botTimer);
    clearTimeout(resultTimer);
    resultTimer = undefined;
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

  const players = (): FourRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort((a, b) =>
      a.disc === b.disc ? 0 : a.disc === "r" ? -1 : 1,
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
                title="Four in a Row"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Play Tappy"
                    onClick={startSolo}
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
                <li>🔴 Every column has a word on top.</li>
                <li>⌨️ Type a word to drop your piece in that column.</li>
                <li>
                  ⚡ You both drop one piece each round - the faster one lands
                  first!
                </li>
                <li>⏰ Too slow and you miss your turn.</li>
                <li>🏆 Get 4 in a row to win a board. Win 2 boards to win!</li>
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
            <GameSetupSection title="Words">
              <DifficultySegmented
                options={FOUR_DIFFICULTIES}
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
                Room code - tell your friend!
              </div>
              <div class="text-5xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                {fourDifficultyFor(room()?.difficultyLabel ?? "").label} words
              </div>
            </div>
            <For each={players()}>
              {(player) => (
                <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-2">
                  <UserAvatar uid={player.uid} class="h-9 w-9" />
                  <span class="flex-1 truncate text-lg font-bold text-text">
                    {player.disc === "r" ? "🔴 " : "🟡 "}
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
                  if (r !== null) void startFourRoom(r);
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
              <FourRow
                game={g()}
                now={now()}
                myDisc={mode() === "solo" ? "r" : myDisc()}
                me={{ name: myName(), uid: me() }}
                opponent={
                  mode() === "solo"
                    ? { name: "Tappy", isBot: true }
                    : opponent()
                }
                onDrop={(col) =>
                  mode() === "solo" ? dropSolo(col) : dropTogether(col)
                }
              />
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

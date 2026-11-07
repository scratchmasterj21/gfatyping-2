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
  boomBomb,
  BombRoom,
  createBombRoom,
  finishBombRoom,
  joinBombRoom,
  leaveBombRoom,
  passBomb,
  serverNow,
  shareTyping,
  startBombRoom,
  subscribeBombRoom,
  syncServerClock,
} from "./bomb-multiplayer";
import {
  applyBoom,
  applyPass,
  BOMB_BOTS,
  BOMB_DIFFICULTIES,
  BombDifficulty,
  bombDifficultyFor,
  bombPlace,
  bombScore,
  BombState,
  bombStars,
  BOOM_PAUSE_MS,
  botPassMs,
  explodeAt,
  MAX_BOMB_PLAYERS,
  newBombMatch,
} from "./bomb-rules";
import { BombSeat, WordBomb } from "./WordBomb";

type Phase = "pick" | "lobby" | "playing" | "result";

const ME = "me";
const BOT_COUNTS = [
  { label: "1 Tappy", count: 1 },
  { label: "2 Tappys", count: 2 },
  { label: "3 Tappys", count: 3 },
];

const ordinal = (n: number): string =>
  n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

export function WordBombModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  onClose: () => void;
  onResult?: (score: number) => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [difficulty, setDifficulty] = createSignal<BombDifficulty>(
    BOMB_DIFFICULTIES[0] as BombDifficulty,
  );
  const [botCount, setBotCount] = createSignal(
    BOT_COUNTS[1] as (typeof BOT_COUNTS)[number],
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  let resultTimer: ReturnType<typeof setTimeout> | undefined;

  // solo
  const [soloGame, setSoloGame] = createSignal<BombState | null>(null);
  /** the bot holding the bomb: when it started "typing" and how long it takes */
  const [botPlan, setBotPlan] = createSignal<{
    seq: number;
    startAt: number;
    ms: number;
  } | null>(null);
  let botTimer: ReturnType<typeof setTimeout> | undefined;

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<BombRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let reportedSeq = 0;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myName = (): string => getSnapshot()?.name ?? "You";
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number =>
    mode() === "together" ? serverNow() : Date.now();

  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 50);
    onCleanup(() => clearInterval(t));
  });

  const finishMatch = (g: BombState, me: string): void => {
    if (untrack(phase) !== "playing" || resultTimer !== undefined) return;
    const score = bombScore(g, me);
    const place = bombPlace(g, me);
    if (place === 1) sfx.finish();
    resultTimer = setTimeout(() => {
      resultTimer = undefined;
      setResult({
        headline: place === 1 ? "You win! 💣" : `You came ${ordinal(place)}!`,
        score,
        stars: bombStars(g, me),
        stats: [
          { label: "place", value: `${ordinal(place)} of ${g.order.length}` },
          { label: "bombs passed", value: String(g.totalPasses[me] ?? 0) },
        ],
      });
      setPhase("result");
      props.onResult?.(score);
      setClaim("pending");
      void claimMiniGameReward("word-bomb", score).then(setClaim);
    }, BOOM_PAUSE_MS);
  };

  const playSounds = (
    prev: BombState | null | undefined,
    g: BombState,
    me: string,
  ): void => {
    if (prev === null || prev === undefined || prev.seq === g.seq) return;
    if (g.lastBoom !== undefined && g.lastBoom.at !== prev.lastBoom?.at) {
      sfx.boom();
      if (g.lastBoom.id === me) setTimeout(() => sfx.bad(), 300);
    } else if (g.holder === me) {
      sfx.pop(); // here it comes!
    }
  };

  // ---------------- solo vs Tappy bots ----------------
  const setSolo = (next: BombState): void => {
    playSounds(untrack(soloGame), next, ME);
    setSoloGame(next);
    if (next.over) finishMatch(next, ME);
  };

  // a bot has the bomb: plan its pass
  createEffect(
    on(
      () => {
        const g = soloGame();
        return g === null || mode() !== "solo" ? undefined : g.seq;
      },
      () => {
        clearTimeout(botTimer);
        setBotPlan(null);
        const g = untrack(soloGame);
        if (g === null || g.over || g.holder === ME) return;
        const startAt = Math.max(Date.now(), g.roundStartAt);
        const ms = botPassMs(difficulty(), g.word, Math.random);
        setBotPlan({ seq: g.seq, startAt, ms });
        botTimer = setTimeout(
          () => {
            const cur = untrack(soloGame);
            if (cur === null || cur.seq !== g.seq) return;
            const next = applyPass(
              cur,
              cur.holder,
              difficulty(),
              Date.now(),
              Math.random,
            );
            if (next !== null) setSolo(next);
          },
          startAt - Date.now() + ms,
        );
      },
    ),
  );
  // the fuse ran out
  createEffect(() => {
    const g = soloGame();
    if (mode() !== "solo" || g === null || g.over) return;
    if (now() >= explodeAt(g)) {
      const next = untrack(() =>
        applyBoom(g, difficulty(), Date.now(), Math.random),
      );
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
    const order = [
      ME,
      ...BOMB_BOTS.slice(0, botCount().count).map((b) => b.id),
    ];
    setSoloGame(newBombMatch(order, difficulty(), Date.now(), Math.random));
    setNow(Date.now());
    setPhase("playing");
  };

  const passSolo = (): void => {
    const cur = soloGame();
    if (cur === null) return;
    const next = applyPass(cur, ME, difficulty(), Date.now(), Math.random);
    if (next !== null) setSolo(next);
  };

  /** The bot's letters appearing as it "types". */
  const botTyped = (): string => {
    const g = soloGame();
    const plan = botPlan();
    if (g === null || plan === null || plan.seq !== g.seq) return "";
    const frac = Math.max(0, (now() - plan.startAt) / plan.ms);
    return g.word.slice(0, Math.floor(frac * g.word.length));
  };

  // ---------------- together ----------------
  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    reportedSeq = 0;
    setRoomCode(code);
    setPhase("lobby");
    void syncServerClock();
    unsubscribeRoom = subscribeBombRoom(code, (next) =>
      untrack(() => onRoom(code, next)),
    );
  };

  const onRoom = (code: string, next: BombRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (untrack(phase) !== "result") {
        setPhase("pick");
        showErrorNotification("The Word Bomb room was closed");
      }
      return;
    }
    const prev = untrack(room);
    setRoom(next);
    const g = next.game;
    if (next.status !== "playing" || g === undefined) return;
    if (untrack(phase) === "lobby") {
      if (!g.order.includes(uid() ?? "")) {
        // joined too late to get a seat
        showErrorNotification("That game started without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      setNow(serverNow());
      setPhase("playing");
    }
    playSounds(prev?.game, g, uid() ?? "");
    if (g.over) {
      finishMatch(g, uid() ?? "");
      if (next.hostUid === uid()) void finishBombRoom(code);
    }
  };

  // anyone reports the boom when the fuse runs out
  createEffect(() => {
    const r = room();
    const g = r?.game;
    if (mode() !== "together" || r === null || g === undefined || g.over) {
      return;
    }
    if (reportedSeq === g.seq) return;
    if (now() >= explodeAt(g) + 150) {
      reportedSeq = g.seq;
      void boomBomb(r, g);
    }
  });

  const passTogether = (): void => {
    const r = room();
    const g = r?.game;
    const me = uid();
    if (r === null || g === undefined || me === undefined) return;
    void passBomb(r, g, me);
  };

  const shareMyTyping = (text: string): void => {
    const r = room();
    const g = r?.game;
    if (mode() !== "together" || r === null || g === undefined) return;
    // the bomb may have moved on already - then the write is refused; fine
    void shareTyping(r.code, g.seq, text).catch(() => undefined);
  };

  const holderTyped = (): string => {
    if (mode() === "solo") return botTyped();
    const r = room();
    const g = r?.game;
    if (g === undefined || r?.typing?.seq !== g.seq) return "";
    const text = r.typing.text;
    return g.word.startsWith(text) ? text : "";
  };

  const createRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await createBombRoom(difficulty().label));
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };

  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await joinBombRoom(joinCode()));
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
    if (code !== undefined) await leaveBombRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
    clearTimeout(botTimer);
    clearTimeout(resultTimer);
    resultTimer = undefined;
    setSoloGame(null);
    setBotPlan(null);
    setResult(null);
    setPhase("pick");
    void leaveRoom();
  };
  createEffect(() => {
    if (!props.open) untrack(reset);
    else setMode(props.initialMode ?? "solo");
  });
  onCleanup(() => void leaveRoom());

  const lobbyPlayers = (): BombRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );

  const seats = (): Record<string, BombSeat> => {
    if (mode() === "solo") {
      return {
        [ME]: { name: myName(), uid: uid() },
        ...Object.fromEntries(
          BOMB_BOTS.map((b) => [b.id, { name: b.name, isBot: true }]),
        ),
      };
    }
    return Object.fromEntries(
      Object.values(room()?.players ?? {}).map((p) => [
        p.uid,
        { name: p.name, uid: p.uid },
      ]),
    );
  };

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
                title="Word Bomb"
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
                  createLabel="Create a room for friends"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>💣 A bomb is passed around the circle.</li>
                <li>
                  ⌨️ When you have it, type the word to pass it on - fast!
                </li>
                <li>🤫 Nobody knows when it will blow up...</li>
                <li>💥 Holding it when it goes BOOM? You lose a ❤️.</li>
                <li>🏆 Last player with hearts left wins!</li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Who do you want to play?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={true}
                unlockHint=""
                onModeChange={setMode}
                soloLabel="vs Tappy"
                togetherLabel={`friends (up to ${MAX_BOMB_PLAYERS})`}
              />
            </GameSetupSection>
            <Show when={mode() === "solo"}>
              <GameSetupSection title="How many Tappys?">
                <DifficultySegmented
                  options={BOT_COUNTS}
                  selectedLabel={botCount().label}
                  onSelect={(b) => setBotCount(() => b)}
                />
              </GameSetupSection>
            </Show>
            <GameSetupSection title="Words">
              <DifficultySegmented
                options={BOMB_DIFFICULTIES}
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
                💣 {bombDifficultyFor(room()?.difficultyLabel ?? "").label}{" "}
                words · {lobbyPlayers().length}/{MAX_BOMB_PLAYERS} players
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
                  <span class={player.online ? "text-main" : "text-sub"}>
                    {player.online ? "ready" : "offline"}
                  </span>
                </div>
              )}
            </For>
            <Show when={lobbyPlayers().length < 2}>
              <div class="text-center text-sub">
                Waiting for friends to join…
              </div>
            </Show>
            <Show
              when={room()?.hostUid === uid()}
              fallback={
                <div class="text-center text-sub">
                  Waiting for the host to start…
                </div>
              }
            >
              <GameSetupPrimaryAction
                text="Start game"
                disabled={lobbyPlayers().filter((p) => p.online).length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== null) void startBombRoom(r);
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
              <WordBomb
                game={g()}
                now={now()}
                myId={myId()}
                seats={seats()}
                holderTyped={holderTyped()}
                onPass={() => (mode() === "solo" ? passSolo() : passTogether())}
                onTyping={shareMyTyping}
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

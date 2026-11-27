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
import { cn } from "../../utils/cn";
import { DailyClassBoard } from "../components/DailyClassBoard";
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameHowTo } from "../components/GameHowTo";
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
import { InviteClassmates } from "../components/InviteClassmates";
import { PracticeWords } from "../components/PracticeWords";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import { submitDailyBest } from "../shared/daily-board";
import { TypingReport, TypingTracker } from "../shared/typing-report";
import { createPickGuard, useGameLevel } from "../use-game-level";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { dailyDay, getRallyWords, rallyPlan } from "./daily-rally";
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
  REACTIONS,
  returnPongBall,
  sendPongReaction,
  serverNow,
  startPongRoom,
  subscribePongRoom,
  syncServerClock,
} from "./pong-multiplayer";
import {
  botReturn,
  botShot,
  HitOpts,
  initialPong,
  nextWord,
  onMiss,
  onReturn,
  PONG_DIFFICULTIES,
  PongBot,
  PongDifficulty,
  pongScore,
  PongState,
  pongStars,
  RALLY_DIFFICULTY,
  rallyScore,
  rallyStars,
  SERIES_WINS,
  Side,
  speedFor,
  tappyBot,
  TOURNAMENT,
  TOURNAMENT_POINTS,
  WALL_MS,
  WIN_POINTS,
  wordForRally,
} from "./pong-rules";
import { WordPong } from "./WordPong";

const OPTIONS = getWordListOptions();
const GROUPS = groupWordListOptions(OPTIONS);
/** If the receiver goes quiet this long past the deadline, the other player calls the miss. */
const STALL_GRACE_MS = 3000;
const REACT_COOLDOWN_MS = 1500;

type Phase = "pick" | "loading" | "lobby" | "playing" | "result";
type SoloKind = "match" | "tournament" | "rally";

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

const SOLO_KINDS: { id: SoloKind; label: string }[] = [
  { id: "match", label: "🏓 Match" },
  { id: "tournament", label: "🏆 Tournament" },
  { id: "rally", label: "🧱 Daily rally" },
];

export function WordPongModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  onClose: () => void;
  onResult?: (score: number) => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [soloKind, setSoloKind] = createSignal<SoloKind>("match");
  const [round, setRound] = createSignal(0);
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<PongDifficulty>(
    PONG_DIFFICULTIES[0] as PongDifficulty,
  );
  const lv = useGameLevel(() => props.open);
  createPickGuard(selected, setSelected, lv.listLock, () => OPTIONS);
  createPickGuard(
    difficulty,
    (d) => setDifficulty(() => d),
    lv.speedLock,
    () => PONG_DIFFICULTIES,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  const [report, setReport] = createSignal<TypingReport | null>(null);
  const [extraNote, setExtraNote] = createSignal<string>();
  /** tournament: the last match was won (offer the next one) */
  const [wonLast, setWonLast] = createSignal(false);

  // this match's typing and records
  let tracker = new TypingTracker();
  let matchStart = 0;
  let longest = 0;
  let fastest = Infinity;
  const resetStats = (): void => {
    tracker = new TypingTracker();
    matchStart = Date.now();
    longest = 0;
    fastest = Infinity;
    setReport(null);
    setExtraNote(undefined);
  };
  const [trackerSignal, setTrackerSignal] = createSignal(tracker);

  // solo
  const [soloGame, setSoloGame] = createSignal<PongGame | null>(null);
  let soloWords: string[] = [];
  let botTimer: ReturnType<typeof setTimeout> | undefined;
  let botReturns = 0;
  let rallyHits = 0;
  const rallyDay = dailyDay();

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<PongRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let reportedSeq = 0;
  let lastReact = 0;

  const me = (): string | undefined => getAuthenticatedUser()?.uid;
  const myName = (): string => getSnapshot()?.name ?? "You";
  const tournament = (): boolean =>
    mode() === "solo" && soloKind() === "tournament";
  const rally = (): boolean => mode() === "solo" && soloKind() === "rally";
  const bot = (): PongBot =>
    tournament()
      ? (TOURNAMENT[round()] ?? (TOURNAMENT[0] as PongBot))
      : tappyBot(difficulty());

  // clock for the ball: local in solo, database time online
  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(
      () => setNow(mode() === "together" ? serverNow() : Date.now()),
      50,
    );
    onCleanup(() => clearInterval(t));
  });

  const noteRally = (s: PongState): void => {
    longest = Math.max(longest, s.hits);
  };

  const typingStats = (): { label: string; value: string }[] => {
    tracker.tick(Date.now() - matchStart);
    const typing = tracker.report();
    setReport(typing);
    return [
      { label: "words per minute", value: String(typing.wpm) },
      { label: "accuracy", value: `${typing.accuracy}%` },
    ];
  };

  const finishMatch = (
    myPoints: number,
    won: boolean,
    series?: Record<Side, number>,
    side: Side = "left",
  ): void => {
    const score = pongScore(myPoints, won);
    if (won) sfx.finish();
    const b = bot();
    const lastRound = round() >= TOURNAMENT.length - 1;
    const seriesMine = series?.[side] ?? 0;
    const seriesTheirs = series?.[side === "left" ? "right" : "left"] ?? 0;
    const headline = tournament()
      ? won
        ? lastRound
          ? "🏆 Tournament champion!"
          : `You beat ${b.emoji} ${b.name}!`
        : `${b.emoji} ${b.name} wins this time!`
      : seriesMine >= SERIES_WINS
        ? "🏆 You won the series!"
        : seriesTheirs >= SERIES_WINS
          ? "Good series!"
          : won
            ? "You win! 🏓"
            : "Good game!";
    setWonLast(won);
    setResult({
      headline,
      score,
      stars: pongStars(myPoints, won),
      stats: [
        { label: "your points", value: String(myPoints) },
        { label: "result", value: won ? "win" : "loss" },
        { label: "longest rally", value: `🔥 ${longest} hits` },
        {
          label: "fastest return",
          value: fastest === Infinity ? "-" : `${(fastest / 1000).toFixed(1)}s`,
        },
        ...typingStats(),
        ...(series === undefined
          ? []
          : [{ label: "series", value: `${seriesMine} - ${seriesTheirs}` }]),
        ...(tournament()
          ? [{ label: "tournament", value: `match ${round() + 1} of 4` }]
          : []),
      ],
    });
    setPhase("result");
    props.onResult?.(score);
    setClaim("pending");
    void claimMiniGameReward("word-pong", score).then(setClaim);
  };

  // ---------------- solo vs a bot ----------------
  /** The bot's roll for the ball now headed its way. */
  let botPlan: { seq: number; returns: boolean } = { seq: -1, returns: false };

  /**
   * Put a new ball in play. Balls to the bot fly only as long as it takes
   * to "type" the word, so a kid never waits out a full slow ball.
   */
  const sendSolo = (state: PongState, delayMs: number): void => {
    const b = bot();
    const d = b.difficulty;
    let speedMs = speedFor(d, state.hits, state);
    if (state.toSide === "right" && !state.over) {
      const r = botReturn(d, state.word, Math.random, state.ball);
      botPlan = { seq: state.seq, returns: r.returns && r.delayMs < speedMs };
      speedMs = Math.min(speedMs, r.delayMs + 250);
    }
    noteRally(state);
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
          const b = bot();
          const opts = botShot(b, ++botReturns, Math.random());
          const hits = cur.hits + 1 + (b.longWords ? 3 : 0);
          sendSolo(
            onReturn(
              cur,
              nextWord(soloWords, hits, cur.seq + 1, opts.shot),
              opts,
            ),
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
    if (cur.toSide === "left") {
      sfx.bad();
      tracker.escaped(cur.word);
    } else {
      sfx.great();
    }
    const next = onMiss(cur, wordForRally(soloWords, 0, cur.seq + 1));
    sendSolo(next, POINT_PAUSE_MS);
    if (next.over) {
      const target = next.target ?? WIN_POINTS;
      finishMatch(next.score.left, next.score.left >= target);
    }
  };

  createEffect(() => {
    const g = soloGame();
    if (g !== null && mode() === "solo" && !rally()) {
      untrack(() => scheduleBot(g));
    }
  });
  // my miss: the ball reached my paddle
  createEffect(() => {
    const g = soloGame();
    if (mode() !== "solo" || g === null || g.over || g.toSide !== "left") {
      return;
    }
    if (now() >= g.sentAt + g.speedMs) {
      untrack(() => (rally() ? missRally(g.seq) : missSolo(g.seq)));
    }
  });
  onCleanup(() => clearTimeout(botTimer));

  const startSolo = async (): Promise<void> => {
    clearTimeout(botTimer);
    if (rally()) {
      await startRally();
      return;
    }
    setPhase("loading");
    soloWords = await selected().getWords();
    setResult(null);
    resetStats();
    setTrackerSignal(tracker);
    botReturns = 0;
    sendSolo(
      initialPong(wordForRally(soloWords, 0, 1), "left", {
        ...(tournament() ? { target: TOURNAMENT_POINTS } : {}),
      }),
      POINT_PAUSE_MS,
    );
    setPhase("playing");
  };

  const hitSolo = (opts: HitOpts): void => {
    const cur = soloGame();
    if (cur === null || cur.toSide !== "left" || cur.over) return;
    sfx.good();
    fastest = Math.min(fastest, Date.now() - cur.sentAt);
    if (rally()) {
      hitRally(cur);
      return;
    }
    sendSolo(
      onReturn(
        cur,
        nextWord(soloWords, cur.hits + 1, cur.seq + 1, opts.shot),
        opts,
      ),
      0,
    );
  };

  // ---------------- daily rally (vs a wall) ----------------
  const startRally = async (): Promise<void> => {
    setPhase("loading");
    soloWords = await getRallyWords(rallyPlan(rallyDay));
    setResult(null);
    resetStats();
    setTrackerSignal(tracker);
    rallyHits = 0;
    setSoloGame({
      ...initialPong(wordForRally(soloWords, 0, 1), "left"),
      sentAt: Date.now() + POINT_PAUSE_MS,
      speedMs: speedFor(RALLY_DIFFICULTY, 0),
    });
    setPhase("playing");
  };

  const hitRally = (cur: PongGame): void => {
    rallyHits++;
    longest = rallyHits;
    // the ball shows the next word while it flies to the wall
    const next = onReturn(cur, wordForRally(soloWords, rallyHits, cur.seq + 1));
    setSoloGame({ ...next, sentAt: Date.now(), speedMs: WALL_MS });
    clearTimeout(botTimer);
    botTimer = setTimeout(() => {
      const g = soloGame();
      if (g === null || g.seq !== next.seq || g.over) return;
      sfx.pop();
      setSoloGame({
        ...onReturn(g, g.word),
        sentAt: Date.now(),
        speedMs: speedFor(RALLY_DIFFICULTY, rallyHits),
      });
    }, WALL_MS);
  };

  const missRally = (seq: number): void => {
    const cur = soloGame();
    if (cur === null || cur.seq !== seq || cur.over) return;
    sfx.bad();
    tracker.escaped(cur.word);
    setSoloGame({ ...cur, over: true });
    const hits = rallyHits;
    const score = rallyScore(hits);
    if (hits >= 12) sfx.finish();
    setWonLast(false);
    setResult({
      headline:
        hits >= 25
          ? `Amazing! ${hits} hits! 🔥`
          : hits > 0
            ? `${hits} hits in a row!`
            : "Try again!",
      score,
      stars: rallyStars(hits),
      stats: [
        { label: "rally", value: `🔥 ${hits} hits` },
        {
          label: "fastest return",
          value: fastest === Infinity ? "-" : `${(fastest / 1000).toFixed(1)}s`,
        },
        ...typingStats(),
      ],
    });
    setPhase("result");
    props.onResult?.(score);
    setClaim("pending");
    void claimMiniGameReward("word-pong", score).then(setClaim);
    if (hits > 0 && getAuthenticatedUser() !== null) {
      void submitDailyBest("dailyRally", rallyDay, hits)
        .then((best) =>
          setExtraNote(
            best
              ? "🏆 New best rally for your class today!"
              : "Rally sent to your class's board.",
          ),
        )
        .catch(() => undefined);
    }
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
  const reactions = (): Partial<Record<Side, { e: string; at: number }>> => {
    const r = room();
    const out: Partial<Record<Side, { e: string; at: number }>> = {};
    for (const [uid, react] of Object.entries(r?.react ?? {})) {
      const side = r?.players[uid]?.side;
      if (side !== undefined) out[side] = react;
    }
    return out;
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
    if (next.status !== "playing" || g === undefined) return;
    const side = untrack(mySide);
    const p = untrack(phase);
    // first serve, or the host started a rematch
    if (p === "lobby" || (p === "result" && !g.over && g.hits === 0)) {
      resetStats();
      setTrackerSignal(tracker);
      setResult(null);
      setPhase("playing");
    }
    noteRally(g);
    // sounds (and missed words) for what just happened
    const pg = prev?.game;
    if (pg !== undefined && g.seq !== pg.seq) {
      if (g.hits === 0 && g.lastPoint !== undefined) {
        if (g.lastPoint === side) {
          sfx.great();
        } else {
          sfx.bad();
          if (pg.toSide === side) tracker.escaped(pg.word);
        }
      } else {
        sfx.good();
      }
    }
    if (g.over && untrack(phase) === "playing") {
      const mine = g.score[side];
      finishMatch(mine, mine >= (g.target ?? WIN_POINTS), g.series, side);
      if (next.hostUid === me()) void finishPongRoom(code);
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

  const hitTogether = (opts: HitOpts): void => {
    const r = room();
    const g = r?.game;
    if (r === null || g === undefined || g.toSide !== mySide()) return;
    reportedSeq = g.seq;
    fastest = Math.min(fastest, serverNow() - g.sentAt);
    void returnPongBall(r, g, opts);
  };

  const react = (emoji: string): void => {
    const code = roomCode();
    if (code === undefined || Date.now() - lastReact < REACT_COOLDOWN_MS) {
      return;
    }
    lastReact = Date.now();
    void sendPongReaction(code, emoji).catch(() => undefined);
  };

  const rematch = (): void => {
    const r = room();
    if (r === null || r.hostUid !== me()) return;
    void startPongRoom(r).catch((e: unknown) =>
      showErrorNotification("Could not start a rematch", { error: e }),
    );
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
    setRound(0);
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

  /** the result screen's button */
  const playAgain = (): { label: string; run: () => void } | undefined => {
    if (mode() === "together") {
      return room()?.hostUid === me()
        ? { label: "Rematch", run: rematch }
        : undefined;
    }
    if (tournament()) {
      const next = TOURNAMENT[round() + 1];
      if (wonLast() && next !== undefined) {
        return {
          label: `Next: ${next.emoji} ${next.name}`,
          run: () => {
            setRound(round() + 1);
            void startSolo();
          },
        };
      }
      return {
        label: "Start over",
        run: () => {
          setRound(0);
          void startSolo();
        },
      };
    }
    return { label: "Play again", run: () => void startSolo() };
  };

  const resultNote = (): string | undefined => {
    const parts = [claimNote(claim()), extraNote()];
    if (mode() === "together" && room()?.hostUid !== me()) {
      parts.push("Waiting for the host to start a rematch…");
    }
    const text = parts.filter((p) => p !== undefined).join(" · ");
    return text === "" ? undefined : text;
  };

  const opponentPlayer = (): {
    name: string;
    uid?: string;
    isBot?: boolean;
    emoji?: string;
  } => {
    if (mode() === "together") return opponent();
    if (rally()) return { name: "Wall", isBot: true };
    const b = bot();
    return tournament()
      ? { name: b.name, isBot: true, emoji: b.emoji }
      : { name: "Tappy", isBot: true };
  };

  const subtitle = (): string | undefined => {
    if (tournament()) {
      const b = bot();
      return `Tournament match ${round() + 1} of 4 · ${b.emoji} ${b.name}: ${b.blurb}`;
    }
    if (rally()) return `🗓️ Daily rally · ${rallyPlan(rallyDay).label}`;
    return undefined;
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
                title="Word Ping-Pong"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text={
                      soloKind() === "tournament"
                        ? "Start the tournament"
                        : soloKind() === "rally"
                          ? "Start the rally"
                          : "Play Tappy"
                    }
                    onClick={() => {
                      setRound(0);
                      void startSolo();
                    }}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="word-pong"
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
            <GameHowTo
              tips={[
                "🏓 Type the ball's word to hit back",
                "💥 Fast + clean = SMASH",
                `🏆 First to ${WIN_POINTS}`,
              ]}
            >
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>
                  🏓 A ball with a word flies to you - type it to hit back.
                </li>
                <li>
                  💥 Fast and no mistakes = a SMASH that flies back faster.
                </li>
                <li>
                  ⚡ While the ball is away, type power words for a special
                  shot: 🔥 fire, 🌀 spin, 👻 ghost or 🐘 giant!
                </li>
                <li>
                  🌟 Golden balls are worth 2 points. First to {WIN_POINTS}{" "}
                  wins!
                </li>
              </ul>
            </GameHowTo>
            <GameSetupSection title="Play with">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={true}
                unlockHint=""
                onModeChange={setMode}
                soloLabel="on my own"
                togetherLabel="vs a friend"
              />
            </GameSetupSection>
            <Show when={mode() === "solo"}>
              <GameSetupSection title="Game">
                <div class="grid grid-cols-3 gap-2">
                  <For each={SOLO_KINDS}>
                    {(k) => (
                      <button
                        type="button"
                        class={cn(
                          "press-3d cursor-pointer rounded-xl p-2 font-kid text-base font-bold",
                          soloKind() === k.id
                            ? "bg-main text-bg"
                            : "bg-sub-alt text-text hover:bg-text hover:text-bg",
                        )}
                        onClick={() => setSoloKind(k.id)}
                      >
                        {k.label}
                      </button>
                    )}
                  </For>
                </div>
                <Show when={soloKind() === "tournament"}>
                  <div class="mt-2 grid gap-1 font-kid text-text">
                    <div class="text-xs text-sub">
                      Beat 4 players in a row · first to {TOURNAMENT_POINTS}{" "}
                      each
                    </div>
                    <For each={TOURNAMENT}>
                      {(b, i) => (
                        <div class="flex items-center gap-2 rounded-lg bg-sub-alt px-2 py-1">
                          <span class="w-5 text-sm text-sub">{i() + 1}.</span>
                          <span class="text-2xl">{b.emoji}</span>
                          <span class="font-bold">{b.name}</span>
                          <span class="flex-1 truncate text-right text-sm text-sub">
                            {b.blurb}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={soloKind() === "rally"}>
                  <div class="mt-2 grid gap-2 rounded-xl bg-sub-alt p-3 font-kid text-text">
                    <div class="grid gap-0.5">
                      <div class="font-bold">
                        🧱 Today: {rallyPlan(rallyDay).label}
                      </div>
                      <div class="text-xs text-sub">
                        Hit the ball off a wall as long as you can · same words
                        for everyone today · one miss ends it · your
                        class&apos;s longest rally goes on the board
                      </div>
                    </div>
                    <DailyClassBoard
                      collection="dailyRally"
                      day={rallyDay}
                      unit="hits"
                    />
                  </div>
                </Show>
              </GameSetupSection>
            </Show>
            <Show when={mode() === "together" || soloKind() === "match"}>
              <GameSetupSection title="Speed">
                <DifficultySegmented
                  options={PONG_DIFFICULTIES}
                  lockedReason={lv.speedLock}
                  selectedLabel={difficulty().label}
                  onSelect={(d) => setDifficulty(() => d)}
                />
              </GameSetupSection>
            </Show>
            <Show when={mode() === "together" || soloKind() !== "rally"}>
              <GameSetupMore>
                <GameSetupSection title="Word list">
                  <WordListPicker
                    lockedReason={lv.listLock}
                    groups={GROUPS}
                    selectedId={selected().id}
                    onSelect={setSelected}
                  />
                </GameSetupSection>
              </GameSetupMore>
            </Show>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "loading"}>
          <div class="py-12 text-center text-sub">Loading…</div>
        </Show>

        <Show when={phase() === "lobby"}>
          <div class="grid min-h-0 gap-4 overflow-y-auto p-6 pt-12 font-kid">
            <div class="text-center">
              <div class="text-sm font-bold tracking-widest text-sub uppercase">
                Room code - tell your friend!
              </div>
              <div class="text-5xl font-bold tracking-[0.25em] text-main">
                {roomCode()}
              </div>
              <div class="mt-2 text-sm text-sub">
                {room()?.wordListLabel} ·{" "}
                {difficultyFor(room()?.difficultyLabel ?? "").label} ball · best
                of 3 with rematches
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
            <InviteClassmates
              gameId="word-pong"
              code={roomCode()}
              show={room()?.hostUid === me() && players().length < 2}
            />
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
                opponent={opponentPlayer()}
                pool={mode() === "solo" ? soloWords : (room()?.words ?? [])}
                tracker={trackerSignal()}
                rally={rally()}
                subtitle={subtitle()}
                onHit={(opts) =>
                  mode() === "solo" ? hitSolo(opts) : hitTogether(opts)
                }
                {...(mode() === "together"
                  ? {
                      showSeries: true,
                      reactions: reactions(),
                      onReact: react,
                      reactionChoices: REACTIONS,
                    }
                  : {})}
              />
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                note={resultNote()}
                onPlayAgain={playAgain()?.run}
                playAgainLabel={playAgain()?.label}
                onExit={() => props.onClose()}
                extra={<PracticeWords words={report()?.hardest ?? []} />}
              />
            )}
          </Show>
        </Show>
      </GameModalFrame>
    </Show>
  );
}

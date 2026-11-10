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

import { Mascot } from "../../components/common/Mascot";
import { UserAvatar } from "../../components/common/UserAvatar";
import { getAuthenticatedUser } from "../../firebase";
import { kanaPrefixMatch } from "../../lessons/kana-romaji";
import { showErrorNotification } from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameModalFrame } from "../components/GameModalFrame";
import {
  GameResultOverlay,
  GameResultView,
} from "../components/GameResultOverlay";
import { GameSetupSection } from "../components/GameSetupSection";
import { claimMiniGameReward, MiniGameClaim } from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import {
  KanaRoom,
  kanaRoomApi,
  playerOrder,
  serverNow,
  syncServerClock,
} from "./kana-room";
import {
  botTypeMs,
  findCard,
  KANA_DIFFICULTIES,
  KanaDifficulty,
  kanaDifficultyFor,
} from "./kana-words";
import { KanaGameSetup } from "./KanaGameSetup";
import { KanaLobby } from "./KanaLobby";
import { KanaPickInput } from "./KanaPickInput";
import {
  applyKarutaSkip,
  applyKarutaTake,
  KARUTA_ROUND_MS,
  karutaRanking,
  karutaScore,
  karutaStars,
  KarutaState,
  newKarutaMatch,
  normalizeKaruta,
  satOut,
} from "./karuta-rules";

const MAX_PLAYERS = 6;
const api = kanaRoomApi<KarutaState>("karutaRooms", MAX_PLAYERS);
const ME = "me";
const BOTS = [
  { id: "bot-tappy", name: "Tappy" },
  { id: "bot-zippy", name: "Zippy" },
  { id: "bot-bloop", name: "Bloop" },
];
const BOT_COUNTS = [
  { label: "1 Tappy", count: 1 },
  { label: "2 Tappys", count: 2 },
  { label: "3 Tappys", count: 3 },
];

type Phase = "pick" | "lobby" | "playing" | "result";
type Seat = { name: string; uid?: string; isBot?: boolean };

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

function KarutaTable(props: {
  game: KarutaState;
  now: number;
  myId: string;
  seats: Record<string, Seat>;
  onTake: (kana: string) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const pausing = (): boolean => props.now < props.game.roundStartAt;
  const iSitOut = (): boolean => satOut(props.game, props.myId);
  const card = (): ReturnType<typeof findCard> => findCard(props.game.clue);
  const nameOf = (id: string | undefined): string =>
    id === undefined
      ? ""
      : id === props.myId
        ? "You"
        : (props.seats[id]?.name ?? "Player");
  const timeLeft = (): number =>
    Math.max(
      0,
      Math.ceil((props.game.roundStartAt + KARUTA_ROUND_MS - props.now) / 1000),
    );

  const banner = (): string | undefined => {
    const last = props.game.last;
    if (!pausing() || last === undefined) {
      return pausing() ? "Get ready… 🎴" : undefined;
    }
    if (last.kind === "take") {
      return last.id === props.myId
        ? `🎉 You took ${last.kana}!`
        : `🎴 ${nameOf(last.id)} took ${last.kana}`;
    }
    if (last.kind === "skip") return `Nobody found ${last.kana} - next card!`;
    return undefined;
  };

  return (
    <div class="relative flex h-full flex-col gap-3 bg-linear-to-b from-game-brown to-game-brown-dark p-3 pt-16 font-kid sm:p-4 sm:pt-16">
      {/* scores */}
      <div class="flex flex-wrap justify-center gap-2">
        <For each={karutaRanking(props.game)}>
          {(row) => (
            <div
              class={cn(
                "flex items-center gap-2 rounded-full bg-game-cream/90 py-1 pr-3 pl-1 text-game-ink",
                satOut(props.game, row.id) && "opacity-50",
              )}
            >
              <span class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-game-cream">
                <Show
                  when={props.seats[row.id]?.uid}
                  fallback={<Mascot mood="happy" size={30} />}
                >
                  {(uid) => <UserAvatar uid={uid()} class="h-8 w-8" />}
                </Show>
              </span>
              <span class="max-w-24 truncate text-sm font-bold">
                {nameOf(row.id)}
              </span>
              <span class="text-sm font-bold">🎴 {row.cards}</span>
            </div>
          )}
        </For>
      </div>

      {/* clue */}
      <div class="mx-auto flex items-center gap-4 rounded-2xl bg-game-cream px-6 py-3 text-game-ink shadow-[0_6px_0_rgb(0_0_0/0.25)]">
        <Show
          when={!pausing() && card()}
          fallback={<span class="text-xl font-bold">{banner() ?? "…"}</span>}
        >
          {(c) => (
            <>
              <span class="text-6xl">{c().emoji}</span>
              <span class="grid">
                <span class="text-sm text-game-ink/60">Find the card:</span>
                <span class="text-3xl font-bold">{c().en}</span>
              </span>
              <span class="ml-2 rounded-lg bg-game-ink px-2 py-1 font-mono text-game-cream tabular-nums">
                {timeLeft()}s
              </span>
            </>
          )}
        </Show>
      </div>

      {/* table */}
      <div
        class="grid min-h-0 flex-1 content-center gap-3 overflow-y-auto"
        style={{
          "grid-template-columns": "repeat(auto-fill, minmax(8.5rem, 1fr))",
        }}
        lang="ja"
      >
        <For each={props.game.table}>
          {(kana) => {
            const match = (): { ok: boolean; kanaDone: number } =>
              typed() === ""
                ? { ok: false, kanaDone: 0 }
                : kanaPrefixMatch(kana, typed());
            return (
              <div
                class={cn(
                  "flex h-24 items-center justify-center rounded-xl border-4 bg-game-cream text-3xl font-bold text-game-ink shadow-[0_5px_0_rgb(0_0_0/0.3)] transition-transform",
                  match().ok
                    ? "-translate-y-1 border-game-yellow"
                    : "border-game-cream",
                )}
              >
                <span class="text-game-green">
                  {kana.slice(0, match().kanaDone)}
                </span>
                {kana.slice(match().kanaDone)}
              </div>
            );
          }}
        </For>
      </div>

      <Show when={iSitOut() && !pausing()}>
        <div class="text-center font-bold text-game-yellow">
          ❌ Wrong card - you sit out this round!
        </div>
      </Show>

      <div class="flex min-h-20 items-center justify-center">
        <Show when={!props.game.over}>
          <KanaPickInput
            candidates={props.game.table}
            waiting={pausing() || iSitOut()}
            onTyped={setTyped}
            onDone={(kana) => props.onTake(kana)}
            placeholder={
              iSitOut()
                ? "sitting out…"
                : pausing()
                  ? "get ready…"
                  : "type a card"
            }
          />
        </Show>
      </div>
    </div>
  );
}

export function KarutaModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  onClose: () => void;
  onResult?: (score: number) => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [difficulty, setDifficulty] = createSignal<KanaDifficulty>(
    KANA_DIFFICULTIES[0] as KanaDifficulty,
  );
  const [botCount, setBotCount] = createSignal(
    BOT_COUNTS[0] as (typeof BOT_COUNTS)[number],
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  let resultTimer: ReturnType<typeof setTimeout> | undefined;

  const [soloGame, setSoloGame] = createSignal<KarutaState | null>(null);
  let botTimers: ReturnType<typeof setTimeout>[] = [];

  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<KanaRoom<KarutaState> | null>(null);
  let unsubscribe: (() => void) | undefined;
  let reportedSeq = 0;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number =>
    mode() === "together" ? serverNow() : Date.now();
  const game = (): KarutaState | null => {
    const g = mode() === "solo" ? soloGame() : (room()?.game ?? null);
    return g === null ? null : normalizeKaruta(g);
  };

  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 100);
    onCleanup(() => clearInterval(t));
  });

  const finishMatch = (g: KarutaState, me: string): void => {
    if (untrack(phase) !== "playing" || resultTimer !== undefined) return;
    const score = karutaScore(g, me);
    const stars = karutaStars(g, me);
    if (stars === 3) sfx.finish();
    resultTimer = setTimeout(() => {
      resultTimer = undefined;
      setResult({
        headline: stars === 3 ? "Karuta champion! 🎴" : "Good game!",
        score,
        stars,
        stats: [
          { label: "your cards", value: String(g.scores[me] ?? 0) },
          {
            label: "most cards",
            value: String(karutaRanking(g)[0]?.cards ?? 0),
          },
        ],
      });
      setPhase("result");
      props.onResult?.(score);
      setClaim("pending");
      void claimMiniGameReward("karuta", score).then(setClaim);
    }, 1800);
  };

  const sounds = (
    prev: KarutaState | null | undefined,
    g: KarutaState,
  ): void => {
    if (prev === null || prev === undefined || prev.seq === g.seq) return;
    const last = g.last;
    if (last === undefined) return;
    if (last.kind === "take") {
      if (last.id === myId()) sfx.great();
      else sfx.pop();
    } else if (last.kind === "fault" && last.id === myId()) {
      sfx.bad();
    }
  };

  // ---------------- solo ----------------
  const setSolo = (next: KarutaState): void => {
    sounds(untrack(soloGame), next);
    setSoloGame(next);
    if (next.over) finishMatch(next, ME);
  };
  createEffect(
    on(
      () => {
        const g = soloGame();
        return g === null || mode() !== "solo" ? undefined : g.round;
      },
      (round) => {
        for (const t of botTimers) clearTimeout(t);
        botTimers = [];
        const g = untrack(soloGame);
        if (round === undefined || g === null || g.over) return;
        const wait = Math.max(0, g.roundStartAt - Date.now());
        for (const bot of g.order.filter((id) => id !== ME)) {
          // slower than typing alone: Tappy has to read the clue and find the card
          const ms = botTypeMs(difficulty(), g.clue, Math.random) * 1.7;
          if (ms > KARUTA_ROUND_MS) continue;
          botTimers.push(
            setTimeout(() => {
              const cur = untrack(soloGame);
              if (cur === null || cur.round !== round) return;
              const next = applyKarutaTake(
                cur,
                bot,
                cur.clue,
                Date.now(),
                Math.random,
              );
              if (next !== null) setSolo(next);
            }, wait + ms),
          );
        }
      },
    ),
  );
  createEffect(() => {
    const g = soloGame();
    if (mode() !== "solo" || g === null || g.over) return;
    if (now() >= g.roundStartAt + KARUTA_ROUND_MS) {
      const next = untrack(() => applyKarutaSkip(g, Date.now(), Math.random));
      if (next !== null) untrack(() => setSolo(next));
    }
  });
  onCleanup(() => {
    for (const t of botTimers) clearTimeout(t);
    clearTimeout(resultTimer);
  });

  const startSolo = (): void => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
    setResult(null);
    const order = [ME, ...BOTS.slice(0, botCount().count).map((b) => b.id)];
    setSoloGame(newKarutaMatch(order, difficulty(), Date.now(), Math.random));
    setNow(Date.now());
    setPhase("playing");
  };

  // ---------------- together ----------------
  const watchRoom = (code: string): void => {
    unsubscribe?.();
    reportedSeq = 0;
    setRoomCode(code);
    setPhase("lobby");
    void syncServerClock();
    unsubscribe = api.subscribe(code, (next) =>
      untrack(() => onRoom(code, next)),
    );
  };
  const onRoom = (code: string, next: KanaRoom<KarutaState> | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (untrack(phase) !== "result") {
        setPhase("pick");
        showErrorNotification("The karuta room was closed");
      }
      return;
    }
    const prev = untrack(room)?.game;
    setRoom(next);
    const g = next.game === undefined ? undefined : normalizeKaruta(next.game);
    if (next.status !== "playing" || g === undefined) return;
    if (untrack(phase) === "lobby") {
      if (!g.order.includes(uid() ?? "")) {
        showErrorNotification("That game started without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      setNow(serverNow());
      setPhase("playing");
    }
    sounds(prev === undefined ? undefined : normalizeKaruta(prev), g);
    if (g.over) {
      finishMatch(g, uid() ?? "");
      if (next.hostUid === uid()) void api.finish(code);
    }
  };
  createEffect(() => {
    const r = room();
    const g = game();
    if (mode() !== "together" || r === null || g === null || g.over) return;
    if (reportedSeq === g.seq) return;
    if (now() >= g.roundStartAt + KARUTA_ROUND_MS + 200) {
      reportedSeq = g.seq;
      const seq = g.seq;
      void api.advance(
        r.code,
        (cur) => cur.seq === seq,
        (cur) => applyKarutaSkip(cur, serverNow(), Math.random),
      );
    }
  });

  const take = (kana: string): void => {
    const g = game();
    if (g === null) return;
    if (mode() === "solo") {
      const next = applyKarutaTake(g, ME, kana, Date.now(), Math.random);
      if (next !== null) setSolo(next);
      return;
    }
    const r = room();
    const me = uid();
    if (r === null || me === undefined) return;
    const round = g.round;
    void api.advance(
      r.code,
      (cur) => cur.round === round,
      (cur) => applyKarutaTake(cur, me, kana, serverNow(), Math.random),
    );
  };

  const createRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await api.create(difficulty().label));
    } catch (e) {
      showErrorNotification("Could not create a room", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };
  const joinRoom = async (): Promise<void> => {
    setRoomBusy(true);
    try {
      watchRoom(await api.join(joinCode()));
    } catch (e) {
      showErrorNotification("Could not join", { error: e });
    } finally {
      setRoomBusy(false);
    }
  };
  const startRoom = async (): Promise<void> => {
    const r = room();
    if (r === null) return;
    await api.start(
      r,
      newKarutaMatch(
        playerOrder(r),
        kanaDifficultyFor(r.difficultyLabel),
        serverNow(),
        Math.random,
      ),
    );
  };
  const leaveRoom = async (): Promise<void> => {
    const code = roomCode();
    unsubscribe?.();
    unsubscribe = undefined;
    setRoom(null);
    setRoomCode(undefined);
    if (code !== undefined) await api.leave(code).catch(() => undefined);
  };

  const reset = (): void => {
    for (const t of botTimers) clearTimeout(t);
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

  const seats = (): Record<string, Seat> => {
    if (mode() === "solo") {
      return {
        [ME]: { name: getSnapshot()?.name ?? "You", uid: uid() },
        ...Object.fromEntries(
          BOTS.map((b) => [b.id, { name: b.name, isBot: true }]),
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
          <KanaGameSetup
            gameId="karuta"
            title="Karuta Battle"
            howTo={[
              "🎴 Hiragana cards are on the table.",
              "👀 A picture and an English word appear.",
              "⌨️ Type that card in romaji (いぬ → inu) to take it - be first!",
              "❌ Type the wrong card and you sit out that round.",
              "🏆 Most cards wins!",
            ]}
            mode={mode()}
            onModeChange={setMode}
            togetherLabel={`friends (up to ${MAX_PLAYERS})`}
            difficulty={difficulty()}
            onDifficulty={(d) => setDifficulty(() => d)}
            extra={
              <GameSetupSection title="How many Tappys?">
                <DifficultySegmented
                  options={BOT_COUNTS}
                  selectedLabel={botCount().label}
                  onSelect={(b) => setBotCount(() => b)}
                />
              </GameSetupSection>
            }
            roomBusy={roomBusy()}
            joinCode={joinCode()}
            onJoinCodeChange={setJoinCode}
            onSolo={startSolo}
            onCreateRoom={() => void createRoom()}
            onJoinRoom={() => void joinRoom()}
            onClose={() => props.onClose()}
          />
        </Show>
        <Show when={phase() === "lobby"}>
          <KanaLobby
            gameId="karuta"
            room={room()}
            code={roomCode()}
            me={uid()}
            maxPlayers={MAX_PLAYERS}
            onStart={() => void startRoom()}
            onLeave={() => {
              void leaveRoom();
              setPhase("pick");
            }}
          />
        </Show>
        <Show when={phase() === "playing" || phase() === "result"}>
          <Show when={game()} keyed={false}>
            {(g) => (
              <KarutaTable
                game={g()}
                now={now()}
                myId={myId()}
                seats={seats()}
                onTake={take}
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

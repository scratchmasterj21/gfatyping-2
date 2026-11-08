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
  bombLive,
  bombPlace,
  bombScore,
  bombStars,
  BOOM_PAUSE_MS,
  DANGER_MS,
  explodeAt,
  MAX_BOMB_PLAYERS,
  START_LIVES,
} from "../word-bomb/bomb-rules";
import {
  KanaRoom,
  kanaRoomApi,
  playerOrder,
  serverNow,
  syncServerClock,
} from "./kana-room";
import {
  botTypeMs,
  KANA_DIFFICULTIES,
  KanaDifficulty,
  kanaDifficultyFor,
  kanaWordPool,
} from "./kana-words";
import { KanaGameSetup } from "./KanaGameSetup";
import { KanaLobby } from "./KanaLobby";
import { KanaPickInput } from "./KanaPickInput";
import {
  applyShiritoriBoom,
  applyShiritoriPass,
  chainKana,
  newShiritoriMatch,
  ShiritoriState,
} from "./shiritori-rules";

const api = kanaRoomApi<ShiritoriState>("shiritoriRooms", MAX_BOMB_PLAYERS);
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
const BOT_FUMBLE = 0.2;

type Phase = "pick" | "lobby" | "playing" | "result";
type Seat = { name: string; uid?: string; isBot?: boolean };

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

function ShiritoriTable(props: {
  game: ShiritoriState;
  now: number;
  myId: string;
  seats: Record<string, Seat>;
  onPass: (word: string) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const g = (): ShiritoriState => props.game;
  const live = (): boolean => bombLive(g(), props.now);
  const mine = (): boolean => g().holder === props.myId && live();
  const danger = (): boolean =>
    live() && props.now >= explodeAt(g()) - DANGER_MS;
  const boomShowing = (): boolean =>
    g().lastBoom !== undefined && (g().over || props.now < g().roundStartAt);
  const nameOf = (id: string): string =>
    id === props.myId ? "You" : (props.seats[id]?.name ?? "Player");
  const n = (): number => g().order.length;
  const myIndex = (): number => Math.max(0, g().order.indexOf(props.myId));
  const pos = (id: string, r: number): { x: number; y: number } => {
    const a =
      ((90 + ((g().order.indexOf(id) - myIndex()) * 360) / n()) * Math.PI) /
      180;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  };
  const word = (): string => g().word;
  const tail = (): string => chainKana(word());

  const banner = (): string | undefined => {
    if (g().over) {
      return g().winner === props.myId
        ? "🏆 You win!"
        : g().winner !== undefined
          ? `🏆 ${nameOf(g().winner ?? "")} wins!`
          : "Game over";
    }
    const b = g().lastBoom;
    if (boomShowing() && b !== undefined) {
      const out = (g().lives[b.id] ?? 0) <= 0;
      return b.id === props.myId
        ? out
          ? "💥 BOOM! You're out!"
          : "💥 BOOM! You lose a life!"
        : out
          ? `💥 BOOM! ${nameOf(b.id)} is out!`
          : `💥 BOOM! ${nameOf(b.id)} loses a life!`;
    }
    if (props.now < g().roundStartAt) return "New chain! Get ready… 💣";
    return undefined;
  };

  return (
    <div
      class={cn(
        "relative flex h-full flex-col items-center gap-2 bg-linear-to-b from-game-night to-game-purple p-3 pt-16 font-kid sm:p-4 sm:pt-16",
        boomShowing() &&
          !g().over &&
          "animate-game-shake motion-reduce:animate-none",
      )}
    >
      <div
        class="relative min-h-0 w-full flex-1"
        style={{ "container-type": "size" }}
      >
        <div
          class="relative mx-auto aspect-square"
          style={{ width: "min(100cqw, 100cqh)" }}
        >
          <div class="absolute inset-[16%] rounded-full bg-game-navy/60"></div>
          <For each={g().order}>
            {(id) => {
              const p = (): { x: number; y: number } => pos(id, 41);
              const lives = (): number => g().lives[id] ?? 0;
              return (
                <div
                  class="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${p().x}%`, top: `${p().y}%` }}
                >
                  <div
                    class={cn(
                      "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-game-cream ring-4",
                      g().holder === id && !boomShowing()
                        ? "scale-110 ring-game-orange"
                        : "ring-game-cream/40",
                      lives() <= 0 && "opacity-40 grayscale",
                    )}
                  >
                    <Show
                      when={props.seats[id]?.uid}
                      fallback={<Mascot mood="happy" size={52} />}
                    >
                      {(uid) => (
                        <UserAvatar uid={uid()} class="h-full w-full" />
                      )}
                    </Show>
                  </div>
                  <span class="max-w-full truncate text-sm font-bold text-game-cream">
                    {nameOf(id)}
                  </span>
                  <span class="text-sm leading-none">
                    <For
                      each={Array.from({ length: START_LIVES }, (_, i) => i)}
                    >
                      {(i) => <span>{i < lives() ? "❤️" : "🖤"}</span>}
                    </For>
                  </span>
                  <Show when={boomShowing() && g().lastBoom?.id === id}>
                    <span class="absolute -top-6 animate-game-pop text-6xl motion-reduce:animate-none">
                      💥
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>

          <Show when={!boomShowing()}>
            <div
              class="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-300"
              style={{
                left: `${pos(g().holder, 30).x}%`,
                top: `${pos(g().holder, 30).y}%`,
              }}
            >
              <span
                class={cn(
                  "block text-5xl",
                  danger() &&
                    "animate-game-shake [animation-iteration-count:infinite] motion-reduce:animate-none",
                )}
              >
                💣
              </span>
            </div>
          </Show>

          {/* chain word + choices */}
          <div
            class="absolute top-1/2 left-1/2 flex w-[60%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
            lang="ja"
          >
            <Show
              when={!boomShowing() && props.now >= g().roundStartAt}
              fallback={
                <Show when={banner()}>
                  {(t) => (
                    <div class="animate-game-pop rounded-full bg-game-yellow px-4 py-2 text-center text-lg font-bold text-game-ink motion-reduce:animate-none">
                      {t()}
                    </div>
                  )}
                </Show>
              }
            >
              <div class="rounded-xl bg-game-cream px-4 py-1 text-3xl font-bold text-game-ink">
                {word().slice(0, word().length - 1)}
                <span class="rounded bg-game-yellow px-0.5">
                  {word().slice(-1)}
                </span>
              </div>
              <div class="text-xs font-bold text-game-cream/80">
                next word starts with 「{tail()}」
              </div>
              <div class="flex flex-wrap justify-center gap-2">
                <For each={g().options}>
                  {(opt) => {
                    const m = (): { ok: boolean; kanaDone: number } =>
                      mine() && typed() !== ""
                        ? kanaPrefixMatch(opt, typed())
                        : { ok: false, kanaDone: 0 };
                    return (
                      <span
                        class={cn(
                          "rounded-lg border-2 px-3 py-1 text-xl font-bold",
                          mine()
                            ? "border-game-yellow bg-game-cream text-game-ink"
                            : "border-transparent bg-game-cream/40 text-game-ink/70",
                          m().ok && "scale-110 border-game-green",
                        )}
                      >
                        <span class="text-game-green">
                          {opt.slice(0, m().kanaDone)}
                        </span>
                        {opt.slice(m().kanaDone)}
                      </span>
                    );
                  }}
                </For>
              </div>
              <div class="text-xs text-game-cream/80">
                {mine()
                  ? "Your turn - type one!"
                  : `${nameOf(g().holder)} is choosing…`}
              </div>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex min-h-20 w-full items-center justify-center">
        <Show when={!g().over}>
          <KanaPickInput
            candidates={mine() ? (g().options ?? []) : []}
            waiting={!mine()}
            onTyped={setTyped}
            onDone={(w) => props.onPass(w)}
            placeholder={
              (g().lives[props.myId] ?? 0) <= 0
                ? "you're out - watch the rest!"
                : mine()
                  ? "type one of the words"
                  : "pass it when it comes to you!"
            }
          />
        </Show>
      </div>
    </div>
  );
}

export function ShiritoriModal(props: {
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
    BOT_COUNTS[1] as (typeof BOT_COUNTS)[number],
  );
  const [pool, setPool] = createSignal<string[]>([]);
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  let resultTimer: ReturnType<typeof setTimeout> | undefined;

  const [soloGame, setSoloGame] = createSignal<ShiritoriState | null>(null);
  let botTimer: ReturnType<typeof setTimeout> | undefined;

  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<KanaRoom<ShiritoriState> | null>(null);
  let unsubscribe: (() => void) | undefined;
  let reportedSeq = 0;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number =>
    mode() === "together" ? serverNow() : Date.now();
  const kd = (): KanaDifficulty =>
    mode() === "solo"
      ? difficulty()
      : kanaDifficultyFor(room()?.difficultyLabel ?? "");
  const fix = (g: ShiritoriState): ShiritoriState => ({
    ...g,
    options: g.options ?? [],
  });
  const game = (): ShiritoriState | null => {
    const g = mode() === "solo" ? soloGame() : (room()?.game ?? null);
    return g === null ? null : fix(g);
  };

  createEffect(() => {
    if (props.open) void kanaWordPool().then(setPool);
  });
  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 60);
    onCleanup(() => clearInterval(t));
  });

  const finishMatch = (g: ShiritoriState, me: string): void => {
    if (untrack(phase) !== "playing" || resultTimer !== undefined) return;
    const score = bombScore(g, me);
    const place = bombPlace(g, me);
    if (place === 1) sfx.finish();
    resultTimer = setTimeout(() => {
      resultTimer = undefined;
      setResult({
        headline:
          place === 1
            ? "Shiritori champion! 💣"
            : `You came ${ordinal(place)}!`,
        score,
        stars: bombStars(g, me),
        stats: [
          { label: "place", value: `${ordinal(place)} of ${g.order.length}` },
          { label: "words passed", value: String(g.totalPasses[me] ?? 0) },
        ],
      });
      setPhase("result");
      props.onResult?.(score);
      setClaim("pending");
      void claimMiniGameReward("shiritori", score).then(setClaim);
    }, BOOM_PAUSE_MS);
  };

  const sounds = (
    prev: ShiritoriState | null | undefined,
    g: ShiritoriState,
  ): void => {
    if (prev === null || prev === undefined || prev.seq === g.seq) return;
    if (g.lastBoom !== undefined && g.lastBoom.at !== prev.lastBoom?.at) {
      sfx.boom();
      if (g.lastBoom.id === myId()) setTimeout(() => sfx.bad(), 300);
    } else if (g.holder === myId()) {
      sfx.pop();
    } else {
      sfx.good();
    }
  };

  // ---------------- solo ----------------
  const setSolo = (next: ShiritoriState): void => {
    sounds(untrack(soloGame), next);
    setSoloGame(next);
    if (next.over) finishMatch(next, ME);
  };
  createEffect(
    on(
      () => {
        const g = soloGame();
        return g === null || mode() !== "solo" ? undefined : g.seq;
      },
      () => {
        clearTimeout(botTimer);
        const g = untrack(soloGame);
        if (g === null || g.over || g.holder === ME) return;
        const option =
          g.options[Math.floor(Math.random() * g.options.length)] ?? "";
        const fumble =
          Math.random() < BOT_FUMBLE ? 2500 + Math.random() * 3000 : 0;
        const startAt = Math.max(Date.now(), g.roundStartAt);
        botTimer = setTimeout(
          () => {
            const cur = untrack(soloGame);
            if (cur === null || cur.seq !== g.seq) return;
            const next = applyShiritoriPass(
              fix(cur),
              cur.holder,
              option,
              difficulty(),
              pool(),
              Date.now(),
              Math.random,
            );
            if (next !== null) setSolo(next);
          },
          startAt -
            Date.now() +
            botTypeMs(difficulty(), option, Math.random) +
            fumble,
        );
      },
    ),
  );
  createEffect(() => {
    const g = soloGame();
    if (mode() !== "solo" || g === null || g.over) return;
    if (now() >= explodeAt(g)) {
      const next = untrack(() =>
        applyShiritoriBoom(
          fix(g),
          difficulty(),
          pool(),
          Date.now(),
          Math.random,
        ),
      );
      if (next !== null) untrack(() => setSolo(next));
    }
  });
  onCleanup(() => {
    clearTimeout(botTimer);
    clearTimeout(resultTimer);
  });

  const startSolo = (): void => {
    if (pool().length === 0) return;
    clearTimeout(resultTimer);
    resultTimer = undefined;
    setResult(null);
    const order = [ME, ...BOTS.slice(0, botCount().count).map((b) => b.id)];
    setSoloGame(
      newShiritoriMatch(order, difficulty(), pool(), Date.now(), Math.random),
    );
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
  const onRoom = (
    code: string,
    next: KanaRoom<ShiritoriState> | null,
  ): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (untrack(phase) !== "result") {
        setPhase("pick");
        showErrorNotification("The shiritori room was closed");
      }
      return;
    }
    const prev = untrack(room)?.game;
    setRoom(next);
    const g = next.game === undefined ? undefined : fix(next.game);
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
    sounds(prev === undefined ? undefined : fix(prev), g);
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
    if (now() >= explodeAt(g) + 150) {
      reportedSeq = g.seq;
      const seq = g.seq;
      const d = kd();
      const words = pool();
      void api.advance(
        r.code,
        (cur) => cur.seq === seq,
        (cur) =>
          applyShiritoriBoom(fix(cur), d, words, serverNow(), Math.random),
      );
    }
  });

  const pass = (word: string): void => {
    const g = game();
    if (g === null) return;
    if (mode() === "solo") {
      const next = applyShiritoriPass(
        g,
        ME,
        word,
        difficulty(),
        pool(),
        Date.now(),
        Math.random,
      );
      if (next !== null) setSolo(next);
      return;
    }
    const r = room();
    const me = uid();
    if (r === null || me === undefined) return;
    const seq = g.seq;
    const d = kd();
    const words = pool();
    void api.advance(
      r.code,
      (cur) => cur.seq === seq,
      (cur) =>
        applyShiritoriPass(
          fix(cur),
          me,
          word,
          d,
          words,
          serverNow(),
          Math.random,
        ),
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
    if (r === null || pool().length === 0) return;
    await api.start(
      r,
      newShiritoriMatch(
        playerOrder(r),
        kanaDifficultyFor(r.difficultyLabel),
        pool(),
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
            title="Shiritori Bomb"
            howTo={[
              "💣 A bomb is passed around - with a word chain!",
              "🔗 The next word must start with the last kana (りんご → ごりら).",
              "⌨️ On your turn, pick one of 3 words and type it in romaji.",
              "💥 Holding the bomb when it goes BOOM? You lose a ❤️.",
              "🏆 Last player with hearts left wins!",
            ]}
            mode={mode()}
            onModeChange={setMode}
            togetherLabel={`friends (up to ${MAX_BOMB_PLAYERS})`}
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
            room={room()}
            code={roomCode()}
            me={uid()}
            maxPlayers={MAX_BOMB_PLAYERS}
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
              <ShiritoriTable
                game={g()}
                now={now()}
                myId={myId()}
                seats={seats()}
                onPass={pass}
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

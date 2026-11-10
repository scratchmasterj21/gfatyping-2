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
  buildFish,
  Fish,
  fishPoints,
  fishProgress,
  GOLDFISH_MS,
  GOLDFISH_START_PAUSE_MS,
  GoldfishGame,
  goldfishOver,
  goldfishRanking,
  goldfishScore,
  goldfishStars,
  POND_LANES,
  visibleFish,
} from "./goldfish-rules";
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

const MAX_PLAYERS = 8;
const api = kanaRoomApi<GoldfishGame>("goldfishRooms", MAX_PLAYERS);
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
type Splash = { at: number; x: number; y: number; text: string };

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") return "You've earned today's coins for this game.";
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

function fishPos(
  f: Fish,
  game: GoldfishGame,
  now: number,
): { x: number; y: number } | undefined {
  const p = fishProgress(f, game, now);
  if (p === undefined) return undefined;
  const x = f.ltr ? -8 + p * 116 : 108 - p * 116;
  const y = 10 + (f.lane * 80) / (POND_LANES - 1);
  return { x, y };
}

function Pond(props: {
  game: GoldfishGame;
  fish: Fish[];
  caught: Record<string, string>;
  now: number;
  myId: string;
  names: Record<string, string>;
  splashes: Splash[];
  onScoop: (word: string) => void;
}): JSXElement {
  const [typed, setTyped] = createSignal("");
  const swimming = (): Fish[] =>
    visibleFish(props.fish, props.game, props.caught, props.now);
  const waiting = (): boolean => props.now < props.game.startAt;
  const left = (): number =>
    Math.max(
      0,
      Math.ceil((props.game.startAt + GOLDFISH_MS - props.now) / 1000),
    );
  const nameOf = (id: string): string =>
    id === props.myId ? "You" : (props.names[id] ?? "Player");

  return (
    <div class="relative flex h-full flex-col gap-2 bg-linear-to-b from-game-sky-top to-game-blue p-3 pt-16 font-kid sm:p-4 sm:pt-16">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <For each={goldfishRanking(props.game, props.fish, props.caught)}>
          {(row) => (
            <span
              class={cn(
                "rounded-full px-3 py-1 text-sm font-bold",
                row.id === props.myId
                  ? "bg-game-yellow text-game-ink"
                  : "bg-game-cream/90 text-game-ink",
              )}
            >
              {nameOf(row.id)} · {row.points} pts 🐟{row.count}
            </span>
          )}
        </For>
        <span class="rounded-lg bg-game-ink px-3 py-1 font-mono text-lg font-bold text-game-cream tabular-nums">
          {waiting()
            ? `starts in ${Math.ceil((props.game.startAt - props.now) / 1000)}`
            : `${left()}s`}
        </span>
      </div>

      {/* pond */}
      <div
        class="relative min-h-0 flex-1 overflow-hidden rounded-[2rem] border-8 border-game-cream/70 bg-linear-to-b from-game-sky to-game-blue shadow-[inset_0_8px_0_rgb(0_0_0/0.15)]"
        lang="ja"
      >
        <For each={swimming()}>
          {(f) => {
            const pos = (): { x: number; y: number } | undefined =>
              fishPos(f, props.game, props.now);
            const match = (): { ok: boolean; kanaDone: number } =>
              typed() === ""
                ? { ok: false, kanaDone: 0 }
                : kanaPrefixMatch(f.word, typed());
            return (
              <Show when={pos()}>
                {(p) => (
                  <div
                    class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{ left: `${p().x}%`, top: `${p().y}%` }}
                  >
                    <span
                      class={cn(
                        "rounded-full border-2 px-2 py-0.5 text-xl font-bold whitespace-nowrap shadow sm:text-2xl",
                        f.golden
                          ? "border-game-gold bg-game-yellow text-game-ink"
                          : "border-transparent bg-game-cream text-game-ink",
                        match().ok && "scale-110 border-game-green",
                      )}
                    >
                      <span class="text-game-green">
                        {f.word.slice(0, match().kanaDone)}
                      </span>
                      {f.word.slice(match().kanaDone)}
                    </span>
                    <span
                      class="text-4xl"
                      style={{ transform: f.ltr ? "scaleX(-1)" : "none" }}
                    >
                      {f.golden ? "🐠" : "🐟"}
                    </span>
                  </div>
                )}
              </Show>
            );
          }}
        </For>
        <For each={props.splashes}>
          {(s) => (
            <span
              class="pointer-events-none absolute -translate-x-1/2 animate-game-float-up text-lg font-bold text-game-cream motion-reduce:animate-none"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              💦 {s.text}
            </span>
          )}
        </For>
        <Show when={waiting()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="animate-game-pop rounded-full bg-game-yellow px-5 py-2 text-xl font-bold text-game-ink motion-reduce:animate-none">
              Get your scoop ready! 🥅
            </span>
          </div>
        </Show>
      </div>

      <div class="flex min-h-20 items-center justify-center">
        <KanaPickInput
          candidates={swimming().map((f) => f.word)}
          waiting={waiting() || goldfishOver(props.game, props.now)}
          onTyped={setTyped}
          onDone={(w) => props.onScoop(w)}
          placeholder={waiting() ? "get ready…" : "type a fish"}
        />
      </div>
    </div>
  );
}

export function GoldfishModal(props: {
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
  const [pool, setPool] = createSignal<string[]>([]);
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  const [splashes, setSplashes] = createSignal<Splash[]>([]);
  let finished = false;

  // solo
  const [soloGame, setSoloGame] = createSignal<GoldfishGame | null>(null);
  const [soloCaught, setSoloCaught] = createSignal<Record<string, string>>({});
  let botPlans: Record<string, { index: number; at: number } | undefined> = {};

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<KanaRoom<GoldfishGame> | null>(null);
  let unsubscribe: (() => void) | undefined;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number =>
    mode() === "together" ? serverNow() : Date.now();
  const game = (): GoldfishGame | null =>
    mode() === "solo" ? soloGame() : (room()?.game ?? null);
  const caught = (): Record<string, string> =>
    mode() === "solo" ? soloCaught() : (room()?.caught ?? {});
  const roomDifficulty = (): KanaDifficulty =>
    mode() === "solo"
      ? difficulty()
      : kanaDifficultyFor(room()?.difficultyLabel ?? "");
  const fish = createMemo((): Fish[] => {
    const g = game();
    const p = pool();
    if (g === null || p.length === 0) return [];
    return buildFish(g.seed, roomDifficulty(), p);
  });

  createEffect(() => {
    if (!props.open) return;
    void kanaWordPool().then(setPool);
  });

  createEffect(() => {
    if (phase() !== "playing") return;
    const t = setInterval(() => setNow(clock()), 80);
    onCleanup(() => clearInterval(t));
  });

  const splashAt = (f: Fish, who: string): void => {
    const g = game();
    if (g === null) return;
    const p = fishPos(f, g, clock());
    if (p === undefined) return;
    const s: Splash = { at: Date.now(), x: p.x, y: p.y, text: who };
    setSplashes((list) => [...list.filter((x) => Date.now() - x.at < 900), s]);
  };

  const finishMatch = (): void => {
    const g = game();
    if (g === null || finished) return;
    finished = true;
    const me = myId();
    const score = goldfishScore(g, fish(), caught(), me);
    const stars = goldfishStars(g, fish(), caught(), me);
    const mine = goldfishRanking(g, fish(), caught()).find((r) => r.id === me);
    if (stars === 3) sfx.finish();
    setResult({
      headline: stars === 3 ? "Best scooper! 🐟" : "Time's up!",
      score,
      stars,
      stats: [
        { label: "fish scooped", value: String(mine?.count ?? 0) },
        { label: "points", value: String(mine?.points ?? 0) },
      ],
    });
    setPhase("result");
    props.onResult?.(score);
    setClaim("pending");
    void claimMiniGameReward("goldfish", score).then(setClaim);
    const r = room();
    if (r !== null && r.hostUid === uid()) void api.finish(r.code);
  };

  createEffect(() => {
    const g = game();
    if (phase() !== "playing" || g === null) return;
    if (goldfishOver(g, now())) untrack(finishMatch);
  });

  // ---------------- solo ----------------
  createEffect(() => {
    const g = soloGame();
    const t = now();
    if (mode() !== "solo" || g === null || phase() !== "playing") return;
    untrack(() => {
      const d = difficulty();
      const swimming = visibleFish(fish(), g, soloCaught(), t);
      for (const bot of g.order.filter((id) => id !== ME)) {
        const plan = botPlans[bot];
        if (plan !== undefined && t >= plan.at) {
          botPlans[bot] = undefined;
          const f = swimming.find((x) => x.index === plan.index);
          if (f !== undefined) {
            setSoloCaught((c) => ({ ...c, [String(f.index)]: bot }));
            splashAt(f, `+${fishPoints(f)}`);
            sfx.pop();
          }
        } else if (plan === undefined && swimming.length > 0) {
          const f = swimming[
            Math.floor(Math.random() * swimming.length)
          ] as Fish;
          botPlans[bot] = {
            index: f.index,
            at: t + botTypeMs(d, f.word, Math.random) * 1.3,
          };
        }
      }
    });
  });

  const startSolo = (): void => {
    finished = false;
    botPlans = {};
    setResult(null);
    setSoloCaught({});
    setSplashes([]);
    const order = [ME, ...BOTS.slice(0, botCount().count).map((b) => b.id)];
    setSoloGame({
      seq: 1,
      seed: Math.floor(Math.random() * 2 ** 31),
      startAt: Date.now() + GOLDFISH_START_PAUSE_MS,
      order,
    });
    setNow(Date.now());
    setPhase("playing");
  };

  // ---------------- together ----------------
  const watchRoom = (code: string): void => {
    unsubscribe?.();
    setRoomCode(code);
    setPhase("lobby");
    void syncServerClock();
    unsubscribe = api.subscribe(code, (next) => untrack(() => onRoom(next)));
  };
  const onRoom = (next: KanaRoom<GoldfishGame> | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (untrack(phase) !== "result") {
        setPhase("pick");
        showErrorNotification("The goldfish room was closed");
      }
      return;
    }
    const prevCaught = untrack(room)?.caught ?? {};
    setRoom(next);
    const g = next.game;
    if (next.status === "lobby" || g === undefined) return;
    if (untrack(phase) === "lobby") {
      if (!g.order.includes(uid() ?? "")) {
        showErrorNotification("That game started without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      finished = false;
      setNow(serverNow());
      setPhase("playing");
    }
    // splash for fish others scooped
    for (const [i, who] of Object.entries(next.caught ?? {})) {
      if (prevCaught[i] !== undefined || who === uid()) continue;
      const f = untrack(fish).find((x) => String(x.index) === i);
      if (f !== undefined) {
        splashAt(f, next.players[who]?.name ?? "");
        sfx.pop();
      }
    }
  };

  const scoop = (word: string): void => {
    const g = game();
    if (g === null) return;
    const swimming = visibleFish(fish(), g, caught(), clock());
    const f = swimming.find((x) => x.word === word);
    if (f === undefined) return;
    if (mode() === "solo") {
      setSoloCaught((c) => ({ ...c, [String(f.index)]: ME }));
      splashAt(f, `+${fishPoints(f)}`);
      sfx.great();
      return;
    }
    const r = room();
    if (r === null) return;
    const at = fishPos(f, g, clock());
    void api.claim(r.code, f.index).then((ok) => {
      if (ok) {
        if (at !== undefined) {
          const splash: Splash = {
            at: Date.now(),
            x: at.x,
            y: at.y,
            text: `+${fishPoints(f)}`,
          };
          setSplashes((list) => [
            ...list.filter((x) => Date.now() - x.at < 900),
            splash,
          ]);
        }
        sfx.great();
      } else {
        sfx.bad();
      }
    });
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
    await api.start(r, {
      seq: 1,
      seed: Math.floor(Math.random() * 2 ** 31),
      startAt: serverNow() + GOLDFISH_START_PAUSE_MS,
      order: playerOrder(r),
    });
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
    botPlans = {};
    finished = false;
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

  const names = (): Record<string, string> =>
    mode() === "solo"
      ? {
          [ME]: getSnapshot()?.name ?? "You",
          ...Object.fromEntries(BOTS.map((b) => [b.id, b.name])),
        }
      : Object.fromEntries(
          Object.values(room()?.players ?? {}).map((p) => [p.uid, p.name]),
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
          <KanaGameSetup
            gameId="goldfish"
            title="Goldfish Scooping"
            howTo={[
              "🐟 Goldfish swim across the pond with hiragana words.",
              "⌨️ Type a fish's word in romaji to scoop it - before anyone else!",
              "🔢 Longer words are worth more points.",
              "🐠 Golden fish are worth double!",
              "⏰ 60 seconds - most points wins.",
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
            gameId="goldfish"
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
              <Pond
                game={g()}
                fish={fish()}
                caught={caught()}
                now={now()}
                myId={myId()}
                names={names()}
                splashes={splashes()}
                onScoop={scoop}
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

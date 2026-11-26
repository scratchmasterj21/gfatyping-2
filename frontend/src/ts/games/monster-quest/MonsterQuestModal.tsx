import {
  createEffect,
  createMemo,
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
import { queryClient } from "../../queries";
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
import { InviteClassmates } from "../components/InviteClassmates";
import { MULTIPLAYER_UNLOCK_HINT_GENERIC } from "../components/multiplayer-unlock-hints";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import {
  claimMiniGameReward,
  MiniGameClaim,
  MONSTER_QUEST_PAID_RUNS_PER_DAY,
} from "../mini/mini-game-reward";
import { sfx } from "../mini/mini-sounds";
import { HERO_ART } from "./hero-art";
import { HeroPicker, useQuestHeroes } from "./HeroPicker";
import {
  closeTimedOut,
  createQuestRoom,
  finishQuestRoom,
  joinQuestRoom,
  leaveQuestRoom,
  openVotes,
  QuestRoom,
  questNow,
  roomInputs,
  roomParty,
  setMyClass,
  startQuestRoom,
  subscribeQuestRoom,
  syncQuestClock,
  writeGuard,
  writeHeroInput,
  writeVote,
} from "./quest-multiplayer";
import {
  buildParty,
  CLASS_INFO,
  HeroClass,
  HeroInput,
  PARTY_SIZE,
  pendingDeadline,
  QUEST_DIFFICULTIES,
  questAwards,
  questDifficultyFor,
  QuestDifficulty,
  QuestInput,
  questScore,
  QuestSetup,
  QuestState,
  questStars,
  runQuest,
  START_PAUSE_MS,
  TIMEOUT_POWER,
  WEEKLY_DIFFICULTY,
  weeklyPlan,
} from "./quest-rules";
import { QuestBattle } from "./QuestBattle";
import {
  formatQuestTime,
  questWeek,
  submitWeeklyTime,
} from "./weekly-quest-db";
import { WeeklyQuestCard } from "./WeeklyQuestCard";

/** Kept as the old Monster Raid id so teacher game settings and coins carry over. */
const GAME_ID = "monster-raid";
const ME = "me";
/** extra wait before anyone closes a timed-out turn, so the player's own answer wins */
const CLOSE_GRACE_MS = 700;

const claimNote = (c: MiniGameClaim | "pending"): string | undefined => {
  if (c === "pending") return "Adding coins…";
  if (c.kind === "coins") return `🪙 +${c.coins} coins!`;
  if (c.kind === "capped") {
    return `You've earned coins ${MONSTER_QUEST_PAID_RUNS_PER_DAY} times today - come back tomorrow for more!`;
  }
  if (c.kind === "signedOut") return "Sign in to earn coins.";
  if (c.kind === "error") return "Couldn't add coins - check your connection.";
  return undefined;
};

type Phase = "pick" | "lobby" | "playing" | "result";

export function MonsterQuestModal(props: {
  open: boolean;
  initialMode?: "solo" | "together";
  multiplayerUnlocked?: boolean;
  onClose: () => void;
}): JSXElement {
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [cls, setCls] = createSignal<HeroClass>("knight");
  const [difficulty, setDifficulty] = createSignal<QuestDifficulty>(
    QUEST_DIFFICULTIES[0] as QuestDifficulty,
  );
  const [now, setNow] = createSignal(Date.now());
  const [result, setResult] = createSignal<GameResultView | null>(null);
  const [claim, setClaim] = createSignal<MiniGameClaim | "pending">("pending");
  const [weekly, setWeekly] = createSignal(false);
  /** my typing this quest, for the results */
  let typing = { chars: 0, ms: 0, errors: 0 };
  const onTyped = (t: { chars: number; ms: number; errors: number }): void => {
    typing = {
      chars: typing.chars + t.chars,
      ms: typing.ms + Math.min(t.ms, 60_000),
      errors: typing.errors + t.errors,
    };
  };
  const [weeklyNote, setWeeklyNote] = createSignal<string>();
  const heroes = useQuestHeroes(() => props.open);
  // a bought hero switched off (or not owned on this account): back to knight
  createEffect(() => {
    if (!heroes.canPlay(cls())) setCls("knight");
  });

  // solo
  const [solo, setSolo] = createSignal<{
    setup: QuestSetup;
    startAt: number;
    inputs: QuestInput[];
    times: number[];
  } | null>(null);

  // together
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [roomCode, setRoomCode] = createSignal<string>();
  const [room, setRoom] = createSignal<QuestRoom | null>(null);
  let unsubscribeRoom: (() => void) | undefined;
  let closeTried = -1;

  const uid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myId = (): string => (mode() === "solo" ? ME : (uid() ?? ME));
  const clock = (): number => (mode() === "together" ? questNow() : Date.now());

  createEffect(
    on(phase, (p, prev) => {
      if (p === "playing" && prev !== "playing") {
        typing = { chars: 0, ms: 0, errors: 0 };
      }
    }),
  );
  createEffect(() => {
    if (phase() !== "playing" && phase() !== "result") return;
    const t = setInterval(() => setNow(clock()), 100);
    onCleanup(() => clearInterval(t));
  });

  // ---------------------------------------------------------- the quest
  // same quest = same object (each room update used to build a new one)
  const setup = createMemo(
    (): QuestSetup | null => {
      if (mode() === "solo") return solo()?.setup ?? null;
      const r = room();
      if (r === null || r.party === undefined) return null;
      if (r.weekly !== undefined) {
        const plan = weeklyPlan(r.weekly);
        return {
          seed: plan.seed,
          difficulty: questDifficultyFor(WEEKLY_DIFFICULTY),
          party: roomParty(r),
          weekly: plan,
        };
      }
      return {
        seed: r.seed,
        difficulty: questDifficultyFor(r.difficultyLabel),
        party: roomParty(r),
      };
    },
    null,
    {
      equals: (a, b) =>
        a === b ||
        (a !== null &&
          b !== null &&
          a.seed === b.seed &&
          a.difficulty.label === b.difficulty.label &&
          a.party.map((h) => `${h.slot}:${h.uid}:${h.cls}`).join() ===
            b.party.map((h) => `${h.slot}:${h.uid}:${h.cls}`).join()),
    },
  );
  const startAt = (): number =>
    mode() === "solo" ? (solo()?.startAt ?? 0) : (room()?.startAt ?? 0);
  const log = createMemo((): { inputs: QuestInput[]; times: number[] } => {
    if (mode() === "solo") {
      const s = solo();
      return { inputs: s?.inputs ?? [], times: s?.times ?? [] };
    }
    const r = room();
    return r === null ? { inputs: [], times: [] } : roomInputs(r);
  });
  const state = createMemo(() => {
    const s = setup();
    return s === null ? null : runQuest(s, log().inputs);
  });
  const deadline = createMemo(() => {
    const st = state();
    return st === null ? null : pendingDeadline(st, startAt(), log().times);
  });

  const pushSolo = (input: QuestInput): void => {
    setSolo((s) =>
      s === null
        ? s
        : {
            ...s,
            inputs: [...s.inputs, input],
            times: [...s.times, Date.now()],
          },
    );
  };

  const onHero = (input: HeroInput): void => {
    const p = state()?.pending;
    if (p?.kind !== "hero") return;
    if (mode() === "solo") {
      pushSolo(input);
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeHeroInput(code, p.n, input).catch(() => undefined);
    }
  };

  const onGuard = (): void => {
    const p = state()?.pending;
    if (p?.kind !== "guard" && p?.kind !== "challenge") return;
    if (mode() === "solo") {
      pushSolo({ kind: "guard", guards: { [ME]: true } });
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeGuard(code, p.n, Object.keys(p.words)).catch(() => undefined);
    }
  };

  const onVote = (choice: string): void => {
    const p = state()?.pending;
    if (p?.kind !== "vote" && p?.kind !== "pick") return;
    if (mode() === "solo") {
      pushSolo({ kind: "vote", votes: { [ME]: choice } });
      return;
    }
    const code = roomCode();
    if (code !== undefined) {
      void writeVote(code, p.n, choice, p.voters).catch(() => undefined);
    }
  };
  const liveVotes = (): Record<string, string> | undefined => {
    const r = room();
    const p = state()?.pending;
    return r === null || (p?.kind !== "vote" && p?.kind !== "pick")
      ? undefined
      : openVotes(r, p.n);
  };

  /** a player who left (closed the tab, lost wifi) */
  const isOffline = (u: string): boolean =>
    room()?.players[u]?.online === false;
  /**
   * Online: nobody left to wait for, so close the turn now instead of
   * running the clock - everyone still here has voted / guarded, or the
   * player whose move it is has left. (Choice screens used to sit for the
   * full timer waiting on a student who'd gone, which felt like a loop.)
   */
  const nothingToWaitFor = (p: NonNullable<QuestState["pending"]>): boolean => {
    const r = room();
    if (r === null) return false;
    if (p.kind === "hero") return isOffline(p.uid);
    if (p.kind === "vote" || p.kind === "pick") {
      const votes = openVotes(r, p.n) ?? {};
      const here = p.voters.filter((u) => !isOffline(u));
      return here.every((u) => votes[u] !== undefined);
    }
    const raw = (r.inputs ?? {}) as Record<
      string,
      { kind?: string; guards?: Record<string, boolean>; closed?: boolean }
    >;
    const entry = raw[String(p.n)];
    const guards = entry?.kind === "guard" ? (entry.guards ?? {}) : {};
    const here = Object.keys(p.words).filter((u) => !isOffline(u));
    return here.every((u) => guards[u] === true);
  };

  // turn timer ran out: answer for the slow player
  createEffect(() => {
    const st = state();
    const d = deadline();
    if (st === null || d === null || st.pending === null || st.over) return;
    const p = st.pending;
    const early = mode() === "together" && nothingToWaitFor(p);
    if (now() < d && !early) return;
    if (mode() === "solo") {
      untrack(() =>
        pushSolo(
          p.kind === "hero"
            ? {
                kind: "hero",
                action: "attack",
                power: TIMEOUT_POWER,
                timeout: true,
              }
            : p.kind === "vote" || p.kind === "pick"
              ? { kind: "vote", votes: {} }
              : { kind: "guard", guards: {} },
        ),
      );
      return;
    }
    // online: anyone may close it, a moment late so the player's answer wins
    if ((!early && now() < d + CLOSE_GRACE_MS) || closeTried === p.n) return;
    closeTried = p.n;
    const code = roomCode();
    if (code !== undefined) {
      const closeAs =
        p.kind === "pick" ? "vote" : p.kind === "challenge" ? "guard" : p.kind;
      void closeTimedOut(code, p.n, closeAs).catch(() => {
        closeTried = -1;
      });
    }
  });

  const finish = (): void => {
    const st = untrack(state);
    if (st === null || phase() === "result") return;
    const me = st.heroes.find((h) => h.uid === myId());
    const myStats = me === undefined ? undefined : st.stats[me.slot];
    const best = Math.max(
      0,
      ...st.heroes
        .filter((h) => h.uid !== null)
        .map((h) => st.stats[h.slot]?.damage ?? 0),
    );
    const stats = myStats ?? { damage: 0, healed: 0, guards: 0, crits: 0 };
    const mvp =
      mode() === "together" && stats.damage > 0 && stats.damage === best;
    const words = Math.round(typing.chars / 5);
    const wpm = typing.ms > 0 ? Math.round(words / (typing.ms / 60_000)) : 0;
    const accuracy =
      typing.chars > 0
        ? Math.round((typing.chars / (typing.chars + typing.errors)) * 100)
        : 100;
    const score = questScore({
      won: st.won,
      stats,
      battlesWon: st.won ? 3 : st.battle,
      mvp,
      words,
    });
    if (st.won) sfx.finish();
    const r = untrack(room);
    if (r !== null && r.hostUid === uid() && r.status === "playing") {
      void finishQuestRoom(r.code).catch(() => undefined);
    }
    const awards =
      mode() === "together" ? questAwards(st.heroes, st.stats) : [];
    const plan = untrack(setup)?.weekly;
    const clearMs = clock() - startAt();
    setWeeklyNote(undefined);
    if (plan !== undefined && st.won && getAuthenticatedUser() !== null) {
      setWeeklyNote("Sending your class time…");
      void submitWeeklyTime(plan.week, clearMs)
        .then((best) => {
          setWeeklyNote(
            best
              ? "🏆 New best time for your class this week!"
              : "⏱️ Time saved - your class already has a faster one.",
          );
          void queryClient.invalidateQueries({
            queryKey: ["weeklyQuest", plan.week],
          });
        })
        .catch(() => setWeeklyNote("Couldn't send your time."));
    }
    setResult({
      headline: st.won
        ? "Quest complete! 🎉"
        : st.battle === 2
          ? "So close! The boss won this time."
          : "The monsters won this time!",
      score,
      stars: questStars(st.won, st.heroes),
      stats: [
        { label: "⌨️ words typed", value: String(words) },
        { label: "typing speed", value: `${wpm} WPM` },
        { label: "accuracy", value: `${accuracy}%` },
        { label: "your damage", value: String(stats.damage) },
        { label: "healing", value: String(stats.healed) },
        { label: "guards", value: `🛡️ ${stats.guards}` },
        { label: "critical hits", value: `⭐ ${stats.crits}` },
        ...(plan !== undefined && st.won
          ? [{ label: "🗓️ weekly time", value: formatQuestTime(clearMs) }]
          : []),
        ...awards.map((a) => ({
          label: `${a.icon} ${a.title}`,
          value: `${a.names.join(" & ")} (${a.value})`,
        })),
      ],
    });
    setPhase("result");
    setClaim("pending");
    void claimMiniGameReward(GAME_ID, score).then(setClaim);
  };

  // ---------------------------------------------------------- solo
  const startSolo = (): void => {
    setResult(null);
    const party = buildParty([
      { uid: ME, name: getSnapshot()?.name ?? "You", cls: cls() },
    ]);
    const plan = weekly() ? weeklyPlan(questWeek()) : undefined;
    setSolo({
      setup:
        plan === undefined
          ? {
              seed: Math.floor(Math.random() * 2 ** 31),
              difficulty: difficulty(),
              party,
            }
          : {
              seed: plan.seed,
              difficulty: questDifficultyFor(WEEKLY_DIFFICULTY),
              party,
              weekly: plan,
            },
      startAt: Date.now() + START_PAUSE_MS,
      inputs: [],
      times: [],
    });
    setNow(Date.now());
    setPhase("playing");
  };

  // ---------------------------------------------------------- together
  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    closeTried = -1;
    setRoomCode(code);
    setPhase("lobby");
    void syncQuestClock();
    unsubscribeRoom = subscribeQuestRoom(code, (next) =>
      untrack(() => onRoom(next)),
    );
  };

  const onRoom = (next: QuestRoom | null): void => {
    if (next === null) {
      setRoom(null);
      setRoomCode(undefined);
      if (phase() !== "result") {
        setPhase("pick");
        showErrorNotification("The Monster Quest room was closed");
      }
      return;
    }
    setRoom(next);
    if (next.status === "playing" && phase() === "lobby") {
      if (!roomParty(next).some((h) => h.uid === uid())) {
        showErrorNotification("That quest started without you");
        void leaveRoom();
        setPhase("pick");
        return;
      }
      setNow(questNow());
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
        await createQuestRoom({
          difficultyLabel: weekly() ? WEEKLY_DIFFICULTY : difficulty().label,
          cls: cls(),
          ...(weekly() ? { weekly: questWeek() } : {}),
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
      watchRoom(await joinQuestRoom(joinCode(), cls()));
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
    if (code !== undefined) await leaveQuestRoom(code).catch(() => undefined);
  };

  const reset = (): void => {
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
    void leaveRoom();
  });

  const lobbyPlayers = (): QuestRoom["players"][string][] =>
    Object.values(room()?.players ?? {}).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    );
  const onlineCount = (): number =>
    lobbyPlayers().filter((p) => p.online).length;
  const takenByOthers = (): Set<HeroClass | undefined> =>
    new Set(
      lobbyPlayers()
        .filter((p) => p.uid !== uid() && p.online)
        .map((p) => p.cls),
    );
  const myLobbyClass = (): HeroClass | undefined =>
    room()?.players[uid() ?? ""]?.cls;

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
                title="Monster Quest"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <Show
                when={mode() === "together"}
                fallback={
                  <GameSetupPrimaryAction
                    text="Start the quest!"
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
                  createLabel="Host a quest for friends"
                />
              </Show>
            }
          >
            <GameSetupSection title="How to play" accent>
              <ul class="grid gap-2 font-kid text-base text-text">
                <li>🔁 Heroes and monsters take turns.</li>
                <li>
                  ⌨️ On your turn, type a move&apos;s name (like
                  &ldquo;attack&rdquo;), then type its words - fast and no
                  mistakes = ⭐ critical hit! Clean turns in a row = 🔥 streak.
                </li>
                <li>
                  🛡️ When a monster attacks you, type the guard word quickly to
                  take less damage.
                </li>
                <li>🗺️ Vote for a land, then pick which boss to face.</li>
                <li>
                  🧰 Between fights: treasure, traps, fairies and a shop - and a
                  ⭐ level up after the first fight with a super move that
                  recharges!
                </li>
                <li>
                  💡 Every monster has a trick - read the tip when it appears!
                </li>
                <li>
                  💥 Use special moves one after another for a COMBO. Good
                  typing fills 🌟 Team Spirit - then everyone types together for
                  a TEAM ATTACK!
                </li>
                <li>👑 Win 2 battles, then beat the boss!</li>
                <li>
                  🪙 Earn coins for up to {MONSTER_QUEST_PAID_RUNS_PER_DAY}{" "}
                  quests a day - more typing means more coins.
                </li>
              </ul>
            </GameSetupSection>
            <GameSetupSection title="Pick your hero">
              <HeroPicker heroes={heroes} selected={cls()} onSelect={setCls} />
            </GameSetupSection>
            <GameSetupSection title="Who do you want to play with?">
              <SoloTogetherToggle
                mode={mode()}
                multiplayerUnlocked={props.multiplayerUnlocked === true}
                unlockHint={MULTIPLAYER_UNLOCK_HINT_GENERIC}
                onModeChange={setMode}
                soloLabel="me + helpers"
                togetherLabel={`friends (up to ${PARTY_SIZE})`}
              />
            </GameSetupSection>
            <GameSetupSection title="Which quest?">
              <WeeklyQuestCard
                week={questWeek()}
                selected={weekly()}
                onSelect={setWeekly}
              />
            </GameSetupSection>
            <Show when={!weekly()}>
              <GameSetupSection title="Words">
                <DifficultySegmented
                  options={QUEST_DIFFICULTIES}
                  selectedLabel={difficulty().label}
                  onSelect={(d) => setDifficulty(() => d)}
                />
              </GameSetupSection>
            </Show>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "lobby"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="Monster Quest"
                onClose={() => props.onClose()}
              />
            }
            footer={
              <div class="grid gap-2 font-kid">
                <Show
                  when={room()?.hostUid === uid()}
                  fallback={
                    <div class="text-center text-sub">
                      Waiting for the host to start…
                    </div>
                  }
                >
                  <GameSetupPrimaryAction
                    text="Start the quest!"
                    disabled={onlineCount() < 2}
                    onClick={() => {
                      const r = room();
                      if (r !== null) void startQuestRoom(r);
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
            }
          >
            <div class="grid gap-3 font-kid">
              <div class="text-center">
                <div class="text-sm font-bold tracking-widest text-sub uppercase">
                  Room code - tell your friends!
                </div>
                <div class="text-4xl font-bold tracking-[0.25em] text-main">
                  {roomCode()}
                </div>
                <div class="mt-2 text-sm text-sub">
                  {room()?.weekly !== undefined ? "🗓️ Weekly quest · " : ""}
                  {questDifficultyFor(room()?.difficultyLabel ?? "").label}{" "}
                  words · {lobbyPlayers().length}/{PARTY_SIZE} heroes · helpers
                  fill empty spots
                </div>
              </div>
              <For each={lobbyPlayers()}>
                {(player) => (
                  <div class="flex items-center gap-3 rounded-xl bg-sub-alt px-3 py-1.5">
                    <UserAvatar uid={player.uid} class="h-8 w-8" />
                    <span class="flex-1 truncate text-lg font-bold text-text">
                      {player.name}
                      {player.uid === room()?.hostUid ? " · host" : ""}
                    </span>
                    <Show when={player.cls}>
                      {(c) => (
                        <span class="flex items-center gap-1 text-text">
                          <img
                            src={HERO_ART[c()]}
                            alt=""
                            class="h-8 w-8 [image-rendering:pixelated]"
                          />
                          {CLASS_INFO[c()].name}
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
                <div class="mb-2 text-sm font-bold text-sub">Your hero</div>
                <HeroPicker
                  heroes={heroes}
                  selected={myLobbyClass() ?? cls()}
                  taken={takenByOthers()}
                  onSelect={(c) => {
                    setCls(c);
                    const code = roomCode();
                    if (code !== undefined) {
                      void setMyClass(code, c).catch(() => undefined);
                    }
                  }}
                />
              </div>
              <Show when={onlineCount() < 2}>
                <div class="text-center text-sub">
                  Waiting for friends to join… (need 2)
                </div>
              </Show>
              <InviteClassmates
                gameId={GAME_ID}
                code={roomCode()}
                show={room()?.hostUid === uid()}
              />
            </div>
          </GamePickLayout>
        </Show>

        <Show when={phase() === "playing" || phase() === "result"}>
          <Show when={setup()}>
            {(s) => (
              <Show when={state()}>
                {(st) => (
                  <QuestBattle
                    setup={s()}
                    state={st()}
                    myUid={myId()}
                    now={now()}
                    startAt={startAt()}
                    deadline={deadline()}
                    onHero={onHero}
                    onGuard={onGuard}
                    onVote={onVote}
                    onTyped={onTyped}
                    openVotes={liveVotes()}
                    onFinished={finish}
                  />
                )}
              </Show>
            )}
          </Show>
          <Show when={result()}>
            {(r) => (
              <GameResultOverlay
                result={r()}
                note={[weeklyNote(), claimNote(claim())]
                  .filter((n) => n !== undefined)
                  .join(" ")}
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

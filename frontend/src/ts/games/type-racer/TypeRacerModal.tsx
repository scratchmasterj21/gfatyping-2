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
import { showErrorNotification } from "../../states/notifications";
import { getSnapshot } from "../../states/snapshot";
import { cn } from "../../utils/cn";
import { DailyClassBoard } from "../components/DailyClassBoard";
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
import { InviteClassmates } from "../components/InviteClassmates";
import { MULTIPLAYER_UNLOCK_HINT_TYPE_RACER } from "../components/multiplayer-unlock-hints";
import { PracticeWords } from "../components/PracticeWords";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { WordListPicker } from "../components/WordListPicker";
import { sfx } from "../mini/mini-sounds";
import { actingHostUid } from "../shared/acting-host";
import { submitDailyBest } from "../shared/daily-board";
import { serverClockNow } from "../shared/server-clock";
import { createPickGuard, useGameLevel } from "../use-game-level";
import {
  getWordListOptions,
  WordListOption,
} from "../word-defender/systems/vocab-pool";
import { CarPreview } from "./CarPreview";
import {
  DAILY_DIFFICULTY,
  DAILY_SECONDS,
  dailyDay,
  getRaceWords,
  racePlan,
} from "./daily-race";
import { Garage } from "./Garage";
import {
  addGpPoints,
  botsFor,
  cpsFor,
  CPU_RACERS,
  cpuFinishSec,
  CpuId,
  cpuInfo,
  GP_CHAMPION_POINTS,
  GP_POINTS,
  gpOrder,
  GpTable,
  GRAND_PRIX,
  newUnlocks,
  nextDifficulty,
  placeName,
  placePoints,
  RACE_DIFFICULTIES,
  RaceDifficulty,
  raceStars,
  safeLook,
  Standing,
  tappySeconds,
  targetFor,
  trackForSeed,
  wonBig,
  TRACKS,
} from "./race-rules";
import {
  LiveStats,
  OtherRacer,
  RaceGame,
  RaceResult,
  RaceSetup,
} from "./RaceGame";
import { rankRacers } from "./racer-result";
import {
  claimGaragePoints,
  loadGhost,
  loadLook,
  offerGhost,
  saveLook,
} from "./racer-store";
import {
  createRacerRoom,
  finishRacerRoom,
  joinRacerRoom,
  leaveRacerRoom,
  RACER_REACTIONS,
  raceWords,
  RacerRoom,
  rematchRacerRoom,
  sendRacerReaction,
  SERIES_WINS,
  seriesOver,
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

type Kind = "race" | "gp" | "daily";
type Phase =
  | "pick"
  | "garage"
  | "loading"
  | "playing"
  | "between"
  | "lobby"
  | "online-results";

/** Solo races: these four line up with you. */
const SOLO_CPUS: CpuId[] = ["turtle", "fox", "tappy", "robot"];
const COUNTDOWN_MS = 3200;

/** Garage points, cached for the session (re-read after 5 min). */
let pointsCache: { points: number; at: number } | null = null;

export function TypeRacerModal(props: Props): JSXElement {
  const [selected, setSelected] = createSignal<WordListOption>(
    OPTIONS[0] as WordListOption,
  );
  const [difficulty, setDifficulty] = createSignal<RaceDifficulty>(
    RACE_DIFFICULTIES[0] as RaceDifficulty,
  );
  const lv = useGameLevel(() => props.open);
  createPickGuard(selected, setSelected, lv.listLock, () => OPTIONS);
  createPickGuard(
    difficulty,
    (d) => setDifficulty(() => d),
    lv.speedLock,
    () => RACE_DIFFICULTIES,
  );
  const [durationSec, setDurationSec] = createSignal<30 | 60>(60);
  const [kind, setKind] = createSignal<Kind>("race");
  const [phase, setPhase] = createSignal<Phase>("pick");
  const [mode, setMode] = createSignal<"solo" | "together">("solo");
  const [look, setLook] = createSignal(loadLook());
  const [points, setPoints] = createSignal(pointsCache?.points ?? 0);
  const [setup, setSetup] = createSignal<RaceSetup | null>(null);
  const [result, setResult] = createSignal<{
    view: GameResultView;
    standings: Standing[];
    practice: string[];
    note?: string;
    online: boolean;
  } | null>(null);
  // Grand Prix
  const [gpRace, setGpRace] = createSignal(0);
  const [gpTable, setGpTable] = createSignal<GpTable>({});
  const [gpLast, setGpLast] = createSignal<Standing[]>([]);
  // together
  const [roomCode, setRoomCode] = createSignal<string>();
  const [joinCode, setJoinCode] = createSignal("");
  const [room, setRoom] = createSignal<RacerRoom>();
  const [roomBusy, setRoomBusy] = createSignal(false);
  const [toast, setToast] = createSignal<string>();
  let unsubscribeRoom: (() => void) | undefined;
  let startedRound = 0;
  let finishSent = -1;
  let lastReactAt = 0;
  let seenReacts: Record<string, number> = {};
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const signedIn = (): boolean => getAuthenticatedUser() !== null;
  const myUid = (): string | undefined => getAuthenticatedUser()?.uid;
  const myName = (): string => getSnapshot()?.name ?? "You";
  const day = dailyDay();
  const plan = racePlan(day);

  const refreshPoints = async (): Promise<void> => {
    if (!signedIn()) return;
    if (pointsCache !== null && Date.now() - pointsCache.at < 5 * 60_000) {
      setPoints(pointsCache.points);
      return;
    }
    const p = await claimGaragePoints(0).catch(() => pointsCache?.points ?? 0);
    pointsCache = { points: p, at: Date.now() };
    setPoints(p);
  };
  const safe = createMemo(() => safeLook(look(), points()));

  // ------------------------------------------------------------ solo races
  const soloSetup = (
    words: string[],
    opts: {
      wpm: number;
      seconds: 30 | 60;
      track: RaceSetup["track"];
      seed: number;
      keepOrder: boolean;
      ghost: boolean;
    },
  ): RaceSetup => {
    const target = targetFor(opts.seconds);
    const cps = cpsFor(opts.wpm);
    const uid = myUid();
    return {
      words,
      target,
      seed: opts.seed,
      keepOrder: opts.keepOrder,
      track: opts.track,
      cpus: SOLO_CPUS,
      cps,
      raceSec: tappySeconds(target, cps),
      startAt: Date.now() + COUNTDOWN_MS,
      look: safe(),
      myName: myName(),
      ...(uid === undefined ? {} : { myUid: uid }),
      ghost: opts.ghost ? loadGhost(target) : null,
    };
  };

  const startRace = async (k: Kind = kind(), gpIndex = 0): Promise<void> => {
    setResult(null);
    setPhase("loading");
    setKind(k);
    const seed = Math.floor(Math.random() * 2 ** 31);
    if (k === "daily") {
      const words = await getRaceWords(plan);
      setSetup(
        soloSetup(words, {
          wpm: DAILY_DIFFICULTY.wpm,
          seconds: DAILY_SECONDS,
          track: plan.track,
          seed: plan.seed,
          keepOrder: true,
          ghost: false,
        }),
      );
    } else {
      const words = await selected().getWords();
      if (k === "gp" && gpIndex === 0) {
        setGpTable(
          Object.fromEntries([
            ["me", 0],
            ...SOLO_CPUS.map((id) => [id, 0]),
          ]) as GpTable,
        );
      }
      setGpRace(gpIndex);
      setSetup(
        soloSetup(words, {
          wpm: difficulty().wpm,
          seconds: durationSec(),
          track:
            k === "gp" ? (GRAND_PRIX[gpIndex] ?? "city") : trackForSeed(seed),
          seed,
          keepOrder: false,
          ghost: k === "race",
        }),
      );
    }
    setPhase("playing");
  };

  const awardPoints = async (n: number): Promise<string | undefined> => {
    if (!signedIn() || n <= 0) return undefined;
    const before = points();
    const after = await claimGaragePoints(n).catch(() => before);
    pointsCache = { points: after, at: Date.now() };
    setPoints(after);
    const opened = newUnlocks(before, after);
    return opened.length > 0
      ? `🔓 New in the garage: ${opened.map((g) => g.emoji ?? g.name).join(" ")}`
      : `🏁 +${after - before} garage point${after - before === 1 ? "" : "s"}`;
  };

  const onSoloEnd = async (r: RaceResult): Promise<void> => {
    const k = kind();
    props.onResult?.(r.wpm, r.words);
    const notes: string[] = [];
    if (k === "race" && r.ghost !== undefined && offerGhost(r.ghost)) {
      notes.push("👻 New personal best! Your ghost will race you next time.");
    }
    const harder = nextDifficulty(difficulty().label);
    if (k !== "daily" && harder !== undefined && wonBig(r.standings)) {
      notes.push(`😎 Too easy? Try ${harder}!`);
    }
    if (k === "daily" && r.wpm > 0 && signedIn()) {
      const best = await submitDailyBest("dailyRace", day, r.wpm).catch(
        () => false,
      );
      if (best) notes.push("🏆 A new best for your class today!");
    }
    if (k === "gp") {
      const table = addGpPoints(gpTable(), r.standings);
      setGpTable(table);
      setGpLast(r.standings);
      if (gpRace() < GRAND_PRIX.length - 1) {
        const pts = await awardPoints(placePoints(r.place));
        setResult({
          view: raceView(r),
          standings: r.standings,
          practice: r.report.hardest,
          ...(pts === undefined ? {} : { note: pts }),
          online: false,
        });
        setPhase("between");
        return;
      }
      const champ = gpOrder(table, r.standings)[0] === "me";
      if (champ) sfx.finish();
      const pts = await awardPoints(
        placePoints(r.place) + (champ ? GP_CHAMPION_POINTS : 0),
      );
      if (pts !== undefined) notes.push(pts);
      setResult({
        view: {
          ...raceView(r),
          headline: champ
            ? "🏆 Grand Prix champion!"
            : `Grand Prix: ${placeName(gpOrder(table, r.standings).indexOf("me") + 1)} overall`,
          stars: champ
            ? 3
            : raceStars(gpOrder(table, r.standings).indexOf("me") + 1, r.words),
        },
        standings: r.standings,
        practice: r.report.hardest,
        note: notes.join(" "),
        online: false,
      });
      setPhase("playing");
      return;
    }
    const pts = await awardPoints(placePoints(r.place));
    if (pts !== undefined) notes.push(pts);
    setResult({
      view: raceView(r),
      standings: r.standings,
      practice: r.report.hardest,
      note: notes.join(" "),
      online: false,
    });
  };

  const raceView = (r: RaceResult): GameResultView => ({
    headline:
      r.place === 1
        ? "1st place! 🏆"
        : r.place <= 3
          ? `${placeName(r.place)} place! 🎉`
          : r.finished
            ? `${placeName(r.place)} place - nice race!`
            : "Race over - keep practising!",
    score: r.wpm,
    scoreLabel: "words per minute",
    stars: raceStars(r.place, r.words),
    stats: [
      { label: "place", value: placeName(r.place) },
      { label: "accuracy", value: `${r.accuracy}%` },
      { label: "words typed", value: String(r.words) },
      { label: "best streak", value: `⚡ ${r.bestStreak}` },
    ],
  });

  // ------------------------------------------------------------ together
  const players = createMemo(() =>
    rankRacers(Object.values(room()?.players ?? {})),
  );
  const onlinePlayers = (): RacerRoom["players"][string][] =>
    players().filter((p) => p.online);

  const say = (text: string): void => {
    clearTimeout(toastTimer);
    setToast(text);
    toastTimer = setTimeout(() => setToast(undefined), 2200);
  };

  const onlineBots = (r: RacerRoom): { ids: CpuId[]; cps: number } => ({
    ids: botsFor(r.bots ?? 0),
    // bots reach the line a bit after the race length
    cps: r.targetChars / (r.durationSec * 1.3),
  });

  const startOnlineRace = (r: RacerRoom): void => {
    const uid = myUid();
    const bots = onlineBots(r);
    const fallbackStart = serverClockNow() + COUNTDOWN_MS;
    setResult(null);
    setSetup({
      words: raceWords(r),
      target: r.targetChars,
      seed: r.seed ?? 1,
      keepOrder: true,
      track: trackForSeed(r.seed ?? 0),
      cpus: bots.ids,
      cps: bots.cps,
      raceSec: r.durationSec,
      startAt: r.startAt ?? fallbackStart,
      look: safe(),
      myName: myName(),
      ...(uid === undefined ? {} : { myUid: uid }),
      ghost: null,
      others: (): OtherRacer[] =>
        Object.values(room()?.players ?? {})
          .filter((p) => p.uid !== myUid() && p.online)
          .map((p) => ({
            id: p.uid,
            name: p.name,
            progress: p.progress,
            avatarUid: p.uid,
            ...(p.completed === true && p.raceMs !== undefined
              ? { finishMs: p.raceMs }
              : {}),
          })),
      timeLimitMs: r.durationSec * 1500,
    });
    setPhase("playing");
  };

  const onLive = (s: LiveStats): void => {
    const code = roomCode();
    if (code !== undefined) {
      void updateRacerPlayer(code, s).catch(() => undefined);
    }
  };

  const onOnlineEnd = (r: RaceResult): void => {
    const code = roomCode();
    props.onResult?.(r.wpm, r.words);
    if (code !== undefined) {
      void updateRacerPlayer(code, {
        progress: r.finished
          ? 1
          : (r.standings.find((s) => s.me)?.progress ?? 0),
        wpm: r.wpm,
        accuracy: r.accuracy,
        finished: true,
        completed: r.finished,
        raceMs: r.elapsedMs,
      }).catch(() => undefined);
    }
    setResult({
      view: raceView(r),
      standings: r.standings,
      practice: r.report.hardest,
      note: "Waiting for the other racers…",
      online: true,
    });
  };

  /** Final online standings: players and the computer fillers. */
  const onlineStandings = createMemo(() => {
    const r = room();
    if (r === undefined) return [];
    const bots = onlineBots(r);
    const rows = [
      ...onlinePlayers().map((p) => ({
        id: p.uid,
        name: p.name,
        bot: false,
        wpm: p.wpm,
        accuracy: p.accuracy,
        progress: p.progress,
        finishMs: p.completed === true ? (p.raceMs ?? Infinity) : Infinity,
      })),
      ...bots.ids.map((id) => {
        const t =
          cpuFinishSec(id, bots.cps, r.targetChars, r.durationSec) * 1000;
        const limit = r.durationSec * 1500;
        return {
          id,
          name: `${cpuInfo(id).emoji} ${cpuInfo(id).name}`,
          bot: true,
          wpm: Math.round((bots.cps * 60) / 5),
          accuracy: 100,
          progress: t <= limit ? 1 : 0.9,
          finishMs: t <= limit ? t : Infinity,
        };
      }),
    ];
    return rows.sort(
      (a, b) => a.finishMs - b.finishMs || b.progress - a.progress,
    );
  });

  const disconnectRoom = async (): Promise<void> => {
    const code = roomCode();
    unsubscribeRoom?.();
    unsubscribeRoom = undefined;
    setRoom(undefined);
    setRoomCode(undefined);
    startedRound = 0;
    if (code !== undefined) await leaveRacerRoom(code).catch(() => undefined);
  };

  const watchRoom = (code: string): void => {
    unsubscribeRoom?.();
    setRoomCode(code);
    setPhase("lobby");
    startedRound = 0;
    seenReacts = {};
    unsubscribeRoom = subscribeRacerRoom(code, (next) => {
      if (next === null) {
        setRoom(undefined);
        setRoomCode(undefined);
        setSetup(null);
        setPhase("pick");
        showErrorNotification("The race room was closed");
        return;
      }
      setRoom(next);
      // reactions from others
      for (const p of Object.values(next.players ?? {})) {
        const at = p.react?.at ?? 0;
        if (p.react !== undefined && at > (seenReacts[p.uid] ?? 0)) {
          const fresh =
            seenReacts[p.uid] !== undefined || Date.now() - at < 3000;
          seenReacts[p.uid] = at;
          if (fresh && p.uid !== myUid()) say(`${p.name} ${p.react.e}`);
        } else {
          seenReacts[p.uid] ??= at;
        }
      }
      const round = next.round ?? 1;
      if (
        (next.status === "countdown" || next.status === "playing") &&
        startedRound !== round
      ) {
        startedRound = round;
        untrack(() => startOnlineRace(next));
      }
      if (next.status === "finished") {
        setSetup(null);
        setResult(null);
        setPhase("online-results");
      }
    });
  };

  // host closes the race once every online player is done
  createEffect(() => {
    const r = room();
    if (r?.status !== "countdown" && r?.status !== "playing") return;
    // the host - or the next player if the host has dropped out
    if (actingHostUid(r) !== myUid() || finishSent === (r.round ?? 1)) return;
    const online = Object.values(r.players ?? {}).filter((p) => p.online);
    if (online.length > 0 && online.every((p) => p.finished)) {
      finishSent = r.round ?? 1;
      const winner = rankRacers(online)[0]?.uid;
      void finishRacerRoom(r.code, winner, r.series).catch(() => {
        finishSent = -1;
      });
    }
  });

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

  const react = (e: string): void => {
    const code = roomCode();
    if (code === undefined || Date.now() - lastReactAt < 1500) return;
    lastReactAt = Date.now();
    say(`You ${e}`);
    void sendRacerReaction(code, e).catch(() => undefined);
  };

  // ------------------------------------------------------------ open/close
  const cleanup = (): void => {
    setSetup(null);
    setResult(null);
    setPhase("pick");
  };
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          setMode(
            props.initialMode === "together" &&
              props.multiplayerUnlocked === true
              ? "together"
              : "solo",
          );
          setLook(loadLook());
          void refreshPoints();
        } else {
          cleanup();
          void disconnectRoom();
        }
      },
    ),
  );
  onCleanup(() => {
    clearTimeout(toastTimer);
    void disconnectRoom();
  });

  const frameLayout = (): "pick" | "playing" | "compact" => {
    if (phase() === "playing" || phase() === "between") return "playing";
    if (phase() === "pick" || phase() === "garage") return "pick";
    return "compact";
  };

  const isHost = (): boolean => room()?.hostUid === myUid();

  const KIND_BUTTONS: {
    id: Kind;
    emoji: string;
    label: string;
    hint: string;
  }[] = [
    {
      id: "race",
      emoji: "🏎️",
      label: "Single race",
      hint: "race 4 racers + your ghost",
    },
    {
      id: "gp",
      emoji: "🏆",
      label: "Grand Prix",
      hint: `${GRAND_PRIX.length} races, most points wins`,
    },
    {
      id: "daily",
      emoji: "📅",
      label: "Daily race",
      hint: "same race for everyone today",
    },
  ];

  return (
    <Show when={props.open}>
      <GameModalFrame layout={frameLayout()} onClose={() => props.onClose()}>
        {/* ---------------------------------------------------- pick */}
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
                    text={
                      kind() === "gp"
                        ? "Start the Grand Prix"
                        : kind() === "daily"
                          ? "Start today's race"
                          : "Start race"
                    }
                    onClick={() => void startRace(kind(), 0)}
                  />
                }
              >
                <GameMultiplayerRoomFooter
                  gameId="type-racer"
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
                Type the big word to drive. Clean words fill 🔥 nitro - type the
                orange word for a boost! Type the long purple word at a ramp to
                jump. Three mistakes in a row and you spin out.
              </p>
            </GameSetupSection>

            <Show when={mode() === "solo"}>
              <div class="grid grid-cols-3 gap-2">
                <For each={KIND_BUTTONS}>
                  {(b) => (
                    <button
                      type="button"
                      class={cn(
                        "grid cursor-pointer place-items-center gap-0.5 rounded-xl border-2 p-2 text-center",
                        kind() === b.id
                          ? "border-main bg-main/15 text-text"
                          : "border-transparent bg-sub-alt text-sub",
                      )}
                      onClick={() => setKind(b.id)}
                    >
                      <span class="text-2xl">{b.emoji}</span>
                      <span class="text-sm font-bold">{b.label}</span>
                      <span class="text-xs">{b.hint}</span>
                    </button>
                  )}
                </For>
              </div>

              <Show when={kind() === "daily"}>
                <GameSetupSection title="📅 Today's race">
                  <div class="grid gap-2 text-sm text-sub">
                    <div>
                      {TRACKS[plan.track].emoji} {TRACKS[plan.track].name} ·{" "}
                      {plan.label} · Medium
                    </div>
                    <Show
                      when={signedIn()}
                      fallback={<div>Sign in to see the class board.</div>}
                    >
                      <DailyClassBoard
                        collection="dailyRace"
                        day={day}
                        unit="WPM"
                      />
                    </Show>
                  </div>
                </GameSetupSection>
              </Show>

              <Show when={kind() !== "daily"}>
                <GameSetupSection title="Choose difficulty">
                  <DifficultySegmented
                    options={RACE_DIFFICULTIES}
                    lockedReason={lv.speedLock}
                    selectedLabel={difficulty().label}
                    onSelect={(d) => setDifficulty(d)}
                  />
                </GameSetupSection>
              </Show>
              <Show when={kind() === "gp"}>
                <div class="text-sm text-sub">
                  {GRAND_PRIX.map(
                    (t) => `${TRACKS[t].emoji} ${TRACKS[t].name}`,
                  ).join(" → ")}
                  {" · "}points {GP_POINTS.join("/")}
                </div>
              </Show>
            </Show>

            <Show when={mode() === "together" || kind() !== "daily"}>
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
                        {seconds === 30
                          ? "Quick · short track"
                          : "Standard · long track"}
                      </button>
                    )}
                  </For>
                </div>
              </GameSetupSection>
            </Show>

            <button
              type="button"
              class="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-sub-alt p-2 text-left"
              onClick={() => setPhase("garage")}
            >
              <CarPreview look={safe()} class="w-20 text-2xl" />
              <span class="grid">
                <span class="font-bold text-text">🔧 Garage</span>
                <span class="text-sm text-sub">
                  {points()} points · pick your colour, sticker and driver
                </span>
              </span>
            </button>

            <GameSetupMore>
              <GameSetupSection title="Mode">
                <SoloTogetherToggle
                  mode={mode()}
                  soloLabel="Race the computer"
                  togetherLabel="Race classmates"
                  multiplayerUnlocked={props.multiplayerUnlocked === true}
                  unlockHint={MULTIPLAYER_UNLOCK_HINT_TYPE_RACER}
                  onModeChange={setMode}
                />
              </GameSetupSection>
              <Show when={mode() === "together" || kind() !== "daily"}>
                <GameSetupSection title="Choose a word list">
                  <WordListPicker
                    lockedReason={lv.listLock}
                    groups={GROUPS}
                    selectedId={selected().id}
                    onSelect={setSelected}
                  />
                </GameSetupSection>
              </Show>
            </GameSetupMore>
          </GamePickLayout>
        </Show>

        {/* ---------------------------------------------------- garage */}
        <Show when={phase() === "garage"}>
          <GamePickLayout
            header={
              <GameModalHeader
                title="🔧 Garage"
                onClose={() => setPhase("pick")}
              />
            }
            footer={
              <GameSetupPrimaryAction
                text="Done"
                showArrow={false}
                onClick={() => setPhase("pick")}
              />
            }
          >
            <Garage
              look={safe()}
              points={points()}
              signedIn={signedIn()}
              onChange={(l) => {
                setLook(l);
                saveLook(l);
              }}
            />
          </GamePickLayout>
        </Show>

        <Show when={phase() === "loading"}>
          <div class="flex items-center justify-center py-12 text-sub">
            Loading…
          </div>
        </Show>

        {/* ---------------------------------------------------- lobby */}
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
                {room()?.wordListLabel} ·{" "}
                {room()?.durationSec === 30 ? "short track" : "long track"}
                {onlinePlayers().length < 4
                  ? ` · computer racers fill ${4 - onlinePlayers().length} spot${4 - onlinePlayers().length === 1 ? "" : "s"}`
                  : ""}
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
            <InviteClassmates
              gameId="type-racer"
              code={roomCode()}
              show={isHost() && room()?.status !== "countdown"}
            />
            <Show
              when={isHost()}
              fallback={
                <div class="text-center text-sub">Waiting for host…</div>
              }
            >
              <GameSetupPrimaryAction
                text="Start race"
                disabled={onlinePlayers().length < 2}
                onClick={() => {
                  const code = roomCode();
                  if (code !== undefined) {
                    void startRacerRoom(code, onlinePlayers().length);
                  }
                }}
              />
            </Show>
          </div>
        </Show>

        {/* ---------------------------------------------------- racing */}
        <Show when={phase() === "playing" || phase() === "between"}>
          <Show when={setup()} keyed>
            {(s) => (
              <RaceGame
                setup={s}
                onEnd={(r) =>
                  s.others === undefined ? void onSoloEnd(r) : onOnlineEnd(r)
                }
                {...(s.others === undefined ? {} : { onLive })}
              />
            )}
          </Show>
          <Show when={roomCode() !== undefined}>
            <div class="absolute top-14 right-2 z-30 flex gap-1 sm:top-2 sm:right-16">
              <For each={RACER_REACTIONS}>
                {(e) => (
                  <button
                    type="button"
                    tabIndex={-1}
                    class="cursor-pointer rounded-full bg-game-ink/70 px-2 py-1 text-lg hover:bg-game-ink"
                    onPointerDown={(ev) => ev.preventDefault()}
                    onClick={() => react(e)}
                  >
                    {e}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={toast()}>
            {(t) => (
              <div class="pointer-events-none absolute top-24 left-1/2 z-30 -translate-x-1/2 animate-game-pop rounded-full bg-game-cream px-4 py-1 text-xl font-bold text-game-ink shadow">
                {t()}
              </div>
            )}
          </Show>
          {/* Grand Prix: standings between races */}
          <Show when={phase() === "between"}>
            <div class="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/90 p-4">
              <div class="grid w-full max-w-md gap-3 rounded-double bg-sub-alt p-4 text-text">
                <div class="text-center text-2xl font-bold">
                  Race {gpRace() + 1} of {GRAND_PRIX.length}:{" "}
                  {placeName(gpLast().findIndex((r) => r.me === true) + 1)}{" "}
                  place
                </div>
                <div class="text-center text-sm text-sub">
                  {result()?.note ?? ""}
                </div>
                <div class="grid gap-1">
                  <div class="text-sm font-bold text-sub">🏆 Points so far</div>
                  <For each={gpOrder(gpTable(), gpLast())}>
                    {(id, i) => (
                      <div
                        class={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-1",
                          id === "me" ? "bg-main text-bg" : "bg-bg",
                        )}
                      >
                        <span class="w-6 font-bold">{i() + 1}.</span>
                        <span class="flex-1">
                          {id === "me"
                            ? "You"
                            : `${cpuInfo(id as CpuId).emoji} ${cpuInfo(id as CpuId).name}`}
                        </span>
                        <span class="font-mono font-bold">
                          {gpTable()[id] ?? 0}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
                <GameSetupPrimaryAction
                  text={`Next: ${TRACKS[GRAND_PRIX[gpRace() + 1] ?? "city"].emoji} ${TRACKS[GRAND_PRIX[gpRace() + 1] ?? "city"].name}`}
                  onClick={() => void startRace("gp", gpRace() + 1)}
                />
              </div>
            </div>
          </Show>
          <Show when={phase() === "playing" ? result() : null}>
            {(r) => (
              <GameResultOverlay
                result={r().view}
                {...(r().online
                  ? {}
                  : {
                      onPlayAgain: () => void startRace(kind(), 0),
                      playAgainLabel:
                        kind() === "gp" ? "New Grand Prix" : "Race again",
                    })}
                {...(r().note === undefined || r().note === ""
                  ? {}
                  : { note: r().note })}
                onExit={() => props.onClose()}
                extra={
                  <div class="grid gap-2">
                    <Standings rows={r().standings} />
                    <PracticeWords words={r().practice} />
                  </div>
                }
              />
            )}
          </Show>
        </Show>

        {/* ---------------------------------------------------- online results */}
        <Show when={phase() === "online-results"}>
          <div class="grid gap-3 pt-12">
            <div class="text-center text-2xl font-bold text-main">
              Race {room()?.round ?? 1} complete!
            </div>
            <Show when={Object.keys(room()?.series ?? {}).length > 0}>
              <div class="text-center text-sm text-sub">
                Best of 3 (first to {SERIES_WINS}):{" "}
                {onlinePlayers()
                  .map((p) => `${p.name} ${room()?.series?.[p.uid] ?? 0}`)
                  .join(" · ")}
                <Show when={seriesOver(room()?.series)}>
                  {" "}
                  - 🏆{" "}
                  {
                    onlinePlayers().find(
                      (p) => (room()?.series?.[p.uid] ?? 0) >= SERIES_WINS,
                    )?.name
                  }{" "}
                  wins the series!
                </Show>
              </div>
            </Show>
            <For each={onlineStandings()}>
              {(row, index) => (
                <div
                  class={cn(
                    "flex items-center gap-3 rounded px-3 py-2",
                    row.id === myUid() ? "bg-main/20" : "bg-sub-alt",
                  )}
                >
                  <span class="w-6 font-bold text-main">{index() + 1}</span>
                  <Show when={!row.bot}>
                    <UserAvatar uid={row.id} class="h-9 w-9" />
                  </Show>
                  <span class="min-w-0 flex-1 truncate text-text">
                    {row.name}
                  </span>
                  <span class="text-right text-em-xs text-sub">
                    {row.wpm} WPM{row.bot ? "" : ` · ${row.accuracy}%`}
                  </span>
                </div>
              )}
            </For>
            <div class="flex justify-center gap-1">
              <For each={RACER_REACTIONS}>
                {(e) => (
                  <button
                    type="button"
                    class="cursor-pointer rounded-full bg-sub-alt px-2 py-1 text-lg"
                    onClick={() => react(e)}
                  >
                    {e}
                  </button>
                )}
              </For>
            </div>
            <Show when={toast()}>
              <div class="text-center text-lg font-bold text-text">
                {toast()}
              </div>
            </Show>
            <Show
              when={isHost()}
              fallback={
                <div class="text-center text-sub">
                  Waiting for the host to start a rematch…
                </div>
              }
            >
              <GameSetupPrimaryAction
                text={seriesOver(room()?.series) ? "New series" : "Rematch!"}
                disabled={onlinePlayers().length < 2}
                onClick={() => {
                  const r = room();
                  if (r !== undefined) void rematchRacerRoom(r);
                }}
              />
            </Show>
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

function Standings(props: { rows: Standing[] }): JSXElement {
  return (
    <div class="grid gap-1 text-left">
      <For each={props.rows}>
        {(r, i) => (
          <div
            class={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1 text-sm",
              r.me === true ? "bg-main text-bg" : "bg-sub-alt text-text",
            )}
          >
            <span class="w-8 font-bold">{placeName(i() + 1)}</span>
            <span class="flex-1 truncate">
              {r.me === true
                ? "You"
                : CPU_RACERS.some((c) => c.id === r.id)
                  ? `${cpuInfo(r.id as CpuId).emoji} ${r.name}`
                  : r.name}
            </span>
            <span class="font-mono text-xs">
              {r.finishMs !== undefined
                ? `${(r.finishMs / 1000).toFixed(1)}s`
                : `${Math.round(r.progress * 100)}%`}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

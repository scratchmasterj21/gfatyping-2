import {
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";

import { sfx } from "../mini/mini-sounds";
import { serverClockNow } from "../shared/server-clock";
import { TypingReport, TypingTracker } from "../shared/typing-report";
import {
  CarLook,
  cpuDistance,
  cpuFinishSec,
  CpuId,
  cpuInfo,
  FINAL_STRETCH,
  GameColor,
  garageItem,
  Ghost,
  ghostDistance,
  GHOST_STEP_MS,
  inPits,
  placeName,
  RaceRun,
  rankStandings,
  RunEvent,
  soloRaceOver,
  soloStandings,
  Standing,
  TrackId,
  TRACKS,
} from "./race-rules";
import { LaneCar, RaceTrack } from "./RaceTrack";
import { StripPopup, StripView, TypingStrip } from "./TypingStrip";

/** Someone else racing online. */
export type OtherRacer = {
  id: string;
  name: string;
  progress: number;
  finishMs?: number;
  avatarUid?: string;
};

export type RaceSetup = {
  words: string[];
  target: number;
  seed: number;
  /** everyone types the same words in order (online, daily) */
  keepOrder: boolean;
  track: TrackId;
  /** computer racers and their base speed */
  cpus: CpuId[];
  cps: number;
  raceSec: number;
  /** Date.now() when the race starts (the countdown runs before) */
  startAt: number;
  look: CarLook;
  myName: string;
  myUid?: string;
  ghost?: Ghost | null;
  /** online: the other players (live) and when my race stops */
  others?: () => OtherRacer[];
  timeLimitMs?: number;
};

export type RaceResult = {
  standings: Standing[];
  place: number;
  wpm: number;
  accuracy: number;
  words: number;
  bestStreak: number;
  elapsedMs: number;
  finished: boolean;
  /** my race, to keep as a ghost (only if I finished) */
  ghost?: Ghost;
  report: TypingReport;
};

export type LiveStats = {
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  completed: boolean;
  raceMs: number;
};

const OTHER_COLORS: GameColor[] = [
  "red",
  "green",
  "purple",
  "orange",
  "pink",
  "yellow",
  "mint",
  "brown",
];

const BANNER: Partial<Record<RunEvent["type"], string>> = {
  nitroReady: "🔥 NITRO ready - type the orange word!",
  boost: "🚀 NITRO BOOST!",
  ramp: "🛫 Ramp! Type the long word with no mistakes to jump!",
  jump: "🤸 BIG JUMP!",
  bump: "Bump! (a mistake on the ramp word)",
  pad: "⚡ Boost pad! Nitro +2",
  spin: "💫 Spin out! Slow down a little",
};

/** One race: the track on top, the typing strip below. */
export function RaceGame(props: {
  setup: RaceSetup;
  onEnd: (r: RaceResult) => void;
  onLive?: (s: LiveStats) => void;
}): JSXElement {
  // a new race gets a new component (keyed), so the setup never changes
  const s = untrack(() => props.setup);
  const run = new RaceRun({
    words: s.words,
    target: s.target,
    seed: s.seed,
    keepOrder: s.keepOrder,
  });
  const tracker = new TypingTracker();
  // online races share the database clock (the start time comes from the
  // host); a Chromebook with a wrong clock got a wrong countdown/time limit
  const clock = (): number =>
    s.others === undefined ? Date.now() : serverClockNow();
  const [now, setNow] = createSignal(clock());
  const [version, setVersion] = createSignal(0);
  const [value, setValue] = createSignal("");
  const [banner, setBanner] = createSignal<string>();
  const [popups, setPopups] = createSignal<StripPopup[]>([]);
  const [shake, setShake] = createSignal(0);
  const [slip, setSlip] = createSignal(0);
  const done: string[] = [];
  const samples: number[] = [];
  let ended = false;
  let finalShown = false;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTick = clock();
  let lastLive = 0;
  let popupId = 0;

  const elapsed = (): number => Math.max(0, now() - s.startAt);
  const racing = (): boolean => now() >= s.startAt && !ended;
  const countdown = (): number | null => {
    const left = s.startAt - now();
    if (left > 0) return Math.ceil(left / 1000);
    return left > -700 ? 0 : null;
  };

  const say = (text: string, ms = 1800): void => {
    clearTimeout(bannerTimer);
    setBanner(text);
    bannerTimer = setTimeout(() => setBanner(undefined), ms);
  };
  const pop = (text: string, tone: StripPopup["tone"]): void => {
    const id = ++popupId;
    setPopups((p) => [...p.slice(-4), { id, text, tone }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 900);
  };

  const cpuFinish = new Map(
    s.cpus.map((id) => [
      id,
      Math.round(cpuFinishSec(id, s.cps, s.target, s.raceSec) * 1000),
    ]),
  );
  const cpuD = (id: CpuId): number =>
    Math.min(s.target, cpuDistance(id, s.cps, elapsed() / 1000, s.raceSec));
  const othersNow = (): OtherRacer[] => s.others?.() ?? [];
  const otherDistances = (): number[] => [
    ...s.cpus.map(cpuD),
    ...othersNow().map((o) => o.progress * s.target),
  ];

  const myDistance = createMemo(() => {
    version();
    return run.distance(now());
  });

  const standingsNow = (): Standing[] => {
    const rows: Standing[] = [
      ...s.cpus.map((id) => ({
        id,
        name: cpuInfo(id).name,
        progress: cpuD(id) / s.target,
        ...(cpuD(id) >= s.target ? { finishMs: cpuFinish.get(id) ?? 0 } : {}),
      })),
      ...othersNow().map((o) => ({
        id: o.id,
        name: o.name,
        progress: o.progress,
        ...(o.finishMs === undefined ? {} : { finishMs: o.finishMs }),
      })),
      {
        id: "me",
        name: s.myName,
        me: true,
        progress: myDistance() / s.target,
        ...(run.finishedAt === undefined
          ? {}
          : { finishMs: run.finishedAt - s.startAt }),
      },
    ];
    return rankStandings(rows);
  };

  const myPlace = (): number =>
    standingsNow().findIndex((r) => r.me === true) + 1;

  const onInput = (raw: string): void => {
    if (!racing()) {
      setValue("");
      return;
    }
    const t = clock();
    const missesBefore = run.misses;
    const events = run.input(raw, t, otherDistances());
    for (let i = missesBefore; i < run.misses; i++) {
      tracker.miss();
      sfx.oops();
      setShake((n) => n + 1);
    }
    let cleared = false;
    for (const e of events) {
      if (e.type === "word") {
        cleared = true;
        done.push(e.word);
        if (done.length > 4) done.shift();
        tracker.word(e.word, e.clean ? 0 : 1);
        sfx.good();
        pop(
          e.slip ? "+1 💨" : e.clean ? "+1" : "+1",
          e.slip ? "boost" : "good",
        );
        if (e.slip) {
          setSlip(t);
          if (run.words % 3 === 1) say("💨 Slipstream! Extra speed", 1200);
        }
      } else if (e.type === "finish") {
        sfx.finish();
      } else {
        const text = BANNER[e.type];
        if (text !== undefined) say(text);
        if (e.type === "boost" || e.type === "jump") sfx.great();
        if (e.type === "spin" || e.type === "bump") sfx.bad();
        if (e.type === "nitroReady" || e.type === "pad") sfx.pop();
        if (e.type === "boost") pop("🚀 BOOST", "boost");
        if (e.type === "spin") pop("💫", "bad");
      }
    }
    setValue(cleared ? "" : raw);
    setVersion((v) => v + 1);
  };

  const view = createMemo((): StripView => {
    version();
    return {
      queue: [...run.queue],
      done: [...done],
      typed: run.typed,
      good: run.good,
      nitro: run.nitro,
      streak: run.streak,
      wpm: run.wpm(elapsed()),
    };
  });

  const end = (): void => {
    if (ended) return;
    ended = true;
    const t = clock();
    const elapsedMs = Math.max(1, (run.finishedAt ?? t) - s.startAt);
    const finished = run.finishedAt !== undefined;
    const standings =
      s.others === undefined
        ? soloStandings({
            cpus: s.cpus,
            cps: s.cps,
            target: s.target,
            raceSec: s.raceSec,
            endMs: t - s.startAt,
            myName: s.myName,
            myDistance: run.distance(t),
            ...(finished ? { myFinishMs: elapsedMs } : {}),
          })
        : standingsNow();
    const place = standings.findIndex((r) => r.me === true) + 1;
    props.onEnd({
      standings,
      place,
      wpm: run.wpm(elapsedMs),
      accuracy: run.accuracy(),
      words: run.words,
      bestStreak: run.bestStreak,
      elapsedMs,
      finished,
      ...(finished
        ? {
            ghost: {
              finishMs: elapsedMs,
              target: s.target,
              d: [...samples, s.target].map((d) => Math.round(d * 10) / 10),
            },
          }
        : {}),
      report: tracker.report(),
    });
  };

  onMount(() => {
    let raf = 0;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = (): void => {
      const t = clock();
      setNow(t);
      if (t >= s.startAt && !ended) {
        tracker.tick(Math.min(250, t - lastTick));
        const el = t - s.startAt;
        while (
          samples.length * GHOST_STEP_MS <= el &&
          run.finishedAt === undefined
        ) {
          samples.push(run.distance(t));
        }
        if (!finalShown && myDistance() / s.target >= FINAL_STRETCH) {
          finalShown = true;
          say("🏁 Final stretch!", 1500);
        }
        if (props.onLive !== undefined && t - lastLive > 250) {
          lastLive = t;
          props.onLive({
            progress: run.distance(t) / s.target,
            wpm: run.wpm(el),
            accuracy: run.accuracy(),
            finished: false,
            completed: false,
            raceMs: el,
          });
        }
        const over =
          s.others === undefined
            ? soloRaceOver({
                cpus: s.cpus,
                cps: s.cps,
                target: s.target,
                raceSec: s.raceSec,
                elapsedMs: el,
                myFinished: run.finishedAt !== undefined,
              })
            : run.finishedAt !== undefined || el >= (s.timeLimitMs ?? Infinity);
        if (over && endTimer === undefined) {
          if (run.finishedAt !== undefined) {
            say(`🏁 You finished ${placeName(myPlace())}!`, 2000);
          } else {
            say("🏁 Race over!", 2000);
          }
          endTimer = setTimeout(end, 1400);
        }
      }
      lastTick = t;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      clearTimeout(endTimer);
      // closed during the finish banner: still report the race (score,
      // coins, daily board, garage) instead of dropping it with the timer
      if (endTimer !== undefined) end();
      clearTimeout(bannerTimer);
    });
  });

  const myLook = (): {
    color: GameColor;
    sticker?: string;
    driver?: string;
  } => {
    const color = garageItem(s.look.color)?.color ?? "blue";
    const sticker = garageItem(s.look.sticker)?.emoji;
    const driver = garageItem(s.look.driver)?.emoji;
    return {
      color,
      ...(sticker === undefined ? {} : { sticker }),
      ...(driver === undefined ? {} : { driver }),
    };
  };

  const cars = createMemo((): LaneCar[] => {
    const t = now();
    const order = standingsNow();
    const placeOf = (id: string): number | undefined => {
      const i = order.findIndex((r) => r.id === id);
      const row = order[i];
      return row?.finishMs !== undefined ? i + 1 : undefined;
    };
    const list: LaneCar[] = s.cpus.map((id) => {
      const info = cpuInfo(id);
      const place = placeOf(id);
      return {
        id,
        name: info.name,
        color: info.color,
        driver: info.emoji,
        progress: cpuD(id) / s.target,
        pits: inPits(id, elapsed() / 1000, s.raceSec),
        ...(place === undefined ? {} : { place }),
      };
    });
    othersNow().forEach((o, i) => {
      const place = placeOf(o.id);
      list.push({
        id: o.id,
        name: o.name,
        color: OTHER_COLORS[i % OTHER_COLORS.length] ?? "red",
        progress: o.progress,
        ...(o.avatarUid === undefined ? {} : { avatarUid: o.avatarUid }),
        ...(place === undefined ? {} : { place }),
      });
    });
    const myPlaceDone = placeOf("me");
    const me: LaneCar = {
      id: "me",
      name: s.myName,
      me: true,
      ...myLook(),
      progress: myDistance() / s.target,
      boosting: run.boosting(t),
      airborne: run.airborne(t),
      spinning: run.spinning(t),
      slip: t - slip() < 600,
      ...(s.myUid === undefined ? {} : { avatarUid: s.myUid }),
      ...(myPlaceDone === undefined ? {} : { place: myPlaceDone }),
    };
    // me in the middle lane
    list.splice(Math.floor(list.length / 2), 0, me);
    return list;
  });

  const ghostP = (): number | undefined =>
    s.ghost === null || s.ghost === undefined || s.ghost.target !== s.target
      ? undefined
      : ghostDistance(s.ghost, elapsed()) / s.target;

  return (
    <div class="flex h-full w-full flex-col overflow-hidden bg-game-night font-kid text-game-cream">
      <div class="relative min-h-0 flex-1">
        <RaceTrack
          cars={cars()}
          {...(ghostP() === undefined ? {} : { ghost: ghostP() })}
          track={s.track}
          countdown={countdown()}
          {...(banner() === undefined ? {} : { banner: banner() })}
        />
        {/* standings + track name */}
        <div class="pointer-events-none absolute top-2 left-20 z-20 hidden gap-0.5 rounded-xl bg-game-ink/70 px-2 py-1 text-xs sm:grid">
          <div class="font-bold text-game-yellow">
            {TRACKS[s.track].emoji} {TRACKS[s.track].name}
          </div>
          <For each={standingsNow().slice(0, 8)}>
            {(r, i) => (
              <div
                class={
                  r.me === true
                    ? "font-bold text-game-yellow"
                    : "text-game-cream"
                }
              >
                {i() + 1}. {r.me === true ? "You" : r.name}
              </div>
            )}
          </For>
        </div>
        <Show when={racing()}>
          <div class="pointer-events-none absolute top-2 right-44 z-20 hidden rounded-full bg-game-ink/70 px-3 py-1 text-sm font-bold sm:block">
            📍 {placeName(myPlace())}
          </div>
        </Show>
      </div>
      <TypingStrip
        view={view()}
        value={value()}
        onInput={onInput}
        waiting={!racing()}
        popups={popups()}
        shakeKey={shake()}
        place={racing() ? placeName(myPlace()) : ""}
      />
    </div>
  );
}

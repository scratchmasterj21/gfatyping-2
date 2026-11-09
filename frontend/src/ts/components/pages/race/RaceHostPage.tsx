import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { isCurrentUserAdmin } from "../../../auth";
import {
  listReadingPassages,
  listWordLists,
  ReadingPassage,
  WordList,
} from "../../../classroom/assignments";
import { CLASS_IDS } from "../../../constants/classes";
import { Confetti } from "../../../games/mini/Confetti";
import { lessonGroups } from "../../../lessons/lessons-data";
import { queryClient } from "../../../queries";
import {
  addPoints,
  BLITZ_REVEAL_MS,
  BLITZ_ROUND_MS,
  BlitzAnswer,
  BlitzState,
  pickBlitzWords,
  rankAnswers,
  roundPoints,
} from "../../../race/blitz";
import {
  CHAMP_ROUNDS,
  Championship,
  ChampRoundPlan,
  pickRoundWords,
  previousRanks,
  rankChampionship,
  scoreRound,
} from "../../../race/championship";
import {
  createRace,
  deleteRace,
  finishRace,
  getRace,
  RaceContentSource,
  resetAllParticipants,
  resolveRaceTokens,
  restartRace,
  saveHistory,
  setRaceRunning,
  standingCoins,
  standingTotals,
  startRace,
  subscribeParticipants,
  subscribeRace,
  withTeams,
  clearBlitz,
  subscribeBlitzAnswers,
  writeBlitzScores,
  writeBlitzState,
  writeTugTotals,
  ChampionRecord,
  crownChampion,
  listChampions,
  setChampionship,
} from "../../../race/race-db";
import {
  isTimedFormat,
  Race,
  RaceFormat,
  RaceParticipant,
  RaceStanding,
  rankParticipants,
  TugTeam,
} from "../../../race/race-types";
import {
  assignTeams,
  ropeOffset,
  teamTotals,
  TugTotals,
  tugOutcome,
  tugWinMargin,
} from "../../../race/tug";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { Mascot } from "../../common/Mascot";
import { Page } from "../../common/Page";
import { CertificateButtons } from "./CertificateButtons";
import {
  contentProblem,
  contentSource,
  defaultRounds,
  RoundDraft,
} from "./champ-setup";
import { ChampionReveal } from "./ChampionReveal";
import { ChampionshipBoard } from "./ChampionshipBoard";
import { ChampionshipSetup } from "./ChampionshipSetup";
import { HallOfChampions } from "./HallOfChampions";

const COUNTDOWN_MS = 4000;
const HOST_STORAGE_KEY = "gfa_hosted_race";

const selectClass =
  "w-full max-w-md rounded-xl bg-bg px-3 py-2 font-kid text-base text-text outline-none focus:outline-2 focus:outline-main";
const inputClass =
  "w-full rounded-xl bg-bg px-3 py-2 font-kid text-text outline-none focus:outline-2 focus:outline-main";

type ContentKind = "random" | "custom" | "lesson" | "wordlist" | "passage";

function Avatar(props: { url?: string }): JSXElement {
  return (
    <Show
      when={props.url !== undefined && props.url !== ""}
      fallback={
        <div class="flex aspect-square w-7 shrink-0 items-center justify-center rounded-full bg-bg text-sub">
          <Fa icon="fa-user" />
        </div>
      }
    >
      <img
        src={props.url}
        alt=""
        class="aspect-square w-7 shrink-0 rounded-full object-cover"
      />
    </Show>
  );
}

const FORMATS: {
  value: RaceFormat;
  icon: string;
  title: string;
  hint: string;
}[] = [
  {
    value: "finish",
    icon: "🏁",
    title: "First to finish",
    hint: "Fastest to type it all wins",
  },
  {
    value: "accuracy",
    icon: "🎯",
    title: "Accuracy race",
    hint: "Fewest mistakes wins",
  },
  {
    value: "timed",
    icon: "⏱️",
    title: "Timed sprint",
    hint: "Most words before time's up",
  },
  {
    value: "tug",
    icon: "🪢",
    title: "Tug of War",
    hint: "Two teams pull with every word",
  },
  {
    value: "blitz",
    icon: "⚡",
    title: "Word Blitz",
    hint: "10 words - fastest typer scores",
  },
];

/** Durations offered per timed format. */
const DURATIONS: Partial<Record<RaceFormat, number[]>> = {
  timed: [15, 30, 60],
  tug: [30, 60, 90],
};

const CONTENT_KINDS: { value: ContentKind; label: string }[] = [
  { value: "random", label: "🎲 Random words" },
  { value: "lesson", label: "📘 Lesson" },
  { value: "wordlist", label: "📝 Word list" },
  { value: "passage", label: "📖 Reading passage" },
  { value: "custom", label: "✏️ Custom text" },
];

/** Rounded choice pill used for durations, word counts and content kinds. */
function ChoicePill(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSXElement {
  return (
    <button
      type="button"
      class={cn(
        "press-3d rounded-full px-4 py-2 font-kid text-base font-bold",
        props.active ? "bg-main text-bg" : "bg-bg text-text hover:bg-sub/20",
      )}
      aria-pressed={props.active}
      onClick={() => props.onClick()}
    >
      {props.label}
    </button>
  );
}

function RaceSetupFields(props: {
  format: RaceFormat;
  onFormat: (v: RaceFormat) => void;
  duration: number;
  onDuration: (v: number) => void;
  kind: ContentKind;
  onKind: (v: ContentKind) => void;
  count: number;
  onCount: (v: number) => void;
  custom: string;
  onCustom: (v: string) => void;
  lessonId: string;
  onLessonId: (v: string) => void;
  wordListId: string;
  onWordListId: (v: string) => void;
  wordLists: WordList[];
  passageId: string;
  onPassageId: (v: string) => void;
  passages: ReadingPassage[];
}): JSXElement {
  return (
    <div class="grid gap-5 font-kid">
      <div class="grid gap-2">
        <div class="text-sm font-bold tracking-wide text-sub uppercase">
          Race type
        </div>
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <For each={FORMATS}>
            {(f) => (
              <button
                type="button"
                class={cn(
                  "press-3d grid justify-items-center gap-1 rounded-double p-4 text-center",
                  props.format === f.value
                    ? "bg-main text-bg"
                    : "bg-bg text-text hover:bg-sub/20",
                )}
                aria-pressed={props.format === f.value}
                onClick={() => {
                  props.onFormat(f.value);
                  const options = DURATIONS[f.value];
                  if (
                    options !== undefined &&
                    !options.includes(props.duration)
                  ) {
                    props.onDuration(options[1] ?? options[0] ?? 30);
                  }
                }}
              >
                <span class="text-4xl" aria-hidden="true">
                  {f.icon}
                </span>
                <span class="text-lg font-bold">{f.title}</span>
                <span
                  class={cn(
                    "text-sm",
                    props.format === f.value ? "text-bg/80" : "text-sub",
                  )}
                >
                  {f.hint}
                </span>
              </button>
            )}
          </For>
        </div>
        <Show when={isTimedFormat(props.format)}>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sub">How long?</span>
            <For each={DURATIONS[props.format] ?? []}>
              {(sec) => (
                <ChoicePill
                  active={props.duration === sec}
                  label={`${sec} seconds`}
                  onClick={() => props.onDuration(sec)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="grid gap-2">
        <div class="text-sm font-bold tracking-wide text-sub uppercase">
          What to type
        </div>
        <div class="flex flex-wrap gap-2">
          <For each={CONTENT_KINDS}>
            {(k) => (
              <ChoicePill
                active={props.kind === k.value}
                label={k.label}
                onClick={() => props.onKind(k.value)}
              />
            )}
          </For>
        </div>
        <Show when={props.kind === "random"}>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sub">How many words?</span>
            <For each={[10, 20, 30, 50]}>
              {(n) => (
                <ChoicePill
                  active={props.count === n}
                  label={String(n)}
                  onClick={() => props.onCount(n)}
                />
              )}
            </For>
          </div>
        </Show>
        <Show when={props.kind === "lesson"}>
          <select
            class={selectClass}
            value={props.lessonId}
            onChange={(e) => props.onLessonId(e.currentTarget.value)}
          >
            <For each={lessonGroups}>
              {(group) => (
                <optgroup label={group.name}>
                  <For each={group.lessons}>
                    {(l) => <option value={l.id}>{l.name}</option>}
                  </For>
                </optgroup>
              )}
            </For>
          </select>
        </Show>
        <Show when={props.kind === "wordlist"}>
          <select
            class={selectClass}
            value={props.wordListId}
            onChange={(e) => props.onWordListId(e.currentTarget.value)}
          >
            <option value="">Choose a word list…</option>
            <For each={props.wordLists}>
              {(wl) => <option value={wl.id}>{wl.title}</option>}
            </For>
          </select>
        </Show>
        <Show when={props.kind === "passage"}>
          <select
            class={selectClass}
            value={props.passageId}
            onChange={(e) => props.onPassageId(e.currentTarget.value)}
          >
            <option value="">Choose a passage…</option>
            <For each={props.passages}>
              {(p) => <option value={p.id}>{p.title}</option>}
            </For>
          </select>
        </Show>
        <Show when={props.kind === "custom"}>
          <textarea
            class={cn(inputClass, "min-h-24 resize-y")}
            placeholder="Paste the passage students will race on…"
            value={props.custom}
            onInput={(e) => props.onCustom(e.currentTarget.value)}
          ></textarea>
        </Show>
      </div>
    </div>
  );
}

const LANE_COLORS = ["blue", "pink", "green", "yellow", "purple", "orange"].map(
  (c) => `var(--color-game-${c})`,
);

/** The race PIN as big keycaps for the projector. */
function PinTiles(props: { pin: string }): JSXElement {
  return (
    <div class="flex justify-center gap-2" aria-label={`Race PIN ${props.pin}`}>
      <For each={[...props.pin]}>
        {(digit) => (
          <span class="flex h-16 w-12 items-center justify-center rounded-xl bg-game-cream font-kid text-4xl font-bold text-game-ink shadow-[0_6px_0_rgb(43_33_64/0.35)] sm:h-20 sm:w-16 sm:text-5xl">
            {digit}
          </span>
        )}
      </For>
    </div>
  );
}

/** One student's lane: their avatar rides a kart toward the finish flag. */
function RaceLane(props: {
  name: string;
  avatarUrl?: string;
  pct: number;
  label: string;
  place: number;
  finished: boolean;
}): JSXElement {
  const color = (): string =>
    LANE_COLORS[(props.place - 1) % LANE_COLORS.length] ??
    "var(--color-game-blue)";
  return (
    <div class="grid grid-cols-[2rem_minmax(0,9rem)_1fr] items-center gap-2 font-kid sm:grid-cols-[2.5rem_minmax(0,11rem)_1fr]">
      <span class="text-center text-xl font-bold text-main">{props.place}</span>
      <span class="truncate text-base font-bold text-text">{props.name}</span>
      <div class="relative h-12 rounded-full bg-[#5b6378]">
        <div class="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-game-cream/50"></div>
        <div
          class="absolute top-0 right-2 flex h-full items-center text-xl"
          aria-hidden="true"
        >
          🏁
        </div>
        <div
          class="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center transition-[left] duration-300 ease-out"
          style={{
            left: `calc(1.75rem + (100% - 4.5rem) * ${props.pct / 100})`,
          }}
        >
          <span
            class="flex h-10 items-center gap-1 rounded-full py-1 pr-2 pl-1 shadow"
            style={{ "background-color": color() }}
          >
            <Avatar url={props.avatarUrl} />
            <span class="text-xs font-bold whitespace-nowrap text-game-ink">
              {props.finished ? "🏆 " : ""}
              {props.label}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Top three on podium steps (gold in the middle). */
function RacePodium(props: {
  top: RaceStanding[];
  metric: (s: RaceStanding) => string;
}): JSXElement {
  const order = (): RaceStanding[] =>
    [2, 1, 3].flatMap((rank) =>
      props.top.filter((s) => s.rank === rank).slice(0, 1),
    );
  const step = (rank: number): { h: string; color: string; medal: string } =>
    rank === 1
      ? { h: "h-36", color: "bg-game-gold", medal: "🥇" }
      : rank === 2
        ? { h: "h-28", color: "bg-game-grey", medal: "🥈" }
        : { h: "h-20", color: "bg-game-orange", medal: "🥉" };
  return (
    <div class="flex items-end justify-center gap-3 font-kid">
      <For each={order()}>
        {(s) => (
          <div class="flex w-28 animate-game-pop flex-col items-center gap-1 motion-reduce:animate-none sm:w-36">
            <span class="text-3xl" aria-hidden="true">
              {step(s.rank).medal}
            </span>
            <div class="scale-150">
              <Avatar url={s.avatarUrl} />
            </div>
            <span class="mt-2 max-w-full truncate text-base font-bold text-text">
              {s.name}
            </span>
            <span class="text-sm font-bold text-sub">{props.metric(s)}</span>
            <div
              class={cn(
                "flex w-full items-start justify-center rounded-t-xl pt-2 text-3xl font-bold text-game-ink",
                step(s.rank).h,
                step(s.rank).color,
              )}
            >
              {s.rank}
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

const TEAM_STYLE: Record<
  TugTeam,
  { label: string; emoji: string; bg: string; text: string }
> = {
  red: {
    label: "Red team",
    emoji: "🔴",
    bg: "bg-game-red",
    text: "text-game-red",
  },
  blue: {
    label: "Blue team",
    emoji: "🔵",
    bg: "bg-game-blue",
    text: "text-game-blue",
  },
};

/** Avatars of one team, shown on its side of the rope. */
function TeamRoster(props: {
  team: TugTeam;
  players: RaceParticipant[];
  align: "start" | "end";
}): JSXElement {
  return (
    <div
      class={cn(
        "flex flex-wrap gap-1.5",
        props.align === "end" ? "justify-end" : "justify-start",
      )}
    >
      <For each={props.players}>
        {(p) => (
          <span
            class={cn(
              "flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs font-bold text-game-cream",
              TEAM_STYLE[props.team].bg,
            )}
          >
            <Avatar url={p.avatarUrl} />
            <span class="max-w-20 truncate">{p.name}</span>
          </span>
        )}
      </For>
    </div>
  );
}

/**
 * The projector's tug of war: a rope with a flag that slides toward the
 * leading team; reaching a team's line wins it for them.
 */
function TugArena(props: {
  totals: TugTotals;
  offset: number;
  red: RaceParticipant[];
  blue: RaceParticipant[];
}): JSXElement {
  // flag position: 50% centre, ±40% at each team's win line
  const flagLeft = (): string => `${50 + props.offset * 40}%`;
  return (
    <div class="grid gap-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="grid gap-1">
          <div class="text-3xl font-bold text-game-red">
            🔴 {props.totals.red}
          </div>
          <div class="text-sm text-sub">words pulled</div>
        </div>
        <div class="grid justify-items-end gap-1 text-right">
          <div class="text-3xl font-bold text-game-blue">
            {props.totals.blue} 🔵
          </div>
          <div class="text-sm text-sub">words pulled</div>
        </div>
      </div>
      <div class="relative h-40 overflow-hidden rounded-double bg-game-grass">
        <div class="absolute inset-y-0 left-0 w-[10%] bg-game-red/25"></div>
        <div class="absolute inset-y-0 right-0 w-[10%] bg-game-blue/25"></div>
        <div class="absolute inset-y-3 left-[10%] w-1.5 rounded-full bg-game-red"></div>
        <div class="absolute inset-y-3 right-[10%] w-1.5 rounded-full bg-game-blue"></div>
        <div class="absolute inset-y-3 left-1/2 w-1 -translate-x-1/2 rounded-full bg-game-cream/70"></div>
        <div class="absolute inset-x-2 top-1/2 h-3 -translate-y-1/2 rounded-full bg-game-tan shadow-[0_3px_0_var(--color-game-brown)]"></div>
        <div
          class="absolute top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-[left] duration-700 ease-out motion-reduce:transition-none"
          style={{ left: flagLeft() }}
        >
          <span class="rounded-md bg-game-yellow px-2 py-0.5 text-sm font-bold text-game-ink shadow">
            🚩
          </span>
          <span class="h-6 w-1 bg-game-ink/70"></span>
        </div>
        <div class="absolute bottom-2 left-3 text-sm font-bold text-game-red">
          RED
        </div>
        <div class="absolute right-3 bottom-2 text-sm font-bold text-game-blue">
          BLUE
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <TeamRoster team="red" players={props.red} align="start" />
        <TeamRoster team="blue" players={props.blue} align="end" />
      </div>
    </div>
  );
}

/** The projector's quiz-show round: the word, who's answered, the leaders. */
function BlitzStage(props: {
  state: BlitzState | null;
  rounds: number;
  secondsLeft: number;
  answers: { uid: string; name: string; avatarUrl?: string }[];
  leaders: { uid: string; name: string; avatarUrl?: string; points: number }[];
  playerCount: number;
  onNext: () => void;
}): JSXElement {
  return (
    <div class="grid gap-4 lg:grid-cols-[1fr_16rem]">
      <div class="grid gap-4">
        <Show
          when={props.state}
          fallback={
            <div class="py-16 text-center text-2xl font-bold text-sub">
              Getting the first word ready…
            </div>
          }
        >
          {(st) => (
            <>
              <div class="flex items-center justify-between text-lg font-bold">
                <span class="rounded-full bg-game-purple px-4 py-1 text-game-cream">
                  Word {st().round} of {props.rounds}
                </span>
                <Show when={st().phase === "live"}>
                  <span
                    class={cn(
                      "rounded-full px-4 py-1 tabular-nums",
                      props.secondsLeft <= 5
                        ? "bg-game-red text-game-cream"
                        : "bg-game-cream text-game-ink",
                    )}
                  >
                    ⏱ {props.secondsLeft}s
                  </span>
                </Show>
              </div>
              <Show when={`${st().round}:${st().phase}`} keyed>
                {(_key) => (
                  <div class="grid animate-game-pop justify-items-center gap-2 rounded-double bg-game-night px-6 py-10 text-center motion-reduce:animate-none">
                    <Show
                      when={st().phase === "reveal"}
                      fallback={
                        <>
                          <div class="text-lg font-bold text-game-cream/80">
                            Type this word!
                          </div>
                          <div class="font-mono text-7xl font-bold tracking-wide text-game-yellow [text-shadow:0_6px_0_rgb(0_0_0/0.3)] sm:text-8xl">
                            {st().word}
                          </div>
                        </>
                      }
                    >
                      <div class="font-mono text-4xl font-bold text-game-cream/70">
                        {st().word}
                      </div>
                      <div class="text-4xl font-bold text-game-yellow sm:text-5xl">
                        {st().winnerName !== undefined
                          ? `⚡ ${st().winnerName} was fastest!`
                          : "⏰ Nobody got it this time"}
                      </div>
                    </Show>
                  </div>
                )}
              </Show>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-base font-bold text-sub">
                  ✅ {props.answers.length} / {props.playerCount} got it
                </span>
                <For each={props.answers.slice(0, 8)}>
                  {(a, i) => (
                    <span
                      class={cn(
                        "flex animate-game-pop items-center gap-1 rounded-full py-0.5 pr-3 pl-0.5 text-sm font-bold motion-reduce:animate-none",
                        i() === 0
                          ? "bg-game-gold text-game-ink"
                          : "bg-bg text-text",
                      )}
                    >
                      <Avatar url={a.avatarUrl} />
                      {i() === 0 ? "⚡ " : ""}
                      {a.name}
                    </span>
                  )}
                </For>
              </div>
              <div>
                <Button
                  chunky
                  size="lg"
                  text={st().phase === "live" ? "Show answer" : "Next word"}
                  fa={{ icon: "fa-forward" }}
                  onClick={() => props.onNext()}
                />
              </div>
            </>
          )}
        </Show>
      </div>
      <div class="grid content-start gap-2 rounded-double bg-bg p-4">
        <div class="text-lg font-bold text-text">🏆 Leaders</div>
        <For
          each={props.leaders.slice(0, 6)}
          fallback={<div class="text-sm text-sub">No points yet</div>}
        >
          {(l, i) => (
            <div class="flex items-center gap-2 text-base">
              <span class="w-5 text-center font-bold text-main">{i() + 1}</span>
              <Avatar url={l.avatarUrl} />
              <span class="min-w-0 flex-1 truncate font-bold text-text">
                {l.name}
              </span>
              <span class="font-bold text-text tabular-nums">{l.points}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export function RaceHostPage(): JSXElement {
  const [hostedPin, setHostedPinSignal] = createSignal<string | null>(null);
  const [race, setRace] = createSignal<Race | null>(null);
  const [participants, setParticipants] = createSignal<RaceParticipant[]>([]);

  /** Persist which race is being hosted, so a page refresh mid-race can resume
   * controlling it instead of losing it (see the reconnect onMount below). */
  const setHostedPin = (pin: string | null): void => {
    setHostedPinSignal(pin);
    if (pin === null) {
      localStorage.removeItem(HOST_STORAGE_KEY);
    } else {
      localStorage.setItem(HOST_STORAGE_KEY, pin);
    }
  };

  onMount(() => {
    if (!isCurrentUserAdmin()) return;
    const savedPin = localStorage.getItem(HOST_STORAGE_KEY);
    if (savedPin === null) return;
    void (async () => {
      const r = await getRace(savedPin);
      if (r === null) {
        localStorage.removeItem(HOST_STORAGE_KEY);
        return;
      }
      setHostedPinSignal(savedPin);
    })();
  });

  // create-form state
  const [format, setFormat] = createSignal<RaceFormat>("finish");
  const [kind, setKind] = createSignal<ContentKind>("random");
  const [count, setCount] = createSignal(20);
  const [custom, setCustom] = createSignal("");
  const [lessonId, setLessonId] = createSignal(
    lessonGroups[0]?.lessons[0]?.id ?? "",
  );
  const [wordListId, setWordListId] = createSignal("");
  const [passageId, setPassageId] = createSignal("");
  const [duration, setDuration] = createSignal(30);
  const [classId, setClassId] = createSignal("none");
  const [busy, setBusy] = createSignal(false);
  // Class Championship setup
  const [mode, setMode] = createSignal<"race" | "championship">("race");
  const [champRounds, setChampRounds] =
    createSignal<RoundDraft[]>(defaultRounds());
  const [sameWords, setSameWords] = createSignal(false);

  let saved = false;
  let runTimer: ReturnType<typeof setTimeout> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let disconnectPoll: ReturnType<typeof setInterval> | null = null;

  const clearTimers = (): void => {
    if (runTimer !== null) clearTimeout(runTimer);
    if (finishTimer !== null) clearTimeout(finishTimer);
    if (disconnectPoll !== null) clearInterval(disconnectPoll);
    runTimer = null;
    finishTimer = null;
    disconnectPoll = null;
  };
  onCleanup(clearTimers);

  const wordListsQuery = useQuery(() => ({
    queryKey: ["race", "wordlists"],
    queryFn: listWordLists,
    enabled: isCurrentUserAdmin(),
  }));
  const wordLists = createMemo<WordList[]>(() => wordListsQuery.data ?? []);

  const passagesQuery = useQuery(() => ({
    queryKey: ["race", "passages"],
    queryFn: listReadingPassages,
    enabled: isCurrentUserAdmin(),
  }));
  const passages = createMemo<ReadingPassage[]>(() => passagesQuery.data ?? []);

  // realtime subscription to the hosted race
  createEffect(() => {
    const pin = hostedPin();
    setRace(null);
    setParticipants([]);
    if (pin === null) return;
    const u1 = subscribeRace(pin, (r) => {
      setRace(r);
      // Deleted elsewhere (or never existed) - stop trying to host it.
      if (r === null) setHostedPin(null);
    });
    const u2 = subscribeParticipants(pin, setParticipants);
    onCleanup(() => {
      u1();
      u2();
    });
  });

  const endRace = async (): Promise<void> => {
    const pin = hostedPin();
    if (pin === null) return;
    clearTimers();
    await finishRace(pin);
  };

  // Reactively (re)schedule the countdown->running and timed-race auto-end
  // transitions from the race doc's absolute timestamps, instead of a fixed
  // in-memory setTimeout. That way, if the host's page refreshes mid-countdown
  // or mid-race, remounting recomputes the remaining time from the document
  // and reschedules correctly, rather than leaving the race stuck forever.
  createEffect(() => {
    const pin = hostedPin();
    const r = race();
    if (runTimer !== null) {
      clearTimeout(runTimer);
      runTimer = null;
    }
    if (finishTimer !== null) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
    if (pin === null || r === null) return;

    if (r.status === "countdown" && r.startAt !== undefined) {
      const remaining = r.startAt - Date.now();
      if (remaining <= 0) {
        void setRaceRunning(pin);
      } else {
        runTimer = setTimeout(() => void setRaceRunning(pin), remaining);
      }
    }

    if (
      r.status === "running" &&
      isTimedFormat(r.format) &&
      r.durationSec !== undefined &&
      r.runningAt !== undefined
    ) {
      const remaining = r.runningAt + r.durationSec * 1000 + 1500 - Date.now();
      if (remaining <= 0) {
        void endRace();
      } else {
        finishTimer = setTimeout(() => void endRace(), remaining);
      }
    }
  });

  const DISCONNECT_MS = 10_000;
  const isConnected = (p: RaceParticipant): boolean =>
    p.finished || (p.lastSeen ?? 0) > Date.now() - DISCONNECT_MS;

  const checkAutoFinish = (): void => {
    const r = race();
    if (r === null || r.status !== "running") return;
    if (r.format !== "finish" && r.format !== "accuracy") return;
    const connected = participants().filter(isConnected);
    if (connected.length > 0 && connected.every((p) => p.finished)) {
      void endRace();
    }
  };

  // auto-finish a "finish"/"accuracy" race when everyone is done or
  // disconnected. Re-checked on a timer too (not just on new participant
  // writes), so a straggler silently disconnecting doesn't leave the race
  // stuck in "running" forever; persist history once when finished.
  createEffect(() => {
    checkAutoFinish();

    const r = race();
    if (disconnectPoll !== null) {
      clearInterval(disconnectPoll);
      disconnectPoll = null;
    }
    if (
      r !== null &&
      r.status === "running" &&
      (r.format === "finish" || r.format === "accuracy")
    ) {
      disconnectPoll = setInterval(checkAutoFinish, 3000);
    }

    if (r !== null && r.status === "finished" && !saved) {
      saved = true;
      void saveHistory(r, participants());
    }
  });

  const buildSource = (): RaceContentSource => {
    switch (kind()) {
      case "random":
        return { type: "random", count: count() };
      case "custom":
        return { type: "custom", text: custom() };
      case "lesson":
        return { type: "lesson", lessonId: lessonId() };
      case "wordlist":
        return { type: "wordlist", wordListId: wordListId() };
      case "passage":
        return { type: "passage", passageId: passageId() };
    }
  };

  const create = async (): Promise<void> => {
    if (kind() === "wordlist" && wordListId() === "") {
      showErrorNotification("Pick a word list");
      return;
    }
    if (kind() === "passage" && passageId() === "") {
      showErrorNotification("Pick a reading passage");
      return;
    }
    setBusy(true);
    try {
      const { tokens, label } = await resolveRaceTokens(buildSource());
      if (tokens.length === 0) {
        showErrorNotification("That content produced no words");
        return;
      }
      const pin = await createRace({
        format: format(),
        tokens,
        contentLabel: label,
        durationSec: duration(),
        classId: classId() === "none" ? undefined : classId(),
      });
      saved = false;
      setHostedPin(pin);
    } catch (e) {
      showErrorNotification("Failed to create race", { error: e });
    } finally {
      setBusy(false);
    }
  };

  // ---- Class Championship ----
  const champ = (): Championship | undefined => race()?.championship;
  const champRows = createMemo(() => rankChampionship(champ()?.scores ?? {}));
  const champPrevious = createMemo(() => previousRanks(champ()?.scores ?? {}));
  const champScored = (): boolean => {
    const c = champ();
    return c !== undefined && c.scoredRounds > c.current;
  };
  const champLastRound = (): boolean => {
    const c = champ();
    return c !== undefined && c.current + 1 >= c.rounds.length;
  };

  const championsQuery = useQuery(() => ({
    queryKey: ["champions", classId()],
    queryFn: async () => listChampions(classId()),
    enabled: isCurrentUserAdmin() && classId() !== "none",
    staleTime: 5 * 60 * 1000,
  }));

  /** The rounds the teacher picked, with each round's words. */
  const champPlans = (): ChampRoundPlan[] | undefined => {
    const drafts = champRounds().filter((r) => r.enabled);
    const first = drafts[0];
    if (first === undefined) return undefined;
    for (const [i, d] of drafts.entries()) {
      const content = sameWords() ? first.content : d.content;
      if (i > 0 && sameWords()) continue;
      const problem = contentProblem(content);
      if (problem !== undefined) {
        showErrorNotification(
          `${CHAMP_ROUNDS[d.kind].title} round: ${problem}`,
        );
        return undefined;
      }
    }
    return drafts.map((d) => {
      const content = sameWords() ? first.content : d.content;
      return {
        kind: d.kind,
        source: contentSource(content),
        // random words already come in the chosen count
        ...(content.kind !== "random" && content.limit > 0
          ? { limit: content.limit }
          : {}),
        ...(d.kind === "speed" ? { durationSec: d.durationSec } : {}),
      };
    });
  };

  const roundTokens = async (
    plan: ChampRoundPlan,
  ): Promise<{ tokens: string[]; label: string }> => {
    const resolved = await resolveRaceTokens(plan.source);
    if (resolved.tokens.length === 0) {
      throw new Error("That content produced no words");
    }
    const keepOrder = plan.source.type === "passage";
    const tokens =
      plan.source.type === "random"
        ? resolved.tokens
        : pickRoundWords(resolved.tokens, plan.limit, keepOrder);
    const label =
      plan.limit !== undefined && resolved.tokens.length > plan.limit
        ? `${resolved.label} (${tokens.length} words)`
        : resolved.label;
    return {
      tokens,
      label: `${CHAMP_ROUNDS[plan.kind].emoji} ${CHAMP_ROUNDS[plan.kind].title} · ${label}`,
    };
  };

  const createChampionship = async (): Promise<void> => {
    if (classId() === "none") {
      showErrorNotification("Pick the class for the championship");
      return;
    }
    const plans = champPlans();
    const first = plans?.[0];
    if (plans === undefined || first === undefined) return;
    setBusy(true);
    try {
      const { tokens, label } = await roundTokens(first);
      const pin = await createRace({
        format: CHAMP_ROUNDS[first.kind].format,
        tokens,
        contentLabel: label,
        durationSec: first.durationSec,
        classId: classId(),
      });
      await setChampionship(pin, {
        classId: classId(),
        rounds: plans,
        current: 0,
        scoredRounds: 0,
        scores: {},
      });
      saved = false;
      setHostedPin(pin);
    } catch (e) {
      showErrorNotification("Failed to create championship", { error: e });
    } finally {
      setBusy(false);
    }
  };

  // Add each finished round to the points table (once). A short wait lets
  // the last students' final results land first.
  let scoringTimer: ReturnType<typeof setTimeout> | null = null;
  onCleanup(() => {
    if (scoringTimer !== null) clearTimeout(scoringTimer);
  });
  createEffect(() => {
    const pin = hostedPin();
    const r = race();
    const c = r?.championship;
    if (
      pin === null ||
      r === null ||
      c === undefined ||
      r.status !== "finished" ||
      c.scoredRounds > c.current ||
      scoringTimer !== null
    ) {
      return;
    }
    scoringTimer = setTimeout(() => {
      scoringTimer = null;
      const latest = race();
      const lc = latest?.championship;
      if (latest === null || lc === undefined || lc.scoredRounds > lc.current) {
        return;
      }
      const roundStandings = rankParticipants(participants(), latest.format);
      void setChampionship(pin, {
        ...lc,
        scores: scoreRound(lc.scores, roundStandings, latest.format),
        scoredRounds: lc.current + 1,
      }).catch((e: unknown) =>
        showErrorNotification("Failed to add up points", { error: e }),
      );
    }, 2500);
  });

  const nextChampRound = async (): Promise<void> => {
    const pin = hostedPin();
    const r = race();
    const c = r?.championship;
    if (pin === null || r === null || c === undefined) return;
    const plan = c.rounds[c.current + 1];
    if (plan === undefined) return;
    setBusy(true);
    try {
      const { tokens, label } = await roundTokens(plan);
      clearTimers();
      const uids = participants().map((p) => p.uid);
      await setChampionship(pin, { ...c, current: c.current + 1 });
      await restartRace(pin, {
        round: r.round + 1,
        format: CHAMP_ROUNDS[plan.kind].format,
        tokens,
        contentLabel: label,
        durationSec: plan.durationSec,
      });
      await resetAllParticipants(pin, uids);
      saved = false;
    } catch (e) {
      showErrorNotification("Failed to start the next round", { error: e });
    } finally {
      setBusy(false);
    }
  };

  // the record from this session's crowning, for the certificate buttons
  const [crowned, setCrowned] = createSignal<ChampionRecord | null>(null);

  const crown = async (): Promise<void> => {
    const pin = hostedPin();
    const c = champ();
    if (pin === null || c === undefined || c.crowned === true || busy()) {
      return;
    }
    setBusy(true);
    try {
      const record = await crownChampion(
        c.classId,
        champRows(),
        c.rounds.length,
      );
      setCrowned(record);
      await setChampionship(pin, { ...c, crowned: true });
      void queryClient.invalidateQueries({ queryKey: ["champions"] });
      if (record !== null) {
        showSuccessNotification(`👑 ${record.name} is the Class Champion!`);
      }
    } catch (e) {
      showErrorNotification("Failed to crown the champion", { error: e });
    } finally {
      setBusy(false);
    }
  };

  // The countdown->running transition and (for timed races) the auto-end
  // are both scheduled reactively from the race doc by the effect above, so
  // this just needs to write the countdown's start time.
  const start = async (): Promise<void> => {
    const pin = hostedPin();
    const r = race();
    if (pin === null || r === null) return;
    const teams =
      r.format === "tug"
        ? assignTeams(participants().map((p) => p.uid))
        : undefined;
    if (r.format === "blitz") {
      resetBlitz();
      await clearBlitz(pin);
    }
    await startRace(pin, COUNTDOWN_MS, teams);
  };

  const close = async (): Promise<void> => {
    const pin = hostedPin();
    if (pin === null) return;
    try {
      await deleteRace(pin);
    } catch (e) {
      showErrorNotification("Failed to close race", { error: e });
    }
    clearTimers();
    saved = false;
    setHostedPin(null);
  };

  const raceAgain = async (): Promise<void> => {
    const pin = hostedPin();
    const r = race();
    if (pin === null || r === null) return;
    if (kind() === "wordlist" && wordListId() === "") {
      showErrorNotification("Pick a word list");
      return;
    }
    if (kind() === "passage" && passageId() === "") {
      showErrorNotification("Pick a reading passage");
      return;
    }
    setBusy(true);
    try {
      const { tokens, label } = await resolveRaceTokens(buildSource());
      if (tokens.length === 0) {
        showErrorNotification("That content produced no words");
        return;
      }
      clearTimers();
      const uids = participants().map((p) => p.uid);
      await restartRace(pin, {
        round: r.round + 1,
        format: format(),
        tokens,
        contentLabel: label,
        durationSec: duration(),
      });
      // Authoritatively reset everyone, including anyone who disconnected
      // last round and won't reset their own doc on the round change.
      await resetAllParticipants(pin, uids);
      saved = false;
    } catch (e) {
      showErrorNotification("Failed to restart race", { error: e });
    } finally {
      setBusy(false);
    }
  };

  // ticking clock for the big countdown and the timed-race timer
  const [now, setNow] = createSignal(Date.now());
  createEffect(() => {
    const st = race()?.status;
    if (st !== "countdown" && st !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    onCleanup(() => clearInterval(t));
  });
  const countdownLeft = (): number => {
    const at = race()?.startAt;
    return at === undefined ? 0 : Math.max(0, Math.ceil((at - now()) / 1000));
  };
  const timeLeft = (): number | null => {
    const r = race();
    if (!isTimedFormat(r?.format) || r?.runningAt === undefined) return null;
    const end = r.runningAt + (r.durationSec ?? 0) * 1000;
    return Math.max(0, Math.ceil((end - now()) / 1000));
  };
  const joinUrl = (): string => `${window.location.host}/race`;
  const metric = (s: RaceStanding): string =>
    race()?.format === "blitz"
      ? `${s.words ?? 0} points`
      : race()?.format === "accuracy"
        ? `${Math.round(s.finalAcc)}% · ${Math.round(s.finalWpm)} wpm`
        : `${Math.round(s.finalWpm)} wpm · ${Math.round(s.finalAcc)}%`;

  // ---- Word Blitz (host runs the rounds) ----
  const isBlitz = (): boolean => race()?.format === "blitz";
  const blitzWords = createMemo(() => pickBlitzWords(race()?.tokens ?? []));
  const [blitzState, setBlitzState] = createSignal<BlitzState | null>(null);
  const [blitzAnswers, setBlitzAnswers] = createSignal<Record<
    string,
    BlitzAnswer
  > | null>(null);
  const [blitzTotals, setBlitzTotals] = createSignal<Record<string, number>>(
    {},
  );
  let blitzUnsub: (() => void) | null = null;
  let blitzTimer: ReturnType<typeof setTimeout> | null = null;
  let blitzStarted = false;
  const stopBlitzRound = (): void => {
    blitzUnsub?.();
    blitzUnsub = null;
    if (blitzTimer !== null) clearTimeout(blitzTimer);
    blitzTimer = null;
  };
  const resetBlitz = (): void => {
    stopBlitzRound();
    blitzStarted = false;
    setBlitzState(null);
    setBlitzAnswers(null);
    setBlitzTotals({});
  };
  onCleanup(stopBlitzRound);

  const beginBlitzRound = (round: number): void => {
    const pin = hostedPin();
    const word = blitzWords()[round - 1];
    if (pin === null || word === undefined) return;
    stopBlitzRound();
    setBlitzAnswers(null);
    const state: BlitzState = {
      round,
      word,
      phase: "live",
      startedAt: Date.now(),
    };
    setBlitzState(state);
    void writeBlitzState(pin, state);
    blitzUnsub = subscribeBlitzAnswers(pin, round, setBlitzAnswers);
    blitzTimer = setTimeout(() => revealBlitzRound(), BLITZ_ROUND_MS);
  };

  const revealBlitzRound = (): void => {
    const pin = hostedPin();
    const st = blitzState();
    if (pin === null || st === null || st.phase !== "live") return;
    const answers = blitzAnswers();
    stopBlitzRound();
    setBlitzTotals((t) => addPoints(t, roundPoints(answers)));
    const winner = rankAnswers(answers)[0];
    const winnerName =
      winner === undefined
        ? undefined
        : (participants().find((p) => p.uid === winner.uid)?.name ??
          winner.answer.name);
    const revealed: BlitzState = {
      ...st,
      phase: "reveal",
      ...(winner !== undefined ? { winnerUid: winner.uid } : {}),
      ...(winnerName !== undefined ? { winnerName } : {}),
    };
    setBlitzState(revealed);
    void writeBlitzState(pin, revealed);
    blitzTimer = setTimeout(() => blitzNext(), BLITZ_REVEAL_MS);
  };

  const finishBlitz = async (): Promise<void> => {
    const pin = hostedPin();
    if (pin === null) return;
    stopBlitzRound();
    await writeBlitzScores(
      pin,
      blitzTotals(),
      participants().map((p) => p.uid),
    );
    await endRace();
  };

  /** Teacher's button: reveal a live round early, or go to the next word. */
  const blitzNext = (): void => {
    const st = blitzState();
    if (st === null) return;
    if (st.phase === "live") {
      revealBlitzRound();
      return;
    }
    if (blitzTimer !== null) clearTimeout(blitzTimer);
    blitzTimer = null;
    if (st.round >= blitzWords().length) {
      void finishBlitz();
    } else {
      beginBlitzRound(st.round + 1);
    }
  };

  // Start round 1 when the race goes live.
  createEffect(() => {
    if (!isBlitz() || race()?.status !== "running" || blitzStarted) return;
    blitzStarted = true;
    beginBlitzRound(1);
  });
  // Close the round early once everyone has answered.
  createEffect(() => {
    const st = blitzState();
    const count = Object.keys(blitzAnswers() ?? {}).length;
    if (
      st?.phase === "live" &&
      participants().length > 0 &&
      count >= participants().length
    ) {
      if (blitzTimer !== null) clearTimeout(blitzTimer);
      blitzTimer = setTimeout(() => revealBlitzRound(), 800);
    }
  });
  const blitzSecondsLeft = (): number => {
    const st = blitzState();
    if (st?.phase !== "live") return 0;
    return Math.max(
      0,
      Math.ceil((st.startedAt + BLITZ_ROUND_MS - now()) / 1000),
    );
  };
  const personOf = (
    uid: string,
    fallbackName?: string,
  ): { uid: string; name: string; avatarUrl?: string } => {
    const p = participants().find((x) => x.uid === uid);
    return {
      uid,
      name: p?.name ?? fallbackName ?? "Student",
      ...(p?.avatarUrl !== undefined ? { avatarUrl: p.avatarUrl } : {}),
    };
  };
  const blitzAnswerList = createMemo(() =>
    rankAnswers(blitzAnswers()).map((a) => personOf(a.uid, a.answer.name)),
  );
  const blitzLeaders = createMemo(() =>
    Object.entries(blitzTotals())
      .map(([uid, points]) => ({ ...personOf(uid), points }))
      .sort((a, b) => b.points - a.points),
  );

  const maxWpm = (): number =>
    Math.max(
      1,
      ...participants().map((p) =>
        p.finished ? (p.finalWpm ?? 0) : (p.liveWpm ?? 0),
      ),
    );
  const barPct = (p: RaceParticipant): number => {
    const r = race();
    if (isTimedFormat(r?.format)) {
      const wpm = p.finished ? (p.finalWpm ?? 0) : (p.liveWpm ?? 0);
      return Math.min(100, (wpm / maxWpm()) * 100);
    }
    return Math.min(100, p.progress * 100);
  };
  const wpmLabel = (p: RaceParticipant): string => {
    if (p.finished) return `done · ${Math.round(p.finalWpm ?? 0)} wpm`;
    if (p.liveWpm !== undefined) return `${p.liveWpm} wpm`;
    return "";
  };
  const liveSorted = createMemo((): RaceParticipant[] => {
    const fmt = race()?.format ?? "finish";
    return [...participants()].sort((a, b) =>
      isTimedFormat(fmt) ? b.wordIndex - a.wordIndex : b.progress - a.progress,
    );
  });
  const standings = createMemo(() =>
    rankParticipants(participants(), race()?.format ?? "finish"),
  );

  // ---- Tug of War ----
  const isTug = (): boolean => race()?.format === "tug";
  const tugTotals = createMemo(
    (): TugTotals => teamTotals(participants(), race()?.teams),
  );
  const tugMargin = (): number =>
    tugWinMargin(Object.keys(race()?.teams ?? {}).length);
  const teamPlayers = (team: TugTeam): RaceParticipant[] =>
    participants().filter((p) => race()?.teams?.[p.uid] === team);
  // Publish the totals for students' screens (once a second) and end the
  // game early when a team drags the flag over its line.
  createEffect(() => {
    const pin = hostedPin();
    if (pin === null || !isTug() || race()?.status !== "running") return;
    let last = "";
    const t = setInterval(() => {
      const totals = tugTotals();
      const key = `${totals.red}:${totals.blue}`;
      if (key !== last) {
        last = key;
        void writeTugTotals(pin, totals);
      }
      if (Math.abs(totals.red - totals.blue) >= tugMargin()) {
        clearInterval(t);
        void endRace();
      }
    }, 1000);
    onCleanup(() => clearInterval(t));
  });
  const tugStandings = createMemo(() => withTeams(standings(), race()?.teams));
  const tugFinalTotals = createMemo(() => standingTotals(tugStandings()));
  // championship rounds pay nothing per round - coins come at the crowning
  const coinsFor = (st: RaceStanding): number =>
    champ() !== undefined
      ? 0
      : standingCoins(st, race()?.format, tugStandings());
  const tugWinner = (): TugTeam | null => {
    const o = tugOutcome(tugFinalTotals());
    return o === "draw" ? null : o;
  };

  const setupFields = (): JSXElement => (
    <RaceSetupFields
      format={format()}
      onFormat={setFormat}
      duration={duration()}
      onDuration={setDuration}
      kind={kind()}
      onKind={setKind}
      count={count()}
      onCount={setCount}
      custom={custom()}
      onCustom={setCustom}
      lessonId={lessonId()}
      onLessonId={setLessonId}
      wordListId={wordListId()}
      onWordListId={setWordListId}
      wordLists={wordLists()}
      passageId={passageId()}
      onPassageId={setPassageId}
      passages={passages()}
    />
  );

  return (
    <Page id="racehost">
      <Show
        when={isCurrentUserAdmin()}
        fallback={
          <div class="content-grid p-8 text-center text-sub">
            <Fa icon="fa-lock" class="mr-2" />
            This page is for teachers only.
          </div>
        }
      >
        <div class="content-grid grid gap-6 py-6 font-kid">
          {/* CREATE FORM */}
          <Show when={hostedPin() === null}>
            <div class="mx-auto grid w-full max-w-3xl gap-6 rounded-double bg-sub-alt p-6">
              <div class="flex items-center gap-4">
                <Mascot mood="cheer" size={72} />
                <div>
                  <h2 class="text-3xl font-bold text-text">
                    Host a class race
                  </h2>
                  <p class="text-sub">
                    Pick a race, show the PIN on the big screen, and let the
                    class join.
                  </p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <For
                  each={
                    [
                      ["race", "🏁 Class race", "One race, any format"],
                      [
                        "championship",
                        "🏆 Class Championship",
                        "Several rounds - crown the class champion",
                      ],
                    ] as const
                  }
                >
                  {([value, title, hint]) => (
                    <button
                      type="button"
                      class={cn(
                        "press-3d grid justify-items-center gap-1 rounded-double p-4 text-center",
                        mode() === value
                          ? "bg-main text-bg"
                          : "bg-bg text-text hover:bg-sub/20",
                      )}
                      aria-pressed={mode() === value}
                      onClick={() => setMode(value)}
                    >
                      <span class="text-xl font-bold">{title}</span>
                      <span
                        class={cn(
                          "text-sm",
                          mode() === value ? "text-bg/80" : "text-sub",
                        )}
                      >
                        {hint}
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <Show when={mode() === "championship"} fallback={setupFields()}>
                <ChampionshipSetup
                  rounds={champRounds()}
                  onRounds={setChampRounds}
                  sameWords={sameWords()}
                  onSameWords={setSameWords}
                  wordLists={wordLists()}
                  passages={passages()}
                />
              </Show>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold tracking-wide text-sub uppercase">
                  Class
                </span>
                <select
                  class={cn(selectClass, "w-auto")}
                  value={classId()}
                  onChange={(e) => setClassId(e.currentTarget.value)}
                >
                  <option value="none">
                    {mode() === "championship" ? "Pick a class…" : "Any class"}
                  </option>
                  <For each={CLASS_IDS}>
                    {(c) => <option value={c}>{c}</option>}
                  </For>
                </select>
              </div>
              <div>
                <Button
                  chunky
                  size="lg"
                  active
                  text={
                    busy()
                      ? "Creating…"
                      : mode() === "championship"
                        ? "Create championship"
                        : "Create race"
                  }
                  fa={{
                    icon:
                      mode() === "championship"
                        ? "fa-trophy"
                        : "fa-flag-checkered",
                  }}
                  onClick={() =>
                    void (mode() === "championship"
                      ? createChampionship()
                      : create())
                  }
                  disabled={busy()}
                />
              </div>
              <Show when={classId() !== "none"}>
                <HallOfChampions
                  classId={classId()}
                  champions={championsQuery.data ?? []}
                />
              </Show>
            </div>
          </Show>

          {/* CONTROL PANEL (projector view) */}
          <Show when={hostedPin() !== null}>
            <div class="mx-auto grid w-full max-w-5xl gap-5">
              <Show when={champ()}>
                {(c) => (
                  <div class="flex flex-wrap items-center justify-center gap-2 rounded-double bg-game-gold px-4 py-2 text-center text-lg font-bold text-game-ink">
                    🏆 {c().classId} Class Championship · Round{" "}
                    {Math.min(c().current + 1, c().rounds.length)} of{" "}
                    {c().rounds.length}:
                    <span>
                      {
                        CHAMP_ROUNDS[c().rounds[c().current]?.kind ?? "speed"]
                          .emoji
                      }{" "}
                      {
                        CHAMP_ROUNDS[c().rounds[c().current]?.kind ?? "speed"]
                          .title
                      }
                    </span>
                  </div>
                )}
              </Show>
              {/* lobby */}
              <Show when={race()?.status === "lobby"}>
                <div class="grid justify-items-center gap-4 rounded-double bg-game-night p-6 text-center shadow-xl sm:p-8">
                  <div class="text-xl font-bold text-game-cream/90">
                    Go to{" "}
                    <span class="rounded-lg bg-game-cream/15 px-2 py-0.5 text-game-yellow">
                      {joinUrl()}
                    </span>{" "}
                    and type this PIN:
                  </div>
                  <PinTiles pin={hostedPin() ?? ""} />
                  <div class="text-base text-game-cream/80">
                    {race()?.contentLabel} ·{" "}
                    {race()?.format === "blitz"
                      ? `word blitz · ${blitzWords().length} words`
                      : race()?.format === "tug"
                        ? `tug of war · ${race()?.durationSec}s`
                        : race()?.format === "timed"
                          ? `timed sprint · ${race()?.durationSec}s`
                          : race()?.format === "accuracy"
                            ? "accuracy race"
                            : "first to finish"}
                  </div>
                </div>

                <div class="grid gap-3 rounded-double bg-sub-alt p-5">
                  <div class="flex items-center gap-2 text-xl font-bold text-text">
                    <Fa icon="fa-users" class="text-main" />
                    {participants().length}{" "}
                    {participants().length === 1 ? "racer" : "racers"} ready
                  </div>
                  <div class="flex flex-wrap gap-3">
                    <For
                      each={participants()}
                      fallback={
                        <div class="flex items-center gap-3 text-sub">
                          <Mascot mood="thinking" size={48} />
                          Waiting for players to join…
                        </div>
                      }
                    >
                      {(p) => (
                        <div class="flex animate-game-pop items-center gap-2 rounded-full bg-bg py-1.5 pr-4 pl-1.5 text-base font-bold text-text motion-reduce:animate-none">
                          <Avatar url={p.avatarUrl} />
                          {p.name}
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-3">
                    <Button
                      chunky
                      size="lg"
                      active
                      text="Start race"
                      fa={{ icon: "fa-play" }}
                      onClick={() => void start()}
                      disabled={participants().length === 0}
                    />
                    <Button
                      chunky
                      size="lg"
                      text="Cancel"
                      fa={{ icon: "fa-trash" }}
                      onClick={() => void close()}
                    />
                  </div>
                </div>
              </Show>

              {/* countdown */}
              <Show when={race()?.status === "countdown"}>
                <div class="grid justify-items-center gap-2 rounded-double bg-game-night py-16 text-center">
                  <div class="text-2xl font-bold text-game-cream/90">
                    Get ready…
                  </div>
                  <Show when={countdownLeft()} keyed>
                    {(n) => (
                      <div class="animate-game-pop text-[9rem] leading-none font-bold text-game-yellow [text-shadow:0_8px_0_rgb(0_0_0/0.3)] motion-reduce:animate-none">
                        {n}
                      </div>
                    )}
                  </Show>
                  <Show when={isTug()}>
                    <div class="mt-4 grid w-full max-w-3xl grid-cols-2 gap-4 px-4 text-left">
                      <div class="grid gap-2">
                        <div class="text-xl font-bold text-game-red">
                          🔴 Red team
                        </div>
                        <TeamRoster
                          team="red"
                          players={teamPlayers("red")}
                          align="start"
                        />
                      </div>
                      <div class="grid justify-items-end gap-2 text-right">
                        <div class="text-xl font-bold text-game-blue">
                          Blue team 🔵
                        </div>
                        <TeamRoster
                          team="blue"
                          players={teamPlayers("blue")}
                          align="end"
                        />
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* running */}
              <Show when={race()?.status === "running"}>
                <div class="grid gap-3 rounded-double bg-sub-alt p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="text-2xl font-bold text-text">
                      {isBlitz()
                        ? "⚡ Word Blitz"
                        : isTug()
                          ? "🪢 Pull, pull, pull!"
                          : "🏎️ Race in progress"}
                    </div>
                    <Show when={timeLeft() !== null}>
                      <div
                        class={cn(
                          "rounded-full px-4 py-1.5 text-2xl font-bold tabular-nums",
                          (timeLeft() ?? 0) <= 5
                            ? "animate-game-pulse bg-game-red text-game-cream motion-reduce:animate-none"
                            : "bg-game-cream text-game-ink",
                        )}
                      >
                        ⏱ {timeLeft()}s
                      </div>
                    </Show>
                  </div>
                  <Show when={isBlitz()}>
                    <BlitzStage
                      state={blitzState()}
                      rounds={blitzWords().length}
                      secondsLeft={blitzSecondsLeft()}
                      answers={blitzAnswerList()}
                      leaders={blitzLeaders()}
                      playerCount={participants().length}
                      onNext={() => blitzNext()}
                    />
                  </Show>
                  <Show
                    when={isTug()}
                    fallback={
                      <Show when={!isBlitz()}>
                        <For each={liveSorted()}>
                          {(p, i) => (
                            <RaceLane
                              name={p.name}
                              avatarUrl={p.avatarUrl}
                              pct={barPct(p)}
                              label={wpmLabel(p) || "0 wpm"}
                              place={i() + 1}
                              finished={p.finished}
                            />
                          )}
                        </For>
                      </Show>
                    }
                  >
                    <TugArena
                      totals={tugTotals()}
                      offset={ropeOffset(tugTotals(), tugMargin())}
                      red={teamPlayers("red")}
                      blue={teamPlayers("blue")}
                    />
                  </Show>
                  <div class="mt-2">
                    <Button
                      chunky
                      size="lg"
                      text="End race"
                      fa={{ icon: "fa-flag-checkered" }}
                      onClick={() => void endRace()}
                    />
                  </div>
                </div>
              </Show>

              {/* finished */}
              <Show when={race()?.status === "finished"}>
                <div class="relative grid gap-5 overflow-hidden rounded-double bg-sub-alt p-6">
                  <Confetti />
                  <div class="text-center text-3xl font-bold text-text">
                    🏆 Race results
                  </div>
                  <Show
                    when={isTug()}
                    fallback={
                      <RacePodium
                        top={standings().slice(0, 3)}
                        metric={metric}
                      />
                    }
                  >
                    <div class="grid justify-items-center gap-2 text-center">
                      <Show
                        when={tugWinner()}
                        fallback={
                          <div class="animate-game-pop rounded-full bg-game-purple px-6 py-2 text-3xl font-bold text-game-cream motion-reduce:animate-none">
                            🤝 It&apos;s a draw!
                          </div>
                        }
                      >
                        {(team) => (
                          <div
                            class={cn(
                              "animate-game-pop rounded-full px-6 py-2 text-3xl font-bold text-game-cream motion-reduce:animate-none",
                              TEAM_STYLE[team()].bg,
                            )}
                          >
                            {TEAM_STYLE[team()].emoji}{" "}
                            {TEAM_STYLE[team()].label} wins!
                          </div>
                        )}
                      </Show>
                      <div class="text-xl font-bold">
                        <span class="text-game-red">
                          🔴 {tugFinalTotals().red}
                        </span>
                        <span class="mx-3 text-sub">vs</span>
                        <span class="text-game-blue">
                          {tugFinalTotals().blue} 🔵
                        </span>
                      </div>
                      <Show when={tugStandings()[0]}>
                        {(mvp) => (
                          <div class="text-lg text-text">
                            ⭐ MVP: <b>{mvp().name}</b> · {mvp().words ?? 0}{" "}
                            words
                          </div>
                        )}
                      </Show>
                    </div>
                  </Show>
                  <div class="grid gap-2">
                    <For each={tugStandings()}>
                      {(st) => (
                        <div class="flex items-center gap-3 rounded-xl bg-bg p-2 text-base">
                          <span class="w-8 text-center text-xl font-bold text-main">
                            {st.rank}
                          </span>
                          <Avatar url={st.avatarUrl} />
                          <span class="min-w-0 flex-1 truncate font-bold text-text">
                            <Show when={st.team}>
                              {(team) => (
                                <span class="mr-1.5">
                                  {TEAM_STYLE[team()].emoji}
                                </span>
                              )}
                            </Show>
                            {st.name}
                          </span>
                          <span class="font-bold text-text">
                            {isTug() ? `${st.words ?? 0} words` : metric(st)}
                          </span>
                          <Show when={coinsFor(st) > 0}>
                            <span class="flex items-center gap-1 rounded-full bg-game-gold px-2 py-0.5 text-sm font-bold text-game-ink">
                              <Fa icon="fa-coins" />+{coinsFor(st)}
                            </span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="text-sm text-sub">
                    <Fa icon="fa-check" class="mr-1.5" />
                    Saved to race history
                  </div>
                </div>

                <Show when={champ()}>
                  {(c) => (
                    <div class="relative grid gap-5 overflow-hidden rounded-double bg-sub-alt p-6">
                      <Show
                        when={c().crowned === true}
                        fallback={
                          <Show
                            when={champScored()}
                            fallback={
                              <div class="flex items-center gap-3 text-lg text-sub">
                                <Mascot mood="thinking" size={48} />
                                Adding up the points…
                              </div>
                            }
                          >
                            <ChampionshipBoard
                              rows={champRows()}
                              previous={champPrevious()}
                              roundsPlayed={c().scoredRounds}
                              roundsTotal={c().rounds.length}
                              roundKinds={c().rounds.map((r) => r.kind)}
                            />
                            <div class="flex flex-wrap gap-3">
                              <Show
                                when={!champLastRound()}
                                fallback={
                                  <Button
                                    chunky
                                    size="lg"
                                    active
                                    text={
                                      busy()
                                        ? "Crowning…"
                                        : "👑 Crown the champion!"
                                    }
                                    onClick={() => void crown()}
                                    disabled={busy()}
                                  />
                                }
                              >
                                {(() => {
                                  const next =
                                    CHAMP_ROUNDS[
                                      c().rounds[c().current + 1]?.kind ??
                                        "final"
                                    ];
                                  return (
                                    <Button
                                      chunky
                                      size="lg"
                                      active
                                      text={
                                        busy()
                                          ? "Getting ready…"
                                          : `Next round: ${next.emoji} ${next.title}`
                                      }
                                      fa={{ icon: "fa-arrow-right" }}
                                      onClick={() => void nextChampRound()}
                                      disabled={busy()}
                                    />
                                  );
                                })()}
                              </Show>
                            </div>
                          </Show>
                        }
                      >
                        <Confetti />
                        <ChampionReveal
                          rows={champRows()}
                          classId={c().classId}
                        />
                        <Show when={crowned()}>
                          {(record) => (
                            <div class="flex flex-wrap items-center justify-center gap-2 font-kid">
                              <span class="text-sub">Print certificates:</span>
                              <CertificateButtons record={record()} />
                            </div>
                          )}
                        </Show>
                        <ChampionshipBoard
                          rows={champRows()}
                          previous={{}}
                          roundsPlayed={c().scoredRounds}
                          roundsTotal={c().rounds.length}
                          roundKinds={c().rounds.map((r) => r.kind)}
                        />
                        <div>
                          <Button
                            chunky
                            size="lg"
                            text="Close championship"
                            fa={{ icon: "fa-check" }}
                            onClick={() => void close()}
                          />
                        </div>
                      </Show>
                    </div>
                  )}
                </Show>
                <Show when={champ() === undefined}>
                  <div class="grid gap-4 rounded-double bg-sub-alt p-5">
                    <div class="text-xl font-bold text-text">
                      Race again with the same players
                    </div>
                    {setupFields()}
                    <div class="flex flex-wrap gap-3">
                      <Button
                        chunky
                        size="lg"
                        active
                        text={busy() ? "Restarting…" : "Race again"}
                        fa={{ icon: "fa-redo" }}
                        onClick={() => void raceAgain()}
                        disabled={busy()}
                      />
                      <Button
                        chunky
                        size="lg"
                        text="Close race"
                        fa={{ icon: "fa-check" }}
                        onClick={() => void close()}
                      />
                    </div>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </Page>
  );
}

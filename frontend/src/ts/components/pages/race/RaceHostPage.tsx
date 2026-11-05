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
  startRace,
  subscribeParticipants,
  subscribeRace,
} from "../../../race/race-db";
import {
  Race,
  RaceFormat,
  RaceParticipant,
  RaceStanding,
  rankParticipants,
} from "../../../race/race-types";
import { showErrorNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { Mascot } from "../../common/Mascot";
import { Page } from "../../common/Page";

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
];

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
        <div class="grid gap-3 sm:grid-cols-3">
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
                onClick={() => props.onFormat(f.value)}
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
        <Show when={props.format === "timed"}>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sub">How long?</span>
            <For each={[15, 30, 60]}>
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
      r.format === "timed" &&
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

  // The countdown->running transition and (for timed races) the auto-end
  // are both scheduled reactively from the race doc by the effect above, so
  // this just needs to write the countdown's start time.
  const start = async (): Promise<void> => {
    const pin = hostedPin();
    if (pin === null || race() === null) return;
    await startRace(pin, COUNTDOWN_MS);
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
    if (r?.format !== "timed" || r.runningAt === undefined) return null;
    const end = r.runningAt + (r.durationSec ?? 0) * 1000;
    return Math.max(0, Math.ceil((end - now()) / 1000));
  };
  const joinUrl = (): string => `${window.location.host}/race`;
  const metric = (s: RaceStanding): string =>
    race()?.format === "accuracy"
      ? `${Math.round(s.finalAcc)}% · ${Math.round(s.finalWpm)} wpm`
      : `${Math.round(s.finalWpm)} wpm · ${Math.round(s.finalAcc)}%`;

  const maxWpm = (): number =>
    Math.max(
      1,
      ...participants().map((p) =>
        p.finished ? (p.finalWpm ?? 0) : (p.liveWpm ?? 0),
      ),
    );
  const barPct = (p: RaceParticipant): number => {
    const r = race();
    if (r?.format === "timed") {
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
      fmt === "timed" ? b.wordIndex - a.wordIndex : b.progress - a.progress,
    );
  });
  const standings = createMemo(() =>
    rankParticipants(participants(), race()?.format ?? "finish"),
  );

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
              {setupFields()}
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold tracking-wide text-sub uppercase">
                  Class
                </span>
                <select
                  class={cn(selectClass, "w-auto")}
                  value={classId()}
                  onChange={(e) => setClassId(e.currentTarget.value)}
                >
                  <option value="none">Any class</option>
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
                  text={busy() ? "Creating…" : "Create race"}
                  fa={{ icon: "fa-flag-checkered" }}
                  onClick={() => void create()}
                  disabled={busy()}
                />
              </div>
            </div>
          </Show>

          {/* CONTROL PANEL (projector view) */}
          <Show when={hostedPin() !== null}>
            <div class="mx-auto grid w-full max-w-5xl gap-5">
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
                    {race()?.format === "timed"
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
                </div>
              </Show>

              {/* running */}
              <Show when={race()?.status === "running"}>
                <div class="grid gap-3 rounded-double bg-sub-alt p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="text-2xl font-bold text-text">
                      🏎️ Race in progress
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
                  <RacePodium top={standings().slice(0, 3)} metric={metric} />
                  <div class="grid gap-2">
                    <For each={standings()}>
                      {(st) => (
                        <div class="flex items-center gap-3 rounded-xl bg-bg p-2 text-base">
                          <span class="w-8 text-center text-xl font-bold text-main">
                            {st.rank}
                          </span>
                          <Avatar url={st.avatarUrl} />
                          <span class="min-w-0 flex-1 truncate font-bold text-text">
                            {st.name}
                          </span>
                          <span class="font-bold text-text">{metric(st)}</span>
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="text-sm text-sub">
                    <Fa icon="fa-check" class="mr-1.5" />
                    Saved to race history
                  </div>
                </div>

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
            </div>
          </Show>
        </div>
      </Show>
    </Page>
  );
}

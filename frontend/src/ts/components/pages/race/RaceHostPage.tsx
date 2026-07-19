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
  rankParticipants,
} from "../../../race/race-types";
import { showErrorNotification } from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { H2 } from "../../common/Headers";
import { Page } from "../../common/Page";

const COUNTDOWN_MS = 4000;
const HOST_STORAGE_KEY = "gfa_hosted_race";

const selectClass =
  "rounded bg-bg px-2 py-1 text-text outline-none focus:ring-2 focus:ring-sub";
const inputClass =
  "w-full rounded bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-sub";

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
    <>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sub">format</span>
        <select
          class={selectClass}
          value={props.format}
          onChange={(e) => props.onFormat(e.currentTarget.value as RaceFormat)}
        >
          <option value="finish">first to finish</option>
          <option value="accuracy">accuracy race</option>
          <option value="timed">timed sprint</option>
        </select>
        <Show when={props.format === "timed"}>
          <select
            class={selectClass}
            value={props.duration}
            onChange={(e) => props.onDuration(Number(e.currentTarget.value))}
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
        </Show>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sub">content</span>
        <select
          class={selectClass}
          value={props.kind}
          onChange={(e) => props.onKind(e.currentTarget.value as ContentKind)}
        >
          <option value="random">random words</option>
          <option value="lesson">built-in lesson</option>
          <option value="wordlist">word list</option>
          <option value="passage">reading passage</option>
          <option value="custom">custom passage</option>
        </select>
        <Show when={props.kind === "random"}>
          <select
            class={selectClass}
            value={props.count}
            onChange={(e) => props.onCount(Number(e.currentTarget.value))}
          >
            <option value={10}>10 words</option>
            <option value={20}>20 words</option>
            <option value={30}>30 words</option>
            <option value={50}>50 words</option>
          </select>
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
            <option value="">select word list...</option>
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
            <option value="">select passage...</option>
            <For each={props.passages}>
              {(p) => <option value={p.id}>{p.title}</option>}
            </For>
          </select>
        </Show>
      </div>

      <Show when={props.kind === "custom"}>
        <textarea
          class={cn(inputClass, "min-h-24 resize-y")}
          placeholder="paste the passage students will race on..."
          value={props.custom}
          onInput={(e) => props.onCustom(e.currentTarget.value)}
        ></textarea>
      </Show>
    </>
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
        <div class="content-grid grid gap-6 py-6">
          <H2 fa={{ icon: "fa-stopwatch" }} text="host a race" />

          {/* CREATE FORM */}
          <Show when={hostedPin() === null}>
            <div class="grid max-w-xl gap-3 rounded bg-sub-alt p-4">
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

              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sub">class (optional)</span>
                <select
                  class={selectClass}
                  value={classId()}
                  onChange={(e) => setClassId(e.currentTarget.value)}
                >
                  <option value="none">none</option>
                  <For each={CLASS_IDS}>
                    {(c) => <option value={c}>{c}</option>}
                  </For>
                </select>
              </div>

              <div>
                <Button
                  text={busy() ? "creating..." : "create race"}
                  fa={{ icon: "fa-plus" }}
                  onClick={() => void create()}
                  disabled={busy()}
                />
              </div>
            </div>
          </Show>

          {/* CONTROL PANEL */}
          <Show when={hostedPin() !== null}>
            <div class="grid max-w-xl gap-4">
              <div class="flex flex-col items-center gap-1 rounded bg-sub-alt p-6">
                <span class="tracking-widest text-sub uppercase">race pin</span>
                <span class="text-[3em] leading-none font-bold tracking-[0.3em] text-main">
                  {hostedPin()}
                </span>
                <span class="text-sub">{race()?.contentLabel}</span>
                <span class="text-em-xs text-sub">
                  {race()?.format === "timed"
                    ? `timed · ${race()?.durationSec}s`
                    : race()?.format === "accuracy"
                      ? "accuracy race"
                      : "first to finish"}
                  {" · "}
                  {race()?.status}
                </span>
              </div>

              {/* lobby */}
              <Show when={race()?.status === "lobby"}>
                <div class="grid gap-2">
                  <div class="text-sub">players ({participants().length})</div>
                  <For
                    each={participants()}
                    fallback={
                      <div class="text-sub">waiting for players to join...</div>
                    }
                  >
                    {(p) => (
                      <div class="flex items-center gap-3 rounded bg-sub-alt p-2">
                        <Avatar url={p.avatarUrl} />
                        <span class="text-text">{p.name}</span>
                      </div>
                    )}
                  </For>
                  <div class="mt-2 flex gap-2">
                    <Button
                      text="start race"
                      fa={{ icon: "fa-play" }}
                      onClick={() => void start()}
                      disabled={participants().length === 0}
                    />
                    <Button
                      variant="text"
                      text="cancel"
                      fa={{ icon: "fa-trash" }}
                      onClick={() => void close()}
                    />
                  </div>
                </div>
              </Show>

              {/* running / countdown */}
              <Show
                when={
                  race()?.status === "countdown" || race()?.status === "running"
                }
              >
                <div class="grid gap-2">
                  <For each={liveSorted()}>
                    {(p) => (
                      <div class="flex items-center gap-2">
                        <Avatar url={p.avatarUrl} />
                        <div class="min-w-0 flex-1">
                          <div class="mb-0.5 flex justify-between text-em-xs text-sub">
                            <span class="truncate">{p.name}</span>
                            <span>{wpmLabel(p)}</span>
                          </div>
                          <div class="h-2 w-full overflow-hidden rounded bg-sub-alt">
                            <div
                              class="h-full rounded bg-main transition-[width] duration-200"
                              style={{ width: `${barPct(p)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                  <div class="mt-2">
                    <Button
                      text="end race"
                      fa={{ icon: "fa-flag-checkered" }}
                      onClick={() => void endRace()}
                    />
                  </div>
                </div>
              </Show>

              {/* finished */}
              <Show when={race()?.status === "finished"}>
                <div class="grid gap-2">
                  <div class="flex items-center gap-2 text-main">
                    <Fa icon="fa-trophy" />
                    final standings
                  </div>
                  <For each={standings()}>
                    {(s) => (
                      <div class="flex items-center gap-3 rounded bg-sub-alt p-2">
                        <span class="w-6 text-center font-bold text-main">
                          {s.rank}
                        </span>
                        <Avatar url={s.avatarUrl} />
                        <span class="min-w-0 flex-1 truncate text-text">
                          {s.name}
                        </span>
                        <span class="text-text">
                          {race()?.format === "accuracy"
                            ? `${Math.round(s.finalAcc)}%`
                            : `${Math.round(s.finalWpm)} wpm`}
                        </span>
                        <span class="text-em-xs text-sub">
                          {race()?.format === "accuracy"
                            ? `${Math.round(s.finalWpm)} wpm`
                            : `${Math.round(s.finalAcc)}%`}
                        </span>
                      </div>
                    )}
                  </For>
                  <div class="mt-2 text-em-xs text-sub">
                    saved to race history
                  </div>

                  <div class="mt-2 grid gap-3 rounded bg-sub-alt p-4">
                    <div class="text-sub">race again (same players)</div>
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
                    <div class="flex gap-2">
                      <Button
                        text={busy() ? "restarting..." : "race again"}
                        fa={{ icon: "fa-redo" }}
                        onClick={() => void raceAgain()}
                        disabled={busy()}
                      />
                      <Button
                        variant="text"
                        text="close race"
                        fa={{ icon: "fa-check" }}
                        onClick={() => void close()}
                      />
                    </div>
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

import { loadFromLocalStorage } from "../config/lifecycle";
import { getAuthenticatedUser } from "../firebase";
import { setConfig } from "../config/setters";
import { navigationEvent } from "../events/navigation";
import { restartTestEvent } from "../events/test";
import { setActiveLesson } from "../lessons/lesson-progress";
import { getActivePage, setCustomTextIndicator } from "../states/core";
import { showNoticeNotification } from "../states/notifications";
import { getSnapshot } from "../states/snapshot";
import { getLastResult, setLastResult } from "../states/test";
import * as CustomText from "../test/custom-text";
import * as TestState from "../test/test-state";
import { getLiveStats } from "../test/test-timer";
import {
  getRace,
  getParticipants,
  joinRace,
  leaveRace,
  resetParticipant,
  subscribeParticipants,
  subscribeRace,
  writeFinal,
  writePartial,
  writeProgress,
} from "./race-db";
import {
  getActiveRacePin,
  getCurrentRace,
  resetRaceState,
  setActiveRacePin,
  setCurrentRace,
  setRaceParticipants,
  setRaceRole,
} from "./race-state";
import { isTimedFormat, Race } from "./race-types";

const PROGRESS_POLL_INTERVAL_MS = 500;
const MIN_PROGRESS_WRITE_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 10000;
const RACE_STORAGE_KEY = "gfa_active_race";

let unsubRace: (() => void) | null = null;
let unsubParticipants: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
/** PIN of the race the user has joined (set on join, cleared on exit). */
let joinedPin: string | null = null;
/** PIN of the race whose test we have actually launched. */
let enteredPin: string | null = null;
/** Round number whose test we have already launched (for restart re-entry). */
let enteredRound: number | null = null;
/** Last round we observed, to detect a teacher restart. 0 = none yet. */
let seenRound = 0;
let finalWritten = false;
/** Local timestamp when enterTest was called, for live WPM calculation. */
let testStartedAt: number | null = null;
let lastProgressWordIndex = -1;
let lastProgressWriteAt = 0;
let finalParticipantsLoaded = false;

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function teardownSubscriptions(): void {
  unsubRace?.();
  unsubParticipants?.();
  unsubRace = null;
  unsubParticipants = null;
}

function subscribeToParticipants(pin: string): void {
  if (unsubParticipants !== null) return;
  const myUid = getAuthenticatedUser()?.uid;
  let listed = false;
  unsubParticipants = subscribeParticipants(pin, (list) => {
    setRaceParticipants(list);
    if (myUid === undefined) return;
    if (list.some((p) => p.uid === myUid)) {
      listed = true;
      return;
    }
    // I was in the lobby and now I'm not: the teacher removed me
    if (listed && joinedPin === pin && getCurrentRace()?.status === "lobby") {
      listed = false;
      showNoticeNotification(
        "Your teacher removed you from the race. Check your account and join again.",
        { durationMs: 8000 },
      );
      void exitRace();
    }
  });
}

function stopParticipantSubscription(): void {
  unsubParticipants?.();
  unsubParticipants = null;
}

/**
 * Student joins a race and starts listening for status changes. Subscriptions
 * live at module scope so they survive navigation from the lobby to the test
 * page.
 */
export async function joinAsParticipant(pin: string): Promise<void> {
  await exitRace();

  const snap = getSnapshot();
  await joinRace(pin, {
    name: snap?.name ?? "Student",
    avatarUrl: snap?.avatarUrl,
  });

  joinedPin = pin;
  localStorage.setItem(RACE_STORAGE_KEY, pin);
  setActiveRacePin(pin);
  setRaceRole("participant");

  unsubRace = subscribeRace(pin, (race) => {
    setCurrentRace(race);
    if (race === null) {
      void exitRace();
      return;
    }
    handleRaceUpdate(race);
  });
  subscribeToParticipants(pin);
}

/**
 * Reconnect to a saved race after a page reload. Does NOT reset the
 * participant doc so progress is preserved.
 */
export async function tryReconnectRace(): Promise<void> {
  if (getActiveRacePin() !== null) return;
  const savedPin = localStorage.getItem(RACE_STORAGE_KEY);
  if (savedPin === null) return;

  try {
    const race = await getRace(savedPin);
    // a championship between rounds is "finished" but not over yet
    const championshipOngoing =
      race?.championship !== undefined && race.championship.crowned !== true;
    if (race === null || (race.status === "finished" && !championshipOngoing)) {
      localStorage.removeItem(RACE_STORAGE_KEY);
      return;
    }

    joinedPin = savedPin;
    seenRound = race.round;
    setActiveRacePin(savedPin);
    setRaceRole("participant");

    unsubRace = subscribeRace(savedPin, (r) => {
      setCurrentRace(r);
      if (r === null) {
        void exitRace();
        return;
      }
      handleRaceUpdate(r);
    });
    if (race.status === "lobby") subscribeToParticipants(savedPin);

    if (
      (race.status === "running" || race.status === "countdown") &&
      race.format !== "blitz"
    ) {
      enterTest(race);
    }
  } catch {
    localStorage.removeItem(RACE_STORAGE_KEY);
  }
}

function handleRaceUpdate(race: Race): void {
  if (race.round !== seenRound) {
    const isReentry = seenRound !== 0;
    seenRound = race.round;
    if (isReentry) {
      finalWritten = false;
      finalParticipantsLoaded = false;
      void resetParticipant(race.pin);
      navigationEvent.dispatch({ url: "/race", options: {} });
    }
  }

  if (race.status === "finished") submitOnRaceEnd(race);

  if (race.status === "lobby") {
    subscribeToParticipants(race.pin);
  } else if (race.status === "countdown" || race.status === "running") {
    // Students only need the full roster in the lobby. Keeping this listener
    // during live progress makes every student's write fan out to every other
    // student as a billed document read. The host keeps its own live listener.
    stopParticipantSubscription();
  } else if (race.status === "finished" && !finalParticipantsLoaded) {
    finalParticipantsLoaded = true;
    stopParticipantSubscription();
    // give everyone's end-of-race results (submitOnRaceEnd) a moment to land
    setTimeout(() => {
      void getParticipants(race.pin)
        .then(setRaceParticipants)
        .catch(() => undefined);
    }, RESULTS_SETTLE_MS);
  }

  if (
    (race.status === "countdown" || race.status === "running") &&
    enteredRound !== race.round &&
    // Word Blitz is played in its own on-screen quiz (RaceOverlay), not the
    // typing test.
    race.format !== "blitz"
  ) {
    enterTest(race);
  }
}

const RESULTS_SETTLE_MS = 3000;

/**
 * The host ended the race while I was still typing: send how far I got and
 * my speed/accuracy so far, instead of leaving me at 0 in the standings.
 */
function submitOnRaceEnd(race: Race): void {
  if (
    finalWritten ||
    race.format === "blitz" ||
    enteredPin !== race.pin ||
    enteredRound !== race.round
  ) {
    return;
  }
  // clock ran out: the test's own result is on its way (startPolling)
  if (
    isTimedFormat(race.format) &&
    race.durationSec !== undefined &&
    race.runningAt !== undefined &&
    (race.finishedAt ?? Date.now()) >=
      race.runningAt + race.durationSec * 1000 - 1000
  ) {
    return;
  }
  finalWritten = true;
  stopPolling();
  const result = getLastResult();
  if (result !== null) {
    void writeFinal(race.pin, {
      wpm: result.wpm,
      acc: result.acc,
      progress: 1,
      wordIndex: TestState.activeWordIndex,
    });
    return;
  }
  const live = getLiveStats();
  if (live === null) return;
  const total = race.tokens.length;
  const wordIndex = TestState.activeWordIndex;
  void writePartial(race.pin, {
    wpm: live.wpm,
    acc: live.acc,
    progress: total > 0 ? Math.min(wordIndex / total, 1) : 0,
    wordIndex,
  });
}

/**
 * Configure the test from the race's snapshotted tokens and launch it on the
 * test page. Uses nosave + disables result saving so race runs never touch the
 * student's personal bests or leaderboards.
 */
function enterTest(race: Race): void {
  enteredPin = race.pin;
  enteredRound = race.round;
  finalWritten = false;
  testStartedAt = Date.now();
  lastProgressWordIndex = -1;
  lastProgressWriteAt = 0;

  setActiveLesson(null);
  setLastResult(null);

  setConfig("mode", "custom", { nosave: true });
  setConfig("punctuation", false, { nosave: true });
  setConfig("numbers", false, { nosave: true });
  setConfig("resultSaving", false, { nosave: true });
  // Force-correct typing so keyboard-mashing can't win a "first to finish"
  // race: you can't advance to the next word until the current one is right.
  setConfig("stopOnError", "word", { nosave: true });

  CustomText.setPipeDelimiter(false);
  CustomText.setMode("repeat");
  CustomText.setText(race.tokens);
  if (isTimedFormat(race.format) && race.durationSec !== undefined) {
    CustomText.setLimitMode("time");
    CustomText.setLimitValue(race.durationSec);
  } else {
    CustomText.setLimitMode("word");
    CustomText.setLimitValue(race.tokens.length);
  }

  setCustomTextIndicator({ name: `race ${race.pin}`, isLong: false });

  if (getActivePage() === "test") {
    restartTestEvent.dispatch();
  } else {
    navigationEvent.dispatch({ url: "/test", options: {} });
  }

  startPolling(race);
}

function startPolling(race: Race): void {
  stopPolling();
  const total = race.tokens.length;
  pollTimer = setInterval(() => {
    if (finalWritten) return;

    const result = getLastResult();
    if (result !== null) {
      finalWritten = true;
      stopPolling();
      void writeFinal(race.pin, {
        wpm: result.wpm,
        acc: result.acc,
        progress: 1,
        wordIndex: TestState.activeWordIndex,
      });
      return;
    }

    const wordIndex = TestState.activeWordIndex;
    const progress = total > 0 ? Math.min(wordIndex / total, 1) : 0;

    // Rolling WPM estimate — skip first 3 s to avoid noise at low word counts.
    let liveWpm: number | undefined;
    if (testStartedAt !== null) {
      const elapsedMin = (Date.now() - testStartedAt) / 60000;
      if (elapsedMin > 0.05) {
        liveWpm = Math.round(wordIndex / elapsedMin);
      }
    }

    const timeSinceWrite = Date.now() - lastProgressWriteAt;
    const progressChanged = wordIndex !== lastProgressWordIndex;
    if (
      (progressChanged && timeSinceWrite >= MIN_PROGRESS_WRITE_INTERVAL_MS) ||
      timeSinceWrite >= HEARTBEAT_INTERVAL_MS
    ) {
      lastProgressWordIndex = wordIndex;
      lastProgressWriteAt = Date.now();
      void writeProgress(race.pin, { wordIndex, progress, liveWpm });
    }
  }, PROGRESS_POLL_INTERVAL_MS);
}

/**
 * Leave the current race: stop everything, drop the participant doc, restore
 * the user's normal config, and reset race state.
 */
export async function exitRace(): Promise<void> {
  const launchedTest = enteredPin !== null;
  stopPolling();
  teardownSubscriptions();

  const pin = joinedPin;
  joinedPin = null;
  enteredPin = null;
  enteredRound = null;
  seenRound = 0;
  finalWritten = false;
  finalParticipantsLoaded = false;
  testStartedAt = null;
  lastProgressWordIndex = -1;
  lastProgressWriteAt = 0;

  localStorage.removeItem(RACE_STORAGE_KEY);

  // Close the race UI first: on a sleepy iPad connection the RTDB delete can
  // take a long time, and students must never be stuck behind the results.
  resetRaceState();
  if (pin !== null) void leaveRace(pin);

  // Restore the real settings the race overrode with nosave.
  if (launchedTest) {
    await loadFromLocalStorage();
    if (getActivePage() === "test") {
      restartTestEvent.dispatch();
    } else {
      navigationEvent.dispatch({ url: "/test", options: {} });
    }
  }
}

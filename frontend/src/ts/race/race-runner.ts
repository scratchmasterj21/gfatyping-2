import { loadFromLocalStorage } from "../config/lifecycle";
import { setConfig } from "../config/setters";
import { navigationEvent } from "../events/navigation";
import { restartTestEvent } from "../events/test";
import { setActiveLesson } from "../lessons/lesson-progress";
import { getActivePage, setCustomTextIndicator } from "../states/core";
import { getSnapshot } from "../states/snapshot";
import { getLastResult, setLastResult } from "../states/test";
import * as CustomText from "../test/custom-text";
import * as TestState from "../test/test-state";
import {
  getRace,
  joinRace,
  leaveRace,
  resetParticipant,
  subscribeParticipants,
  subscribeRace,
  writeFinal,
  writeProgress,
} from "./race-db";
import {
  getActiveRacePin,
  resetRaceState,
  setActiveRacePin,
  setCurrentRace,
  setRaceParticipants,
  setRaceRole,
} from "./race-state";
import { Race } from "./race-types";

const PROGRESS_INTERVAL_MS = 500;
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
  unsubParticipants = subscribeParticipants(pin, setRaceParticipants);
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
    if (race === null || race.status === "finished") {
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
    unsubParticipants = subscribeParticipants(savedPin, setRaceParticipants);

    if (race.status === "running" || race.status === "countdown") {
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
      void resetParticipant(race.pin);
      navigationEvent.dispatch({ url: "/race", options: {} });
    }
  }

  if (
    (race.status === "countdown" || race.status === "running") &&
    enteredRound !== race.round
  ) {
    enterTest(race);
  }
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
  if (race.format === "timed" && race.durationSec !== undefined) {
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
    navigationEvent.dispatch({ url: "/", options: {} });
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

    // Always write so lastSeen stays fresh (used for disconnect detection).
    void writeProgress(race.pin, { wordIndex, progress, liveWpm });
  }, PROGRESS_INTERVAL_MS);
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
  testStartedAt = null;

  localStorage.removeItem(RACE_STORAGE_KEY);

  if (pin !== null) {
    await leaveRace(pin);
  }

  resetRaceState();

  // Restore the real settings the race overrode with nosave.
  if (launchedTest) {
    await loadFromLocalStorage();
    if (getActivePage() === "test") {
      restartTestEvent.dispatch();
    } else {
      navigationEvent.dispatch({ url: "/", options: {} });
    }
  }
}

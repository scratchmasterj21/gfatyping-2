import { callApi } from "../api-client";
import { isCurrentUserAdmin } from "../auth";
import { noteGameSeconds } from "./game-access";

/**
 * Measures how long a free-play game is open (only while the page is
 * visible) and reports it to the server for the teacher's activity view and
 * the bonus-game-time budget. A report that can't be sent (offline, tab
 * closed) is kept in localStorage and retried next time.
 */

const PENDING_KEY = "gfa_pending_game_seconds";
/** Shorter than this (opened by accident) isn't reported. */
const MIN_SECONDS = 5;

type Pending = { gameId: string; seconds: number };

let current:
  | { gameId: string; visibleSince: number | null; seconds: number }
  | undefined;

function onVisibility(): void {
  if (current === undefined) return;
  if (document.hidden) {
    if (current.visibleSince !== null) {
      current.seconds += (Date.now() - current.visibleSince) / 1000;
      current.visibleSince = null;
    }
    // the tab may never come back - park what we have so far
    savePending({ gameId: current.gameId, seconds: current.seconds });
  } else {
    clearPending();
    current.visibleSince = Date.now();
  }
}

function savePending(p: Pending): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // storage full / private mode: lose this one
  }
}

function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function readPending(): Pending | undefined {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw === null) return undefined;
    const p = JSON.parse(raw) as Partial<Pending>;
    if (typeof p.gameId === "string" && typeof p.seconds === "number") {
      return { gameId: p.gameId, seconds: p.seconds };
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function report(p: Pending, opened: boolean): Promise<void> {
  if (isCurrentUserAdmin()) return;
  const seconds = Math.round(p.seconds);
  if (seconds < MIN_SECONDS) return;
  noteGameSeconds(seconds);
  try {
    const res = await callApi<{ ok: boolean; gameSecondsToday?: number }>(
      "/api/save-game-result",
      { session: { gameId: p.gameId, seconds, opened } },
    );
    if (res.ok) noteGameSeconds(0, res.gameSecondsToday);
  } catch {
    savePending(p);
  }
}

/** Send a report left over from a closed tab / offline session. */
export function flushPendingGameSession(): void {
  if (current !== undefined) return;
  const p = readPending();
  if (p === undefined) return;
  clearPending();
  void report(p, true);
}

export function startGameSession(gameId: string): void {
  if (current !== undefined) stopGameSession();
  flushPendingGameSession();
  current = {
    gameId,
    visibleSince: document.hidden ? null : Date.now(),
    seconds: 0,
  };
  document.addEventListener("visibilitychange", onVisibility);
}

export function stopGameSession(): void {
  const s = current;
  if (s === undefined) return;
  current = undefined;
  document.removeEventListener("visibilitychange", onVisibility);
  clearPending();
  if (s.visibleSince !== null) {
    s.seconds += (Date.now() - s.visibleSince) / 1000;
  }
  void report({ gameId: s.gameId, seconds: s.seconds }, true);
}

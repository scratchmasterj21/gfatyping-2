import { isCurrentUserAdmin } from "../auth";
import { authEvent } from "../events/auth";
import { getActiveLesson } from "../lessons/lesson-progress";
import { getActivePage } from "../states/core";
import type { PageName } from "../pages/page";
import { getSnapshot } from "../states/snapshot";
import * as TestState from "../test/test-state";
import * as TestWords from "../test/test-words";
import { clearClassPresence, writeClassPresence } from "./class-presence";

const POLL_MS = 500;
const MIN_WRITE_MS = 5000;
const HEARTBEAT_MS = 10_000;

let lastWriteAt = 0;
let lastWordIndex = -1;
let testStartedAt: number | null = null;
let trackedClassId: string | null = null;

function presencePage(page: PageName): "test" | "lessons" | "other" {
  if (page === "test") return "test";
  if (page === "lessons") return "lessons";
  return "other";
}

function resolveClassId(): string | null {
  const classId = getSnapshot()?.classId;
  if (typeof classId !== "string" || classId === "") return null;
  return classId;
}

function shouldTrack(): boolean {
  if (isCurrentUserAdmin()) return false;
  return resolveClassId() !== null;
}

async function flushPresence(): Promise<void> {
  const classId = resolveClassId();
  if (classId === null) {
    if (trackedClassId !== null) {
      await clearClassPresence(trackedClassId);
      trackedClassId = null;
    }
    return;
  }

  if (trackedClassId !== null && trackedClassId !== classId) {
    await clearClassPresence(trackedClassId);
  }
  trackedClassId = classId;

  const page = getActivePage();
  const onTest = page === "test";
  const typing =
    onTest &&
    TestState.isActive &&
    !TestState.resultVisible &&
    !TestState.testRestarting;

  if (typing && testStartedAt === null) {
    testStartedAt = Date.now();
  }
  if (!typing) {
    testStartedAt = null;
    lastWordIndex = -1;
  }

  let progress: number | undefined;
  let liveWpm: number | undefined;
  if (typing) {
    const total = TestWords.words.length;
    const wordIndex = TestState.activeWordIndex;
    progress = total > 0 ? Math.min(wordIndex / total, 1) : 0;
    if (testStartedAt !== null) {
      const elapsedMin = (Date.now() - testStartedAt) / 60000;
      if (elapsedMin > 0.05) {
        liveWpm = Math.round(wordIndex / elapsedMin);
      }
    }
  }

  const lessonId = getActiveLesson() ?? undefined;
  const now = Date.now();
  const wordChanged = TestState.activeWordIndex !== lastWordIndex;
  const timeSinceWrite = now - lastWriteAt;
  if (
    timeSinceWrite < MIN_WRITE_MS &&
    !wordChanged &&
    timeSinceWrite < HEARTBEAT_MS
  ) {
    return;
  }
  if (timeSinceWrite < HEARTBEAT_MS && !wordChanged && !typing) {
    return;
  }

  lastWriteAt = now;
  lastWordIndex = TestState.activeWordIndex;

  await writeClassPresence(classId, {
    page: presencePage(page),
    typing,
    lessonId,
    progress,
    liveWpm,
  });
}

export function initClassPresenceClient(): void {
  window.addEventListener("beforeunload", () => {
    void clearClassPresence(trackedClassId);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushPresence();
    }
  });

  authEvent.subscribe((event) => {
    if (event.type === "authStateChanged" && !event.data.isUserSignedIn) {
      void clearClassPresence(trackedClassId);
      trackedClassId = null;
    }
  });

  setInterval(() => {
    if (!shouldTrack()) return;
    void flushPresence();
  }, POLL_MS);
}

import { DBSchema, IDBPDatabase, openDB } from "idb";

import { ApiError, callApi } from "../api-client";
import { authEvent } from "../events/auth";
import { connectionEvent } from "../events/connection";
import { getAuthenticatedUser } from "../firebase";
import { queryClient } from "../queries";
import { showSuccessNotification } from "../states/notifications";

export type PendingLessonPayload = {
  lessonId: string;
  wpm: number;
  acc: number;
  testDuration: number;
  incompleteTestSeconds: number;
  afkDuration: number;
  practiceRewardCategory?: string;
};

type PendingLesson = {
  key: string;
  uid: string;
  payload: PendingLessonPayload;
  queuedAt: number;
};

type PendingLessonsDb = DBSchema & {
  lessons: {
    key: string;
    value: PendingLesson;
    indexes: { "by-uid": string };
  };
};

const MAX_PENDING_PER_USER = 20;

let dbPromise: Promise<IDBPDatabase<PendingLessonsDb>> | undefined;
async function getDbPromise(): Promise<IDBPDatabase<PendingLessonsDb>> {
  dbPromise ??= openDB<PendingLessonsDb>("gfa-pending-lessons", 1, {
    upgrade(db) {
      const store = db.createObjectStore("lessons", { keyPath: "key" });
      store.createIndex("by-uid", "uid");
    },
  });
  return dbPromise;
}

let syncing = false;

/** 4xx that retrying can't fix (bad result); auth/timeout/rate-limit are retryable. */
export function isPermanentApiError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status < 500 &&
    ![401, 408, 429].includes(error.status)
  );
}

/** Keep a lesson completion that failed to reach the server, to retry later. */
export async function queuePendingLesson(
  uid: string,
  payload: PendingLessonPayload,
): Promise<void> {
  const db = await getDbPromise();
  const tx = db.transaction("lessons", "readwrite");
  const store = tx.objectStore("lessons");
  const existing = await store.index("by-uid").getAll(uid);
  const overflow = existing
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .slice(0, Math.max(0, existing.length - MAX_PENDING_PER_USER + 1));
  await Promise.all(overflow.map(async (item) => store.delete(item.key)));
  const queuedAt = Date.now();
  await store.put({
    key: `${uid}:${payload.lessonId}:${queuedAt}`,
    uid,
    payload,
    queuedAt,
  });
  await tx.done;
}

/** One API call per queued lesson; no-op (no network) when the queue is empty. */
export async function syncPendingLessons(): Promise<void> {
  const user = getAuthenticatedUser();
  if (syncing || user === null || !navigator.onLine) return;
  syncing = true;
  let uploaded = 0;
  try {
    const db = await getDbPromise();
    const pending = (await db.getAllFromIndex("lessons", "by-uid", user.uid))
      .sort((a, b) => a.queuedAt - b.queuedAt)
      .slice(0, 10);

    for (const item of pending) {
      try {
        const res = await callApi<{ ok: boolean }>(
          "/api/complete-lesson",
          item.payload,
        );
        await db.delete("lessons", item.key);
        if (res.ok) uploaded++;
      } catch (error) {
        // 4xx is permanent (invalid result), so drop it; network/server
        // failures stay queued for the next reconnect.
        if (isPermanentApiError(error)) {
          await db.delete("lessons", item.key);
          continue;
        }
        break;
      }
    }
  } catch (e) {
    console.error("Failed to sync pending lessons:", e);
  } finally {
    syncing = false;
  }

  if (uploaded > 0) {
    void queryClient.invalidateQueries({ queryKey: ["lessonProgress"] });
    void queryClient.invalidateQueries({ queryKey: ["userLessonStats"] });
    void queryClient.invalidateQueries({ queryKey: ["weeklyQuests"] });
    showSuccessNotification(
      `${uploaded} saved lesson${uploaded === 1 ? "" : "s"} uploaded`,
    );
  }
}

authEvent.subscribe((event) => {
  if (event.type === "snapshotUpdated" && event.data.isInitial) {
    void syncPendingLessons();
  }
});

connectionEvent.subscribe((online) => {
  if (online) void syncPendingLessons();
});

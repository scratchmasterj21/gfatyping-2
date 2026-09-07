import { CompletedEvent } from "@monkeytype/schemas/results";
import { DBSchema, openDB } from "idb";

import { ApiError, callApi } from "../api-client";
import { authEvent } from "../events/auth";
import { connectionEvent } from "../events/connection";
import { getAuthenticatedUser } from "../firebase";
import { showSuccessNotification } from "../states/notifications";

type PendingResult = {
  key: string;
  uid: string;
  result: CompletedEvent;
  queuedAt: number;
};

type PendingResultsDb = DBSchema & {
  results: {
    key: string;
    value: PendingResult;
    indexes: { "by-uid": string };
  };
};

type SubmitResultResponse = {
  ok: boolean;
  insertedId?: string;
};

const MAX_PENDING_PER_USER = 100;
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

const dbPromise = openDB<PendingResultsDb>("gfa-pending-results", 1, {
  upgrade(db) {
    const store = db.createObjectStore("results", { keyPath: "key" });
    store.createIndex("by-uid", "uid");
  },
});

let syncing = false;

export async function queuePendingResult(
  uid: string,
  result: CompletedEvent,
): Promise<void> {
  const db = await dbPromise;
  const tx = db.transaction("results", "readwrite");
  const store = tx.objectStore("results");
  const existing = await store.index("by-uid").getAll(uid);
  const overflow = existing
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .slice(0, Math.max(0, existing.length - MAX_PENDING_PER_USER + 1));
  await Promise.all(overflow.map(async (item) => store.delete(item.key)));
  await store.put({
    key: `${uid}:${result.timestamp}`,
    uid,
    result: structuredClone(result),
    queuedAt: Date.now(),
  });
  await tx.done;
}

export async function syncPendingResults(): Promise<void> {
  const user = getAuthenticatedUser();
  if (syncing || user === null || !navigator.onLine) return;
  syncing = true;
  let uploaded = 0;
  try {
    const db = await dbPromise;
    const pending = (await db.getAllFromIndex("results", "by-uid", user.uid))
      .sort((a, b) => a.queuedAt - b.queuedAt)
      .slice(0, 10);

    for (const item of pending) {
      try {
        const response = await callApi<SubmitResultResponse>(
          "/api/submit-result",
          { result: item.result },
        );
        if (!response.ok || response.insertedId === undefined) break;
        await db.delete("results", item.key);
        uploaded++;
      } catch (error) {
        // A 4xx response is permanent (invalid/expired), so it must not block
        // newer valid results. Network, quota, and server failures stay queued.
        if (error instanceof ApiError && error.status < 500) {
          await db.delete("results", item.key);
          continue;
        }
        break;
      }
    }
  } finally {
    syncing = false;
  }

  if (uploaded > 0) {
    showSuccessNotification(
      `${uploaded} saved result${uploaded === 1 ? "" : "s"} uploaded`,
    );
  }
}

authEvent.subscribe((event) => {
  if (event.type === "snapshotUpdated" && event.data.isInitial) {
    void syncPendingResults();
  }
});

connectionEvent.subscribe((online) => {
  if (online) void syncPendingResults();
});

setInterval(() => void syncPendingResults(), SYNC_INTERVAL_MS);

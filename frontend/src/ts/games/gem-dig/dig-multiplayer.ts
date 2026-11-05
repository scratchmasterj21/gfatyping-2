import {
  DataSnapshot,
  DatabaseReference,
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";

import {
  getAuthenticatedUser,
  getRealtimeDb,
  trackRealtimeListener,
} from "../../firebase";
import { DIG_DIFFICULTIES, DIG_TIME_MS, DigDifficulty } from "./dig-rules";

/**
 * Gem Dig rooms (RTDB digRooms/{code}). Each player only writes their own
 * progress (depth / gems), throttled to about once a second, so even a full
 * room of 8 stays tiny. Everyone builds the same shaft from the room's seed.
 */

export type DigPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  depth: number;
  gems: number;
  /** ms after the start when they reached the treasure */
  finishedMs?: number;
};

export type DigRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
  seed: number;
  /** server-clock ms when digging starts (after a short countdown) */
  startedAt?: number;
  players: Record<string, DigPlayer>;
};

export const MAX_DIGGERS = 8;
/** Countdown before digging starts. */
export const START_COUNTDOWN_MS = 3000;
/** After the first player reaches the treasure, the rest get this long. */
export const FINISH_GRACE_MS = 15_000;
/** At most one progress write per player this often. */
const WRITE_EVERY_MS = 800;

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `digRooms/${code}`);
}
function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `digRooms/${code}/players/${uid}`);
}

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): DigRoom | null {
  return snapshot.exists() ? (snapshot.val() as DigRoom) : null;
}

export function digDifficultyFor(label: string): DigDifficulty {
  return (
    DIG_DIFFICULTIES.find((d) => d.label === label) ??
    (DIG_DIFFICULTIES[0] as DigDifficulty)
  );
}

let serverOffset = 0;
export async function syncDigClock(): Promise<void> {
  try {
    const snap = await get(ref(getRealtimeDb(), ".info/serverTimeOffset"));
    const v = snap.val() as unknown;
    if (typeof v === "number") serverOffset = v;
  } catch {
    // fall back to the local clock
  }
}
export const digServerNow = (): number => Date.now() + serverOffset;

/** When the match ends: time limit, or a short grace after the first finish. */
export function digEndsAt(room: DigRoom): number | undefined {
  if (room.startedAt === undefined) return undefined;
  const firstFinish = Math.min(
    ...Object.values(room.players ?? {}).map((p) => p.finishedMs ?? Infinity),
  );
  return Math.min(
    room.startedAt + DIG_TIME_MS,
    room.startedAt + firstFinish + FINISH_GRACE_MS,
  );
}

function newPlayer(user: { uid: string; name: string }): DigPlayer {
  return {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
    depth: 0,
    gems: 0,
  };
}

export async function createDigRoom(input: {
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
}): Promise<string> {
  const user = currentUser();
  const words = input.words
    .filter((w) => w.length > 0 && w.length <= 30 && !w.includes(" "))
    .slice(0, 300);
  if (words.length === 0) throw new Error("The word list is empty");
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const result = await runTransaction(roomRef(code), (existing) => {
      if (existing !== null) return;
      return {
        code,
        hostUid: user.uid,
        status: "lobby",
        createdAt: Date.now(),
        difficultyLabel: input.difficultyLabel,
        wordListLabel: input.wordListLabel,
        words,
        seed: Math.floor(Math.random() * 1_000_000_000),
        players: { [user.uid]: newPlayer(user) },
      } satisfies DigRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(code, user.uid)).update({ online: false });
      // Only the host can start, so a lobby whose host dropped is useless.
      await onDisconnect(roomRef(code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinDigRoom(rawCode: string): Promise<string> {
  const code = rawCode.trim();
  const user = currentUser();
  const room = readRoom(await get(roomRef(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") {
    throw new Error("That dig has already started");
  }
  const players = Object.values(room.players ?? {});
  if (players.length >= MAX_DIGGERS && room.players[user.uid] === undefined) {
    throw new Error("That room is full");
  }
  if (room.players[user.uid] === undefined) {
    await set(playerRef(code, user.uid), newPlayer(user));
  } else {
    await update(playerRef(code, user.uid), { online: true });
  }
  await onDisconnect(playerRef(code, user.uid)).update({ online: false });
  return code;
}

export function subscribeDigRoom(
  code: string,
  callback: (room: DigRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(roomRef(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

export async function startDigRoom(room: DigRoom): Promise<void> {
  const host = getAuthenticatedUser();
  // Keep the room if the host drops mid-dig; re-add the host presence hook
  // that cancel() also cleared.
  await onDisconnect(roomRef(room.code)).cancel();
  if (host !== null) {
    await onDisconnect(playerRef(room.code, host.uid)).update({
      online: false,
    });
  }
  await update(roomRef(room.code), {
    status: "playing",
    startedAt: digServerNow() + START_COUNTDOWN_MS,
  });
}

export async function finishDigRoom(code: string): Promise<void> {
  await update(roomRef(code), { status: "finished" });
}

export async function leaveDigRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room === null) return;
  if (room.hostUid === user.uid && room.status === "lobby") {
    await remove(roomRef(code));
  } else if (room.status === "lobby") {
    await remove(playerRef(code, user.uid));
  } else if (room.hostUid === user.uid && room.status === "finished") {
    await remove(roomRef(code));
  } else {
    // mid-dig: keep the score on the board
    await update(playerRef(code, user.uid), { online: false });
  }
}

/**
 * Throttled progress writer: call push() after every dig; it writes at most
 * once per WRITE_EVERY_MS (the finishing dig is written right away).
 */
export function createProgressWriter(code: string): {
  push: (p: { depth: number; gems: number; finishedMs?: number }) => void;
  stop: () => void;
} {
  const uid = getAuthenticatedUser()?.uid;
  let pending: { depth: number; gems: number; finishedMs?: number } | null =
    null;
  let lastWrite = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (): void => {
    timer = undefined;
    if (pending === null || uid === undefined) return;
    const p = pending;
    pending = null;
    lastWrite = Date.now();
    void update(playerRef(code, uid), p).catch(() => undefined);
  };
  return {
    push: (p) => {
      pending = p;
      if (p.finishedMs !== undefined) {
        clearTimeout(timer);
        flush();
        return;
      }
      if (timer !== undefined) return;
      timer = setTimeout(
        flush,
        Math.max(0, lastWrite + WRITE_EVERY_MS - Date.now()),
      );
    },
    stop: () => {
      clearTimeout(timer);
      flush();
    },
  };
}

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

import { getAuthenticatedUser, getRealtimeDb } from "../../firebase";

export type TossPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  score: number;
  words: number;
  accuracy: number;
  finished: boolean;
  finishedAt: number;
};

export type TossRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "countdown" | "playing" | "finished";
  createdAt: number;
  startAt?: number;
  durationSec: 30 | 60;
  seed: number;
  wordListLabel: string;
  words: string[];
  players: Record<string, TossPlayer>;
};

const MAX_PLAYERS = 8;

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `tossRooms/${code}`);
}

function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `tossRooms/${code}/players/${uid}`);
}

function currentPlayer(): TossPlayer {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return {
    uid: user.uid,
    name: user.displayName ?? "Student",
    joinedAt: Date.now(),
    online: true,
    score: 0,
    words: 0,
    accuracy: 100,
    finished: false,
    finishedAt: 0,
  };
}

function readRoom(snapshot: DataSnapshot): TossRoom | null {
  return snapshot.exists() ? (snapshot.val() as TossRoom) : null;
}

export async function createTossRoom(input: {
  durationSec: 30 | 60;
  wordListLabel: string;
  words: string[];
}): Promise<string> {
  const player = currentPlayer();
  const words = input.words
    .filter((word) => word.length > 0 && word.length <= 60)
    .slice(0, 200);
  if (words.length === 0) throw new Error("The word list is empty");
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const result = await runTransaction(roomRef(code), (existing) => {
      if (existing !== null) return;
      return {
        code,
        hostUid: player.uid,
        status: "lobby",
        createdAt: Date.now(),
        durationSec: input.durationSec,
        seed: Math.floor(Math.random() * 2_147_483_647),
        wordListLabel: input.wordListLabel,
        words,
        players: { [player.uid]: player },
      } satisfies TossRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(code, player.uid)).update({ online: false });
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinTossRoom(rawCode: string): Promise<string> {
  const code = rawCode.trim();
  const player = currentPlayer();
  const room = readRoom(await get(roomRef(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") {
    throw new Error("That match has already started");
  }
  if (
    Object.keys(room.players ?? {}).length >= MAX_PLAYERS &&
    room.players[player.uid] === undefined
  ) {
    throw new Error("That room is full");
  }
  await set(playerRef(code, player.uid), player);
  await onDisconnect(playerRef(code, player.uid)).update({ online: false });
  return code;
}

export function subscribeTossRoom(
  code: string,
  callback: (room: TossRoom | null) => void,
): () => void {
  return onValue(roomRef(code), (snapshot) => callback(readRoom(snapshot)));
}

export async function startTossRoom(code: string): Promise<void> {
  await update(roomRef(code), {
    status: "countdown",
    startAt: Date.now() + 3000,
  });
}

export async function markTossRoomPlaying(code: string): Promise<void> {
  await update(roomRef(code), { status: "playing" });
}

export async function finishTossRoom(code: string): Promise<void> {
  await update(roomRef(code), { status: "finished" });
}

export async function updateTossPlayer(
  code: string,
  stats: Pick<TossPlayer, "score" | "words" | "accuracy" | "finished">,
): Promise<void> {
  const player = currentPlayer();
  await update(playerRef(code, player.uid), {
    score: Math.max(0, stats.score),
    words: Math.max(0, stats.words),
    accuracy: Math.max(0, Math.min(100, stats.accuracy)),
    finished: stats.finished,
    finishedAt: stats.finished ? Date.now() : 0,
    online: true,
  });
}

export async function leaveTossRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room?.hostUid === user.uid) await remove(roomRef(code));
  else await remove(playerRef(code, user.uid));
}

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

export type RacerPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  finishedAt: number;
};

export type RacerRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "countdown" | "playing" | "finished";
  createdAt: number;
  startAt?: number;
  durationSec: 30 | 60;
  targetChars: number;
  wordListLabel: string;
  words: string[];
  players: Record<string, RacerPlayer>;
};

const MAX_PLAYERS = 8;

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `racerRooms/${code}`);
}

function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `racerRooms/${code}/players/${uid}`);
}

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to race together");
  return { uid: user.uid, name: user.displayName ?? "Student" };
}

function newPlayer(): RacerPlayer {
  const user = currentUser();
  return {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
    progress: 0,
    wpm: 0,
    accuracy: 100,
    finished: false,
    finishedAt: 0,
  };
}

function readRoom(snapshot: DataSnapshot): RacerRoom | null {
  return snapshot.exists() ? (snapshot.val() as RacerRoom) : null;
}

export async function createRacerRoom(input: {
  durationSec: 30 | 60;
  wordListLabel: string;
  words: string[];
}): Promise<string> {
  const player = newPlayer();
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
        targetChars: input.durationSec === 30 ? 100 : 200,
        wordListLabel: input.wordListLabel,
        words,
        players: { [player.uid]: player },
      } satisfies RacerRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(code, player.uid)).update({ online: false });
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinRacerRoom(rawCode: string): Promise<string> {
  const code = rawCode.trim();
  const player = newPlayer();
  const room = readRoom(await get(roomRef(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("That race has already started");
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

export function subscribeRacerRoom(
  code: string,
  callback: (room: RacerRoom | null) => void,
): () => void {
  return onValue(roomRef(code), (snapshot) => callback(readRoom(snapshot)));
}

export async function startRacerRoom(code: string): Promise<void> {
  await update(roomRef(code), {
    status: "countdown",
    startAt: Date.now() + 3000,
  });
}

export async function markRacerRoomPlaying(code: string): Promise<void> {
  await update(roomRef(code), { status: "playing" });
}

export async function finishRacerRoom(code: string): Promise<void> {
  await update(roomRef(code), { status: "finished" });
}

export async function updateRacerPlayer(
  code: string,
  stats: Pick<RacerPlayer, "progress" | "wpm" | "accuracy" | "finished">,
): Promise<void> {
  const user = currentUser();
  await update(playerRef(code, user.uid), {
    progress: Math.max(0, Math.min(1, stats.progress)),
    wpm: Math.max(0, stats.wpm),
    accuracy: Math.max(0, Math.min(100, stats.accuracy)),
    finished: stats.finished,
    finishedAt: stats.finished ? Date.now() : 0,
    online: true,
  });
}

export async function leaveRacerRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room?.hostUid === user.uid) await remove(roomRef(code));
  else await remove(playerRef(code, user.uid));
}

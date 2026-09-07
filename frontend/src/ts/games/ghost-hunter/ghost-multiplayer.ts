import {
  DataSnapshot,
  DatabaseReference,
  get,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";

import { getAuthenticatedUser, getRealtimeDb } from "../../firebase";

export type GhostRoomStatus = "lobby" | "countdown" | "playing" | "finished";

export type GhostRoomPlayer = {
  uid: string;
  name: string;
  online: boolean;
  joinedAt: number;
  score: number;
  wave: number;
  finished: boolean;
  position: number;
  facing: "left" | "right";
};

export type GhostRoom = {
  code: string;
  hostUid: string;
  status: GhostRoomStatus;
  createdAt: number;
  startAt?: number;
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
  players: Record<string, GhostRoomPlayer>;
};

export type SharedGhost = {
  word: string;
  side: "left" | "right";
  x: number;
  y: number;
  frozen: boolean;
};

export type GhostWorld = {
  wave: number;
  teamScore: number;
  leftLogHp: number;
  rightLogHp: number;
  ghosts: SharedGhost[];
  finished: boolean;
  cleared: boolean;
  updatedAt: number;
};

export type GhostAction = {
  uid: string;
  word: string;
  createdAt: number;
};

const MAX_PLAYERS = 8;

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `ghostRooms/${code}`);
}

function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `ghostRooms/${code}/players/${uid}`);
}

function worldRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `ghostWorlds/${code}`);
}

function actionsRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `ghostActions/${code}`);
}

function roomFromSnapshot(snap: DataSnapshot): GhostRoom | null {
  return snap.exists() ? (snap.val() as GhostRoom) : null;
}

function code(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: user.displayName ?? "Student" };
}

export async function createGhostRoom(input: {
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
}): Promise<string> {
  const user = currentUser();
  const words = input.words
    .filter((word) => word.length > 0 && word.length <= 60)
    .slice(0, 200);
  if (words.length === 0) throw new Error("The word list is empty");
  for (let attempt = 0; attempt < 10; attempt++) {
    const roomCode = code();
    const result = await runTransaction(roomRef(roomCode), (existing) => {
      if (existing !== null) return;
      const player: GhostRoomPlayer = {
        uid: user.uid,
        name: user.name,
        online: true,
        joinedAt: Date.now(),
        score: 0,
        wave: 1,
        finished: false,
        position: 0.5,
        facing: "right",
      };
      return {
        code: roomCode,
        hostUid: user.uid,
        status: "lobby",
        createdAt: Date.now(),
        difficultyLabel: input.difficultyLabel,
        wordListLabel: input.wordListLabel,
        words,
        players: { [user.uid]: player },
      } satisfies GhostRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(roomCode, user.uid)).update({
        online: false,
      });
      return roomCode;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinGhostRoom(rawCode: string): Promise<string> {
  const user = currentUser();
  const roomCode = rawCode.trim();
  const snap = await get(roomRef(roomCode));
  const room = roomFromSnapshot(snap);
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("That game has already started");
  const players = Object.values(room.players ?? {});
  if (players.length >= MAX_PLAYERS && room.players[user.uid] === undefined) {
    throw new Error("That room is full");
  }
  await set(playerRef(roomCode, user.uid), {
    uid: user.uid,
    name: user.name,
    online: true,
    joinedAt: Date.now(),
    score: 0,
    wave: 1,
    finished: false,
    position: 0.5,
    facing: "right",
  } satisfies GhostRoomPlayer);
  await onDisconnect(playerRef(roomCode, user.uid)).update({ online: false });
  return roomCode;
}

export function subscribeGhostRoom(
  roomCode: string,
  callback: (room: GhostRoom | null) => void,
): () => void {
  return onValue(roomRef(roomCode), (snap) => callback(roomFromSnapshot(snap)));
}

export async function startGhostRoom(roomCode: string): Promise<void> {
  await update(roomRef(roomCode), {
    status: "countdown",
    startAt: Date.now() + 3000,
  });
}

export async function markGhostRoomPlaying(roomCode: string): Promise<void> {
  await update(roomRef(roomCode), { status: "playing" });
}

export async function markGhostPlayerFinished(
  roomCode: string,
  wave: number,
): Promise<void> {
  const user = currentUser();
  await update(playerRef(roomCode, user.uid), {
    wave,
    finished: true,
    online: true,
  });
}

export async function updateGhostPlayerPosition(
  roomCode: string,
  position: number,
  facing: "left" | "right",
): Promise<void> {
  const user = currentUser();
  await update(playerRef(roomCode, user.uid), {
    position: Math.max(0, Math.min(1, position)),
    facing,
    online: true,
  });
}

export async function finishGhostRoom(roomCode: string): Promise<void> {
  await update(roomRef(roomCode), { status: "finished" });
}

export async function publishGhostWorld(
  roomCode: string,
  world: GhostWorld,
): Promise<void> {
  await set(worldRef(roomCode), world);
}

export function subscribeGhostWorld(
  roomCode: string,
  callback: (world: GhostWorld | null) => void,
): () => void {
  return onValue(worldRef(roomCode), (snap) =>
    callback(snap.exists() ? (snap.val() as GhostWorld) : null),
  );
}

export async function submitGhostAction(
  roomCode: string,
  word: string,
): Promise<void> {
  const user = currentUser();
  await set(push(actionsRef(roomCode)), {
    uid: user.uid,
    word,
    createdAt: Date.now(),
  } satisfies GhostAction);
}

export function subscribeGhostActions(
  roomCode: string,
  callback: (action: GhostAction) => void,
): () => void {
  return onChildAdded(actionsRef(roomCode), (snap) => {
    callback(snap.val() as GhostAction);
    void remove(snap.ref);
  });
}

export async function awardGhostPlayer(
  roomCode: string,
  uid: string,
  points: number,
  wave: number,
): Promise<void> {
  await runTransaction(playerRef(roomCode, uid), (existing) => {
    if (existing === null) return;
    const player = existing as GhostRoomPlayer;
    return {
      ...player,
      score: Math.max(0, player.score + points),
      wave: Math.max(player.wave, wave),
    } satisfies GhostRoomPlayer;
  });
}

export async function leaveGhostRoom(roomCode: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const snap = await get(roomRef(roomCode));
  const room = roomFromSnapshot(snap);
  if (room?.hostUid === user.uid) {
    // World/action permissions depend on the room's hostUid, so remove those
    // before deleting the room that grants the host access.
    await Promise.all([
      remove(worldRef(roomCode)),
      remove(actionsRef(roomCode)),
    ]);
    await remove(roomRef(roomCode));
  } else {
    await remove(playerRef(roomCode, user.uid));
  }
}

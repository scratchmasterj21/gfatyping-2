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
import {
  applyBoom,
  applyPass,
  bombDifficultyFor,
  BombState,
  MAX_BOMB_PLAYERS,
  newBombMatch,
} from "./bomb-rules";

/**
 * Word Bomb rooms (RTDB bombRooms/{code}). The game is written when the bomb
 * is passed or goes off; the holder also shares what they're typing
 * (`typing`, one tiny write per letter) so everyone can watch. Rounds use
 * the database's server clock.
 */

export type BombPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
};

export type BombTyping = { seq: number; text: string };

export type BombRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  players: Record<string, BombPlayer>;
  game?: BombState;
  typing?: BombTyping;
};

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `bombRooms/${code}`);
}
function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `bombRooms/${code}/players/${uid}`);
}
function gameRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `bombRooms/${code}/game`);
}

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): BombRoom | null {
  return snapshot.exists() ? (snapshot.val() as BombRoom) : null;
}

let serverOffset = 0;
/** Read the database clock offset so everyone times the fuse the same. */
export async function syncServerClock(): Promise<void> {
  try {
    const snap = await get(ref(getRealtimeDb(), ".info/serverTimeOffset"));
    const v = snap.val() as unknown;
    if (typeof v === "number") serverOffset = v;
  } catch {
    // fall back to the local clock
  }
}
export const serverNow = (): number => Date.now() + serverOffset;

export async function createBombRoom(difficultyLabel: string): Promise<string> {
  const user = currentUser();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const result = await runTransaction(roomRef(code), (existing) => {
      if (existing !== null) return;
      return {
        code,
        hostUid: user.uid,
        status: "lobby",
        createdAt: Date.now(),
        difficultyLabel,
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.name,
            joinedAt: Date.now(),
            online: true,
          },
        },
      } satisfies BombRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(code, user.uid)).update({ online: false });
      // a lobby only its host can start is useless once the host drops
      await onDisconnect(roomRef(code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinBombRoom(rawCode: string): Promise<string> {
  const code = rawCode.trim();
  const user = currentUser();
  const room = readRoom(await get(roomRef(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") {
    throw new Error("That game has already started");
  }
  const players = Object.values(room.players ?? {});
  if (
    players.length >= MAX_BOMB_PLAYERS &&
    room.players[user.uid] === undefined
  ) {
    throw new Error("That room is full");
  }
  await set(playerRef(code, user.uid), {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
  } satisfies BombPlayer);
  await onDisconnect(playerRef(code, user.uid)).update({ online: false });
  return code;
}

export function subscribeBombRoom(
  code: string,
  callback: (room: BombRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(roomRef(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

export async function startBombRoom(room: BombRoom): Promise<void> {
  const host = getAuthenticatedUser();
  // the game is under way: keep the room if the host drops now (cancelling
  // also clears the host's presence hook, so set that again)
  await onDisconnect(roomRef(room.code)).cancel();
  if (host !== null) {
    await onDisconnect(playerRef(room.code, host.uid)).update({
      online: false,
    });
  }
  const order = Object.values(room.players)
    .filter((p) => p.online)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => p.uid);
  const d = bombDifficultyFor(room.difficultyLabel);
  await update(roomRef(room.code), {
    status: "playing",
    game: newBombMatch(order, d, serverNow(), Math.random),
  });
}

/** Change the game only if nobody else did first (same seq). */
async function advance(
  code: string,
  expectSeq: number,
  next: (g: BombState) => BombState | null,
): Promise<boolean> {
  const result = await runTransaction(gameRef(code), (current) => {
    const g = current as BombState | null;
    // first pass may run on an empty local cache: propose "no change" so the
    // server answers with the real game and the transaction runs again
    if (g === null) return null;
    if (g.seq !== expectSeq) return;
    return next(g) ?? undefined;
  });
  return result.committed && result.snapshot.val() !== null;
}

/** I typed the word: pass the bomb on. */
export async function passBomb(
  room: BombRoom,
  game: BombState,
  uid: string,
): Promise<boolean> {
  const d = bombDifficultyFor(room.difficultyLabel);
  return advance(room.code, game.seq, (g) =>
    applyPass(g, uid, d, serverNow(), Math.random),
  );
}

/** The fuse ran out (anyone may report it). */
export async function boomBomb(
  room: BombRoom,
  game: BombState,
): Promise<boolean> {
  const d = bombDifficultyFor(room.difficultyLabel);
  return advance(room.code, game.seq, (g) =>
    applyBoom(g, d, serverNow(), Math.random),
  );
}

/** Share what the holder is typing so everyone can watch. */
export async function shareTyping(
  code: string,
  seq: number,
  text: string,
): Promise<void> {
  await set(ref(getRealtimeDb(), `bombRooms/${code}/typing`), {
    seq,
    text: text.slice(0, 30),
  } satisfies BombTyping);
}

export async function finishBombRoom(code: string): Promise<void> {
  await update(roomRef(code), { status: "finished" });
}

export async function leaveBombRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room?.hostUid === user.uid) await remove(roomRef(code));
  else await remove(playerRef(code, user.uid));
}

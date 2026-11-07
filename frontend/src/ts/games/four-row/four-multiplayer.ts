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
  applyDrop,
  applyTimeout,
  Disc,
  fourDifficultyFor,
  FourState,
  newMatch,
} from "./four-rules";

/**
 * Four in a Row rooms (RTDB fourRooms/{code}). Only written when a piece
 * drops or a round times out - at most ~45 writes a board - so a match costs
 * almost nothing. Both players use the database's server clock for rounds.
 */

export type FourPlayer = {
  uid: string;
  name: string;
  disc: Disc;
  joinedAt: number;
  online: boolean;
};

export type FourRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  players: Record<string, FourPlayer>;
  game?: FourState;
};

const MAX_PLAYERS = 2;

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `fourRooms/${code}`);
}
function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `fourRooms/${code}/players/${uid}`);
}
function gameRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `fourRooms/${code}/game`);
}

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): FourRoom | null {
  return snapshot.exists() ? (snapshot.val() as FourRoom) : null;
}

let serverOffset = 0;
/** Read the database clock offset so both players time rounds the same. */
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

export async function createFourRoom(difficultyLabel: string): Promise<string> {
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
            disc: "r",
            joinedAt: Date.now(),
            online: true,
          },
        },
      } satisfies FourRoom;
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

export async function joinFourRoom(rawCode: string): Promise<string> {
  const code = rawCode.trim();
  const user = currentUser();
  const room = readRoom(await get(roomRef(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") {
    throw new Error("That match has already started");
  }
  const players = Object.values(room.players ?? {});
  if (players.length >= MAX_PLAYERS && room.players[user.uid] === undefined) {
    throw new Error("That room is full");
  }
  await set(playerRef(code, user.uid), {
    uid: user.uid,
    name: user.name,
    disc: "y",
    joinedAt: Date.now(),
    online: true,
  } satisfies FourPlayer);
  await onDisconnect(playerRef(code, user.uid)).update({ online: false });
  return code;
}

export function subscribeFourRoom(
  code: string,
  callback: (room: FourRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(roomRef(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

export async function startFourRoom(room: FourRoom): Promise<void> {
  const host = getAuthenticatedUser();
  // the match is under way: keep the room if the host drops now (cancelling
  // also clears the host's presence hook, so set that again)
  await onDisconnect(roomRef(room.code)).cancel();
  if (host !== null) {
    await onDisconnect(playerRef(room.code, host.uid)).update({
      online: false,
    });
  }
  const d = fourDifficultyFor(room.difficultyLabel);
  await update(roomRef(room.code), {
    status: "playing",
    game: newMatch(d.words, d.roundMs, serverNow(), Math.random),
  });
}

/**
 * Change the game in a transaction. `same` says whether the game is still in
 * the state the change was meant for; otherwise nothing is written.
 */
async function advance(
  code: string,
  same: (g: FourState) => boolean,
  next: (g: FourState) => FourState | null,
): Promise<boolean> {
  const result = await runTransaction(gameRef(code), (current) => {
    const g = current as FourState | null;
    // first pass may run on an empty local cache: propose "no change" so the
    // server answers with the real game and the transaction runs again
    if (g === null) return null;
    if (!same(g)) return;
    return next(g) ?? undefined;
  });
  return result.committed && result.snapshot.val() !== null;
}

/**
 * I typed a column's word: drop my piece. Works even if the other player
 * dropped a moment earlier (pieces just stack), but not once the round has
 * moved on.
 */
export async function dropFourPiece(
  room: FourRoom,
  game: FourState,
  disc: Disc,
  col: number,
): Promise<boolean> {
  const pool = fourDifficultyFor(room.difficultyLabel).words;
  return advance(
    room.code,
    (g) => g.boardNo === game.boardNo && g.round === game.round,
    (g) => applyDrop(g, disc, col, pool, serverNow(), Math.random),
  );
}

/** The round's time is up: move on (either player may call it). */
export async function timeoutFourRound(
  room: FourRoom,
  game: FourState,
): Promise<boolean> {
  return advance(
    room.code,
    (g) => g.seq === game.seq,
    (g) => applyTimeout(g, serverNow()),
  );
}

export async function finishFourRoom(code: string): Promise<void> {
  await update(roomRef(code), { status: "finished" });
}

export async function leaveFourRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room?.hostUid === user.uid) await remove(roomRef(code));
  else await remove(playerRef(code, user.uid));
}

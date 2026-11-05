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
  initialPong,
  onMiss,
  onReturn,
  PongState,
  Side,
  speedFor,
  wordForRally,
  PONG_DIFFICULTIES,
  PongDifficulty,
} from "./pong-rules";

/**
 * Word Ping-Pong rooms (RTDB pongRooms/{code}). Turn-based: only the player
 * who has the ball writes, about once per hit, so a match costs almost
 * nothing. Both players agree on time via the database's server clock.
 */

export type PongPlayer = {
  uid: string;
  name: string;
  side: Side;
  joinedAt: number;
  online: boolean;
};

/** Live match: the shared game state plus when the ball was sent. */
export type PongGame = PongState & {
  /** server-clock ms when this ball was sent */
  sentAt: number;
  /** travel time of this ball, ms */
  speedMs: number;
};

export type PongRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
  players: Record<string, PongPlayer>;
  game?: PongGame;
};

const MAX_PLAYERS = 2;
/** Pause before the next ball after a point (and before the first serve). */
export const POINT_PAUSE_MS = 1500;

function roomRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `pongRooms/${code}`);
}
function playerRef(code: string, uid: string): DatabaseReference {
  return ref(getRealtimeDb(), `pongRooms/${code}/players/${uid}`);
}
function gameRef(code: string): DatabaseReference {
  return ref(getRealtimeDb(), `pongRooms/${code}/game`);
}

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): PongRoom | null {
  return snapshot.exists() ? (snapshot.val() as PongRoom) : null;
}

export function difficultyFor(label: string): PongDifficulty {
  return (
    PONG_DIFFICULTIES.find((d) => d.label === label) ??
    (PONG_DIFFICULTIES[0] as PongDifficulty)
  );
}

let serverOffset = 0;
/** Read the database clock offset so both players time the ball the same. */
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

export async function createPongRoom(input: {
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
}): Promise<string> {
  const user = currentUser();
  const words = input.words
    .filter((w) => w.length > 0 && w.length <= 30 && !w.includes(" "))
    .slice(0, 200);
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
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.name,
            side: "left",
            joinedAt: Date.now(),
            online: true,
          },
        },
      } satisfies PongRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(code, user.uid)).update({ online: false });
      // A lobby only its host can start is useless once the host drops -
      // delete it then (cancelled in startPongRoom).
      await onDisconnect(roomRef(code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinPongRoom(rawCode: string): Promise<string> {
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
    side: "right",
    joinedAt: Date.now(),
    online: true,
  } satisfies PongPlayer);
  await onDisconnect(playerRef(code, user.uid)).update({ online: false });
  return code;
}

export function subscribePongRoom(
  code: string,
  callback: (room: PongRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(roomRef(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

/** Host serves: the guest (right) gets the first ball. */
export async function startPongRoom(room: PongRoom): Promise<void> {
  const host = getAuthenticatedUser();
  // The match is under way: keep the room if the host drops now. Cancelling
  // also clears the host's own presence hook, so set that one again.
  await onDisconnect(roomRef(room.code)).cancel();
  if (host !== null) {
    await onDisconnect(playerRef(room.code, host.uid)).update({
      online: false,
    });
  }
  const d = difficultyFor(room.difficultyLabel);
  const first = initialPong(wordForRally(room.words, 0, 1), "right");
  await update(roomRef(room.code), {
    status: "playing",
    game: {
      ...first,
      sentAt: serverNow() + POINT_PAUSE_MS,
      speedMs: speedFor(d, 0),
    },
  });
}

/**
 * Advance the match only if nobody else already did (same seq). Returns
 * false if the update lost the race.
 */
async function advance(
  room: PongRoom,
  expectSeq: number,
  next: (g: PongGame) => PongState,
  delayMs = 0,
): Promise<boolean> {
  const d = difficultyFor(room.difficultyLabel);
  const result = await runTransaction(gameRef(room.code), (current) => {
    const g = current as PongGame | null;
    // First pass may run on an empty local cache: propose "no change" so the
    // server answers with the real game and the transaction runs again.
    if (g === null) return null;
    if (g.seq !== expectSeq || g.over) return;
    const state = next(g);
    return {
      ...state,
      sentAt: serverNow() + delayMs,
      speedMs: speedFor(d, state.hits),
    };
  });
  const after = result.snapshot.val() as PongGame | null;
  return result.committed && after?.seq === expectSeq + 1;
}

/** The player with the ball typed it: send it back. */
export async function returnPongBall(
  room: PongRoom,
  game: PongGame,
): Promise<boolean> {
  return advance(room, game.seq, (g) =>
    onReturn(g, wordForRally(room.words, g.hits + 1, g.seq + 1)),
  );
}

/**
 * The ball got past the receiver. Normally the receiver reports their own
 * miss; the other player may report it too if the receiver went quiet.
 */
export async function missPongBall(
  room: PongRoom,
  game: PongGame,
): Promise<boolean> {
  return advance(
    room,
    game.seq,
    (g) => onMiss(g, wordForRally(room.words, 0, g.seq + 1)),
    POINT_PAUSE_MS,
  );
}

export async function finishPongRoom(code: string): Promise<void> {
  await update(roomRef(code), { status: "finished" });
}

export async function leavePongRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room?.hostUid === user.uid) await remove(roomRef(code));
  else await remove(playerRef(code, user.uid));
}

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

/**
 * Real-time rooms for Word Defender (co-op: defenderRooms), Balloon Pop
 * (versus: balloonRooms) and Type Toss (one shared stall: tossArena). Every player runs the same seeded game; the room
 * only carries what can't be worked out locally:
 *   kills/{id}       who finished a target first (first write wins)
 *   hits/{id}        ships that reached the base (host decides)
 *   fx/{n}           power-ups used (everyone's game reacts)
 *   sends/{uid}/{n}  extra balloons sent to a player
 * Players write their own score / lives about twice a second at most.
 */

export type ArcadeKind = "defenderRooms" | "balloonRooms" | "tossArena";

export type ArcadePlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  score: number;
  lives: number;
  done: boolean;
};

export type ArcadeFx = { kind: string; at: number; uid: string };
export type ArcadeSend = { word: string; at: number };

export type ArcadeRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  startAt?: number;
  seed?: number;
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
  players: Record<string, ArcadePlayer>;
  kills?: Record<string, string>;
  hits?: Record<string, boolean>;
  fx?: Record<string, ArcadeFx>;
  sends?: Record<string, Record<string, ArcadeSend>>;
};

const MAX_PLAYERS: Record<ArcadeKind, number> = {
  defenderRooms: 4,
  balloonRooms: 2,
  tossArena: 4,
};

const path = (kind: ArcadeKind, code: string, sub = ""): DatabaseReference =>
  ref(getRealtimeDb(), `${kind}/${code}${sub}`);

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

const readRoom = (snap: DataSnapshot): ArcadeRoom | null =>
  snap.exists() ? (snap.val() as ArcadeRoom) : null;

function newPlayer(lives: number): ArcadePlayer {
  const user = currentUser();
  return {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
    score: 0,
    lives,
    done: false,
  };
}

let serverOffset = 0;
/** Read the database clock offset so everyone's game runs in step. */
export async function syncArcadeClock(): Promise<void> {
  try {
    const v = (
      await get(ref(getRealtimeDb(), ".info/serverTimeOffset"))
    ).val() as unknown;
    if (typeof v === "number") serverOffset = v;
  } catch {
    // local clock it is
  }
}
export const arcadeNow = (): number => Date.now() + serverOffset;

export async function createArcadeRoom(
  kind: ArcadeKind,
  input: {
    difficultyLabel: string;
    wordListLabel: string;
    words: string[];
    lives: number;
  },
): Promise<string> {
  const player = newPlayer(input.lives);
  const words = input.words
    .filter((w) => w.length > 0 && w.length <= 30 && !w.includes(" "))
    .slice(0, 200);
  if (words.length === 0) throw new Error("The word list is empty");
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const result = await runTransaction(path(kind, code), (existing) => {
      if (existing !== null) return;
      return {
        code,
        hostUid: player.uid,
        status: "lobby",
        createdAt: Date.now(),
        difficultyLabel: input.difficultyLabel,
        wordListLabel: input.wordListLabel,
        words,
        players: { [player.uid]: player },
      } satisfies ArcadeRoom;
    });
    if (result.committed) {
      await onDisconnect(path(kind, code, `/players/${player.uid}`)).update({
        online: false,
      });
      await onDisconnect(path(kind, code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinArcadeRoom(
  kind: ArcadeKind,
  rawCode: string,
  lives: number,
): Promise<string> {
  const code = rawCode.trim();
  const player = newPlayer(lives);
  const room = readRoom(await get(path(kind, code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("That game has already started");
  if (
    Object.keys(room.players ?? {}).length >= MAX_PLAYERS[kind] &&
    room.players[player.uid] === undefined
  ) {
    throw new Error("That room is full");
  }
  await set(path(kind, code, `/players/${player.uid}`), player);
  await onDisconnect(path(kind, code, `/players/${player.uid}`)).update({
    online: false,
  });
  return code;
}

export function subscribeArcadeRoom(
  kind: ArcadeKind,
  code: string,
  cb: (room: ArcadeRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(path(kind, code), (snap) => cb(readRoom(snap))),
  );
}

/** Host: start (or restart) the game for everyone in 3 seconds. */
export async function startArcadeRoom(
  kind: ArcadeKind,
  room: ArcadeRoom,
  lives: number,
): Promise<void> {
  await onDisconnect(path(kind, room.code)).cancel();
  const me = currentUser();
  await onDisconnect(path(kind, room.code, `/players/${me.uid}`)).update({
    online: false,
  });
  const players: Record<string, ArcadePlayer> = {};
  for (const [uid, p] of Object.entries(room.players ?? {})) {
    if (p.online) players[uid] = { ...p, score: 0, lives, done: false };
  }
  await update(path(kind, room.code), {
    status: "playing",
    startAt: arcadeNow() + 3000,
    seed: Math.floor(Math.random() * 2 ** 31),
    players,
    kills: null,
    hits: null,
    fx: null,
    sends: null,
  });
}

export async function finishArcadeRoom(
  kind: ArcadeKind,
  code: string,
): Promise<void> {
  await update(path(kind, code), { status: "finished" });
}

/** My score / lives (throttle calls: ~2 a second). */
export async function updateArcadePlayer(
  kind: ArcadeKind,
  code: string,
  s: Pick<ArcadePlayer, "score" | "lives" | "done">,
): Promise<void> {
  const me = currentUser();
  await update(path(kind, code, `/players/${me.uid}`), {
    score: Math.max(0, Math.round(s.score)),
    lives: Math.max(0, Math.round(s.lives)),
    done: s.done,
    online: true,
  });
}

/** Claim a target; false if someone else got it first. */
export async function claimKill(
  kind: ArcadeKind,
  code: string,
  id: string,
): Promise<boolean> {
  const me = currentUser();
  const result = await runTransaction(
    path(kind, code, `/kills/${id}`),
    (cur: string | null) => (cur === null ? me.uid : undefined),
  );
  return result.committed && result.snapshot.val() === me.uid;
}

/** Host: this ship reached the base. */
export async function markHit(
  kind: ArcadeKind,
  code: string,
  id: string,
): Promise<void> {
  await set(path(kind, code, `/hits/${id}`), true);
}

export async function sendFx(
  kind: ArcadeKind,
  code: string,
  n: string,
  fxKind: string,
): Promise<void> {
  const me = currentUser();
  await set(path(kind, code, `/fx/${n}`), {
    kind: fxKind,
    at: arcadeNow(),
    uid: me.uid,
  });
}

/** Balloon Pop: send an extra balloon to the other player. */
export async function sendBalloon(
  kind: ArcadeKind,
  code: string,
  to: string,
  n: string,
  word: string,
): Promise<void> {
  await set(path(kind, code, `/sends/${to}/${n}`), {
    word: word.slice(0, 30),
    at: arcadeNow(),
  });
}

export async function leaveArcadeRoom(
  kind: ArcadeKind,
  code: string,
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(path(kind, code)));
  if (room?.hostUid === user.uid) await remove(path(kind, code));
  else await remove(path(kind, code, `/players/${user.uid}`));
}

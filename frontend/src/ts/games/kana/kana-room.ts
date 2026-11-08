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
 * Student-hosted rooms for the romaji games (RTDB {root}/{code}), same
 * pattern as Ping-Pong / Four in a Row: the host creates a 6-digit room,
 * friends join, the host starts. The game is only written when something
 * happens (a card taken, a turn passed), so rooms cost almost nothing.
 */

export type KanaRoomPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
};

export type KanaRoom<G> = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  players: Record<string, KanaRoomPlayer>;
  game?: G;
  /** Goldfish: fish index -> uid who scooped it */
  caught?: Record<string, string>;
};

let serverOffset = 0;
/** Read the database clock offset so everyone agrees on time. */
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

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

export type KanaRoomApi<G> = {
  create: (difficultyLabel: string) => Promise<string>;
  join: (code: string) => Promise<string>;
  subscribe: (
    code: string,
    callback: (room: KanaRoom<G> | null) => void,
  ) => () => void;
  /** host: lock the room and write the first game state */
  start: (room: KanaRoom<G>, game: G) => Promise<void>;
  /** change the game in a transaction if `same` still holds */
  advance: (
    code: string,
    same: (g: G) => boolean,
    next: (g: G) => G | null,
  ) => Promise<boolean>;
  /** Goldfish: take fish `index` if nobody has */
  claim: (code: string, index: number) => Promise<boolean>;
  finish: (code: string) => Promise<void>;
  leave: (code: string) => Promise<void>;
};

export function kanaRoomApi<G>(
  root: string,
  maxPlayers: number,
): KanaRoomApi<G> {
  const roomRef = (code: string): DatabaseReference =>
    ref(getRealtimeDb(), `${root}/${code}`);
  const playerRef = (code: string, uid: string): DatabaseReference =>
    ref(getRealtimeDb(), `${root}/${code}/players/${uid}`);
  const read = (snap: DataSnapshot): KanaRoom<G> | null =>
    snap.exists() ? (snap.val() as KanaRoom<G>) : null;

  return {
    async create(difficultyLabel) {
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
          } satisfies KanaRoom<G>;
        });
        if (result.committed) {
          await onDisconnect(playerRef(code, user.uid)).update({
            online: false,
          });
          await onDisconnect(roomRef(code)).remove();
          return code;
        }
      }
      throw new Error("Could not create a room. Try again.");
    },

    async join(rawCode) {
      const code = rawCode.trim();
      const user = currentUser();
      const room = read(await get(roomRef(code)));
      if (room === null) throw new Error("Room not found");
      if (room.status !== "lobby") {
        throw new Error("That game has already started");
      }
      const players = Object.values(room.players ?? {});
      if (
        players.length >= maxPlayers &&
        room.players[user.uid] === undefined
      ) {
        throw new Error("That room is full");
      }
      await set(playerRef(code, user.uid), {
        uid: user.uid,
        name: user.name,
        joinedAt: Date.now(),
        online: true,
      } satisfies KanaRoomPlayer);
      await onDisconnect(playerRef(code, user.uid)).update({ online: false });
      return code;
    },

    subscribe(code, callback) {
      return trackRealtimeListener(
        onValue(roomRef(code), (snap) => callback(read(snap))),
      );
    },

    async start(room, game) {
      const host = getAuthenticatedUser();
      await onDisconnect(roomRef(room.code)).cancel();
      if (host !== null) {
        await onDisconnect(playerRef(room.code, host.uid)).update({
          online: false,
        });
      }
      await update(roomRef(room.code), { status: "playing", game });
    },

    async advance(code, same, next) {
      const result = await runTransaction(
        ref(getRealtimeDb(), `${root}/${code}/game`),
        (current) => {
          const g = current as G | null;
          // first pass may run on an empty cache: propose "no change" so
          // the server answers with the real game and it runs again
          if (g === null) return null;
          if (!same(g)) return;
          return next(g) ?? undefined;
        },
      );
      return result.committed && result.snapshot.val() !== null;
    },

    async claim(code, index) {
      const user = currentUser();
      const result = await runTransaction(
        ref(getRealtimeDb(), `${root}/${code}/caught/${index}`),
        (current) => (current === null ? user.uid : undefined),
      );
      return result.committed && result.snapshot.val() === user.uid;
    },

    async finish(code) {
      await update(roomRef(code), { status: "finished" });
    },

    async leave(code) {
      const user = getAuthenticatedUser();
      if (user === null) return;
      const room = read(await get(roomRef(code)));
      if (room?.hostUid === user.uid) await remove(roomRef(code));
      else await remove(playerRef(code, user.uid));
    },
  };
}

/** Players in join order (the order seats/turns use). */
export function playerOrder(room: KanaRoom<unknown>): string[] {
  return Object.values(room.players ?? {})
    .filter((p) => p.online)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => p.uid);
}

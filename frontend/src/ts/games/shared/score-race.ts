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
 * Score race rooms (RTDB scoreRaces/{code}) for games that are solo at heart:
 * everyone plays their own copy with the same words and difficulty at the
 * same time, and a live scoreboard shows who's ahead. The match ends when the
 * time runs out or everyone is done.
 */

export const SCORE_RACE_GAMES = [
  "balloon-pop",
  "fruit-ninja",
  "word-defender",
  "tower-climb",
  "snack-shop",
  "echo-keys",
] as const;
export type ScoreRaceGameId = (typeof SCORE_RACE_GAMES)[number];

export const MAX_SCORE_RACE_PLAYERS = 8;
/** 3-2-1 before the match starts. */
export const SCORE_RACE_COUNTDOWN_MS = 3000;

export type ScoreRacePlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  score: number;
  /** my game ended (out of lives / my own timer) */
  finished: boolean;
};

export type ScoreRaceRoom = {
  code: string;
  gameId: ScoreRaceGameId;
  hostUid: string;
  status: "lobby" | "countdown" | "playing" | "finished";
  createdAt: number;
  startAt?: number;
  durationSec: number;
  difficultyLabel: string;
  wordListLabel: string;
  /** empty for games that don't use words (Echo Keys) */
  words?: string[];
  players: Record<string, ScoreRacePlayer>;
};

const roomRef = (code: string): DatabaseReference =>
  ref(getRealtimeDb(), `scoreRaces/${code}`);
const playerRef = (code: string, uid: string): DatabaseReference =>
  ref(getRealtimeDb(), `scoreRaces/${code}/players/${uid}`);

function newPlayer(): ScoreRacePlayer {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return {
    uid: user.uid,
    name: (user.displayName ?? "Student").slice(0, 40),
    joinedAt: Date.now(),
    online: true,
    score: 0,
    finished: false,
  };
}

const readRoom = (snap: DataSnapshot): ScoreRaceRoom | null =>
  snap.exists() ? (snap.val() as ScoreRaceRoom) : null;

/** When the match ends (ms), or undefined before the countdown. */
export function scoreRaceEndsAt(room: ScoreRaceRoom): number | undefined {
  return room.startAt === undefined
    ? undefined
    : room.startAt + room.durationSec * 1000;
}

export async function createScoreRace(input: {
  gameId: ScoreRaceGameId;
  durationSec: number;
  difficultyLabel: string;
  wordListLabel: string;
  words: string[];
}): Promise<string> {
  const player = newPlayer();
  const words = input.words
    .filter((w) => w.length > 0 && w.length <= 60)
    .slice(0, 300);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const result = await runTransaction(roomRef(code), (existing) => {
      if (existing !== null) return;
      return {
        code,
        gameId: input.gameId,
        hostUid: player.uid,
        status: "lobby",
        createdAt: Date.now(),
        durationSec: input.durationSec,
        difficultyLabel: input.difficultyLabel,
        wordListLabel: input.wordListLabel,
        ...(words.length > 0 ? { words } : {}),
        players: { [player.uid]: player },
      } satisfies ScoreRaceRoom;
    });
    if (result.committed) {
      await onDisconnect(playerRef(code, player.uid)).update({ online: false });
      // a lobby only its host can start is useless once the host drops
      await onDisconnect(roomRef(code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinScoreRace(
  rawCode: string,
  gameId: ScoreRaceGameId,
): Promise<string> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit room code");
  const player = newPlayer();
  const room = readRoom(await get(roomRef(code)));
  if (room?.gameId !== gameId) throw new Error("Room not found");
  if (room.status !== "lobby") {
    throw new Error("That match has already started");
  }
  if (
    Object.keys(room.players ?? {}).length >= MAX_SCORE_RACE_PLAYERS &&
    room.players[player.uid] === undefined
  ) {
    throw new Error("That room is full");
  }
  await set(playerRef(code, player.uid), player);
  await onDisconnect(playerRef(code, player.uid)).update({ online: false });
  return code;
}

export function subscribeScoreRace(
  code: string,
  callback: (room: ScoreRaceRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(roomRef(code), (snap) => callback(readRoom(snap))),
  );
}

/** Host: start the 3-2-1. */
export async function startScoreRace(code: string): Promise<void> {
  // under way: keep the room if the host drops now (cancelling also clears
  // the host's own presence hook, so set that again)
  await onDisconnect(roomRef(code)).cancel();
  const host = getAuthenticatedUser();
  if (host !== null) {
    await onDisconnect(playerRef(code, host.uid)).update({ online: false });
  }
  await update(roomRef(code), {
    status: "countdown",
    startAt: Date.now() + SCORE_RACE_COUNTDOWN_MS,
  });
}

export async function markScoreRacePlaying(code: string): Promise<void> {
  await update(roomRef(code), { status: "playing" });
}

/** Host any time; anyone once the time is up (rules check the clock). */
export async function finishScoreRace(code: string): Promise<void> {
  await set(ref(getRealtimeDb(), `scoreRaces/${code}/status`), "finished");
}

export async function updateScoreRacePlayer(
  code: string,
  stats: Pick<ScoreRacePlayer, "score" | "finished">,
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await update(playerRef(code, user.uid), {
    score: Math.max(0, Math.floor(stats.score)),
    finished: stats.finished,
    online: true,
  });
}

/** Host: take a student out of the lobby. */
export async function kickScoreRacePlayer(
  code: string,
  uid: string,
): Promise<void> {
  await remove(playerRef(code, uid));
}

export async function leaveScoreRace(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(roomRef(code)));
  if (room?.hostUid === user.uid && room.status === "lobby") {
    await remove(roomRef(code));
  } else {
    await remove(playerRef(code, user.uid));
  }
}

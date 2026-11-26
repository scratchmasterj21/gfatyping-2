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
import { serverClockNow, watchServerClock } from "../shared/server-clock";
import {
  buildParty,
  FREE_HEROES,
  HeroClass,
  HeroInput,
  HeroSetup,
  PARTY_SIZE,
  QuestInput,
  START_PAUSE_MS,
  TIMEOUT_POWER,
} from "./quest-rules";

/**
 * Monster Quest rooms (RTDB questRooms/{code}). The battle is worked out on
 * every screen from the party, the seed and the list of inputs. Each input
 * slot is written once ("closed") through a transaction, so a late answer and
 * a timeout can never both count.
 */

export type QuestPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  cls?: HeroClass;
};

type StoredInput = QuestInput & { closed?: boolean; at?: number };

export type QuestRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  seed: number;
  /** weekly quest week id */
  weekly?: number;
  startAt?: number;
  party?: HeroSetup[];
  players: Record<string, QuestPlayer>;
  inputs?: Record<string, StoredInput> | StoredInput[];
};

const path = (code: string, rest = ""): DatabaseReference =>
  ref(getRealtimeDb(), `questRooms/${code}${rest}`);

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): QuestRoom | null {
  return snapshot.exists() ? (snapshot.val() as QuestRoom) : null;
}

/** The database drops nulls and may turn lists into objects - tidy up. */
export function roomParty(room: QuestRoom): HeroSetup[] {
  return Object.values(room.party ?? {})
    .map((h) => ({ ...h, uid: h.uid ?? null }))
    .sort((a, b) => a.slot - b.slot);
}

/** Closed inputs in order, and when each was closed. */
export function roomInputs(room: QuestRoom): {
  inputs: QuestInput[];
  times: number[];
} {
  const raw = (room.inputs ?? {}) as Record<string, StoredInput | undefined>;
  const inputs: QuestInput[] = [];
  const times: number[] = [];
  for (let n = 0; ; n++) {
    const entry = raw[String(n)];
    if (entry?.closed !== true) break;
    const { closed: _closed, at, ...input } = entry;
    inputs.push(input as QuestInput);
    times.push(at ?? 0);
  }
  return { inputs, times };
}

/** Read the database clock offset so everyone's turn timers agree. */
export async function syncQuestClock(): Promise<void> {
  watchServerClock();
}
export const questNow = serverClockNow;

export async function createQuestRoom(input: {
  difficultyLabel: string;
  cls: HeroClass;
  weekly?: number;
}): Promise<string> {
  const user = currentUser();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const result = await runTransaction(path(code), (existing) => {
      if (existing !== null) return;
      return {
        code,
        hostUid: user.uid,
        status: "lobby",
        createdAt: Date.now(),
        difficultyLabel: input.difficultyLabel,
        seed: Math.floor(Math.random() * 2 ** 31),
        ...(input.weekly === undefined ? {} : { weekly: input.weekly }),
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.name,
            joinedAt: Date.now(),
            online: true,
            cls: input.cls,
          },
        },
      } satisfies QuestRoom;
    });
    if (result.committed) {
      await onDisconnect(path(code, `/players/${user.uid}`)).update({
        online: false,
      });
      // a lobby only its host can start is useless once the host drops
      await onDisconnect(path(code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinQuestRoom(
  rawCode: string,
  cls: HeroClass,
): Promise<string> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit room code");
  const user = currentUser();
  const room = readRoom(await get(path(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") {
    throw new Error("That quest has already started");
  }
  if (
    Object.keys(room.players ?? {}).length >= PARTY_SIZE &&
    room.players[user.uid] === undefined
  ) {
    throw new Error("That party is full (4 heroes)");
  }
  // take a class nobody has yet, if mine is taken
  const taken = new Set(
    Object.values(room.players ?? {})
      .filter((p) => p.uid !== user.uid)
      .map((p) => p.cls),
  );
  // a free hero, so it's one this player can always use
  const free = (FREE_HEROES as HeroClass[]).find((c) => !taken.has(c));
  await set(path(code, `/players/${user.uid}`), {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
    cls: taken.has(cls) ? (free ?? cls) : cls,
  } satisfies QuestPlayer);
  await onDisconnect(path(code, `/players/${user.uid}`)).update({
    online: false,
  });
  return code;
}

export async function setMyClass(code: string, cls: HeroClass): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await update(path(code, `/players/${user.uid}`), { cls });
}

export function subscribeQuestRoom(
  code: string,
  callback: (room: QuestRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(path(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

/** Host: make the party (helpers fill the gaps) and start the 3-2-1. */
export async function startQuestRoom(room: QuestRoom): Promise<void> {
  const host = getAuthenticatedUser();
  // the quest is under way: keep the room if the host drops now (cancelling
  // also clears the host's presence hook, so set that again)
  await onDisconnect(path(room.code)).cancel();
  if (host !== null) {
    await onDisconnect(path(room.code, `/players/${host.uid}`)).update({
      online: false,
    });
  }
  const players = Object.values(room.players)
    .filter((p) => p.online)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  await update(path(room.code), {
    status: "playing",
    party: buildParty(players),
    startAt: questNow() + START_PAUSE_MS,
  });
}

/** My move for input slot n (ignored if that slot already closed). */
export async function writeHeroInput(
  code: string,
  n: number,
  input: HeroInput,
): Promise<void> {
  await runTransaction(
    path(code, `/inputs/${n}`),
    (cur: StoredInput | null) => {
      if (cur?.closed === true) return;
      return { ...input, closed: true, at: questNow() };
    },
    // only show a move once the database has accepted it
    { applyLocally: false },
  );
}

/** I typed my guard word. Closes the slot once everyone needed is in. */
export async function writeGuard(
  code: string,
  n: number,
  needed: string[],
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await runTransaction(
    path(code, `/inputs/${n}`),
    (cur: StoredInput | null) => {
      if (cur?.closed === true) return;
      const guards = {
        ...(cur?.kind === "guard" ? (cur.guards ?? {}) : {}),
        [user.uid]: true,
      };
      const all = needed.every((u) => guards[u] === true);
      return {
        kind: "guard",
        guards,
        ...(all ? { closed: true, at: questNow() } : {}),
      };
    },
    // only show a move once the database has accepted it
    { applyLocally: false },
  );
}

/** My vote. Closes the slot once every voter is in. */
export async function writeVote(
  code: string,
  n: number,
  choice: string,
  voters: string[],
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await runTransaction(
    path(code, `/inputs/${n}`),
    (cur: StoredInput | null) => {
      if (cur?.closed === true) return;
      const votes = {
        ...(cur?.kind === "vote" ? (cur.votes ?? {}) : {}),
        [user.uid]: choice,
      };
      const all = voters.every((u) => votes[u] !== undefined);
      return {
        kind: "vote",
        votes,
        ...(all ? { closed: true, at: questNow() } : {}),
      };
    },
    // only show a move once the database has accepted it
    { applyLocally: false },
  );
}

/** Votes on the slot that's still open (to show who picked what). */
export function openVotes(
  room: QuestRoom,
  n: number,
): Record<string, string> | undefined {
  const raw = (room.inputs ?? {}) as Record<string, StoredInput | undefined>;
  const entry = raw[String(n)];
  return entry?.kind === "vote" && entry.closed !== true
    ? entry.votes
    : undefined;
}

/** The turn timer ran out: close slot n with whatever came in. */
export async function closeTimedOut(
  code: string,
  n: number,
  kind: "hero" | "guard" | "vote",
): Promise<void> {
  await runTransaction(
    path(code, `/inputs/${n}`),
    (cur: StoredInput | null) => {
      if (cur?.closed === true) return;
      if (kind === "vote") {
        return {
          kind: "vote",
          votes: cur?.kind === "vote" ? (cur.votes ?? {}) : {},
          closed: true,
          at: questNow(),
        };
      }
      if (kind === "hero") {
        return {
          kind: "hero",
          action: "attack",
          power: TIMEOUT_POWER,
          timeout: true,
          closed: true,
          at: questNow(),
        };
      }
      return {
        kind: "guard",
        guards: cur?.kind === "guard" ? (cur.guards ?? {}) : {},
        closed: true,
        at: questNow(),
      };
    },
    // only show a move once the database has accepted it
    { applyLocally: false },
  );
}

export async function finishQuestRoom(code: string): Promise<void> {
  await update(path(code), { status: "finished" });
}

export async function leaveQuestRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(path(code)));
  if (room?.hostUid === user.uid && room.status === "lobby") {
    await remove(path(code));
  } else if (room?.status === "lobby") {
    // free my seat in the party
    await remove(path(code, `/players/${user.uid}`));
  } else {
    await update(path(code, `/players/${user.uid}`), { online: false }).catch(
      () => undefined,
    );
  }
}

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
  assignRaidTeams,
  MAX_RAID_PLAYERS,
  RaidMode,
  RaidTeam,
  START_PAUSE_MS,
} from "./raid-rules";

/**
 * Monster Raid rooms (RTDB raidRooms/{code}). Each player writes only their
 * own damage; blocks and "we beat the boss" are first-write-wins. Everyone
 * works the monsters out from those (see raid-rules.ts), so the game keeps
 * going for the team even if the host's connection is slow.
 */

export type RaidPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  dealt: number;
};

export type RaidRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  mode: RaidMode;
  /** players per team in team mode */
  teamSize: number;
  difficultyLabel: string;
  seed: number;
  startAt?: number;
  teams?: Record<string, RaidTeam>;
  players: Record<string, RaidPlayer>;
  /** team -> attack number -> uid who blocked it */
  blocks?: Partial<Record<RaidTeam, Record<string, string>>>;
  /** team -> when it beat the boss (server time) */
  cleared?: Partial<Record<RaidTeam, number>>;
};

const path = (code: string, rest = ""): DatabaseReference =>
  ref(getRealtimeDb(), `raidRooms/${code}${rest}`);

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): RaidRoom | null {
  return snapshot.exists() ? (snapshot.val() as RaidRoom) : null;
}

let serverOffset = 0;
/** Read the database clock offset so everyone sees attacks at the same time. */
export async function syncRaidClock(): Promise<void> {
  try {
    const snap = await get(ref(getRealtimeDb(), ".info/serverTimeOffset"));
    const v = snap.val() as unknown;
    if (typeof v === "number") serverOffset = v;
  } catch {
    // fall back to the local clock
  }
}
export const raidNow = (): number => Date.now() + serverOffset;

export async function createRaidRoom(input: {
  mode: RaidMode;
  teamSize: number;
  difficultyLabel: string;
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
        mode: input.mode,
        teamSize: input.teamSize,
        difficultyLabel: input.difficultyLabel,
        seed: Math.floor(Math.random() * 2 ** 31),
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.name,
            joinedAt: Date.now(),
            online: true,
            dealt: 0,
          },
        },
      } satisfies RaidRoom;
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

export async function joinRaidRoom(rawCode: string): Promise<string> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit room code");
  const user = currentUser();
  const room = readRoom(await get(path(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("That raid has already started");
  if (
    Object.keys(room.players ?? {}).length >= MAX_RAID_PLAYERS &&
    room.players[user.uid] === undefined
  ) {
    throw new Error("That room is full");
  }
  await set(path(code, `/players/${user.uid}`), {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
    dealt: 0,
  } satisfies RaidPlayer);
  await onDisconnect(path(code, `/players/${user.uid}`)).update({
    online: false,
  });
  return code;
}

export function subscribeRaidRoom(
  code: string,
  callback: (room: RaidRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(path(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

/** Host: deal teams and start the 3-2-1. */
export async function startRaidRoom(room: RaidRoom): Promise<void> {
  const host = getAuthenticatedUser();
  // the raid is under way: keep the room if the host drops now (cancelling
  // also clears the host's presence hook, so set that again)
  await onDisconnect(path(room.code)).cancel();
  if (host !== null) {
    await onDisconnect(path(room.code, `/players/${host.uid}`)).update({
      online: false,
    });
  }
  const uids = Object.values(room.players)
    .filter((p) => p.online)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => p.uid);
  const teams: Record<string, RaidTeam> =
    room.mode === "teams"
      ? assignRaidTeams(uids, room.teamSize)
      : Object.fromEntries(uids.map((u) => [u, "red" as RaidTeam]));
  await update(path(room.code), {
    status: "playing",
    teams,
    startAt: raidNow() + START_PAUSE_MS,
  });
}

export async function writeDealt(code: string, dealt: number): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await update(path(code, `/players/${user.uid}`), {
    dealt: Math.max(0, Math.floor(dealt)),
  });
}

/** Block attack k for my team (refused if a teammate got there first). */
export async function writeBlock(
  code: string,
  team: RaidTeam,
  k: number,
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await set(path(code, `/blocks/${team}/${k}`), user.uid);
}

/** My team beat the boss (first write wins). */
export async function writeCleared(
  code: string,
  team: RaidTeam,
): Promise<void> {
  await set(path(code, `/cleared/${team}`), raidNow());
}

export async function finishRaidRoom(code: string): Promise<void> {
  await update(path(code), { status: "finished" });
}

export async function leaveRaidRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(path(code)));
  if (room?.hostUid === user.uid) await remove(path(code));
  else await remove(path(code, `/players/${user.uid}`));
}

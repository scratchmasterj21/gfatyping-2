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
  buildCrew,
  CREW_SIZE,
  CrewMember,
  ShipFacts,
  START_PAUSE_MS,
  Station,
  STATIONS,
} from "./ship-rules";

/**
 * Rescue Ship rooms (RTDB shipRooms/{code}). Each player writes only the
 * tasks they finish (first write wins) and their all-hands answers; every
 * screen works the ship out from those facts (see ship-rules.ts).
 */

export type ShipPlayer = {
  uid: string;
  name: string;
  joinedAt: number;
  online: boolean;
  station?: Station;
};

export type ShipRoom = {
  code: string;
  hostUid: string;
  status: "lobby" | "playing" | "finished";
  createdAt: number;
  difficultyLabel: string;
  seed: number;
  startAt?: number;
  crew?: CrewMember[];
  players: Record<string, ShipPlayer>;
  done?: ShipFacts["done"];
  hands?: ShipFacts["hands"];
};

const path = (code: string, rest = ""): DatabaseReference =>
  ref(getRealtimeDb(), `shipRooms/${code}${rest}`);

function currentUser(): { uid: string; name: string } {
  const user = getAuthenticatedUser();
  if (user === null) throw new Error("Sign in to play together");
  return { uid: user.uid, name: (user.displayName ?? "Student").slice(0, 40) };
}

function readRoom(snapshot: DataSnapshot): ShipRoom | null {
  return snapshot.exists() ? (snapshot.val() as ShipRoom) : null;
}

/** The database drops nulls and may turn lists into objects - tidy up. */
export function roomCrew(room: ShipRoom): CrewMember[] {
  const list = Object.values(room.crew ?? {}).map((c) => ({
    ...c,
    uid: c.uid ?? null,
  }));
  return STATIONS.map(
    (s) =>
      list.find((c) => c.station === s) ?? {
        station: s,
        uid: null,
        name: "Helper",
      },
  );
}

let serverOffset = 0;
export async function syncShipClock(): Promise<void> {
  try {
    const snap = await get(ref(getRealtimeDb(), ".info/serverTimeOffset"));
    const v = snap.val() as unknown;
    if (typeof v === "number") serverOffset = v;
  } catch {
    // fall back to the local clock
  }
}
export const shipNow = (): number => Date.now() + serverOffset;

export async function createShipRoom(input: {
  difficultyLabel: string;
  station: Station;
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
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.name,
            joinedAt: Date.now(),
            online: true,
            station: input.station,
          },
        },
      } satisfies ShipRoom;
    });
    if (result.committed) {
      await onDisconnect(path(code, `/players/${user.uid}`)).update({
        online: false,
      });
      await onDisconnect(path(code)).remove();
      return code;
    }
  }
  throw new Error("Could not create a room. Try again.");
}

export async function joinShipRoom(
  rawCode: string,
  station: Station,
): Promise<string> {
  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit room code");
  const user = currentUser();
  const room = readRoom(await get(path(code)));
  if (room === null) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("That ship has already left");
  if (
    Object.keys(room.players ?? {}).length >= CREW_SIZE &&
    room.players[user.uid] === undefined
  ) {
    throw new Error("That crew is full (4 players)");
  }
  const taken = new Set(
    Object.values(room.players ?? {})
      .filter((p) => p.uid !== user.uid)
      .map((p) => p.station),
  );
  const free = STATIONS.find((s) => !taken.has(s));
  await set(path(code, `/players/${user.uid}`), {
    uid: user.uid,
    name: user.name,
    joinedAt: Date.now(),
    online: true,
    station: taken.has(station) ? (free ?? station) : station,
  } satisfies ShipPlayer);
  await onDisconnect(path(code, `/players/${user.uid}`)).update({
    online: false,
  });
  return code;
}

export async function setMyStation(
  code: string,
  station: Station,
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await update(path(code, `/players/${user.uid}`), { station });
}

export function subscribeShipRoom(
  code: string,
  callback: (room: ShipRoom | null) => void,
): () => void {
  return trackRealtimeListener(
    onValue(path(code), (snapshot) => callback(readRoom(snapshot))),
  );
}

/** Host: make the crew (helpers fill the gaps) and launch. */
export async function startShipRoom(room: ShipRoom): Promise<void> {
  const host = getAuthenticatedUser();
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
    crew: buildCrew(players),
    startAt: shipNow() + START_PAUSE_MS,
  });
}

/** I finished a task (first write wins; a later write is refused). */
export async function writeDone(code: string, taskId: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await set(path(code, `/done/${taskId}`), { by: user.uid, at: shipNow() });
}

/** I typed an all-hands call. */
export async function writeHands(code: string, taskId: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await set(path(code, `/hands/${taskId}/${user.uid}`), shipNow());
}

export async function finishShipRoom(code: string): Promise<void> {
  await update(path(code), { status: "finished" });
}

export async function leaveShipRoom(code: string): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  const room = readRoom(await get(path(code)));
  if (room?.hostUid === user.uid && room.status === "lobby") {
    await remove(path(code));
  } else if (room?.status === "lobby") {
    await remove(path(code, `/players/${user.uid}`));
  } else {
    await update(path(code, `/players/${user.uid}`), { online: false }).catch(
      () => undefined,
    );
  }
}

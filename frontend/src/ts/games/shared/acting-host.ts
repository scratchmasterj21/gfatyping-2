/**
 * Who runs the room right now: the host while they're online, otherwise the
 * earliest-joined player still online. Rooms used to wait on the host alone,
 * so a host whose wifi dropped or whose iPad slept left everyone stuck on
 * "Waiting…". (The database rules let a player end the room only while the
 * host is marked offline.)
 */
export function actingHostUid(room: {
  hostUid: string;
  players?: Record<string, { uid: string; online: boolean; joinedAt: number }>;
}): string | undefined {
  const players = room.players ?? {};
  if (players[room.hostUid]?.online !== false) return room.hostUid;
  return Object.values(players)
    .filter((p) => p.online)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0]?.uid;
}

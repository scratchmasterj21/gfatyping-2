import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getAdminApp } from "./_lib/admin.js";

/**
 * Daily housekeeping (Vercel cron, see vercel.json): deletes multiplayer
 * rooms and class races that were abandoned - e.g. the host closed the tab
 * instead of pressing Leave. Only touches data older than STALE_MS, so it can
 * never interrupt a game in progress.
 *
 * Realtime Database: racerRooms, tossRooms, ghostRooms (+ their ghostWorlds /
 * ghostActions), classRaces participants. Firestore: the races/{pin} control
 * docs. Race history (raceHistory) is never touched.
 */
const STALE_MS = 3 * 60 * 60 * 1000;
const ROOM_ROOTS = [
  "racerRooms",
  "tossRooms",
  "ghostRooms",
  "pongRooms",
  "digRooms",
  "fourRooms",
  "bombRooms",
] as const;
/** Firestore deletes per run - plenty for a school, keeps a run cheap. */
const MAX_RACE_DOCS = 100;

function authorized(req: VercelRequest): boolean {
  const secret = process.env["CRON_SECRET"];
  if (secret === undefined || secret === "") {
    // Without a secret configured, only accept Vercel's own cron caller.
    return (req.headers["user-agent"] ?? "").startsWith("vercel-cron");
  }
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }
  if (!authorized(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const app = getAdminApp();
  const db = app.database();
  const firestore = app.firestore();
  const cutoff = Date.now() - STALE_MS;
  const removed: Record<string, number> = {};

  // 1. Old multiplayer rooms.
  for (const root of ROOM_ROOTS) {
    const snap = await db
      .ref(root)
      .orderByChild("createdAt")
      .endAt(cutoff)
      .get();
    const codes = Object.keys((snap.val() as Record<string, unknown>) ?? {});
    await Promise.all(
      codes.map(async (code) => db.ref(`${root}/${code}`).remove()),
    );
    removed[root] = codes.length;
  }

  // 2. Ghost Hunter world/action data whose room no longer exists.
  const liveGhostRooms = new Set(
    Object.keys(
      ((await db.ref("ghostRooms").get()).val() as Record<string, unknown>) ??
        {},
    ),
  );
  for (const root of ["ghostWorlds", "ghostActions"] as const) {
    const codes = Object.keys(
      ((await db.ref(root).get()).val() as Record<string, unknown>) ?? {},
    ).filter((code) => !liveGhostRooms.has(code));
    await Promise.all(
      codes.map(async (code) => db.ref(`${root}/${code}`).remove()),
    );
    removed[root] = codes.length;
  }

  // 3. Class races: stale Firestore control docs, then any RTDB participant
  //    lists whose race doc is gone.
  const staleRaces = await firestore
    .collection("races")
    .where("createdAt", "<", cutoff)
    .limit(MAX_RACE_DOCS)
    .get();
  await Promise.all(staleRaces.docs.map(async (d) => d.ref.delete()));
  removed["races"] = staleRaces.size;

  const pins = Object.keys(
    ((await db.ref("classRaces").get()).val() as Record<string, unknown>) ?? {},
  );
  let orphanPins = 0;
  for (const pin of pins) {
    const race = await firestore.collection("races").doc(pin).get();
    if (!race.exists) {
      await db.ref(`classRaces/${pin}`).remove();
      orphanPins++;
    }
  }
  removed["classRaces"] = orphanPins;

  res.status(200).json({ ok: true, removed });
}

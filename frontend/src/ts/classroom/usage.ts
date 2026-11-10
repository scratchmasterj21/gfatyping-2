import { collection, getDocs } from "firebase/firestore";
import { get, ref } from "firebase/database";

import { getDb, getRealtimeDb } from "../firebase";
import { ActivityDays, parseActivityDays, tokyoDate } from "./activity";

/**
 * A rough "are we still inside the free (Spark) plan?" check for the
 * teacher. Firebase doesn't let the app read its real usage without extra
 * Google Cloud setup, so this estimates today's Firestore reads/writes from
 * what students did today (activityDays) and counts live game rooms. The
 * real numbers are in the Firebase console (link on the page).
 */

/** Spark plan daily/total limits. */
export const SPARK = {
  firestoreReadsPerDay: 50_000,
  firestoreWritesPerDay: 20_000,
  firestoreStorageBytes: 1024 ** 3,
  rtdbConnections: 100,
} as const;

/** Rough costs per thing a student does (tuned to this app). */
const READS_PER_ACTIVE_STUDENT = 160; // sign-in, snapshot, lessons page, shop...
const READS_PER_TEACHER_VIEW = 2; // per student, per dashboard scan
const WRITES_PER_ACTIVE_STUDENT = 8; // config, streak, rewards...
const WRITES_PER_LESSON = 4;
const WRITES_PER_GAME = 3;
const WRITES_PER_TYPING_MINUTE = 1.5; // results + stats
const BYTES_PER_USER = 40_000; // user doc + results + lesson progress

export const RTDB_ROOM_ROOTS = [
  "pongRooms",
  "digRooms",
  "fourRooms",
  "bombRooms",
  "karutaRooms",
  "goldfishRooms",
  "shiritoriRooms",
  "tossRooms",
  "racerRooms",
  "ghostRooms",
  "raidRooms",
  "scoreRaces",
  "classRaces",
] as const;

export type UsageInput = {
  users: { activity: ActivityDays }[];
  /** live rooms per RTDB root, and players in them */
  rooms: Record<string, { rooms: number; players: number }>;
  now?: number;
};

export type UsageLevel = "ok" | "watch" | "high";

export type UsageLine = {
  label: string;
  value: number;
  limit: number;
  level: UsageLevel;
};

export type UsageEstimate = {
  students: number;
  activeToday: number;
  lessonsToday: number;
  gamesToday: number;
  typingMinutesToday: number;
  liveRooms: number;
  playersInRooms: number;
  lines: UsageLine[];
};

export function usageLevel(value: number, limit: number): UsageLevel {
  const pct = value / limit;
  if (pct >= 0.8) return "high";
  if (pct >= 0.5) return "watch";
  return "ok";
}

export function estimateUsage(input: UsageInput): UsageEstimate {
  const today = tokyoDate(input.now ?? Date.now());
  let activeToday = 0;
  let lessonsToday = 0;
  let gamesToday = 0;
  let typingSec = 0;
  for (const u of input.users) {
    const d = u.activity[today];
    if (d === undefined) continue;
    const sec = Math.max(d.t ?? 0, d.l ?? 0);
    if (sec > 0 || (d.gp ?? 0) > 0 || (d.lx?.length ?? 0) > 0) activeToday++;
    lessonsToday += d.lx?.length ?? 0;
    gamesToday += d.gp ?? 0;
    typingSec += sec;
  }
  const typingMinutesToday = Math.round(typingSec / 60);
  const students = input.users.length;
  const rooms = Object.values(input.rooms);
  const liveRooms = rooms.reduce((n, r) => n + r.rooms, 0);
  const playersInRooms = rooms.reduce((n, r) => n + r.players, 0);

  const reads =
    activeToday * READS_PER_ACTIVE_STUDENT +
    // a few teacher dashboard scans a day
    students * READS_PER_TEACHER_VIEW * 5;
  const writes =
    activeToday * WRITES_PER_ACTIVE_STUDENT +
    lessonsToday * WRITES_PER_LESSON +
    gamesToday * WRITES_PER_GAME +
    typingMinutesToday * WRITES_PER_TYPING_MINUTE;
  const storage = students * BYTES_PER_USER;

  const line = (label: string, value: number, limit: number): UsageLine => ({
    label,
    value: Math.round(value),
    limit,
    level: usageLevel(value, limit),
  });

  return {
    students,
    activeToday,
    lessonsToday,
    gamesToday,
    typingMinutesToday,
    liveRooms,
    playersInRooms,
    lines: [
      line("Firestore reads today", reads, SPARK.firestoreReadsPerDay),
      line("Firestore writes today", writes, SPARK.firestoreWritesPerDay),
      line("Firestore storage (bytes)", storage, SPARK.firestoreStorageBytes),
      line(
        "Players in live game rooms now",
        playersInRooms,
        SPARK.rtdbConnections,
      ),
    ],
  };
}

function countRooms(value: unknown): { rooms: number; players: number } {
  if (value === null || typeof value !== "object") {
    return { rooms: 0, players: 0 };
  }
  let rooms = 0;
  let players = 0;
  for (const room of Object.values(value as Record<string, unknown>)) {
    if (room === null || typeof room !== "object") continue;
    const r = room as {
      status?: unknown;
      players?: unknown;
      participants?: unknown;
    };
    if (r.status === "finished") continue;
    rooms++;
    const list = r.players ?? r.participants;
    if (list !== null && typeof list === "object") {
      players += Object.values(
        list as Record<string, { online?: unknown }>,
      ).filter((p) => p?.online !== false).length;
    }
  }
  return { rooms, players };
}

/** One read per user doc plus the (small) live room lists. */
export async function getUsageInput(): Promise<UsageInput> {
  const snap = await getDocs(collection(getDb(), "users"));
  const users = snap.docs.map((d) => ({
    activity: parseActivityDays(
      (d.data() as { activityDays?: unknown }).activityDays,
    ),
  }));
  const rooms: UsageInput["rooms"] = {};
  await Promise.all(
    RTDB_ROOM_ROOTS.map(async (root) => {
      try {
        rooms[root] = countRooms(
          (await get(ref(getRealtimeDb(), root))).val() as unknown,
        );
      } catch {
        rooms[root] = { rooms: 0, players: 0 }; // not readable as a list
      }
    }),
  );
  return { users, rooms };
}

import { UTCDateMini } from "@date-fns/utc";
import { CompletedEvent } from "@monkeytype/schemas/results";
import { startOfWeek } from "date-fns";
import {
  collection,
  CollectionReference,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { getAuthenticatedUser } from "../../firebase";
import { db, Handler, ok, stripUndefined } from "./common";

const DAY_MS = 24 * 60 * 60 * 1000;

export function leaderboardKey(
  mode: string,
  mode2: string,
  language: string,
): string {
  return `${mode}_${mode2}_${language}`;
}

function entriesCol(key: string): CollectionReference {
  return collection(db(), "leaderboards", key, "entries");
}

function dailyEntriesCol(dayId: number, key: string): CollectionReference {
  return collection(db(), "dailyLeaderboards", `${dayId}_${key}`, "entries");
}

function weeklyEntriesCol(weekId: number): CollectionReference {
  return collection(db(), "weeklyXpLeaderboards", String(weekId), "entries");
}

function currentDayId(daysBefore: number): number {
  return Math.floor(Date.now() / DAY_MS) - daysBefore;
}

/** Monday-UTC-midnight timestamp for the current week (or `weeksBefore` weeks back) - the canonical "week" definition, also used for weekly quests (see coins.ts). */
export function currentWeekId(weeksBefore: number): number {
  const base = Date.now() - weeksBefore * 7 * DAY_MS;
  return startOfWeek(new UTCDateMini(base), { weekStartsOn: 1 }).getTime();
}

function currentAvatarUrl(): string | undefined {
  return getAuthenticatedUser()?.photoURL ?? undefined;
}

type StoredEntry = {
  uid: string;
  name: string;
  wpm: number;
  acc: number;
  raw: number;
  consistency?: number;
  timestamp: number;
  avatarUrl?: string;
};

type WeeklyStoredEntry = {
  uid: string;
  name: string;
  totalXp: number;
  timeTypedSeconds: number;
  lastActivityTimestamp: number;
  avatarUrl?: string;
};

/**
 * Upsert the all-time leaderboard entry for a user if the result beats their
 * stored best for this mode/mode2/language.
 */
export async function upsertLeaderboardEntry(
  uid: string,
  name: string,
  result: CompletedEvent,
  timestamp: number,
): Promise<void> {
  const key = leaderboardKey(
    result.mode,
    String(result.mode2),
    result.language,
  );
  const ref = doc(entriesCol(key), uid);
  const snap = await getDoc(ref);
  const existingWpm = snap.exists()
    ? ((snap.data() as StoredEntry).wpm ?? 0)
    : 0;
  if (result.wpm <= existingWpm) return;

  await setDoc(
    ref,
    stripUndefined<StoredEntry>({
      uid,
      name,
      wpm: result.wpm,
      acc: result.acc,
      raw: result.rawWpm,
      consistency: result.consistency,
      timestamp,
      avatarUrl: currentAvatarUrl(),
    }),
  );
}

/**
 * Upsert today's daily leaderboard entry if the result beats the user's best
 * for today.
 */
export async function upsertDailyLeaderboardEntry(
  uid: string,
  name: string,
  result: CompletedEvent,
  timestamp: number,
): Promise<void> {
  const key = leaderboardKey(
    result.mode,
    String(result.mode2),
    result.language,
  );
  const ref = doc(dailyEntriesCol(currentDayId(0), key), uid);
  const snap = await getDoc(ref);
  const existingWpm = snap.exists()
    ? ((snap.data() as StoredEntry).wpm ?? 0)
    : 0;
  if (result.wpm <= existingWpm) return;

  await setDoc(
    ref,
    stripUndefined<StoredEntry>({
      uid,
      name,
      wpm: result.wpm,
      acc: result.acc,
      raw: result.rawWpm,
      consistency: result.consistency,
      timestamp,
      avatarUrl: currentAvatarUrl(),
    }),
  );
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Increment the current week's xp total (and time typed) for a user.
 *
 * Uses a read-then-write instead of Firestore `increment()` because the
 * sentinel returned by `increment()` does not survive `stripUndefined`, and
 * this also self-heals any entries previously corrupted by that bug (non-finite
 * stored values are treated as 0).
 */
export async function incrementWeeklyXp(
  uid: string,
  name: string,
  xp: number,
  timeTypedSeconds: number,
  timestamp: number,
): Promise<void> {
  const ref = doc(weeklyEntriesCol(currentWeekId(0)), uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data() as Partial<WeeklyStoredEntry>) : {};

  const addXp = finiteOr(xp, 0);
  const addTime = Math.max(0, finiteOr(timeTypedSeconds, 0));

  await setDoc(
    ref,
    stripUndefined<WeeklyStoredEntry>({
      uid,
      name,
      totalXp: finiteOr(prev.totalXp, 0) + addXp,
      timeTypedSeconds: finiteOr(prev.timeTypedSeconds, 0) + addTime,
      lastActivityTimestamp: timestamp,
      avatarUrl: currentAvatarUrl(),
    }),
    { merge: true },
  );
}

async function getSortedSpeedEntries(
  col: CollectionReference,
): Promise<StoredEntry[]> {
  const snap = await getDocs(query(col, orderBy("wpm", "desc")));
  return snap.docs.map((d) => d.data() as StoredEntry);
}

async function getSortedWeeklyEntries(
  col: CollectionReference,
): Promise<WeeklyStoredEntry[]> {
  const snap = await getDocs(query(col, orderBy("totalXp", "desc")));
  return snap.docs.map((d) => d.data() as WeeklyStoredEntry);
}

// --- all-time ---

export const get: Handler = async (ctx) => {
  const q = ctx.query as {
    mode?: string;
    mode2?: string;
    language?: string;
    page?: number;
    pageSize?: number;
    friendsOnly?: boolean;
  };
  const pageSize = Number(q.pageSize ?? 50);
  const page = Number(q.page ?? 0);

  if (q.friendsOnly) {
    return ok({ count: 0, pageSize, entries: [] });
  }

  const key = leaderboardKey(
    String(q.mode),
    String(q.mode2),
    String(q.language),
  );
  const all = await getSortedSpeedEntries(entriesCol(key));
  const start = page * pageSize;
  const entries = all.slice(start, start + pageSize).map((e, i) => ({
    ...e,
    rank: start + i + 1,
  }));

  return ok({ count: all.length, pageSize, entries });
};

export const getRank: Handler = async (ctx) => {
  const q = ctx.query as {
    mode?: string;
    mode2?: string;
    language?: string;
    friendsOnly?: boolean;
  };
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined || q.friendsOnly) return ok(null);

  const key = leaderboardKey(
    String(q.mode),
    String(q.mode2),
    String(q.language),
  );
  const all = await getSortedSpeedEntries(entriesCol(key));
  const index = all.findIndex((e) => e.uid === uid);
  if (index === -1) return ok(null);

  return ok({ ...all[index], rank: index + 1 });
};

// --- daily ---

export const getDaily: Handler = async (ctx) => {
  const q = ctx.query as {
    mode?: string;
    mode2?: string;
    language?: string;
    page?: number;
    pageSize?: number;
    daysBefore?: number;
    friendsOnly?: boolean;
  };
  const pageSize = Number(q.pageSize ?? 50);
  const page = Number(q.page ?? 0);

  if (q.friendsOnly) {
    return ok({ count: 0, pageSize, entries: [], minWpm: 0 });
  }

  const key = leaderboardKey(
    String(q.mode),
    String(q.mode2),
    String(q.language),
  );
  const dayId = currentDayId(q.daysBefore === 1 ? 1 : 0);
  const all = await getSortedSpeedEntries(dailyEntriesCol(dayId, key));
  const start = page * pageSize;
  const entries = all.slice(start, start + pageSize).map((e, i) => ({
    ...e,
    rank: start + i + 1,
  }));

  return ok({ count: all.length, pageSize, entries, minWpm: 0 });
};

export const getDailyRank: Handler = async (ctx) => {
  const q = ctx.query as {
    mode?: string;
    mode2?: string;
    language?: string;
    daysBefore?: number;
    friendsOnly?: boolean;
  };
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined || q.friendsOnly) return ok(null);

  const key = leaderboardKey(
    String(q.mode),
    String(q.mode2),
    String(q.language),
  );
  const dayId = currentDayId(q.daysBefore === 1 ? 1 : 0);
  const all = await getSortedSpeedEntries(dailyEntriesCol(dayId, key));
  const index = all.findIndex((e) => e.uid === uid);
  if (index === -1) return ok(null);

  return ok({ ...all[index], rank: index + 1 });
};

// --- weekly xp ---

export const getWeeklyXp: Handler = async (ctx) => {
  const q = ctx.query as {
    page?: number;
    pageSize?: number;
    weeksBefore?: number;
    friendsOnly?: boolean;
  };
  const pageSize = Number(q.pageSize ?? 50);
  const page = Number(q.page ?? 0);

  if (q.friendsOnly) {
    return ok({ count: 0, pageSize, entries: [] });
  }

  const weekId = currentWeekId(q.weeksBefore === 1 ? 1 : 0);
  const all = await getSortedWeeklyEntries(weeklyEntriesCol(weekId));
  const start = page * pageSize;
  const entries = all.slice(start, start + pageSize).map((e, i) => ({
    ...e,
    rank: start + i + 1,
  }));

  return ok({ count: all.length, pageSize, entries });
};

export const getWeeklyXpRank: Handler = async (ctx) => {
  const q = ctx.query as { weeksBefore?: number; friendsOnly?: boolean };
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined || q.friendsOnly) return ok(null);

  const weekId = currentWeekId(q.weeksBefore === 1 ? 1 : 0);
  const all = await getSortedWeeklyEntries(weeklyEntriesCol(weekId));
  const index = all.findIndex((e) => e.uid === uid);
  if (index === -1) return ok(null);

  return ok({ ...all[index], rank: index + 1 });
};

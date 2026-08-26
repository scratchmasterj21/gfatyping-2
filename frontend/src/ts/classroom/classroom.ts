import {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@monkeytype/schemas/leaderboards";
import {
  collection,
  CollectionReference,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { gradeOf } from "../constants/classes";
import { getDb, getIdToken } from "../firebase";

export type Student = {
  uid: string;
  name: string;
  xp: number;
  avatarUrl?: string;
  classId?: string;
};

export type ClassroomScope = "class" | "grade" | "school";
export type ClassroomMetric =
  | "xp"
  | "xpAllTime"
  | "wpm"
  | "racewpm"
  | "raceacc";

export type RaceLeaderboardEntry = {
  uid: string;
  name: string;
  avatarUrl?: string;
  bestRaceWpm: number;
  bestRaceAcc: number;
  totalRaces: number;
  wins: number;
  rank: number;
};

export type ClassroomLeaderboardData = {
  count: number;
  pageSize: number;
  entries: (XpLeaderboardEntry | LeaderboardEntry | RaceLeaderboardEntry)[];
};

type StoredPersonalBest = {
  wpm?: number;
  acc?: number;
  raw?: number;
  consistency?: number;
  timestamp?: number;
  language?: string;
};

type StoredWeeklyWpm = {
  wpm: number;
  acc: number;
  raw: number;
  consistency?: number;
  timestamp: number;
};

// Written directly at test-submission time (see computeWeeklyPeriod in
// ape/firestore/scoring.ts) - a fresh bucket starts whenever weekId changes,
// which *is* the weekly reset. No cron/backfill needed: the wpm/xp classroom
// leaderboards rank by this instead of lifetime personalBests/xp so a
// student can't set one high score and coast on it indefinitely.
export type StoredWeeklyPeriod = {
  weekId: number;
  xp: number;
  lastActivityTimestamp: number;
  wpm?: Partial<Record<WpmMode2, StoredWeeklyWpm>>;
};

export type StoredUserDoc = {
  uid?: string;
  name?: string;
  avatarUrl?: string;
  xp?: number;
  classId?: string;
  timeTyping?: number;
  completedTests?: number;
  streak?: {
    lastResultTimestamp?: number;
    length?: number;
    maxLength?: number;
  };
  personalBests?: {
    time?: Record<string, StoredPersonalBest[]>;
  };
  weeklyPeriod?: StoredWeeklyPeriod;
  /** char -> weakness score, capped to top 10, see lesson-progress.ts's updateWeakKeys */
  weakKeys?: Record<string, number>;
  lessonStars?: number;
  gameScores?: Record<string, number>;
  raceBestWpm?: number;
  raceBestWpmAcc?: number;
  raceBestAcc?: number;
  raceBestAccWpm?: number;
  raceTotalRaces?: number;
  raceWins?: number;
};

type StudentDoc = StoredUserDoc & { uid: string };

// WPM boards rank by time-mode tests in english (the most-populated personal
// bests); duration defaults to 30s but callers can pick 15/30/60.
export const WPM_MODE2_OPTIONS = ["15", "30", "60"] as const;
export type WpmMode2 = (typeof WPM_MODE2_OPTIONS)[number];
const DEFAULT_WPM_MODE2: WpmMode2 = "30";
const WPM_LANGUAGE = "english";

function usersCol(): CollectionReference {
  return collection(getDb(), "users");
}

function toStudent(userDoc: StudentDoc): Student {
  return {
    uid: userDoc.uid,
    name: userDoc.name ?? "",
    xp: userDoc.xp ?? 0,
    avatarUrl: userDoc.avatarUrl,
    classId: userDoc.classId ?? undefined,
  };
}

async function fetchUserDocs(): Promise<StudentDoc[]> {
  const snap = await getDocs(usersCol());
  return snap.docs.map((d) => {
    const data = d.data() as StoredUserDoc;
    return { ...data, uid: data.uid ?? d.id };
  });
}

export async function listAllStudents(): Promise<Student[]> {
  const docs = await fetchUserDocs();
  return docs.map(toStudent);
}

export async function setStudentClass(
  uid: string,
  classId: string | null,
): Promise<void> {
  await setDoc(doc(usersCol(), uid), { classId }, { merge: true });
}

export type BestWpm = {
  wpm: number;
  acc: number;
  raw: number;
  consistency?: number;
  timestamp: number;
};

export function bestWpm(
  userDoc: StoredUserDoc,
  mode2: WpmMode2 = DEFAULT_WPM_MODE2,
): BestWpm | null {
  const arr = userDoc.personalBests?.time?.[mode2];
  if (arr === undefined || arr.length === 0) return null;
  const english = arr.filter((p) => p.language === WPM_LANGUAGE);
  if (english.length === 0) return null;

  let best = english[0] as StoredPersonalBest;
  for (const pb of english) {
    if ((pb.wpm ?? 0) > (best.wpm ?? 0)) best = pb;
  }
  return {
    wpm: best.wpm ?? 0,
    acc: best.acc ?? 0,
    raw: best.raw ?? 0,
    consistency: best.consistency,
    timestamp: best.timestamp ?? 0,
  };
}

/**
 * Best wpm within the current week (see StoredWeeklyPeriod), or null if the
 * student has no results this week. Used for leaderboard ranking; bestWpm()
 * (lifetime) is still used for teacher progress views.
 */
export function weeklyWpm(
  userDoc: StoredUserDoc,
  mode2: WpmMode2 = DEFAULT_WPM_MODE2,
): BestWpm | null {
  return userDoc.weeklyPeriod?.wpm?.[mode2] ?? null;
}

function competitionRank<T>(
  sorted: T[],
  score: (entry: T) => number,
): Array<T & { rank: number }> {
  let previous: number | undefined;
  let rank = 0;
  return sorted.map((entry, index) => {
    const current = score(entry);
    if (previous === undefined || current !== previous) {
      rank = index + 1;
    }
    previous = current;
    return { ...entry, rank };
  });
}

export async function getClassroomLeaderboard(options: {
  scope: ClassroomScope;
  classId?: string;
  grade?: string;
  metric: ClassroomMetric;
  wpmMode2?: WpmMode2;
}): Promise<ClassroomLeaderboardData> {
  let students: StudentDoc[];

  if (options.scope === "class" && options.classId !== undefined) {
    // Query only the target class (~20 docs instead of all users)
    const snap = await getDocs(
      query(usersCol(), where("classId", "==", options.classId)),
    );
    students = snap.docs.map((d) => {
      const data = d.data() as StoredUserDoc;
      return { ...data, uid: data.uid ?? d.id };
    });
  } else {
    // Grade / school scope: need all assigned users
    const docs = await fetchUserDocs();
    students = docs.filter(
      (d) => typeof d.classId === "string" && d.classId !== "",
    );
    if (options.scope === "grade" && options.grade !== undefined) {
      students = students.filter(
        (d) => gradeOf(d.classId as string) === options.grade,
      );
    }
  }

  if (options.metric === "racewpm") {
    const sorted = students
      .filter((d) => (d.raceTotalRaces ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.raceBestWpm ?? 0) - (a.raceBestWpm ?? 0) ||
          a.uid.localeCompare(b.uid),
      )
      .map((d) => ({
        uid: d.uid,
        name: d.name ?? "",
        avatarUrl: d.avatarUrl,
        bestRaceWpm: d.raceBestWpm ?? 0,
        bestRaceAcc: d.raceBestWpmAcc ?? 0,
        totalRaces: d.raceTotalRaces ?? 0,
        wins: d.raceWins ?? 0,
      }));
    const ranked: RaceLeaderboardEntry[] = competitionRank(
      sorted,
      (entry) => entry.bestRaceWpm,
    );
    return { count: ranked.length, pageSize: ranked.length, entries: ranked };
  }

  if (options.metric === "raceacc") {
    const sorted = students
      .filter((d) => (d.raceTotalRaces ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.raceBestAcc ?? 0) - (a.raceBestAcc ?? 0) ||
          a.uid.localeCompare(b.uid),
      )
      .map((d) => ({
        uid: d.uid,
        name: d.name ?? "",
        avatarUrl: d.avatarUrl,
        bestRaceWpm: d.raceBestAccWpm ?? 0,
        bestRaceAcc: d.raceBestAcc ?? 0,
        totalRaces: d.raceTotalRaces ?? 0,
        wins: d.raceWins ?? 0,
      }));
    const ranked: RaceLeaderboardEntry[] = competitionRank(
      sorted,
      (entry) => entry.bestRaceAcc,
    );
    return { count: ranked.length, pageSize: ranked.length, entries: ranked };
  }

  if (options.metric === "wpm") {
    const sorted = students
      .map((d) => ({ d, best: weeklyWpm(d, options.wpmMode2) }))
      .filter((x): x is { d: StudentDoc; best: BestWpm } => x.best !== null)
      .sort(
        (a, b) =>
          b.best.wpm - a.best.wpm ||
          b.best.timestamp - a.best.timestamp ||
          a.d.uid.localeCompare(b.d.uid),
      )
      .map((x) => ({
        uid: x.d.uid,
        name: x.d.name ?? "",
        wpm: x.best.wpm,
        acc: x.best.acc,
        raw: x.best.raw,
        consistency: x.best.consistency,
        timestamp: x.best.timestamp,
        avatarUrl: x.d.avatarUrl,
      }));
    const ranked: (LeaderboardEntry & { avatarUrl?: string })[] =
      competitionRank(sorted, (entry) => entry.wpm);
    return { count: ranked.length, pageSize: ranked.length, entries: ranked };
  }

  if (options.metric === "xpAllTime") {
    const sorted = students
      .slice()
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0) || a.uid.localeCompare(b.uid))
      .map((d) => ({
        uid: d.uid,
        name: d.name ?? "",
        totalXp: d.xp ?? 0,
        timeTypedSeconds: 0,
        lastActivityTimestamp: d.streak?.lastResultTimestamp ?? 0,
        avatarUrl: d.avatarUrl,
      }));
    const ranked: (XpLeaderboardEntry & { avatarUrl?: string })[] =
      competitionRank(sorted, (entry) => entry.totalXp);
    return { count: ranked.length, pageSize: ranked.length, entries: ranked };
  }

  const sorted = students
    .slice()
    .sort(
      (a, b) =>
        (b.weeklyPeriod?.xp ?? 0) - (a.weeklyPeriod?.xp ?? 0) ||
        a.uid.localeCompare(b.uid),
    )
    .map((d) => ({
      uid: d.uid,
      name: d.name ?? "",
      totalXp: d.weeklyPeriod?.xp ?? 0,
      timeTypedSeconds: 0,
      lastActivityTimestamp: d.weeklyPeriod?.lastActivityTimestamp ?? 0,
      avatarUrl: d.avatarUrl,
    }));
  const ranked: (XpLeaderboardEntry & { avatarUrl?: string })[] =
    competitionRank(sorted, (entry) => entry.totalXp);
  return { count: ranked.length, pageSize: ranked.length, entries: ranked };
}

/**
 * Grade/school rankings read the entire `users` collection, which is
 * expensive at scale, so those two scopes are served by a cached Vercel
 * serverless function instead of computing client-side on every view.
 * `class` scope stays on `getClassroomLeaderboard` above (already a cheap
 * scoped query).
 */
export async function getClassroomLeaderboardFromCache(options: {
  scope: "grade" | "school";
  grade?: string;
  metric: ClassroomMetric;
  wpmMode2?: WpmMode2;
}): Promise<ClassroomLeaderboardData> {
  const token = await getIdToken();
  if (token === null) {
    return { count: 0, pageSize: 0, entries: [] };
  }

  const params = new URLSearchParams({
    scope: options.scope,
    metric: options.metric,
  });
  if (options.grade !== undefined) params.set("grade", options.grade);
  if (options.metric === "wpm") {
    params.set("mode2", options.wpmMode2 ?? DEFAULT_WPM_MODE2);
  }

  const response = await fetch(`/api/refresh-leaderboard-cache?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${options.scope} leaderboard`);
  }
  return (await response.json()) as ClassroomLeaderboardData;
}

export type LessonLeaderboardEntry = {
  uid: string;
  name: string;
  avatarUrl?: string;
  lessonStars: number;
};

export async function getLessonStarsLeaderboard(
  classId: string,
): Promise<LessonLeaderboardEntry[]> {
  const snap = await getDocs(
    query(usersCol(), where("classId", "==", classId)),
  );
  return snap.docs
    .map((d) => {
      const data = d.data() as StoredUserDoc;
      return {
        uid: data.uid ?? d.id,
        name: data.name ?? "",
        avatarUrl: data.avatarUrl,
        lessonStars: data.lessonStars ?? 0,
      };
    })
    .sort((a, b) => b.lessonStars - a.lessonStars);
}

export type ClassCompareEntry = {
  classId: string;
  studentCount: number;
  avgStars: number;
  totalStars: number;
  rank: number;
};

/**
 * Compares the classes within a grade (e.g. G3A vs G3B) by average lesson
 * stars - already grade-scaled, so it's a fair comparison. Reads the same
 * server-side cached aggregation as getClassroomLeaderboardFromCache, just a
 * different "scope" value the Vercel function branches on.
 */
export async function getClassCompare(grade: string): Promise<{
  count: number;
  pageSize: number;
  entries: ClassCompareEntry[];
}> {
  const token = await getIdToken();
  if (token === null) {
    return { count: 0, pageSize: 0, entries: [] };
  }

  const params = new URLSearchParams({ scope: "classCompare", grade });
  const response = await fetch(`/api/refresh-leaderboard-cache?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to load class comparison");
  }
  return (await response.json()) as {
    count: number;
    pageSize: number;
    entries: ClassCompareEntry[];
  };
}

export type GameScoreEntry = {
  uid: string;
  name: string;
  avatarUrl?: string;
  score: number;
};

export type GameScoresLeaderboard = Record<string, GameScoreEntry[]>;

export async function getGameScoresLeaderboard(options: {
  scope: ClassroomScope;
  classId?: string;
  grade?: string;
}): Promise<GameScoresLeaderboard> {
  let students: StudentDoc[];

  if (options.scope === "class" && options.classId !== undefined) {
    const snap = await getDocs(
      query(usersCol(), where("classId", "==", options.classId)),
    );
    students = snap.docs.map((d) => {
      const data = d.data() as StoredUserDoc;
      return { ...data, uid: data.uid ?? d.id };
    });
  } else {
    const docs = await fetchUserDocs();
    students = docs.filter(
      (d) => typeof d.classId === "string" && d.classId !== "",
    );
    if (options.scope === "grade" && options.grade !== undefined) {
      students = students.filter(
        (d) => gradeOf(d.classId as string) === options.grade,
      );
    }
  }

  const result: GameScoresLeaderboard = {};
  for (const d of students) {
    const uid = d.uid;
    const name = d.name ?? "";
    const avatarUrl = d.avatarUrl;
    const scores = d.gameScores ?? {};
    for (const [gameId, score] of Object.entries(scores)) {
      const list = result[gameId] ?? [];
      list.push({ uid, name, avatarUrl, score });
      result[gameId] = list;
    }
  }
  for (const gameId of Object.keys(result)) {
    result[gameId] = (result[gameId] as GameScoreEntry[]).sort(
      (a, b) => b.score - a.score || a.uid.localeCompare(b.uid),
    );
  }
  return result;
}

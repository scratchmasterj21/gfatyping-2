import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

// Reads the entire `users` collection to rank the grade/school classroom
// leaderboards, then caches the result so repeat views within TTL_MS are a
// single doc read instead of a full collection scan. Only this function
// (via the Admin SDK, which bypasses firestore.rules) may write the cache;
// see the `leaderboardCache` rule in frontend/firestore.rules.
const TTL_MS = 5 * 60 * 1000;
const WPM_MODE2_OPTIONS = ["15", "30", "60"] as const;
type WpmMode2 = (typeof WPM_MODE2_OPTIONS)[number];
const DEFAULT_WPM_MODE2: WpmMode2 = "30";
const DOMAIN = "@felice.ed.jp";
const ADMIN_EMAIL = "john.limpiada@felice.ed.jp";

type ClassroomMetric = "xp" | "xpAllTime" | "wpm" | "racewpm" | "raceacc";

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

// Written directly at test-submission time by ape/firestore/results.ts
// (computeWeeklyPeriod in scoring.ts) - a fresh bucket per weekId, no cron
// needed. Mirrors classroom.ts's StoredWeeklyPeriod.
type StoredWeeklyPeriod = {
  weekId: number;
  xp: number;
  lastActivityTimestamp: number;
  wpm?: Partial<Record<WpmMode2, StoredWeeklyWpm>>;
};

type StoredUserDoc = {
  uid?: string;
  name?: string;
  avatarUrl?: string;
  xp?: number;
  classId?: string;
  personalBests?: { time?: Record<string, StoredPersonalBest[]> };
  streak?: { lastResultTimestamp?: number };
  weeklyPeriod?: StoredWeeklyPeriod;
  raceBestWpm?: number;
  raceBestWpmAcc?: number;
  raceBestAcc?: number;
  raceBestAccWpm?: number;
  raceTotalRaces?: number;
  raceWins?: number;
  lessonStars?: number;
};

type Student = StoredUserDoc & { uid: string };

function competitionRank<T>(
  sorted: T[],
  score: (entry: T) => number,
): Array<T & { rank: number }> {
  let previous: number | undefined;
  let rank = 0;
  return sorted.map((entry, index) => {
    const current = score(entry);
    if (previous === undefined || current !== previous) rank = index + 1;
    previous = current;
    return { ...entry, rank };
  });
}

type CachedResult = {
  count: number;
  pageSize: number;
  entries: unknown[];
  computedAt: number;
};

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (raw === undefined) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
  }
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount),
  });
}

/** Grade portion of a class id, e.g. "G3A" -> "G3". Mirrors classes.ts. */
function gradeOf(classId: string): string {
  return classId.slice(0, 2);
}

/** Mirrors classroom.ts's weeklyWpm(): best wpm within the current week. */
function weeklyWpm(
  doc: StoredUserDoc,
  mode2: WpmMode2,
): StoredWeeklyWpm | null {
  return doc.weeklyPeriod?.wpm?.[mode2] ?? null;
}

/** Mirrors the grade/school branches of classroom.ts's getClassroomLeaderboard. */
function rankStudents(
  students: Student[],
  metric: ClassroomMetric,
  wpmMode2: WpmMode2,
): { count: number; pageSize: number; entries: unknown[] } {
  if (metric === "racewpm") {
    const ranked = students
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
    const entries = competitionRank(ranked, (d) => d.bestRaceWpm);
    return { count: entries.length, pageSize: entries.length, entries };
  }

  if (metric === "raceacc") {
    const ranked = students
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
    const entries = competitionRank(ranked, (d) => d.bestRaceAcc);
    return { count: entries.length, pageSize: entries.length, entries };
  }

  if (metric === "wpm") {
    const ranked = students
      .map((d) => ({ d, best: weeklyWpm(d, wpmMode2) }))
      .filter(
        (
          x,
        ): x is {
          d: Student;
          best: NonNullable<ReturnType<typeof weeklyWpm>>;
        } => x.best !== null,
      )
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
    const entries = competitionRank(ranked, (d) => d.wpm);
    return { count: entries.length, pageSize: entries.length, entries };
  }

  if (metric === "xpAllTime") {
    const ranked = students
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
    const entries = competitionRank(ranked, (d) => d.totalXp);
    return { count: entries.length, pageSize: entries.length, entries };
  }

  const ranked = students
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
  const entries = competitionRank(ranked, (d) => d.totalXp);
  return { count: entries.length, pageSize: entries.length, entries };
}

type ClassPairEntry = {
  classId: string;
  studentCount: number;
  avgStars: number;
  totalStars: number;
  rank: number;
};

/**
 * Groups a single grade's students by classId (e.g. "G3A" vs "G3B") and
 * ranks the classes by average lesson stars - already grade-scaled
 * (STAR_THRESHOLDS in lessons-data.ts), so avg stars is a fair comparison
 * without any extra grade-weighting math.
 */
function rankClassPairs(
  students: Student[],
  grade: string,
): { count: number; pageSize: number; entries: ClassPairEntry[] } {
  const byClass = new Map<string, Student[]>();
  for (const s of students) {
    if (typeof s.classId !== "string" || gradeOf(s.classId) !== grade) continue;
    const list = byClass.get(s.classId) ?? [];
    list.push(s);
    byClass.set(s.classId, list);
  }

  const ranked = [...byClass.entries()]
    .map(([classId, members]) => {
      const totalStars = members.reduce(
        (sum, m) => sum + (m.lessonStars ?? 0),
        0,
      );
      return {
        classId,
        studentCount: members.length,
        totalStars,
        avgStars: members.length > 0 ? totalStars / members.length : 0,
      };
    })
    .sort(
      (a, b) => b.avgStars - a.avgStars || a.classId.localeCompare(b.classId),
    );
  const entries = competitionRank(ranked, (c) => c.avgStars);

  return { count: entries.length, pageSize: entries.length, entries };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const scope = req.query["scope"];
  const metric = req.query["metric"];
  const grade = req.query["grade"];
  const mode2Param = req.query["mode2"];

  const isClassCompare = scope === "classCompare";
  if (isClassCompare) {
    if (typeof grade !== "string") {
      res.status(400).json({ message: "Invalid grade" });
      return;
    }
  } else if (
    (scope !== "grade" && scope !== "school") ||
    typeof metric !== "string" ||
    !["xp", "xpAllTime", "wpm", "racewpm", "raceacc"].includes(metric) ||
    (scope === "grade" && typeof grade !== "string") ||
    (metric === "wpm" &&
      mode2Param !== undefined &&
      !(WPM_MODE2_OPTIONS as readonly string[]).includes(mode2Param as string))
  ) {
    res.status(400).json({ message: "Invalid scope/metric/grade/mode2" });
    return;
  }
  const wpmMode2: WpmMode2 =
    typeof mode2Param === "string" && metric === "wpm"
      ? (mode2Param as WpmMode2)
      : DEFAULT_WPM_MODE2;

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token === "") {
    res.status(401).json({ message: "Missing Authorization header" });
    return;
  }

  let app: admin.app.App;
  try {
    app = getAdminApp();
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
    return;
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await app.auth().verifyIdToken(token);
    if (decoded.email === undefined || !decoded.email.endsWith(DOMAIN)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  const db = app.firestore();
  if (scope === "grade" && decoded.email !== ADMIN_EMAIL) {
    const requester = await db.collection("users").doc(decoded.uid).get();
    const requesterData = requester.data() as { classId?: unknown } | undefined;
    const classId = requesterData?.classId;
    const ownGrade = typeof classId === "string" ? gradeOf(classId) : undefined;
    if (ownGrade === undefined || grade !== ownGrade) {
      res
        .status(403)
        .json({ message: "Students may only view their own grade" });
      return;
    }
  }
  const cacheKey = isClassCompare
    ? `classCompare_${grade}`
    : `${scope}_${scope === "grade" ? grade : "all"}_${metric}${
        metric === "wpm" ? `_${wpmMode2}` : ""
      }`;
  const cacheRef = db.collection("leaderboardCache").doc(cacheKey);

  const cached = await cacheRef.get();
  if (cached.exists) {
    const data = cached.data() as CachedResult;
    if (Date.now() - data.computedAt < TTL_MS) {
      res.status(200).json({
        count: data.count,
        pageSize: data.pageSize,
        entries: data.entries,
      });
      return;
    }
  }

  const usersSnap = await db.collection("users").get();
  let students: Student[] = usersSnap.docs
    .map((d: admin.firestore.QueryDocumentSnapshot) => {
      const data = d.data() as StoredUserDoc;
      return { ...data, uid: data.uid ?? d.id };
    })
    .filter((d: Student) => typeof d.classId === "string" && d.classId !== "");

  if (isClassCompare) {
    const result = rankClassPairs(students, grade as string);
    const record: CachedResult = { ...result, computedAt: Date.now() };
    await cacheRef.set(record);
    res.status(200).json(result);
    return;
  }

  if (scope === "grade") {
    students = students.filter((d) => gradeOf(d.classId as string) === grade);
  }

  const result = rankStudents(students, metric as ClassroomMetric, wpmMode2);
  const record: CachedResult = { ...result, computedAt: Date.now() };
  await cacheRef.set(record);

  res.status(200).json(result);
}

import { collection, getDocs, query, where } from "firebase/firestore";
import { getDb } from "../firebase";

export type StudentActivity = {
  testsTaken: number;
  avgWpm: number;
  avgAcc: number;
  timeTypingSeconds: number;
};

export const EMPTY_ACTIVITY: StudentActivity = {
  testsTaken: 0,
  avgWpm: 0,
  avgAcc: 0,
  timeTypingSeconds: 0,
};

type StoredResult = {
  wpm?: number;
  acc?: number;
  testDuration?: number;
  incompleteTestSeconds?: number;
  afkDuration?: number;
};

/**
 * Typing activity for one student within [startTs, endTs] (inclusive),
 * computed from their `results` subcollection - the only place individual
 * tests carry a real timestamp. Lifetime stats (xp, lessons, best wpm, etc.)
 * have no history to filter by date, so a report combines this with
 * StudentProgressRow's lifetime totals rather than trying to date-range those too.
 */
export async function getStudentActivity(
  uid: string,
  startTs: number,
  endTs: number,
): Promise<StudentActivity> {
  const snap = await getDocs(
    query(
      collection(getDb(), "users", uid, "results"),
      where("timestamp", ">=", startTs),
      where("timestamp", "<=", endTs),
    ),
  );

  let testsTaken = 0;
  let wpmSum = 0;
  let accSum = 0;
  let timeTypingSeconds = 0;

  for (const resultDoc of snap.docs) {
    const d = resultDoc.data() as StoredResult;
    testsTaken++;
    wpmSum += d.wpm ?? 0;
    accSum += d.acc ?? 0;
    const time =
      (d.testDuration ?? 0) +
      (d.incompleteTestSeconds ?? 0) -
      (d.afkDuration ?? 0);
    timeTypingSeconds += Math.max(0, time);
  }

  return {
    testsTaken,
    avgWpm: testsTaken > 0 ? wpmSum / testsTaken : 0,
    avgAcc: testsTaken > 0 ? accSum / testsTaken : 0,
    timeTypingSeconds,
  };
}

/** Activity for a whole class, keyed by uid - one subcollection query per student. */
export async function getClassActivity(
  uids: string[],
  startTs: number,
  endTs: number,
): Promise<Record<string, StudentActivity>> {
  const entries = await Promise.all(
    uids.map(
      async (uid) =>
        [uid, await getStudentActivity(uid, startTs, endTs)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

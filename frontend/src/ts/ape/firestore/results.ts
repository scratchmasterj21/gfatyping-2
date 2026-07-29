import { CompletedEvent, XpBreakdown } from "@monkeytype/schemas/results";
import {
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import {
  db,
  Handler,
  HandlerError,
  ok,
  requireUid,
  stripUndefined,
} from "./common";
import {
  currentWeekId,
  incrementWeeklyXp,
  upsertDailyLeaderboardEntry,
  upsertLeaderboardEntry,
} from "./leaderboards";
import {
  checkAndUpdatePersonalBest,
  computeStreak,
  computeWeeklyPeriod,
  computeXp,
  emptyPersonalBests,
  PersonalBestsLike,
  StreakData,
  WeeklyPeriodData,
} from "./scoring";

type StoredUserData = {
  name?: string;
  xp?: number;
  streak?: StreakData;
  timeTyping?: number;
  startedTests?: number;
  completedTests?: number;
  personalBests?: PersonalBestsLike;
  weeklyPeriod?: WeeklyPeriodData;
};

type StoredTagData = {
  _id?: string;
  personalBests?: PersonalBestsLike;
};

function userRef(uid: string): DocumentReference {
  return doc(db(), "users", uid);
}
function resultsCol(uid: string): CollectionReference {
  return collection(db(), "users", uid, "results");
}

function buildStoredResult(
  result: CompletedEvent,
  meta: {
    id: string;
    uid: string;
    name: string;
    isPb: boolean;
    timestamp: number;
  },
): Record<string, unknown> {
  return stripUndefined({
    _id: meta.id,
    uid: meta.uid,
    name: meta.name,
    isPb: meta.isPb || undefined,
    timestamp: meta.timestamp,
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    charStats: result.charStats,
    acc: result.acc,
    mode: result.mode,
    mode2: result.mode2,
    quoteLength: result.quoteLength,
    testDuration: result.testDuration,
    consistency: result.consistency,
    keyConsistency: result.keyConsistency,
    chartData: result.chartData,
    restartCount: result.restartCount,
    incompleteTestSeconds: result.incompleteTestSeconds,
    afkDuration: result.afkDuration,
    tags: result.tags ?? [],
    bailedOut: result.bailedOut,
    blindMode: result.blindMode,
    lazyMode: result.lazyMode,
    funbox: result.funbox,
    language: result.language,
    difficulty: result.difficulty,
    numbers: result.numbers,
    punctuation: result.punctuation,
  });
}

type AddOutcome = {
  isPb: boolean;
  tagPbs: string[];
  xp: number;
  breakdown: XpBreakdown;
  streak: number;
  name: string;
  timeTyped: number;
};

export const add: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { result?: CompletedEvent };
  const result = body.result;
  if (result === undefined) throw new HandlerError(463, "Result data invalid");
  if (result.testDuration < 1) throw new HandlerError(460, "Test too short");

  const resultId = doc(resultsCol(uid)).id;
  const timestamp = Date.now();
  const tagIds = result.tags ?? [];

  let outcome: AddOutcome | undefined;

  await runTransaction(db(), async (tx) => {
    const userSnap = await tx.get(userRef(uid));
    if (!userSnap.exists()) throw new HandlerError(404, "User not found");
    const user = userSnap.data() as StoredUserData;

    const tagDocs: {
      ref: DocumentReference;
      data: StoredTagData;
    }[] = [];
    for (const tagId of tagIds) {
      const tref = doc(db(), "users", uid, "tags", tagId);
      const tsnap = await tx.get(tref);
      if (tsnap.exists()) {
        tagDocs.push({
          ref: tref,
          data: tsnap.data() as StoredTagData,
        });
      }
    }

    const personalBests = user.personalBests ?? emptyPersonalBests();
    const { isPb } = checkAndUpdatePersonalBest(personalBests, result);

    const { xp, breakdown } = computeXp(result);
    const newXp = (user.xp ?? 0) + xp;
    const streak = computeStreak(user.streak, timestamp);
    const weeklyPeriod = computeWeeklyPeriod(
      user.weeklyPeriod,
      result,
      xp,
      timestamp,
      currentWeekId(0),
    );

    const time =
      result.testDuration +
      (result.incompleteTestSeconds ?? 0) -
      (result.afkDuration ?? 0);
    const timeTyping = (user.timeTyping ?? 0) + Math.max(0, time);
    const startedTests =
      (user.startedTests ?? 0) + (result.restartCount ?? 0) + 1;
    const completedTests = (user.completedTests ?? 0) + 1;

    const userName = user.name ?? "";

    const tagPbs: string[] = [];
    for (const { ref, data } of tagDocs) {
      const tagPersonalBests = data.personalBests ?? emptyPersonalBests();
      const { isPb: tagIsPb } = checkAndUpdatePersonalBest(
        tagPersonalBests,
        result,
      );
      if (tagIsPb) {
        tagPbs.push(data._id ?? ref.id);
        tx.update(ref, { personalBests: tagPersonalBests });
      }
    }

    const storedResult = buildStoredResult(result, {
      id: resultId,
      uid,
      name: userName,
      isPb,
      timestamp,
    });
    tx.set(doc(resultsCol(uid), resultId), storedResult);
    tx.set(
      userRef(uid),
      stripUndefined({
        personalBests,
        xp: newXp,
        streak,
        timeTyping,
        startedTests,
        completedTests,
        weeklyPeriod,
      }),
      { merge: true },
    );

    outcome = {
      isPb,
      tagPbs,
      xp,
      breakdown,
      streak: streak.length,
      name: userName,
      timeTyped: Math.max(0, time),
    };
  });

  if (outcome === undefined) {
    throw new HandlerError(500, "Failed to save result");
  }

  await upsertLeaderboardEntry(uid, outcome.name, result, timestamp).catch(
    () => undefined,
  );
  await upsertDailyLeaderboardEntry(uid, outcome.name, result, timestamp).catch(
    () => undefined,
  );
  await incrementWeeklyXp(
    uid,
    outcome.name,
    outcome.xp,
    outcome.timeTyped,
    timestamp,
  ).catch(() => undefined);

  return ok({
    insertedId: resultId,
    isPb: outcome.isPb,
    tagPbs: outcome.tagPbs,
    xp: outcome.xp,
    dailyXpBonus: false,
    xpBreakdown: outcome.breakdown,
    streak: outcome.streak,
  });
};

export const get: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const q = ctx.query as { limit?: number };
  const requested = Number(q.limit ?? 1000);
  const lim = Math.min(Number.isFinite(requested) ? requested : 1000, 1000);
  const snap = await getDocs(
    query(resultsCol(uid), orderBy("timestamp", "desc"), fbLimit(lim)),
  );
  return ok(snap.docs.map((d) => d.data()));
};

export const getById: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const id = ctx.params["resultId"];
  if (id === undefined || id === "") {
    throw new HandlerError(422, "Missing resultId");
  }
  const snap = await getDoc(doc(resultsCol(uid), id));
  if (!snap.exists()) throw new HandlerError(404, "Result not found");
  return ok(snap.data());
};

export const updateTags: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { resultId?: string; tagIds?: string[] };
  if (body.resultId === undefined || body.resultId === "") {
    throw new HandlerError(422, "Missing resultId");
  }

  const resultRef = doc(resultsCol(uid), body.resultId);
  const snap = await getDoc(resultRef);
  if (!snap.exists()) throw new HandlerError(404, "Result not found");
  const result = snap.data() as unknown as CompletedEvent;
  const tagIds = body.tagIds ?? [];

  await updateDoc(resultRef, { tags: tagIds });

  const tagPbs: string[] = [];
  for (const tagId of tagIds) {
    const tref = doc(db(), "users", uid, "tags", tagId);
    const tsnap = await getDoc(tref);
    if (!tsnap.exists()) continue;
    const data = tsnap.data() as StoredTagData;
    const tagPersonalBests = data.personalBests ?? emptyPersonalBests();
    const { isPb } = checkAndUpdatePersonalBest(tagPersonalBests, result);
    if (isPb) {
      tagPbs.push(tagId);
      await updateDoc(tref, { personalBests: tagPersonalBests });
    }
  }

  return ok({ tagPbs });
};

import { CompletedEvent, XpBreakdown } from "@monkeytype/schemas/results";
import {
  collection,
  CollectionReference,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { callApi } from "../../api-client";
import { triggerCelebration } from "../../states/celebration";
import { db, Handler, HandlerError, ok, requireUid } from "./common";
import {
  checkAndUpdatePersonalBest,
  emptyPersonalBests,
  PersonalBestsLike,
} from "./scoring";

type StoredTagData = {
  _id?: string;
  personalBests?: PersonalBestsLike;
};

function resultsCol(uid: string): CollectionReference {
  return collection(db(), "users", uid, "results");
}

type SubmitResultResponse = {
  ok: boolean;
  reason?: string;
  insertedId?: string;
  isPb?: boolean;
  xp?: number;
  xpBreakdown?: XpBreakdown;
  streak?: number;
  newlyCompletedQuests?: { name: string; coinReward: number }[];
};

/**
 * personalBests/xp/streak/timeTyping/completedTests/leaderboards/coins are
 * computed and written server-side (see api/submit-result.ts) - this used to
 * write them straight from the client, which let a student self-report an
 * arbitrary wpm/acc onto their own record and the leaderboards.
 */
export const add: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { result?: CompletedEvent };
  const result = body.result;
  if (result === undefined) throw new HandlerError(463, "Result data invalid");
  if (result.testDuration < 1) throw new HandlerError(460, "Test too short");

  const response = await callApi<SubmitResultResponse>("/api/submit-result", {
    result,
  });
  if (!response.ok || response.insertedId === undefined) {
    throw new HandlerError(500, response.reason ?? "Failed to save result");
  }

  for (const quest of response.newlyCompletedQuests ?? []) {
    triggerCelebration({
      title: "Quest complete!",
      message: `${quest.name} - +${quest.coinReward} coins`,
      icon: "fa-flag-checkered",
    });
  }

  // Tag personal bests are a per-student organizational feature (not
  // leaderboard/coin-bearing), so they stay a direct client write.
  const tagPbs: string[] = [];
  for (const tagId of result.tags ?? []) {
    const tref = doc(db(), "users", uid, "tags", tagId);
    const tsnap = await getDoc(tref);
    if (!tsnap.exists()) continue;
    const data = tsnap.data() as StoredTagData;
    const tagPersonalBests = data.personalBests ?? emptyPersonalBests();
    const { isPb: tagIsPb } = checkAndUpdatePersonalBest(
      tagPersonalBests,
      result,
    );
    if (tagIsPb) {
      tagPbs.push(data._id ?? tref.id);
      await updateDoc(tref, { personalBests: tagPersonalBests });
    }
  }

  return ok({
    insertedId: response.insertedId,
    isPb: response.isPb ?? false,
    tagPbs,
    xp: response.xp ?? 0,
    dailyXpBonus: false,
    xpBreakdown: response.xpBreakdown,
    streak: response.streak ?? 0,
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

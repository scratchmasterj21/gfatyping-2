import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getAuthenticatedUser } from "../../firebase";
import {
  db,
  Handler,
  HandlerError,
  ok,
  okMessage,
  requireUid,
  stripUndefined,
} from "./common";
import { emptyPersonalBests } from "./scoring";

function userRef(uid: string): DocumentReference {
  return doc(db(), "users", uid);
}
function usernameRef(name: string): DocumentReference {
  return doc(db(), "usernames", name.toLowerCase());
}
function tagsCol(uid: string): CollectionReference {
  return collection(db(), "users", uid, "tags");
}

type StoredUser = {
  uid: string;
  name: string;
  nameLower: string;
  email?: string;
  avatarUrl?: string;
  addedAt: number;
  classId?: string;
  xp?: number;
  personalBests?: unknown;
  lbMemory?: unknown;
  allTimeLbs?: unknown;
  timeTyping?: number;
  startedTests?: number;
  completedTests?: number;
  streak?: {
    length: number;
    maxLength: number;
    lastResultTimestamp: number;
    hourOffset?: number;
  };
  testActivity?: { testsByDays: (number | null)[]; lastDay: number };
};

export async function getStoredUser(uid: string): Promise<StoredUser | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as StoredUser) : null;
}

export const get: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const stored = await getStoredUser(uid);
  if (stored === null) {
    throw new HandlerError(404, "User not found");
  }

  const tagSnap = await getDocs(tagsCol(uid));
  const tags = tagSnap.docs.map((d) => d.data());

  // Backfill missing join date / avatar from the Firebase Auth account so old
  // user docs (created before these fields existed) and profile lookups by
  // other users get the correct values.
  const authUser = getAuthenticatedUser();
  const patch: { addedAt?: number; avatarUrl?: string } = {};

  let addedAt = stored.addedAt ?? 0;
  if (addedAt === 0) {
    const created = authUser?.metadata?.creationTime;
    if (created !== undefined && created !== null && created !== "") {
      const parsed = Date.parse(created);
      if (!Number.isNaN(parsed)) {
        addedAt = parsed;
        patch.addedAt = parsed;
      }
    }
  }

  const photo = authUser?.photoURL ?? undefined;
  let avatarUrl = stored.avatarUrl;
  if (photo !== undefined && photo !== stored.avatarUrl) {
    avatarUrl = photo;
    patch.avatarUrl = photo;
  }

  if (Object.keys(patch).length > 0) {
    await setDoc(userRef(uid), patch, { merge: true }).catch(() => undefined);
  }

  const streak = stored.streak;
  const data = {
    uid,
    name: stored.name,
    email: stored.email ?? authUser?.email ?? "",
    avatarUrl,
    addedAt,
    classId: stored.classId,
    personalBests: stored.personalBests ?? emptyPersonalBests(),
    banned: false,
    verified: true,
    lbOptOut: false,
    needsToChangeName: false,
    timeTyping: stored.timeTyping ?? 0,
    startedTests: stored.startedTests ?? 0,
    completedTests: stored.completedTests ?? 0,
    quoteMod: false,
    favoriteQuotes: {},
    quoteRatings: undefined,
    profileDetails: undefined,
    inventory: { badges: [] },
    xp: stored.xp ?? 0,
    inboxUnreadSize: 0,
    isPremium: false,
    allTimeLbs: stored.allTimeLbs ?? undefined,
    lbMemory: stored.lbMemory ?? undefined,
    testActivity: stored.testActivity ?? undefined,
    streak:
      streak !== undefined
        ? {
            length: streak.length,
            maxLength: streak.maxLength,
            lastResultTimestamp: streak.lastResultTimestamp,
            hourOffset: streak.hourOffset,
          }
        : undefined,
    tags,
  };

  return ok(data);
};

export const create: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { name?: string };
  const name = (body.name ?? "").trim();
  if (name.length === 0) {
    throw new HandlerError(422, "Name cannot be empty");
  }

  // If the user doc already exists, treat as success (idempotent).
  const existing = await getStoredUser(uid);
  if (existing !== null) {
    return okMessage("user already exists");
  }

  const nameLower = name.toLowerCase();
  const nameDoc = await getDoc(usernameRef(name));
  if (nameDoc.exists() && (nameDoc.data() as { uid: string }).uid !== uid) {
    throw new HandlerError(409, "Username already taken");
  }

  const authUser = getAuthenticatedUser();
  const created = authUser?.metadata?.creationTime;
  const addedAt =
    created !== undefined && created !== null && created !== ""
      ? Date.parse(created)
      : Date.now();
  const batch = writeBatch(db());
  batch.set(
    userRef(uid),
    stripUndefined<StoredUser>({
      uid,
      name,
      nameLower,
      email: authUser?.email ?? undefined,
      avatarUrl: authUser?.photoURL ?? undefined,
      addedAt: Number.isNaN(addedAt) ? Date.now() : addedAt,
      xp: 0,
      personalBests: emptyPersonalBests(),
      lbMemory: { time: { "15": { english: 0 }, "60": { english: 0 } } },
      timeTyping: 0,
      startedTests: 0,
      completedTests: 0,
      streak: { length: 0, maxLength: 0, lastResultTimestamp: 0 },
    }),
  );
  batch.set(usernameRef(name), { uid });
  await batch.commit();

  return okMessage("user created");
};

export const deleteUser: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const stored = await getStoredUser(uid);

  // best-effort cleanup of subcollections
  for (const sub of ["tags", "results", "config"]) {
    const snap = await getDocs(collection(db(), "users", uid, sub));
    await Promise.all(snap.docs.map(async (d) => deleteDoc(d.ref)));
  }

  if (stored?.nameLower !== undefined) {
    await deleteDoc(usernameRef(stored.nameLower)).catch(() => undefined);
  }
  await deleteDoc(userRef(uid));

  return okMessage("user deleted");
};

export const reset: Handler = async (ctx) => {
  const uid = requireUid(ctx);

  // wipe history-style subcollections
  for (const sub of ["tags", "results", "config"]) {
    const snap = await getDocs(collection(db(), "users", uid, sub));
    await Promise.all(snap.docs.map(async (d) => deleteDoc(d.ref)));
  }

  // reset progression on the user doc, keeping identity (name/addedAt/avatar)
  await setDoc(
    userRef(uid),
    {
      personalBests: emptyPersonalBests(),
      xp: 0,
      streak: { length: 0, maxLength: 0, lastResultTimestamp: 0 },
      timeTyping: 0,
      startedTests: 0,
      completedTests: 0,
      lbMemory: { time: { "15": { english: 0 }, "60": { english: 0 } } },
    },
    { merge: true },
  );

  return okMessage("user reset");
};

export const deletePersonalBests: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  await setDoc(
    userRef(uid),
    { personalBests: emptyPersonalBests() },
    { merge: true },
  );
  return okMessage("personal bests deleted");
};

export const getProfile: Handler = async (ctx) => {
  const uidOrName = ctx.params["uidOrName"];
  if (uidOrName === undefined || uidOrName === "") {
    throw new HandlerError(404, "User not found");
  }
  const isUid = ctx.query["isUid"] === true || ctx.query["isUid"] === "true";

  let uid = uidOrName;
  if (!isUid) {
    const nameSnap = await getDoc(usernameRef(uidOrName));
    if (!nameSnap.exists()) {
      throw new HandlerError(404, "User not found");
    }
    uid = (nameSnap.data() as { uid: string }).uid;
  }

  const stored = await getStoredUser(uid);
  if (stored === null) {
    throw new HandlerError(404, "User not found");
  }

  const streak = stored.streak;
  const profile = {
    uid: stored.uid ?? uid,
    name: stored.name,
    avatarUrl: stored.avatarUrl,
    classId: stored.classId,
    banned: false,
    addedAt: stored.addedAt ?? 0,
    xp: stored.xp ?? 0,
    lbOptOut: false,
    isPremium: false,
    typingStats: {
      completedTests: stored.completedTests ?? 0,
      startedTests: stored.startedTests ?? 0,
      timeTyping: stored.timeTyping ?? 0,
    },
    personalBests: stored.personalBests ?? emptyPersonalBests(),
    streak: streak?.length ?? 0,
    maxStreak: streak?.maxLength ?? 0,
    allTimeLbs: stored.allTimeLbs ?? { time: {} },
    testActivity: stored.testActivity ?? undefined,
    inventory: { badges: [] },
    details: undefined,
  };

  return ok(profile);
};

export const getNameAvailability: Handler = async (ctx) => {
  const name = ctx.params["name"] ?? "";
  const snap = await getDoc(usernameRef(name));
  const currentUid = getAuthenticatedUser()?.uid;
  const available =
    !snap.exists() || (snap.data() as { uid: string }).uid === currentUid;
  return ok({ available });
};

// --- tags ---

export const getTags: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const snap = await getDocs(tagsCol(uid));
  return ok(snap.docs.map((d) => d.data()));
};

export const createTag: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { tagName?: string };
  const tagName = body.tagName ?? "";
  const ref = doc(tagsCol(uid));
  const tag = {
    _id: ref.id,
    name: tagName,
    personalBests: emptyPersonalBests(),
  };
  await setDoc(ref, tag);
  return ok(tag);
};

export const editTag: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { tagId?: string; newName?: string };
  if (body.tagId === undefined || body.tagId === "") {
    throw new HandlerError(422, "Missing tagId");
  }
  await updateDoc(doc(tagsCol(uid), body.tagId), {
    name: body.newName ?? "",
  });
  return okMessage("tag updated");
};

export const deleteTag: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const tagId = ctx.params["tagId"];
  if (tagId === undefined || tagId === "") {
    throw new HandlerError(422, "Missing tagId");
  }
  await deleteDoc(doc(tagsCol(uid), tagId));
  return okMessage("tag deleted");
};

export const deleteTagPersonalBest: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const tagId = ctx.params["tagId"];
  if (tagId === undefined || tagId === "") {
    throw new HandlerError(422, "Missing tagId");
  }
  await updateDoc(doc(tagsCol(uid), tagId), {
    personalBests: emptyPersonalBests(),
  });
  return okMessage("tag personal bests cleared");
};

// --- misc ---

export const updateLeaderboardMemory: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as {
    mode?: string;
    mode2?: string;
    language?: string;
    rank?: number;
  };
  if (
    body.mode === undefined ||
    body.mode2 === undefined ||
    body.language === undefined
  ) {
    throw new HandlerError(422, "Invalid leaderboard memory");
  }
  await setDoc(
    userRef(uid),
    {
      lbMemory: {
        [body.mode]: { [body.mode2]: { [body.language]: body.rank ?? 0 } },
      },
    },
    { merge: true },
  );
  return okMessage("leaderboard memory updated");
};

export const setStreakHourOffset: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = (ctx.body ?? {}) as { hourOffset?: number };
  await setDoc(
    userRef(uid),
    { streak: { hourOffset: body.hourOffset ?? 0 } },
    { merge: true },
  );
  return okMessage("streak hour offset set");
};

export const getTestActivity: Handler = async () => {
  // Historical (per-year) activity is not tracked in the serverless model.
  return ok(null);
};

// Features not supported in the serverless model. Their collections auto-run on
// load, so return empty-but-valid payloads instead of 501 to avoid error noise.
export const getCustomThemes: Handler = async () => ok([]);
export const getInbox: Handler = async () => ok({ inbox: [], maxMail: 0 });

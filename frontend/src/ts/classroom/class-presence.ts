import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { getAuthenticatedUser, getDb } from "../firebase";

export type ClassPresencePage = "test" | "lessons" | "other";

export type ClassPresenceMember = {
  uid: string;
  name: string;
  lastSeen: number;
  page: ClassPresencePage;
  typing?: boolean;
  lessonId?: string;
  progress?: number;
  liveWpm?: number;
};

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function membersCol(classId: string): CollectionReference {
  return collection(getDb(), "classPresence", classId, "members");
}

function memberDoc(classId: string, uid: string): DocumentReference {
  return doc(getDb(), "classPresence", classId, "members", uid);
}

export async function writeClassPresence(
  classId: string,
  data: Omit<ClassPresenceMember, "uid" | "name" | "lastSeen"> & {
    lastSeen?: number;
  },
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null) return;
  await setDoc(
    memberDoc(classId, user.uid),
    clean({
      uid: user.uid,
      name: user.displayName ?? "Student",
      lastSeen: data.lastSeen ?? Date.now(),
      page: data.page,
      typing: data.typing,
      lessonId: data.lessonId,
      progress: data.progress,
      liveWpm: data.liveWpm,
    }),
    { merge: true },
  );
}

export async function clearClassPresence(
  classId: string | null,
): Promise<void> {
  const user = getAuthenticatedUser();
  if (user === null || classId === null || classId === "") return;
  await deleteDoc(memberDoc(classId, user.uid)).catch(() => undefined);
}

export function subscribeClassPresence(
  classId: string,
  cb: (members: ClassPresenceMember[]) => void,
): () => void {
  return onSnapshot(
    membersCol(classId),
    (snap) => cb(snap.docs.map((d) => d.data() as ClassPresenceMember)),
    () => cb([]),
  );
}

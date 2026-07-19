import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { gradeOf } from "../constants/classes";
import { getAuthenticatedUser, getDb } from "../firebase";
import { findLesson, lessonOrder } from "../lessons/lessons-data";
import { bestWpm, StoredUserDoc } from "./classroom";

export type ContentScope = "class" | "grade" | "school";
export type ContentType = "lesson" | "wordlist" | "passage";

export type ReadingPassage = {
  id: string;
  title: string;
  text: string;
  scope: ContentScope;
  classId?: string;
  grade?: string;
  createdAt: number;
  createdBy: string;
};

export type WordList = {
  id: string;
  title: string;
  text: string;
  scope: ContentScope;
  classId?: string;
  grade?: string;
  createdAt: number;
  createdBy: string;
};

export type Assignment = {
  id: string;
  title: string;
  scope: ContentScope;
  classId?: string;
  grade?: string;
  contentType: ContentType;
  lessonId?: string;
  wordListId?: string;
  passageId?: string;
  dueAt?: number;
  createdAt: number;
  createdBy: string;
};

/** Progress-key prefixes so the dashboard can tell content types apart. */
export const ASSIGNMENT_PREFIX = "assign:";
export const WORDLIST_PREFIX = "wl:";
export const PASSAGE_PREFIX = "passage:";

function wordListsCol(): CollectionReference {
  return collection(getDb(), "wordLists");
}

function assignmentsCol(): CollectionReference {
  return collection(getDb(), "assignments");
}

function passagesCol(): CollectionReference {
  return collection(getDb(), "readingPassages");
}

/** Drop undefined keys so Firestore writes don't fail. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Split text into typing tokens (whitespace separated, preserves punctuation). */
export function wordListTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

export const passageTokens = wordListTokens;

/** Whether an item scoped to (scope/classId/grade) applies to a student's class. */
function appliesToClass(
  item: { scope: ContentScope; classId?: string; grade?: string },
  classId: string,
): boolean {
  if (item.scope === "school") return true;
  if (item.scope === "grade") return item.grade === gradeOf(classId);
  return item.classId === classId;
}

// ---------------------------------------------------------------------------
// Word lists (admin CRUD + student reads)
// ---------------------------------------------------------------------------

export async function createWordList(input: {
  title: string;
  text: string;
  scope: ContentScope;
  classId?: string;
  grade?: string;
}): Promise<void> {
  const ref = doc(wordListsCol());
  const createdBy = getAuthenticatedUser()?.uid ?? "";
  await setDoc(
    ref,
    clean<WordList>({
      id: ref.id,
      title: input.title,
      text: input.text,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
      createdAt: Date.now(),
      createdBy,
    }),
  );
}

export async function listWordLists(): Promise<WordList[]> {
  const snap = await getDocs(wordListsCol());
  return snap.docs
    .map((d) => ({ ...(d.data() as WordList), id: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateWordList(
  id: string,
  input: {
    title: string;
    text: string;
    scope: ContentScope;
    classId?: string;
    grade?: string;
  },
): Promise<void> {
  await setDoc(
    doc(wordListsCol(), id),
    clean({
      title: input.title,
      text: input.text,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
    }),
    { merge: true },
  );
}

export async function deleteWordList(id: string): Promise<void> {
  await deleteDoc(doc(wordListsCol(), id));
}

export async function getWordList(id: string): Promise<WordList | null> {
  const snap = await getDoc(doc(wordListsCol(), id));
  if (!snap.exists()) return null;
  return { ...(snap.data() as WordList), id: snap.id };
}

export async function getPassage(id: string): Promise<ReadingPassage | null> {
  const snap = await getDoc(doc(passagesCol(), id));
  if (!snap.exists()) return null;
  return { ...(snap.data() as ReadingPassage), id: snap.id };
}

export async function getWordListsForStudent(
  classId: string,
): Promise<WordList[]> {
  const all = await listWordLists();
  return all.filter((wl) => appliesToClass(wl, classId));
}

// ---------------------------------------------------------------------------
// Assignments (admin CRUD + student reads)
// ---------------------------------------------------------------------------

export async function createAssignment(input: {
  title: string;
  scope: ContentScope;
  classId?: string;
  grade?: string;
  contentType: ContentType;
  lessonId?: string;
  wordListId?: string;
  passageId?: string;
  dueAt?: number;
}): Promise<void> {
  const ref = doc(assignmentsCol());
  const createdBy = getAuthenticatedUser()?.uid ?? "";
  await setDoc(
    ref,
    clean<Assignment>({
      id: ref.id,
      title: input.title,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
      contentType: input.contentType,
      lessonId: input.contentType === "lesson" ? input.lessonId : undefined,
      wordListId:
        input.contentType === "wordlist" ? input.wordListId : undefined,
      passageId: input.contentType === "passage" ? input.passageId : undefined,
      dueAt: input.dueAt,
      createdAt: Date.now(),
      createdBy,
    }),
  );
}

export async function listAssignments(): Promise<Assignment[]> {
  const snap = await getDocs(assignmentsCol());
  return snap.docs
    .map((d) => ({ ...(d.data() as Assignment), id: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateAssignment(
  id: string,
  input: {
    title: string;
    scope: ContentScope;
    classId?: string;
    grade?: string;
    contentType: ContentType;
    lessonId?: string;
    wordListId?: string;
    passageId?: string;
    dueAt?: number;
  },
): Promise<void> {
  await setDoc(
    doc(assignmentsCol(), id),
    clean({
      title: input.title,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
      contentType: input.contentType,
      lessonId: input.contentType === "lesson" ? input.lessonId : undefined,
      wordListId:
        input.contentType === "wordlist" ? input.wordListId : undefined,
      passageId: input.contentType === "passage" ? input.passageId : undefined,
      dueAt: input.dueAt,
    }),
    { merge: true },
  );
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(assignmentsCol(), id));
}

export async function getAssignmentsForStudent(
  classId: string,
): Promise<Assignment[]> {
  const all = await listAssignments();
  return all.filter((a) => appliesToClass(a, classId));
}

// ---------------------------------------------------------------------------
// Reading passages (admin CRUD + student reads)
// ---------------------------------------------------------------------------

export async function createReadingPassage(input: {
  title: string;
  text: string;
  scope: ContentScope;
  classId?: string;
  grade?: string;
}): Promise<void> {
  const ref = doc(passagesCol());
  const createdBy = getAuthenticatedUser()?.uid ?? "";
  await setDoc(
    ref,
    clean<ReadingPassage>({
      id: ref.id,
      title: input.title,
      text: input.text,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
      createdAt: Date.now(),
      createdBy,
    }),
  );
}

export async function listReadingPassages(): Promise<ReadingPassage[]> {
  const snap = await getDocs(passagesCol());
  return snap.docs
    .map((d) => ({ ...(d.data() as ReadingPassage), id: d.id }))
    .sort((a, b) => a.text.length - b.text.length);
}

export async function updateReadingPassage(
  id: string,
  input: {
    title: string;
    text: string;
    scope: ContentScope;
    classId?: string;
    grade?: string;
  },
): Promise<void> {
  await setDoc(
    doc(passagesCol(), id),
    clean({
      title: input.title,
      text: input.text,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
    }),
    { merge: true },
  );
}

export async function deleteReadingPassage(id: string): Promise<void> {
  await deleteDoc(doc(passagesCol(), id));
}

export async function getPassagesForStudent(
  classId: string,
): Promise<ReadingPassage[]> {
  const all = await listReadingPassages();
  return all.filter((p) => appliesToClass(p, classId));
}

// ---------------------------------------------------------------------------
// Dashboard aggregation
// ---------------------------------------------------------------------------

type StoredLessonProgress = {
  lessonId?: string;
  completed?: boolean;
  bestWpm?: number;
  bestAcc?: number;
  stars?: number;
  attempts?: number;
  timeSpent?: number;
  lastAt?: number;
};

export type StudentProgressRow = {
  uid: string;
  name: string;
  avatarUrl?: string;
  bestWpm: number;
  bestAcc: number;
  xp: number;
  timeTyping: number;
  completedTests: number;
  lastActive: number;
  lessonsCompleted: number;
  /** total attempts across curriculum lessons */
  lessonAttempts: number;
  /** total seconds spent in curriculum lessons */
  lessonTime: number;
  /** average best accuracy across attempted curriculum lessons (0 if none) */
  lessonAvgAcc: number;
  /** assignmentId -> completed */
  assignmentStatus: Record<string, boolean>;
  /** wordListId -> completed */
  wordListStatus: Record<string, boolean>;
  /** passageId -> completed */
  passageStatus: Record<string, boolean>;
};

/** One curriculum lesson's progress for a single student (drill-down view). */
export type LessonDetailRow = {
  lessonId: string;
  name: string;
  completed: boolean;
  stars: number;
  bestWpm: number;
  bestAcc: number;
  attempts: number;
  timeSpent: number;
  lastAt: number;
};

/** True when a progress key is a built-in curriculum lesson (not assign/wl/passage/jp). */
function isCurriculumKey(key: string): boolean {
  return (
    !key.startsWith(ASSIGNMENT_PREFIX) &&
    !key.startsWith(WORDLIST_PREFIX) &&
    !key.startsWith(PASSAGE_PREFIX) &&
    !key.startsWith("jp-")
  );
}

async function readLessonProgress(
  uid: string,
): Promise<Map<string, StoredLessonProgress>> {
  const out = new Map<string, StoredLessonProgress>();
  const snap = await getDocs(
    collection(getDb(), "users", uid, "lessonProgress"),
  );
  for (const d of snap.docs) {
    out.set(d.id, d.data() as StoredLessonProgress);
  }
  return out;
}

/**
 * Per-student progress for one class: top-level stats from the user doc plus a
 * read of each student's lessonProgress subcollection (admin-readable). Also
 * resolves which class assignments each student has completed.
 */
export async function getClassProgress(
  classId: string,
): Promise<StudentProgressRow[]> {
  const usersSnap = await getDocs(
    query(collection(getDb(), "users"), where("classId", "==", classId)),
  );
  const docs = usersSnap.docs.map((d) => {
    const data = d.data() as StoredUserDoc;
    return { ...data, uid: data.uid ?? d.id };
  });

  const assignments = (await listAssignments()).filter((a) =>
    appliesToClass(a, classId),
  );

  const rows = await Promise.all(
    docs.map(async (d) => {
      const progress = await readLessonProgress(d.uid);

      let lessonsCompleted = 0;
      let lessonAttempts = 0;
      let lessonTime = 0;
      let accSum = 0;
      let accCount = 0;
      for (const [key, p] of progress) {
        if (!isCurriculumKey(key)) continue;
        if (p.completed === true) lessonsCompleted++;
        lessonAttempts += p.attempts ?? 0;
        lessonTime += p.timeSpent ?? 0;
        if ((p.attempts ?? 0) > 0 || p.bestAcc !== undefined) {
          accSum += p.bestAcc ?? 0;
          accCount++;
        }
      }

      const assignmentStatus: Record<string, boolean> = {};
      for (const a of assignments) {
        assignmentStatus[a.id] =
          progress.get(`${ASSIGNMENT_PREFIX}${a.id}`)?.completed === true;
      }

      const wordListStatus: Record<string, boolean> = {};
      const passageStatus: Record<string, boolean> = {};
      for (const [key, p] of progress) {
        if (key.startsWith(WORDLIST_PREFIX)) {
          wordListStatus[key.slice(WORDLIST_PREFIX.length)] =
            p.completed === true;
        } else if (key.startsWith(PASSAGE_PREFIX)) {
          passageStatus[key.slice(PASSAGE_PREFIX.length)] =
            p.completed === true;
        }
      }

      const best = bestWpm(d);
      const row: StudentProgressRow = {
        uid: d.uid,
        name: d.name ?? "",
        avatarUrl: d.avatarUrl,
        bestWpm: best?.wpm ?? 0,
        bestAcc: best?.acc ?? 0,
        xp: d.xp ?? 0,
        timeTyping: d.timeTyping ?? 0,
        completedTests: d.completedTests ?? 0,
        lastActive: d.streak?.lastResultTimestamp ?? 0,
        lessonsCompleted,
        lessonAttempts,
        lessonTime,
        lessonAvgAcc: accCount > 0 ? accSum / accCount : 0,
        assignmentStatus,
        wordListStatus,
        passageStatus,
      };
      return row;
    }),
  );

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Per-lesson progress for one student, in curriculum order, for the teacher
 * drill-down. Lessons the student hasn't attempted appear with zeroed stats.
 */
export async function getStudentLessonDetails(
  uid: string,
): Promise<LessonDetailRow[]> {
  const progress = await readLessonProgress(uid);
  return lessonOrder.map((lessonId) => {
    const p = progress.get(lessonId);
    return {
      lessonId,
      name: findLesson(lessonId)?.name ?? lessonId,
      completed: p?.completed === true,
      stars: p?.stars ?? 0,
      bestWpm: p?.bestWpm ?? 0,
      bestAcc: p?.bestAcc ?? 0,
      attempts: p?.attempts ?? 0,
      timeSpent: p?.timeSpent ?? 0,
      lastAt: p?.lastAt ?? 0,
    };
  });
}

export type StudentSummary = {
  uid: string;
  name: string;
  classId?: string;
  bestWpm: number;
  bestAcc: number;
  lessonsCompleted: number;
  lessonStars: number;
};

/** Single-student summary used by the certificate page (admin path). */
export async function getStudentSummary(
  uid: string,
): Promise<StudentSummary | null> {
  const userDoc = await getDoc(doc(collection(getDb(), "users"), uid));
  const data = userDoc.exists() ? (userDoc.data() as StoredUserDoc) : undefined;
  if (data === undefined) return null;

  const progress = await readLessonProgress(uid);
  let lessonsCompleted = 0;
  for (const [key, p] of progress) {
    if (p.completed !== true) continue;
    if (key.startsWith(ASSIGNMENT_PREFIX)) continue;
    if (key.startsWith(WORDLIST_PREFIX)) continue;
    if (key.startsWith(PASSAGE_PREFIX)) continue;
    if (key.startsWith("jp-")) continue;
    lessonsCompleted++;
  }

  const best = bestWpm(data);
  return {
    uid,
    name: data.name ?? "",
    classId: data.classId,
    bestWpm: best?.wpm ?? 0,
    bestAcc: best?.acc ?? 0,
    lessonsCompleted,
    lessonStars: data.lessonStars ?? 0,
  };
}

import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { getAuthenticatedUser, getDb } from "../firebase";
import { appliesToClass, AssignmentScope, clean } from "./assignments";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  scope: AssignmentScope;
  classId?: string;
  grade?: string;
  studentUid?: string;
  createdAt: number;
  createdBy: string;
};

function announcementsCol(): CollectionReference {
  return collection(getDb(), "announcements");
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  scope: AssignmentScope;
  classId?: string;
  grade?: string;
  studentUid?: string;
}): Promise<void> {
  const ref = doc(announcementsCol());
  const createdBy = getAuthenticatedUser()?.uid ?? "";
  await setDoc(
    ref,
    clean<Announcement>({
      id: ref.id,
      title: input.title,
      message: input.message,
      scope: input.scope,
      classId: input.scope === "class" ? input.classId : undefined,
      grade: input.scope === "grade" ? input.grade : undefined,
      studentUid: input.scope === "student" ? input.studentUid : undefined,
      createdAt: Date.now(),
      createdBy,
    }),
  );
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const snap = await getDocs(announcementsCol());
  return snap.docs
    .map((d) => ({ ...(d.data() as Announcement), id: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(announcementsCol(), id));
}

/** Same reasoning as getAssignmentsForStudent - reuses the shared class/grade/school/student scope filter. */
export async function getAnnouncementsForStudent(
  classId: string,
  uid: string,
): Promise<Announcement[]> {
  const all = await listAnnouncements();
  return all.filter((a) => appliesToClass(a, classId, uid));
}

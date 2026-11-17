/**
 * Account roles. "teacher" accounts (set by the admin in Classroom ->
 * Students) skip the student rules and are left out of class statistics,
 * leaderboards and reports. Stored as users/{uid}.role; only the admin can
 * write it (an economy field in firestore.rules).
 */
export type Role = "teacher";

export function isTeacherDoc(data: { role?: unknown } | undefined): boolean {
  return data?.role === "teacher";
}

/** Drop teacher accounts from a list of user docs. */
export function withoutTeachers<T extends { role?: unknown }>(docs: T[]): T[] {
  return docs.filter((d) => !isTeacherDoc(d));
}

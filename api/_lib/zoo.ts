/**
 * My Zoo lesson gates: an area's animals can be bought once every lesson in
 * its lesson group is completed. Mirrors frontend lessons-data.ts groups
 * (a test keeps the two in sync).
 */
export const ZOO_LESSON_GROUPS: Readonly<Record<string, readonly string[]>> = {
  "home-row": [
    "home-index",
    "home-middle",
    "home-ring",
    "home-pinky",
    "home-reach",
    "home-all",
    "home-words",
  ],
  "top-row": [
    "top-index",
    "top-middle",
    "top-ring",
    "top-pinky",
    "top-all",
    "top-home",
    "top-words",
  ],
  "bottom-row": [
    "bottom-index",
    "bottom-middle",
    "bottom-ring",
    "bottom-pinky",
    "bottom-all",
    "bottom-home",
    "bottom-words",
  ],
  "all-keys": [
    "all-keys-1",
    "all-keys-2",
    "all-keys-3",
    "all-keys-4",
    "all-keys-5",
    "all-keys-6",
  ],
};

/** Every lesson in the group is completed (users/{uid}/lessonProgress). */
export async function lessonGroupDone(
  userRef: FirebaseFirestore.DocumentReference,
  groupId: string,
): Promise<boolean> {
  const ids = ZOO_LESSON_GROUPS[groupId];
  if (ids === undefined) return false;
  const snaps = await userRef.firestore.getAll(
    ...ids.map((id) => userRef.collection("lessonProgress").doc(id)),
  );
  return snaps.every((s) => s.data()?.["completed"] === true);
}

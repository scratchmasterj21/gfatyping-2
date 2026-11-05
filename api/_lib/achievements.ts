type PersonalBest = { language?: string; wpm?: number; acc?: number };

function timePersonalBests(
  user: Record<string, unknown>,
  mode2?: string,
): PersonalBest[] {
  const personalBests = user["personalBests"] as
    | { time?: Record<string, PersonalBest[]> }
    | undefined;
  const time = personalBests?.time ?? {};
  return mode2 === undefined ? Object.values(time).flat() : (time[mode2] ?? []);
}

/** Verify shop unlocks from server-owned stats, never client-written badges. */
export function qualifiesForAchievement(
  user: Record<string, unknown>,
  achievementId: string,
  /** built-in lessons completed (counted by the caller for "lessons-*") */
  extra: { lessonsCompleted?: number } = {},
): boolean {
  if (achievementId === "speed-30") {
    return timePersonalBests(user, "30").some(
      (pb) => pb.language === "english" && (pb.wpm ?? 0) >= 30,
    );
  }
  if (achievementId === "lessons-25") {
    return (extra.lessonsCompleted ?? 0) >= 25;
  }
  if (achievementId === "races-10") {
    // raceWins is only writable by the teacher account (firestore.rules)
    const wins = user["raceWins"];
    return typeof wins === "number" && wins >= 10;
  }
  if (achievementId === "accuracy-perfect") {
    return timePersonalBests(user).some((pb) => (pb.acc ?? 0) >= 100);
  }
  if (achievementId === "speed-50") {
    return timePersonalBests(user, "30").some(
      (pb) => pb.language === "english" && (pb.wpm ?? 0) >= 50,
    );
  }
  const streak = user["streak"] as { maxLength?: number } | undefined;
  if (achievementId === "streak-7") {
    return (streak?.maxLength ?? 0) >= 7;
  }
  if (achievementId === "streak-30") {
    return (streak?.maxLength ?? 0) >= 30;
  }
  if (achievementId === "streak-60") {
    return (streak?.maxLength ?? 0) >= 60;
  }
  return false;
}

/** Built-in curriculum lessons completed - mirrors achievements-data.ts. */
export async function countBuiltInLessonsCompleted(
  userRef: FirebaseFirestore.DocumentReference,
): Promise<number> {
  const snap = await userRef
    .collection("lessonProgress")
    .where("completed", "==", true)
    .select()
    .get();
  return snap.docs.filter(
    (d) =>
      !d.id.startsWith("assign:") &&
      !d.id.startsWith("wl:") &&
      !d.id.startsWith("jp-"),
  ).length;
}

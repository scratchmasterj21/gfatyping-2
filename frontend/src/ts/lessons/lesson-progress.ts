import { CompletedEvent } from "@monkeytype/schemas/results";
import {
  collection,
  CollectionReference,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
} from "firebase/firestore";
import { createSignal } from "solid-js";

import { callApi } from "../api-client";
import { configEvent } from "../events/config";
import { getAuthenticatedUser, getDb } from "../firebase";
import { findLesson, lessonGroups, lessonOrder } from "./lessons-data";
import { invalidateCoinQueries } from "../queries/coins";
import { isAuthenticated } from "../states/core";
import { showNoticeNotification } from "../states/notifications";
import { getSnapshot } from "../states/snapshot";
import { triggerCelebration } from "../states/celebration";
import {
  getCorrectCharacters,
  getMissedCharacters,
} from "../test/events/stats";
import { lastEventLog } from "../test/test-state";
import { localDateString } from "../utils/date-and-time";
import { checkNewAchievements } from "./achievements";

export const GAME_PREFIX = "game:";

function celebrateCompletedQuests(
  quests: { name: string; coinReward: number }[],
): void {
  for (const quest of quests) {
    triggerCelebration({
      title: "Quest complete!",
      message: `${quest.name} - +${quest.coinReward} coins`,
      icon: "fa-flag-checkered",
    });
  }
}

export type LessonProgress = {
  lessonId: string;
  bestWpm: number;
  bestAcc: number;
  stars: number;
  completed: boolean;
  attempts: number;
  /** total seconds the student has spent on this lesson */
  timeSpent: number;
  lastAt: number;
  bestScore?: number;
  /** Whether the first-clear/star-improvement coin bonus has ever been paid
   * for this lesson. Left unset on lessons finished before coin rewards
   * existed, so those students still get it the next time they touch it. */
  bonusPaid?: boolean;
  /** Date (see localDateString) repeatCoinsCount applies to. */
  repeatCoinsDate?: string;
  /** Repeat-practice coin payouts already claimed today for this lesson. */
  repeatCoinsCount?: number;
};

// A signal (not a plain variable) so UI - e.g. the test page's config bar -
// can reactively show/hide lesson-specific chrome as a lesson starts/ends.
const [activeLessonId, setActiveLessonId] = createSignal<string | null>(null);

export function setActiveLesson(id: string | null): void {
  setActiveLessonId(id);
}

export function getActiveLesson(): string | null {
  return activeLessonId();
}

// 2nd/3rd star WPM thresholds per grade. 1 star is always awarded on finish.
// Younger grades get a far gentler bar so they aren't stuck at one star;
// undefined (teacher / unassigned) keeps the original 30/45 standard.
const STAR_THRESHOLDS: Record<number, [number, number]> = {
  1: [8, 15],
  2: [10, 18],
  3: [12, 22],
  4: [15, 28],
  5: [18, 35],
  6: [22, 45],
};

/** Stars from WPM, scaled to the student's grade: 1 = completed, 2/3 = faster. */
export function starsForGrade(wpm: number, grade: number | undefined): number {
  const [two, three] =
    grade !== undefined ? (STAR_THRESHOLDS[grade] ?? [30, 45]) : [30, 45];
  if (wpm >= three) return 3;
  if (wpm >= two) return 2;
  return 1;
}

// Minimum accuracy (%) required to pass and unlock the next lesson, scaled by
// grade so the youngest aren't blocked while still demanding real accuracy.
const PASS_ACCURACY: Record<number, number> = {
  1: 80,
  2: 82,
  3: 85,
  4: 88,
  5: 90,
  6: 90,
};

/** Accuracy a curriculum lesson must reach to count as passed. */
export function lessonPassAccuracy(grade: number | undefined): number {
  if (grade === undefined) return 85;
  return PASS_ACCURACY[grade] ?? 85;
}

/** Whether a lesson id is part of the gated built-in curriculum. */
export function isCurriculumLesson(id: string): boolean {
  return lessonOrder.includes(id);
}

function progressCol(uid: string): CollectionReference {
  return collection(getDb(), "users", uid, "lessonProgress");
}

// Minimum stars the previous lesson needs for the next one to unlock. 1 star
// is awarded on any finish, so this is the point where genuine grade-scaled
// speed (not just accuracy) is actually required to move forward.
const STARS_GATE_MIN = 2;

/** Whether a lesson's star rating clears the bar to unlock the next lesson. */
export function meetsStarsGate(stars: number | undefined): boolean {
  return (stars ?? 0) >= STARS_GATE_MIN;
}

/**
 * Whether the lesson at this position in lessonOrder is locked, given its
 * predecessor's progress and this student's grandfather frontier (lessons at
 * or before it are exempt from the 2-star requirement - see
 * ensureStarsGateGrandfather). Index 0 (no predecessor) is never locked.
 * Shared by every place that can launch a lesson (the lessons list, the
 * "continue" shortcut, "next test") so none of them can bypass the gate.
 */
export function isLessonLockedAt(
  index: number,
  prevProgress: LessonProgress | undefined,
  grandfatherIndex: number,
): boolean {
  if (index <= 0) return false;
  if (index <= grandfatherIndex) return prevProgress?.completed !== true;
  return (
    prevProgress?.completed !== true || !meetsStarsGate(prevProgress.stars)
  );
}

/**
 * One-time, lazy migration: the first time this runs for a student (i.e. the
 * first time their lessons page loads after the 2-star unlock requirement
 * shipped), freezes how far they'd already gotten under the old
 * completed-only rule as a permanent grandfather boundary - lessons at or
 * before it stay accessible regardless of star count, so nobody who already
 * unlocked a lesson with 1 star loses it. Only lessons beyond wherever a
 * student already was require the new 2-star bar, from here on.
 */
export async function ensureStarsGateGrandfather(
  uid: string,
  progress: Map<string, LessonProgress>,
): Promise<number> {
  const userRef = doc(collection(getDb(), "users"), uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists()
    ? (snap.data()["starsGateGrandfatherIndex"] as number | undefined)
    : undefined;
  if (existing !== undefined) return existing;

  let frontier = 0;
  for (const id of lessonOrder) {
    if (progress.get(id)?.completed === true) {
      frontier += 1;
    } else {
      break;
    }
  }

  await setDoc(
    userRef,
    { starsGateGrandfatherIndex: frontier },
    { merge: true },
  );
  return frontier;
}

/**
 * Record a finished lesson against the signed-in user's progress, keeping the
 * best WPM/accuracy. No-op when signed out or no lesson is active.
 */
export async function recordCompletion(ce: CompletedEvent): Promise<void> {
  const lessonId = activeLessonId();
  if (!isAuthenticated() || lessonId === null) return;
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined) return;

  const ref = doc(progressCol(uid), lessonId);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data() as Partial<LessonProgress>) : {};

  // Stars/completion/coins/quests are computed and written server-side (see
  // api/complete-lesson.ts) - this used to be a direct client write, which
  // let any student self-report an arbitrary wpm/acc straight into their own
  // progress doc and mint coins for it.
  try {
    const result = await callApi<{
      ok: boolean;
      reason?: string;
      completed?: boolean;
      coinsAwarded?: number;
      stars?: number;
      newlyCompletedQuests?: { name: string; coinReward: number }[];
    }>("/api/complete-lesson", {
      lessonId,
      wpm: ce.wpm,
      acc: ce.acc,
      testDuration: ce.testDuration,
      incompleteTestSeconds: ce.incompleteTestSeconds,
      afkDuration: ce.afkDuration,
    });
    if (!result.ok) {
      console.error("Failed to save lesson progress:", result.reason);
      return;
    }

    const newStars = result.stars ?? 0;
    const wasFirst3Star = (prev.stars ?? 0) < 3 && newStars === 3;

    if (lastEventLog) {
      void updateWeakKeys(
        uid,
        getMissedCharacters(lastEventLog),
        getCorrectCharacters(lastEventLog),
      );
    }

    void updateEngagement(uid, lessonId, ce.wpm, ce.acc, wasFirst3Star);

    if ((result.coinsAwarded ?? 0) > 0) invalidateCoinQueries();
    celebrateCompletedQuests(result.newlyCompletedQuests ?? []);
  } catch (e) {
    console.error("Failed to save lesson progress:", e);
    showNoticeNotification(
      "You're offline — progress will save when reconnected",
    );
  }
}

async function updateEngagement(
  uid: string,
  lessonId: string,
  wpm: number,
  acc: number,
  wasFirst3Star: boolean,
): Promise<void> {
  const userRef = doc(collection(getDb(), "users"), uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};

  // Streak: increment if practiced yesterday, reset if gap, keep if already
  // today. A single missed day is forgiven if a streak freeze is available
  // (consumed on use) - otherwise one sick day/forgotten day undoes weeks of
  // practice, which is exactly when a student is most likely to give up.
  // Freezes refill (capped at 1 banked) every full week of streak reached.
  const today = localDateString();
  const yesterday = localDateString(new Date(Date.now() - 86400000));
  const twoDaysAgo = localDateString(new Date(Date.now() - 2 * 86400000));
  const lastDate = (userData["lastPracticedDate"] as string | undefined) ?? "";
  const prevStreak = (userData["streakDays"] as number | undefined) ?? 0;
  const freezesAvailable =
    (userData["streakFreezesAvailable"] as number | undefined) ?? 0;

  let streakDays: number;
  let freezeConsumed = false;
  if (lastDate === today) {
    streakDays = prevStreak;
  } else if (lastDate === yesterday) {
    streakDays = prevStreak + 1;
  } else if (lastDate === twoDaysAgo && freezesAvailable > 0) {
    streakDays = prevStreak + 1;
    freezeConsumed = true;
  } else {
    streakDays = 1;
  }

  const baseFreezes = freezeConsumed ? freezesAvailable - 1 : freezesAvailable;
  const streakFreezesAvailable =
    streakDays > 0 && streakDays % 7 === 0
      ? Math.max(baseFreezes, 1)
      : baseFreezes;

  // Achievements: check against full progress map.
  const allProgress = await getAllProgress();
  const totalStars = lessonOrder.reduce(
    (sum, id) => sum + (allProgress.get(id)?.stars ?? 0),
    0,
  );
  const alreadyEarned =
    (userData["achievements"] as string[] | undefined) ?? [];
  const newAchievements = checkNewAchievements(
    allProgress,
    { wpm, acc, streakDays },
    alreadyEarned,
  );

  // Daily challenge: mark done if this lesson matches today's *persisted*
  // pick (weakKeys/progress mutate continuously as the student practices, so
  // recomputing fresh here could disagree with whatever the Lessons page
  // showed them). Falls back to a fresh pick only if none was persisted yet
  // today (e.g. lesson completed via a direct link, bypassing the page).
  const weakKeys =
    (userData["weakKeys"] as Record<string, number> | undefined) ?? {};
  const storedChallengeDate = userData["dailyChallengeDate"] as
    | string
    | undefined;
  const challengeId =
    storedChallengeDate === today
      ? ((userData["dailyChallengeLessonId"] as string | undefined) ??
        pickDailyChallengeLesson(weakKeys, allProgress))
      : pickDailyChallengeLesson(weakKeys, allProgress);
  const alreadyDoneToday =
    (userData["lastDailyChallengeDate"] as string | undefined) === today;
  const challengeJustDone = !alreadyDoneToday && lessonId === challengeId;

  await setDoc(
    userRef,
    {
      streakDays,
      streakFreezesAvailable,
      lastPracticedDate: today,
      achievements: [...alreadyEarned, ...newAchievements.map((a) => a.id)],
      lessonStars: totalStars,
      ...(challengeJustDone ? { lastDailyChallengeDate: today } : {}),
    },
    { merge: true },
  );

  // Update class member stats so classmates can see this student's stars.
  // classId can be stored as null in Firestore (see setStudentClass) for an
  // unassigned student - the field is typed string|undefined but that's not
  // enforced at the data layer, so a plain !== undefined check let a literal
  // null through into a Firestore path segment and crashed the SDK.
  const classId = getSnapshot()?.classId;
  if (classId !== undefined && classId !== null) {
    const snap = getSnapshot();
    const memberRef = doc(
      collection(getDb(), "classrooms", classId, "memberStats"),
      uid,
    );
    await setDoc(
      memberRef,
      {
        uid,
        name: snap?.name ?? "Student",
        avatarUrl: snap?.avatarUrl ?? null,
        lessonStars: totalStars,
      },
      { merge: true },
    );
  }

  // Trigger celebration: achievement takes priority over 3-star.
  const firstAchievement = newAchievements[0];
  if (firstAchievement !== undefined) {
    triggerCelebration({
      title: firstAchievement.name,
      message: firstAchievement.description,
      icon: firstAchievement.icon,
    });
  } else if (wasFirst3Star) {
    triggerCelebration({
      title: "3 Stars!",
      message: "Keep it up!",
      icon: "fa-star",
    });
  }
}

// Tab/Enter are excluded from weak-key tracking entirely: the review drill
// this feeds (generateWeakKeysDrill -> muscleDrill) repeats a weak key
// back-to-back in one "word" (e.g. "\n\n"), and the typing engine treats any
// newline as "end of word, advance" - so a repeated-newline word gets marked
// wrong after the very first Enter press. Tab/Enter already have their own
// dedicated lesson group that handles them correctly (always one at a time,
// at the end of a real word).
const WEAK_KEY_SKIP_CHARS = new Set(["\t", "\n"]);

export async function updateWeakKeys(
  uid: string,
  missedChars: Record<string, number>,
  correctChars: Record<string, number>,
): Promise<void> {
  if (
    Object.keys(missedChars).length === 0 &&
    Object.keys(correctChars).length === 0
  ) {
    return;
  }
  const userRef = doc(collection(getDb(), "users"), uid);
  const snap = await getDoc(userRef);
  const stored = snap.exists()
    ? ((snap.data()["weakKeys"] as Record<string, number> | undefined) ?? {})
    : {};
  // Clean up any stale Tab/Enter entries saved before this exclusion existed.
  const current = Object.fromEntries(
    Object.entries(stored).filter(([char]) => !WEAK_KEY_SKIP_CHARS.has(char)),
  );

  for (const [char, count] of Object.entries(missedChars)) {
    if (WEAK_KEY_SKIP_CHARS.has(char)) continue;
    current[char] = (current[char] ?? 0) + count;
  }
  // Decay: each correct keystroke reduces weakness by 0.3, so consistent
  // accuracy on a key eventually clears it from the list.
  for (const [char, count] of Object.entries(correctChars)) {
    if (WEAK_KEY_SKIP_CHARS.has(char)) continue;
    if (current[char] !== undefined) {
      current[char] = Math.max(0, current[char] - Math.floor(count * 0.3));
    }
  }

  // Filter zeros, sort descending, keep top 10.
  const sorted = Object.entries(current)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const newWeakKeys = Object.fromEntries(sorted);

  try {
    await setDoc(userRef, { weakKeys: newWeakKeys }, { merge: true });
  } catch (e) {
    console.error("Failed to save weak keys:", e);
  }
}

export async function getWeakKeys(
  uid: string,
): Promise<Record<string, number>> {
  try {
    const userRef = doc(collection(getDb(), "users"), uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data()["weakKeys"] !== undefined) {
      // Defensive filter for data saved before Tab/Enter were excluded
      // above - self-heals immediately instead of waiting for the next
      // updateWeakKeys() call to clean it up.
      return Object.fromEntries(
        Object.entries(
          snap.data()["weakKeys"] as Record<string, number>,
        ).filter(([char]) => !WEAK_KEY_SKIP_CHARS.has(char)),
      );
    }
  } catch (e) {
    console.error("Failed to get weak keys:", e);
  }
  return {};
}

/**
 * Pick today's personalised challenge lesson.
 * 1. Find which curriculum lesson covers the student's top weak key.
 * 2. Fall back to the first uncompleted curriculum lesson.
 * 3. Last resort: date-seeded pick from the full curriculum.
 */
export function pickDailyChallengeLesson(
  weakKeys: Record<string, number>,
  progressMap: Map<string, LessonProgress>,
): string {
  // Build char → lessonId from each lesson's newKeys field.
  const charToLesson = new Map<string, string>();
  for (const group of lessonGroups) {
    for (const lesson of group.lessons) {
      if (lesson.newKeys !== undefined) {
        for (const ch of lesson.newKeys) {
          if (!charToLesson.has(ch)) charToLesson.set(ch, lesson.id);
        }
      }
    }
  }

  const topWeakKey = Object.entries(weakKeys)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .find((k) => charToLesson.has(k));

  if (topWeakKey !== undefined) {
    const id = charToLesson.get(topWeakKey);
    if (id !== undefined && findLesson(id) !== undefined) return id;
  }

  const nextUncompleted = lessonOrder.find(
    (id) => progressMap.get(id)?.completed !== true,
  );
  if (nextUncompleted !== undefined) return nextUncompleted;

  // All curriculum lessons complete — cycle by date.
  const dateNum = parseInt(localDateString().replace(/-/g, ""), 10);
  return (
    lessonOrder[dateNum % lessonOrder.length] ?? (lessonOrder[0] as string)
  );
}

export async function getAllProgress(): Promise<Map<string, LessonProgress>> {
  const result = new Map<string, LessonProgress>();
  if (!isAuthenticated()) return result;
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined) return result;

  const snap = await getDocs(progressCol(uid));
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as LessonProgress;
    result.set(docSnap.id, data);
  }
  return result;
}

/**
 * Record a game result for a lesson group game.
 * key format: "game:{groupId}:{gameId}" (e.g. "game:home-row:balloon-pop")
 * wave > 5 counts as cleared (completed = true).
 */
export async function recordGameResult(
  key: string,
  score: number,
  wave: number,
): Promise<void> {
  if (!isAuthenticated()) return;
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined) return;

  const ref = doc(progressCol(uid), key);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data() as Partial<LessonProgress>) : {};

  const bestScore = Math.max(prev.bestScore ?? 0, score);
  const completed = prev.completed === true || wave > 5;

  try {
    await setDoc(
      ref,
      {
        lessonId: key,
        bestWpm: 0,
        bestAcc: 0,
        stars: completed ? 1 : 0,
        completed,
        attempts: increment(1),
        timeSpent: 0,
        lastAt: Date.now(),
        bestScore,
      },
      { merge: true },
    );
  } catch (e) {
    console.error("Failed to save game result:", e);
  }
}

export async function recordGameScore(
  gameId: string,
  score: number,
): Promise<void> {
  if (!isAuthenticated()) return;
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined) return;
  const userRef = doc(collection(getDb(), "users"), uid);
  const snap = await getDoc(userRef);
  const data = snap.data() as Record<string, unknown> | undefined;
  const scores = data?.["gameScores"] as Record<string, number> | undefined;
  const existing = scores?.[gameId] ?? 0;
  if (score <= existing) return;
  await setDoc(userRef, { gameScores: { [gameId]: score } }, { merge: true });
}

export async function getUserLessonStats(uid: string): Promise<{
  streakDays: number;
  streakFreezesAvailable: number;
  achievements: string[];
  lastDailyChallengeDate: string;
  dailyChallengeDate: string;
  dailyChallengeLessonId: string;
  lastPracticedDate: string;
  lastSeenAssignmentsAt: number;
  seenAchievementIds: string[];
}> {
  try {
    const userRef = doc(collection(getDb(), "users"), uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        streakDays: (data["streakDays"] as number | undefined) ?? 0,
        streakFreezesAvailable:
          (data["streakFreezesAvailable"] as number | undefined) ?? 0,
        achievements: (data["achievements"] as string[] | undefined) ?? [],
        lastDailyChallengeDate:
          (data["lastDailyChallengeDate"] as string | undefined) ?? "",
        dailyChallengeDate:
          (data["dailyChallengeDate"] as string | undefined) ?? "",
        dailyChallengeLessonId:
          (data["dailyChallengeLessonId"] as string | undefined) ?? "",
        lastPracticedDate:
          (data["lastPracticedDate"] as string | undefined) ?? "",
        lastSeenAssignmentsAt:
          (data["lastSeenAssignmentsAt"] as number | undefined) ?? 0,
        seenAchievementIds:
          (data["seenAchievementIds"] as string[] | undefined) ?? [],
      };
    }
  } catch (e) {
    console.error("Failed to get user lesson stats:", e);
  }
  return {
    streakDays: 0,
    streakFreezesAvailable: 0,
    achievements: [],
    lastDailyChallengeDate: "",
    dailyChallengeDate: "",
    dailyChallengeLessonId: "",
    lastPracticedDate: "",
    lastSeenAssignmentsAt: 0,
    seenAchievementIds: [],
  };
}

/** Marks all assignments/word lists/passages up to now as seen, clearing the "new" badge for them. */
export async function markAssignmentsSeen(uid: string): Promise<void> {
  try {
    const userRef = doc(collection(getDb(), "users"), uid);
    await setDoc(
      userRef,
      { lastSeenAssignmentsAt: Date.now() },
      { merge: true },
    );
  } catch (e) {
    console.error("Failed to mark assignments seen:", e);
  }
}

/** Marks the given achievement ids as seen (union with whatever's already stored), clearing their "new" badge. */
export async function markAchievementsSeen(
  uid: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const userRef = doc(collection(getDb(), "users"), uid);
    const snap = await getDoc(userRef);
    const existing = snap.exists()
      ? ((snap.data()["seenAchievementIds"] as string[] | undefined) ?? [])
      : [];
    const merged = [...new Set([...existing, ...ids])];
    await setDoc(userRef, { seenAchievementIds: merged }, { merge: true });
  } catch (e) {
    console.error("Failed to mark achievements seen:", e);
  }
}

/**
 * Persists today's daily-challenge pick so it stays stable for the rest of
 * the day regardless of later weak-key/progress changes (both mutate
 * continuously as the student practices, which is what made the pick
 * flicker between reloads before this existed). No-ops if a pick for today
 * is already stored (e.g. set moments ago by another tab).
 */
export async function persistDailyChallengePick(
  uid: string,
  lessonId: string,
): Promise<void> {
  const today = localDateString();
  try {
    const userRef = doc(collection(getDb(), "users"), uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    if ((data["dailyChallengeDate"] as string | undefined) === today) return;
    await setDoc(
      userRef,
      { dailyChallengeDate: today, dailyChallengeLessonId: lessonId },
      { merge: true },
    );
  } catch (e) {
    console.error("Failed to persist daily challenge pick:", e);
  }
}

// Clear the active lesson whenever the user leaves custom mode, so unrelated
// custom tests are not recorded as lesson completions.
configEvent.subscribe((data) => {
  if (data.key === "mode" && data.newValue !== "custom") {
    setActiveLessonId(null);
  }
});

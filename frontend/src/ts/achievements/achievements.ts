import {
  collection,
  CollectionReference,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { getAuthenticatedUser, getDb } from "../firebase";
import { getAllProgress } from "../lessons/lesson-progress";
import { isAuthenticated } from "../states/core";
import { showSuccessNotification } from "../states/notifications";
import { getSnapshot } from "../states/snapshot";
import { achievements } from "./achievements-data";

type StoredAchievement = { id: string; earnedAt: number };

function achievementsCol(uid: string): CollectionReference {
  return collection(getDb(), "users", uid, "achievements");
}

/** Earned achievement ids mapped to their earn timestamp. Empty when signed out. */
export async function getEarnedAchievements(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!isAuthenticated()) return out;
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined) return out;

  const snap = await getDocs(achievementsCol(uid));
  for (const d of snap.docs) {
    const data = d.data() as StoredAchievement;
    out.set(d.id, data.earnedAt ?? 0);
  }
  return out;
}

let evaluating = false;

/**
 * Compute which achievements the current user now qualifies for, persist any
 * newly earned ones, and show an "unlocked" toast for each. Safe to call after
 * every test and on account open; already-earned achievements are skipped.
 */
export async function evaluateAchievements(): Promise<void> {
  if (!isAuthenticated()) return;
  const uid = getAuthenticatedUser()?.uid;
  if (uid === undefined) return;
  if (evaluating) return;
  evaluating = true;

  try {
    const snapshot = getSnapshot();
    if (snapshot === undefined) return;

    const [earned, lessonProgress] = await Promise.all([
      getEarnedAchievements(),
      getAllProgress(),
    ]);

    const ctx = { snapshot, lessonProgress };

    for (const achievement of achievements) {
      if (earned.has(achievement.id)) continue;

      let qualifies = false;
      try {
        qualifies = achievement.earned(ctx);
      } catch {
        qualifies = false;
      }
      if (!qualifies) continue;

      await setDoc(doc(achievementsCol(uid), achievement.id), {
        id: achievement.id,
        earnedAt: Date.now(),
      });

      showSuccessNotification(achievement.name, {
        customTitle: "Achievement unlocked",
        customIcon: achievement.icon,
        important: true,
      });
    }
  } finally {
    evaluating = false;
  }
}

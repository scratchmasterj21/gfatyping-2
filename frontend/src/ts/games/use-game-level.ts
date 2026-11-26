import { useQuery } from "@tanstack/solid-query";
import { createEffect } from "solid-js";

import { isCurrentUserStaff } from "../auth";
import { getAllProgress } from "../lessons/lesson-progress";
import { lessonGroups } from "../lessons/lessons-data";
import { getUserId, isAuthenticated } from "../states/core";
import { getSnapshot } from "../states/snapshot";
import { getGameAccess, QuestLevel, resolvePolicy } from "./game-access";
import { levelLock, speedLock, wordLevelFor, wordListLock } from "./game-level";

export type GameLevel = {
  /** lessons + teacher settings loaded (staff / signed out: always) */
  ready: () => boolean;
  /** word level: from lessons, or fixed by the teacher */
  level: () => QuestLevel;
  byTeacher: () => boolean;
  /** lesson group finished (staff: always) */
  groupDone: (groupId: string) => boolean;
  /** Easy/Medium/Hard words: only your level */
  wordsLock: (option: { label: string }) => string | undefined;
  /** game speed: your level or faster */
  speedLock: (option: { label: string }) => string | undefined;
  /** word lists: current lesson group + last part of the one before */
  listLock: (option: { id: string }) => string | undefined;
};

/** Lesson progress + teacher setting -> what a student may pick (cached). */
export function useGameLevel(enabled: () => boolean): GameLevel {
  const staff = (): boolean => isCurrentUserStaff();
  const on = (): boolean => enabled() && isAuthenticated() && !staff();
  const accessQuery = useQuery(() => ({
    queryKey: ["gameAccess"],
    queryFn: getGameAccess,
    enabled: on(),
    staleTime: 5 * 60 * 1000,
  }));
  const progressQuery = useQuery(() => ({
    queryKey: ["lessonProgress"],
    queryFn: getAllProgress,
    enabled: on(),
    staleTime: 5 * 60 * 1000,
  }));
  const teacher = (): QuestLevel | undefined =>
    resolvePolicy(
      accessQuery.data,
      getSnapshot()?.classId ?? undefined,
      getUserId() ?? undefined,
    ).questLevel;
  const lessonDone = (id: string): boolean =>
    progressQuery.data?.get(id)?.completed === true;
  const groupDone = (groupId: string): boolean => {
    if (staff()) return true;
    const group = lessonGroups.find((g) => g.id === groupId);
    return (
      group !== undefined &&
      progressQuery.data !== undefined &&
      group.lessons.every((l) => lessonDone(l.id))
    );
  };
  const level = (): QuestLevel => wordLevelFor(groupDone, teacher());
  const lists = (): ((id: string) => string | undefined) =>
    wordListLock(lessonGroups, lessonDone, teacher());
  return {
    ready: () =>
      staff() ||
      !isAuthenticated() ||
      (progressQuery.data !== undefined && !accessQuery.isPending),
    level,
    byTeacher: () => teacher() !== undefined,
    groupDone,
    wordsLock: (o) =>
      staff()
        ? undefined
        : levelLock(o.label, level(), teacher() !== undefined),
    speedLock: (o) =>
      staff()
        ? undefined
        : speedLock(o.label, level(), teacher() !== undefined),
    listLock: (o) => (staff() ? undefined : lists()(o.id)),
  };
}

/** The first allowed option when `v` is locked (undefined = keep `v`). */
export function pickAllowed<T>(
  v: T,
  lock: (v: T) => string | undefined,
  options: readonly T[],
): T | undefined {
  if (lock(v) === undefined) return undefined;
  const ok = options.find((o) => lock(o) === undefined);
  return ok === v ? undefined : ok;
}

/** Moves a pick off a locked choice onto the first allowed one. */
export function createPickGuard<T>(
  get: () => T,
  set: (v: T) => void,
  lock: (v: T) => string | undefined,
  options: () => readonly T[],
): void {
  createEffect(() => {
    const next = pickAllowed(get(), lock, options());
    if (next !== undefined) set(next);
  });
}

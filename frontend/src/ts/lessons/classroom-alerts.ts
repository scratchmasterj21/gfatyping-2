import { useQuery } from "@tanstack/solid-query";
import { Accessor, createMemo } from "solid-js";

import { isCurrentUserAdmin } from "../auth";
import {
  Assignment,
  getAssignmentsForStudent,
  getPassagesForStudent,
  getWordListsForStudent,
  listReadingPassages,
  listWordLists,
  ReadingPassage,
  WordList,
} from "../classroom/assignments";
import { getAuthenticatedUser } from "../firebase";
import { queryClient } from "../queries";
import { isAuthenticated } from "../states/core";
import { getSnapshot } from "../states/snapshot";
import { FaSolidIcon } from "../types/font-awesome";
import { localDateString } from "../utils/date-and-time";
import { ACHIEVEMENTS } from "./achievements";
import {
  getUserLessonStats,
  markAchievementsSeen,
  markAssignmentsSeen,
} from "./lesson-progress";

export type ClassroomAlert = {
  id: string;
  icon: FaSolidIcon;
  title: string;
  message: string;
};

type DeriveAlertsInput = {
  assignments: Assignment[];
  wordLists: WordList[];
  passages: ReadingPassage[];
  lastSeenAssignmentsAt: number;
  achievements: string[];
  seenAchievementIds: string[];
  streakDays: number;
  lastPracticedDate: string;
};

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateString(d);
}

export function deriveAlerts(input: DeriveAlertsInput): ClassroomAlert[] {
  const alerts: ClassroomAlert[] = [];

  for (const a of input.assignments) {
    if (a.createdAt > input.lastSeenAssignmentsAt) {
      alerts.push({
        id: `assign:${a.id}`,
        icon: "fa-list",
        title: "New assignment",
        message: a.title,
      });
    }
  }
  for (const wl of input.wordLists) {
    if (wl.createdAt > input.lastSeenAssignmentsAt) {
      alerts.push({
        id: `wl:${wl.id}`,
        icon: "fa-keyboard",
        title: "New word list",
        message: wl.title,
      });
    }
  }
  for (const p of input.passages) {
    if (p.createdAt > input.lastSeenAssignmentsAt) {
      alerts.push({
        id: `passage:${p.id}`,
        icon: "fa-book-open",
        title: "New reading passage",
        message: p.title,
      });
    }
  }

  const seen = new Set(input.seenAchievementIds);
  for (const id of input.achievements) {
    if (seen.has(id)) continue;
    const achievement = ACHIEVEMENTS.find((a) => a.id === id);
    if (achievement === undefined) continue;
    alerts.push({
      id: `achievement:${achievement.id}`,
      icon: achievement.icon,
      title: `Achievement unlocked: ${achievement.name}`,
      message: achievement.description,
    });
  }

  if (input.streakDays > 0 && input.lastPracticedDate === yesterday()) {
    alerts.push({
      id: "streak-nudge",
      icon: "fa-fire",
      title: "Keep your streak alive",
      message: `Practice today to keep your ${input.streakDays}-day streak going.`,
    });
  }

  return alerts;
}

/**
 * Shared across Nav.tsx (always mounted, drives the bell badge) and
 * ClassroomAlerts.tsx (the alerts popup section) - reuses the same
 * queryKeys LessonsPage.tsx uses for these so both share one TanStack cache
 * entry instead of double-fetching when the student is on /lessons.
 */
export function useClassroomAlerts(): {
  alerts: Accessor<ClassroomAlert[]>;
  markAllSeen: () => void;
} {
  const classId = (): string | undefined => getSnapshot()?.classId ?? undefined;

  const assignmentsQuery = useQuery(() => ({
    queryKey: ["studentAssignments", classId()],
    queryFn: async () => getAssignmentsForStudent(classId() as string),
    enabled: isAuthenticated() && classId() !== undefined,
    staleTime: 1000 * 30,
  }));

  const wordListsQuery = useQuery(() => ({
    queryKey: ["studentWordLists", classId() ?? "admin"],
    queryFn: async () =>
      isCurrentUserAdmin()
        ? listWordLists()
        : getWordListsForStudent(classId() as string),
    enabled:
      isAuthenticated() && (classId() !== undefined || isCurrentUserAdmin()),
    staleTime: 1000 * 30,
  }));

  const passagesQuery = useQuery(() => ({
    queryKey: ["studentPassages", classId() ?? "admin"],
    queryFn: async () =>
      isCurrentUserAdmin()
        ? listReadingPassages()
        : getPassagesForStudent(classId() as string),
    enabled:
      isAuthenticated() && (classId() !== undefined || isCurrentUserAdmin()),
    staleTime: 1000 * 30,
  }));

  const userStatsQuery = useQuery(() => ({
    queryKey: ["userLessonStats"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) {
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
      return getUserLessonStats(uid);
    },
    enabled: isAuthenticated(),
    staleTime: 0,
  }));

  const alerts = createMemo(() =>
    deriveAlerts({
      assignments: assignmentsQuery.data ?? [],
      wordLists: wordListsQuery.data ?? [],
      passages: passagesQuery.data ?? [],
      lastSeenAssignmentsAt: userStatsQuery.data?.lastSeenAssignmentsAt ?? 0,
      achievements: userStatsQuery.data?.achievements ?? [],
      seenAchievementIds: userStatsQuery.data?.seenAchievementIds ?? [],
      streakDays: userStatsQuery.data?.streakDays ?? 0,
      lastPracticedDate: userStatsQuery.data?.lastPracticedDate ?? "",
    }),
  );

  const markAllSeen = (): void => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined || alerts().length === 0) return;
    void markAssignmentsSeen(uid);
    void markAchievementsSeen(uid, userStatsQuery.data?.achievements ?? []);
    void queryClient.invalidateQueries({ queryKey: ["userLessonStats"] });
  };

  return { alerts, markAllSeen };
}

import { LessonGroup } from "../../../lessons/lessons-data";
import { LessonProgress } from "../../../lessons/lesson-progress";

export function groupStarTotals(
  group: LessonGroup,
  progressFor: (id: string) => LessonProgress | undefined,
): { earned: number; max: number } {
  let earned = 0;
  for (const lesson of group.lessons) {
    earned += progressFor(lesson.id)?.stars ?? 0;
  }
  return { earned, max: group.lessons.length * 3 };
}

export function groupCompletedCount(
  group: LessonGroup,
  progressFor: (id: string) => LessonProgress | undefined,
): number {
  return group.lessons.filter((l) => progressFor(l.id)?.completed === true)
    .length;
}

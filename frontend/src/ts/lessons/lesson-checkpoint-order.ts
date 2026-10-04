import {
  HOME_ROW_GAME_IDS,
  HomeRowCheckpoint,
  LESSON_GROUP_CHECKPOINTS,
} from "./lesson-checkpoints";
import { GAME_PREFIX, LessonProgress } from "./lesson-progress";
import { Lesson, LessonGroup, lessonGroups } from "./lessons-data";

export type LessonGridRowItem =
  | { kind: "lesson"; lesson: Lesson }
  | { kind: "game"; checkpoint: HomeRowCheckpoint };

export type ContinueItem =
  | { kind: "lesson"; lesson: Lesson }
  | { kind: "checkpoint"; group: LessonGroup; checkpoint: HomeRowCheckpoint };

/** Lessons, with the group's game checkpoints (if any) spliced in after their lesson. */
export function rowItemsFor(group: LessonGroup): LessonGridRowItem[] {
  const checkpoints = LESSON_GROUP_CHECKPOINTS[group.id] ?? [];
  const items: LessonGridRowItem[] = [];
  for (const lesson of group.lessons) {
    items.push({ kind: "lesson", lesson });
    const checkpoint = checkpoints.find((c) => c.afterLessonId === lesson.id);
    if (checkpoint !== undefined) {
      items.push({ kind: "game", checkpoint });
    }
  }
  return items;
}

export const continueOrder: ContinueItem[] = lessonGroups.flatMap((group) =>
  rowItemsFor(group).map(
    (item): ContinueItem =>
      item.kind === "lesson"
        ? { kind: "lesson", lesson: item.lesson }
        : { kind: "checkpoint", group, checkpoint: item.checkpoint },
  ),
);

export function checkpointProgressKey(
  group: LessonGroup,
  checkpoint: HomeRowCheckpoint,
): string {
  return `${GAME_PREFIX}${group.id}:${HOME_ROW_GAME_IDS[checkpoint.gameType]}`;
}

export function incompleteCheckpointBeforeLesson(
  lessonId: string,
  progress: Map<string, LessonProgress>,
): { checkpoint: HomeRowCheckpoint; group: LessonGroup } | undefined {
  const index = continueOrder.findIndex(
    (item) => item.kind === "lesson" && item.lesson.id === lessonId,
  );
  if (index <= 0) return undefined;
  const prior = continueOrder[index - 1];
  if (prior === undefined || prior.kind !== "checkpoint") return undefined;
  const key = checkpointProgressKey(prior.group, prior.checkpoint);
  if (progress.get(key)?.completed === true) return undefined;
  return { checkpoint: prior.checkpoint, group: prior.group };
}

export function isLessonBlockedByCheckpoint(
  lessonId: string,
  progress: Map<string, LessonProgress>,
): boolean {
  return incompleteCheckpointBeforeLesson(lessonId, progress) !== undefined;
}

export function checkpointLockMessage(checkpoint: HomeRowCheckpoint): string {
  if (checkpoint.gameType === "toss") {
    return `Play ${checkpoint.label} (full round) to unlock the next lesson`;
  }
  return `Beat ${checkpoint.label} (3 waves) to unlock the next lesson`;
}

export function lessonCardNumber(lessonId: string): number {
  return (
    continueOrder.findIndex(
      (item) => item.kind === "lesson" && item.lesson.id === lessonId,
    ) + 1
  );
}

export function checkpointCardNumber(
  group: LessonGroup,
  checkpoint: HomeRowCheckpoint,
): number {
  return (
    continueOrder.findIndex(
      (item) =>
        item.kind === "checkpoint" &&
        item.group.id === group.id &&
        item.checkpoint.gameType === checkpoint.gameType,
    ) + 1
  );
}

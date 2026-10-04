import { navigationEvent } from "../events/navigation";
import { showNoticeNotification } from "../states/notifications";
import {
  checkpointProgressKey,
  continueOrder,
  ContinueItem,
  isLessonBlockedByCheckpoint,
} from "./lesson-checkpoint-order";
import { LESSON_IDS_WITH_GAME_CHECKPOINT } from "./lesson-checkpoints";
import {
  findLesson,
  findNextLesson,
  groupIdForLesson,
  lessonOrder,
} from "./lessons-data";
import type { PracticeRewardCategory } from "./lesson-progress";
import { isLessonLockedAt, LessonProgress } from "./lesson-progress";
import type { HomeRowCheckpoint } from "./lesson-checkpoints";
import type { Lesson, LessonGroup } from "./lessons-data";

const lessonIndex = new Map<string, number>();
const previousLessonId = new Map<string, string | undefined>();
lessonOrder.forEach((id, i) => {
  lessonIndex.set(id, i);
  previousLessonId.set(id, i === 0 ? undefined : lessonOrder[i - 1]);
});

export function getFrontierItem(
  progress: Map<string, LessonProgress>,
): ContinueItem | undefined {
  return continueOrder.find((item) =>
    item.kind === "lesson"
      ? progress.get(item.lesson.id)?.completed !== true
      : progress.get(checkpointProgressKey(item.group, item.checkpoint))
          ?.completed !== true,
  );
}

export function isLessonLockedForProgress(
  id: string,
  progress: Map<string, LessonProgress>,
  grandfatherIndex: number,
): boolean {
  const index = lessonIndex.get(id);
  if (index === undefined) return false;
  if (isLessonBlockedByCheckpoint(id, progress)) return true;
  const prev = previousLessonId.get(id);
  const prevProgress = prev !== undefined ? progress.get(prev) : undefined;
  return isLessonLockedAt(index, prevProgress, grandfatherIndex);
}

export function getContinueItem(
  progress: Map<string, LessonProgress>,
  grandfatherIndex: number,
): ContinueItem | undefined {
  const item = getFrontierItem(progress);
  if (
    item?.kind === "lesson" &&
    isLessonLockedForProgress(item.lesson.id, progress, grandfatherIndex)
  ) {
    const prevId = previousLessonId.get(item.lesson.id);
    const prevLesson = prevId !== undefined ? findLesson(prevId) : undefined;
    if (prevLesson !== undefined) {
      return { kind: "lesson", lesson: prevLesson };
    }
  }
  return item;
}

export function scrollToContinueTarget(item: ContinueItem): void {
  const groupId =
    item.kind === "lesson" ? groupIdForLesson(item.lesson.id) : item.group.id;
  if (groupId === undefined) return;
  document.getElementById(groupId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export type CurriculumNextAction =
  | "checkpoint"
  | "next-lesson"
  | "repeat-lesson"
  | "lessons-hub";

/** Labels for the result-screen primary action after a curriculum lesson. */
export function curriculumNextAction(
  activeLessonId: string,
  options: {
    progress?: Map<string, LessonProgress>;
    grandfatherIndex: number;
    finishedStars?: number;
  },
): CurriculumNextAction {
  if (options.finishedStars !== undefined && options.finishedStars < 2) {
    return "repeat-lesson";
  }
  if (LESSON_IDS_WITH_GAME_CHECKPOINT.has(activeLessonId)) {
    return "checkpoint";
  }
  const next = findNextLesson(activeLessonId);
  if (next === undefined) return "lessons-hub";
  const progress = options.progress;
  if (
    progress !== undefined &&
    isLessonBlockedByCheckpoint(next.id, progress)
  ) {
    return "checkpoint";
  }
  const nextIndex = lessonOrder.indexOf(next.id);
  const prevId = nextIndex > 0 ? lessonOrder[nextIndex - 1] : undefined;
  const prevProgress =
    prevId !== undefined && progress !== undefined
      ? progress.get(prevId)
      : undefined;
  if (isLessonLockedAt(nextIndex, prevProgress, options.grandfatherIndex)) {
    return "repeat-lesson";
  }
  return "next-lesson";
}

export function curriculumNextButtonLabel(
  action: CurriculumNextAction,
): string {
  switch (action) {
    case "checkpoint":
      return "Go to checkpoint";
    case "next-lesson":
      return "Next lesson";
    case "repeat-lesson":
      return "Try again for 2 stars";
    case "lessons-hub":
      return "Back to lessons";
  }
}

export function launchContinueTarget(
  item: ContinueItem,
  handlers: {
    launchLesson: (
      lesson: Lesson,
      rewardCategory?: PracticeRewardCategory,
    ) => void;
    openCheckpoint: (
      group: LessonGroup,
      checkpoint: HomeRowCheckpoint,
      reward?: boolean,
    ) => void | Promise<void>;
  },
  reward = false,
): void {
  if (item.kind === "lesson") {
    handlers.launchLesson(item.lesson, reward ? "recommendation" : undefined);
  } else {
    void handlers.openCheckpoint(item.group, item.checkpoint, reward);
  }
}

export function navigateToLessonsHub(notice?: string): void {
  if (notice !== undefined && notice !== "") {
    showNoticeNotification(notice);
  }
  navigationEvent.dispatch({ url: "/", options: {} });
}

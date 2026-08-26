export function lessonLockMessage(
  previousLessonName: string,
  previousCompleted: boolean,
  previousStars: number,
): string {
  if (!previousCompleted) return `Complete ${previousLessonName} first`;
  return `Earn 2 stars on ${previousLessonName} (currently ${previousStars})`;
}

export function initialLessonGroupCollapseState(
  groupIds: readonly string[],
  completedGroupIds: ReadonlySet<string>,
  currentGroupId: string | undefined,
  manuallyToggled: ReadonlySet<string>,
  existing: ReadonlySet<string>,
): Set<string> {
  const next = new Set(existing);
  for (const id of groupIds) {
    if (manuallyToggled.has(id)) continue;
    if (id === currentGroupId) next.delete(id);
    else if (completedGroupIds.has(id)) next.add(id);
  }
  return next;
}

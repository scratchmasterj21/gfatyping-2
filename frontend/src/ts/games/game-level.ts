import type { QuestLevel } from "./game-access";

/**
 * Game words follow lesson progress, not a student's pick - kids always
 * pick the easiest. Pure rules; see use-game-level.ts for the hook.
 */

const LEVELS: QuestLevel[] = ["Easy", "Medium", "Hard"];
const levelIndex = (label: string): number =>
  LEVELS.indexOf(label as QuestLevel);

/** Each level needs its lesson group finished. */
export const LEVEL_STEPS: {
  level: QuestLevel;
  requires: string;
  requiresName: string;
}[] = [
  { level: "Medium", requires: "top-row", requiresName: "Top Row" },
  { level: "Hard", requires: "all-keys", requiresName: "All Keys" },
];

/** The teacher's fixed level wins; otherwise the highest step finished. */
export function wordLevelFor(
  groupDone: (groupId: string) => boolean,
  teacher?: QuestLevel,
): QuestLevel {
  if (teacher !== undefined) return teacher;
  let level: QuestLevel = "Easy";
  for (const step of LEVEL_STEPS) {
    if (groupDone(step.requires)) level = step.level;
  }
  return level;
}

/** Word levels (Easy/Medium/Hard words): only your own. */
export function levelLock(
  option: string,
  mine: QuestLevel,
  byTeacher: boolean,
): string | undefined {
  if (option === mine || levelIndex(option) === -1) return undefined;
  if (byTeacher) return "set by your teacher";
  if (levelIndex(option) < levelIndex(mine)) return "you're past this!";
  const step = LEVEL_STEPS.find((s) => s.level === option);
  return `finish ${step?.requiresName ?? "more"} lessons`;
}

/** Game speed: yours or faster, never slower. */
export function speedLock(
  option: string,
  mine: QuestLevel,
  byTeacher: boolean,
): string | undefined {
  const i = levelIndex(option);
  if (i === -1 || i >= levelIndex(mine)) return undefined;
  return byTeacher ? "set by your teacher" : "you're past this!";
}

export type LessonGroupLite = {
  id: string;
  name: string;
  lessons: { id: string }[];
};

/** A teacher's fixed level as a lesson group for word lists. */
const TEACHER_GROUP: Record<QuestLevel, string> = {
  Easy: "home-row",
  Medium: "top-row",
  Hard: "all-keys",
};
/** "last part" of a finished group: its final lessons (no finger drills) */
const LAST_PART = 2;
const lastPart = (g: LessonGroupLite): string[] =>
  g.lessons.slice(-LAST_PART).map((l) => l.id);

/**
 * Which word lists (lesson group or single lesson ids) a student may pick:
 * the whole current group (first one not finished) plus the last part of
 * the group before it. Everything else is locked, with a reason.
 */
export function wordListLock(
  groups: LessonGroupLite[],
  lessonDone: (lessonId: string) => boolean,
  teacher?: QuestLevel,
): (optionId: string) => string | undefined {
  const cur =
    teacher !== undefined
      ? groups.findIndex((g) => g.id === TEACHER_GROUP[teacher])
      : groups.findIndex((g) => !g.lessons.every((l) => lessonDone(l.id)));
  const allowed = new Set<string>();
  const current = groups[cur];
  if (current === undefined) {
    // everything finished: the last part of All Keys and every group after
    const from = Math.max(
      0,
      groups.findIndex((g) => g.id === "all-keys"),
    );
    for (const g of groups.slice(from)) {
      lastPart(g).forEach((id) => allowed.add(id));
    }
  } else {
    allowed.add(current.id);
    current.lessons.forEach((l) => allowed.add(l.id));
    const prev = groups[cur - 1];
    if (prev !== undefined) lastPart(prev).forEach((id) => allowed.add(id));
  }
  const groupIndex = new Map<string, number>();
  groups.forEach((g, i) => {
    groupIndex.set(g.id, i);
    g.lessons.forEach((l) => groupIndex.set(l.id, i));
  });
  return (id) => {
    if (allowed.has(id)) return undefined;
    const gi = groupIndex.get(id);
    if (gi === undefined) return undefined;
    if (teacher !== undefined) return "set by your teacher";
    if (current === undefined || gi <= cur) return "you're past this!";
    return `finish ${current.name} first`;
  };
}

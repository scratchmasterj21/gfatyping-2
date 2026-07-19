import type { FaSolidIcon } from "../types/font-awesome";
import { lessonGroups } from "./lessons-data";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: FaSolidIcon;
};

type ProgressLike = { completed: boolean; stars: number };

type CheckFn = (
  p: Map<string, ProgressLike>,
  ctx: { wpm: number; acc: number; streakDays: number },
) => boolean;

type Def = Achievement & { check: CheckFn };

const groupIds: Map<string, string[]> = new Map(
  lessonGroups.map((g) => [g.id, g.lessons.map((l) => l.id)]),
);

function allDone(groupId: string, p: Map<string, ProgressLike>): boolean {
  return (groupIds.get(groupId) ?? []).every(
    (id) => p.get(id)?.completed === true,
  );
}

function allStars(
  groupId: string,
  p: Map<string, ProgressLike>,
  n: number,
): boolean {
  return (groupIds.get(groupId) ?? []).every(
    (id) => (p.get(id)?.stars ?? 0) >= n,
  );
}

function pick(d: Def): Achievement {
  return { id: d.id, name: d.name, description: d.description, icon: d.icon };
}

const DEFS: Def[] = [
  {
    id: "first-lesson",
    name: "First Step",
    description: "Complete your first lesson",
    icon: "fa-key",
    check: (p) => [...p.values()].some((lp) => lp.completed),
  },
  {
    id: "home-row-done",
    name: "Home Row Hero",
    description: "Complete all home row lessons",
    icon: "fa-home",
    check: (p) => allDone("home-row", p),
  },
  {
    id: "home-row-master",
    name: "Home Row Master",
    description: "3 stars on all home row lessons",
    icon: "fa-star",
    check: (p) => allStars("home-row", p, 3),
  },
  {
    id: "top-row-done",
    name: "Top Rower",
    description: "Complete all top row lessons",
    icon: "fa-arrow-up",
    check: (p) => allDone("top-row", p),
  },
  {
    id: "bottom-row-done",
    name: "Bottom Rower",
    description: "Complete all bottom row lessons",
    icon: "fa-arrow-down",
    check: (p) => allDone("bottom-row", p),
  },
  {
    id: "all-letters",
    name: "All Keys",
    description: "Complete all alphabet lessons",
    icon: "fa-keyboard",
    check: (p) =>
      allDone("home-row", p) &&
      allDone("top-row", p) &&
      allDone("bottom-row", p) &&
      allDone("all-keys", p),
  },
  {
    id: "speed-20",
    name: "Getting There",
    description: "Type 20 WPM on any lesson",
    icon: "fa-bolt",
    check: (_, ctx) => ctx.wpm >= 20,
  },
  {
    id: "speed-30",
    name: "Speed Typist",
    description: "Type 30 WPM on any lesson",
    icon: "fa-bolt",
    check: (_, ctx) => ctx.wpm >= 30,
  },
  {
    id: "speed-50",
    name: "Lightning Fingers",
    description: "Type 50 WPM on any lesson",
    icon: "fa-bolt",
    check: (_, ctx) => ctx.wpm >= 50,
  },
  {
    id: "accuracy-95",
    name: "Sharp Eye",
    description: "95%+ accuracy on any lesson",
    icon: "fa-bullseye",
    check: (_, ctx) => ctx.acc >= 95,
  },
  {
    id: "accuracy-100",
    name: "Perfectionist",
    description: "100% accuracy on any lesson",
    icon: "fa-check-circle",
    check: (_, ctx) => ctx.acc >= 100,
  },
  {
    id: "streak-3",
    name: "3-Day Streak",
    description: "Practice 3 days in a row",
    icon: "fa-fire",
    check: (_, ctx) => ctx.streakDays >= 3,
  },
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "Practice 7 days in a row",
    icon: "fa-fire",
    check: (_, ctx) => ctx.streakDays >= 7,
  },
  {
    id: "streak-14",
    name: "Two-Week Titan",
    description: "Practice 14 days in a row",
    icon: "fa-fire",
    check: (_, ctx) => ctx.streakDays >= 14,
  },
  {
    id: "streak-30",
    name: "Monthly Master",
    description: "Practice 30 days in a row",
    icon: "fa-fire",
    check: (_, ctx) => ctx.streakDays >= 30,
  },
  {
    id: "streak-60",
    name: "Unstoppable",
    description: "Practice 60 days in a row",
    icon: "fa-fire",
    check: (_, ctx) => ctx.streakDays >= 60,
  },
  {
    id: "streak-100",
    name: "Century Streak",
    description: "Practice 100 days in a row",
    icon: "fa-fire",
    check: (_, ctx) => ctx.streakDays >= 100,
  },
];

export const ACHIEVEMENTS: Achievement[] = DEFS.map((d) => pick(d));

export function checkNewAchievements(
  progress: Map<string, ProgressLike>,
  ctx: { wpm: number; acc: number; streakDays: number },
  alreadyEarned: string[],
): Achievement[] {
  const earned = new Set(alreadyEarned);
  return DEFS.filter((d) => !earned.has(d.id) && d.check(progress, ctx)).map(
    (d) => pick(d),
  );
}

import { localDateString } from "../utils/date-and-time";
import {
  Assignment,
  ReadingPassage,
  StudentProgressRow,
  WordList,
} from "./assignments";
import { formatWeakKeys } from "./progress-pdf";

/** Quote a CSV field and escape embedded quotes. */
function csvCell(value: string | number): string {
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function isoDate(ts: number): string {
  if (ts <= 0) return "";
  return localDateString(new Date(ts));
}

/**
 * Build a CSV of a class's progress: one row per student, with a column per
 * class assignment, word list, and passage. Mirrors the dashboard Progress table.
 */
export function buildProgressCsv(
  classId: string,
  rows: StudentProgressRow[],
  assignments: Assignment[],
  wordLists: WordList[],
  passages: ReadingPassage[],
): string {
  const header = [
    "class",
    "name",
    "best wpm (30s test)",
    "best acc % (30s test)",
    "xp",
    "current streak (days)",
    "longest streak (days)",
    "lessons completed",
    "lesson attempts",
    "lesson avg acc %",
    "lesson time (min)",
    "top weak keys",
    "completed tests",
    "time typing (min)",
    "last active",
    "assignments done",
    "assignments total",
    ...assignments.map((a) => `assign: ${a.title}`),
    ...wordLists.map((wl) => `wl: ${wl.title}`),
    ...passages.map((p) => `passage: ${p.title}`),
  ];

  const lines = rows.map((row) => {
    const done = assignments.filter(
      (a) => row.assignmentStatus[a.id] === true,
    ).length;
    return [
      classId,
      row.name,
      Math.round(row.bestWpm),
      Math.round(row.bestAcc),
      row.xp,
      row.streakLength,
      row.streakMaxLength,
      row.lessonsCompleted,
      row.lessonAttempts,
      Math.round(row.lessonAvgAcc),
      Math.round(row.lessonTime / 60),
      formatWeakKeys(row.weakKeys),
      row.completedTests,
      Math.round(row.timeTyping / 60),
      isoDate(row.lastActive),
      done,
      assignments.length,
      ...assignments.map((a) =>
        row.assignmentStatus[a.id] === true ? "done" : "-",
      ),
      ...wordLists.map((wl) =>
        row.wordListStatus[wl.id] === true ? "done" : "-",
      ),
      ...passages.map((p) => (row.passageStatus[p.id] === true ? "done" : "-")),
    ]
      .map(csvCell)
      .join(",");
  });

  return [header.map(csvCell).join(","), ...lines].join("\n");
}

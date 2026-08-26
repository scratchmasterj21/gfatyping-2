import jsPDF from "jspdf";
import { autoTable, RowInput } from "jspdf-autotable";

import { EMPTY_ACTIVITY, StudentActivity } from "./activity-report";
import { Assignment, LessonDetailRow, StudentProgressRow } from "./assignments";
import { formatWeakKeys } from "./progress-format";
import { localDateString } from "../utils/date-and-time";

export type DateRange = { start: number; end: number };

const BRAND_COLOR: [number, number, number] = [13, 105, 105];
const SECTION_FILL: [number, number, number] = [230, 230, 230];
const PAGE_WIDTH = 210; // A4 portrait, mm

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

/**
 * jspdf-autotable attaches `lastAutoTable` onto the doc as a runtime side
 * effect (documented plugin behavior) rather than returning it, and its
 * bundled types don't declare that augmentation - so this cast is the only
 * way to know where a table ended in order to stack the next one under it.
 */
function getFinalY(doc: jsPDF, fallback: number): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}

function sectionHeaderRow(label: string): RowInput {
  return [
    {
      content: label,
      colSpan: 2,
      styles: { fontStyle: "bold", fillColor: SECTION_FILL },
    },
  ];
}

function formatStreak(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function studentReportRows(
  row: StudentProgressRow,
  activity: StudentActivity,
  assignments: Assignment[],
): RowInput[] {
  const assignmentsDone = assignments.filter(
    (a) => row.assignmentStatus[a.id] === true,
  ).length;

  return [
    sectionHeaderRow("Lifetime"),
    ["Best WPM (30s test)", `${Math.round(row.bestWpm)}`],
    ["Best accuracy (30s test)", `${Math.round(row.bestAcc)}%`],
    ["XP", `${row.xp}`],
    ["Current streak", formatStreak(row.streakLength)],
    ["Longest streak", formatStreak(row.streakMaxLength)],
    ["Lessons completed", `${row.lessonsCompleted}`],
    ["Lesson attempts", `${row.lessonAttempts}`],
    ["Assignments done", `${assignmentsDone}/${assignments.length}`],
    ["Time typing (lifetime)", formatMinutes(row.timeTyping)],
    ["Top weak keys", formatWeakKeys(row.weakKeys)],
    [
      "Last active",
      row.lastActive > 0 ? localDateString(new Date(row.lastActive)) : "-",
    ],
    // Includes lesson drills (short custom-text bursts), not just formal
    // timed tests - a different, broader population than "30s test" above,
    // so it's labeled separately rather than implying the same yardstick.
    sectionHeaderRow("Activity in selected period (all practice)"),
    ["Practice sessions", `${activity.testsTaken}`],
    [
      "Average WPM (all practice)",
      activity.testsTaken > 0 ? `${Math.round(activity.avgWpm)}` : "-",
    ],
    [
      "Average accuracy (all practice)",
      activity.testsTaken > 0 ? `${Math.round(activity.avgAcc)}%` : "-",
    ],
    ["Time typing", formatMinutes(activity.timeTypingSeconds)],
  ];
}

function pageHeader(doc: jsPDF, title: string, subtitle?: string): void {
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text("GFA Typing", 14, 10);
  doc.setFontSize(16);
  doc.text("Progress Report", 14, 19);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(title, 14, 34);
  if (subtitle !== undefined) {
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitle, 14, 40);
    doc.setTextColor(0, 0, 0);
  }
}

function addStudentPage(
  doc: jsPDF,
  classId: string,
  row: StudentProgressRow,
  activity: StudentActivity,
  assignments: Assignment[],
  range: DateRange,
  isFirstPage: boolean,
): void {
  if (!isFirstPage) doc.addPage();

  pageHeader(
    doc,
    row.name,
    `Class ${classId}  |  Period: ${localDateString(new Date(range.start))} to ${localDateString(new Date(range.end))}`,
  );

  autoTable(doc, {
    startY: 46,
    head: [["Metric", "Value"]],
    body: studentReportRows(row, activity, assignments),
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR },
  });
}

/**
 * Page 2: per-lesson detail (attempted lessons only - a student partway
 * through a 50-lesson curriculum doesn't need 30+ blank "not started" rows),
 * so a parent/teacher can see exactly where the student is in the
 * curriculum, not just an aggregate completed-count.
 */
function addDetailPage(
  doc: jsPDF,
  row: StudentProgressRow,
  lessonDetails: LessonDetailRow[],
): void {
  doc.addPage();
  pageHeader(doc, row.name, "Lesson detail");

  const attempted = lessonDetails.filter((l) => l.attempts > 0);
  const notStarted = lessonDetails.length - attempted.length;

  autoTable(doc, {
    startY: 46,
    head: [
      ["Lesson", "Stars", "Best WPM", "Best acc", "Attempts", "Last attempt"],
    ],
    body:
      attempted.length > 0
        ? attempted.map((l) => [
            l.name,
            `${l.stars}`,
            l.bestWpm > 0 ? `${Math.round(l.bestWpm)}` : "-",
            l.bestAcc > 0 ? `${Math.round(l.bestAcc)}%` : "-",
            `${l.attempts}`,
            l.lastAt > 0 ? localDateString(new Date(l.lastAt)) : "-",
          ])
        : [["No lessons attempted yet", "", "", "", "", ""]],
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR },
    styles: { fontSize: 8, cellPadding: 1.5 },
  });

  if (notStarted > 0) {
    const y = getFinalY(doc, 46) + 6;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${notStarted} lesson(s) not started yet`, 14, y);
    doc.setTextColor(0, 0, 0);
  }
}

/** Stamps a footer (generated date + page N of M) on every page of the document. */
function addFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const generatedOn = localDateString(new Date());
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated ${generatedOn}`, 14, 290);
    doc.text(`Page ${p} of ${total}`, PAGE_WIDTH - 14, 290, {
      align: "right",
    });
  }
}

export type StudentReportInput = {
  classId: string;
  row: StudentProgressRow;
  activity: StudentActivity;
  lessonDetails: LessonDetailRow[];
  assignments: Assignment[];
  range: DateRange;
};

/** One student's report: an overview page plus a lesson detail page. */
export function buildStudentReportPdf(input: StudentReportInput): jsPDF {
  const doc = new jsPDF();
  addStudentPage(
    doc,
    input.classId,
    input.row,
    input.activity,
    input.assignments,
    input.range,
    true,
  );
  addDetailPage(doc, input.row, input.lessonDetails);
  addFooters(doc);
  return doc;
}

export type ClassReportInput = {
  classId: string;
  rows: StudentProgressRow[];
  activityByUid: Record<string, StudentActivity>;
  lessonDetailsByUid: Record<string, LessonDetailRow[]>;
  assignments: Assignment[];
  range: DateRange;
};

/** A whole class's reports as one combined multi-page PDF, 2 pages per student. */
export function buildClassReportPdf(input: ClassReportInput): jsPDF {
  const doc = new jsPDF();
  input.rows.forEach((row, i) => {
    addStudentPage(
      doc,
      input.classId,
      row,
      input.activityByUid[row.uid] ?? EMPTY_ACTIVITY,
      input.assignments,
      input.range,
      i === 0,
    );
    addDetailPage(doc, row, input.lessonDetailsByUid[row.uid] ?? []);
  });
  addFooters(doc);
  return doc;
}

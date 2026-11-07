import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";

import { EMPTY_ACTIVITY, StudentActivity } from "./activity-report";
import { Assignment, LessonDetailRow, StudentProgressRow } from "./assignments";
import {
  CertificateLevel,
  earnedLevels,
  nextLevel,
  stillNeeds,
} from "./certificate-levels";
import { displayChar } from "./progress-format";
import { buildReportComment } from "./report-comment";

/**
 * Printable progress reports (A4 portrait) for parents and teachers.
 * Student report: an overview page (key results, certificate level,
 * curriculum progress, this period, habits, keys to practise and automatic
 * teacher's comments) plus a lesson-by-lesson page. The class report
 * adds a summary page of the whole class in front.
 */

export type DateRange = { start: number; end: number };

type RGB = [number, number, number];

const SCHOOL = "Felice Tamamura International School";
const BRAND: RGB = [13, 105, 105];
const BRAND_LIGHT: RGB = [225, 241, 240];
const INK: RGB = [43, 33, 64];
const MUTED: RGB = [110, 110, 120];
const LINE: RGB = [215, 215, 222];
const CARD: RGB = [246, 245, 250];
const GOLD: RGB = [240, 180, 20];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // page margin
const CONTENT_W = PAGE_W - M * 2;

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDayTime(ts: number): string {
  if (ts <= 0) return "Not yet";
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (seconds > 0 && m < 1) return "<1 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatName(name: string): string {
  if (name.includes(" ")) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * jspdf-autotable attaches `lastAutoTable` onto the doc as a runtime side
 * effect rather than returning it, and its types don't declare that - this
 * cast is the only way to know where a table ended.
 */
function getFinalY(doc: jsPDF, fallback: number): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}

function setColor(doc: jsPDF, c: RGB): void {
  doc.setTextColor(c[0], c[1], c[2]);
}

// ---------------- building blocks ----------------

function pageHeader(doc: jsPDF, title: string): void {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 26, PAGE_W, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("GFA TYPING", M, 10);
  doc.setFontSize(17);
  doc.text(title, M, 19.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(SCHOOL, PAGE_W - M, 10, { align: "right" });
  doc.text("Keyboarding program", PAGE_W - M, 15, { align: "right" });
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(doc, BRAND);
  doc.text(text.toUpperCase(), M, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y + 2, PAGE_W - M, y + 2);
  return y + 8;
}

function kpiCards(
  doc: jsPDF,
  y: number,
  items: { value: string; label: string }[],
): number {
  const gap = 4;
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
  const h = 22;
  items.forEach((item, i) => {
    const x = M + i * (w + gap);
    doc.setFillColor(...CARD);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
    doc.setFillColor(...BRAND);
    doc.rect(x, y + 3, 1.2, h - 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setColor(doc, INK);
    doc.text(item.value, x + w / 2, y + 11, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(doc, MUTED);
    doc.text(item.label.toUpperCase(), x + w / 2, y + 17, { align: "center" });
  });
  return y + h + 8;
}

/** Two-column label/value list. */
function factList(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  facts: [string, string][],
): number {
  let cy = y;
  for (const [label, value] of facts) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setColor(doc, MUTED);
    doc.text(label, x, cy);
    doc.setFont("helvetica", "bold");
    setColor(doc, INK);
    doc.text(value, x + w, cy, { align: "right" });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.line(x, cy + 2, x + w, cy + 2);
    cy += 7;
  }
  return cy;
}

function progressBar(
  doc: jsPDF,
  y: number,
  fraction: number,
  left: string,
  right: string,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setColor(doc, INK);
  doc.text(left, M, y);
  setColor(doc, MUTED);
  doc.text(right, PAGE_W - M, y, { align: "right" });
  const by = y + 3;
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(M, by, CONTENT_W, 4, 2, 2, "F");
  const w = Math.max(0, Math.min(1, fraction)) * CONTENT_W;
  if (w > 0) {
    doc.setFillColor(...BRAND);
    doc.roundedRect(M, by, Math.max(w, 4), 4, 2, 2, "F");
  }
  return by + 11;
}

function keyChips(doc: jsPDF, y: number, keys: string[]): number {
  if (keys.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    setColor(doc, MUTED);
    doc.text(
      "No tricky keys yet - more lesson practice will show which keys need work.",
      M,
      y,
    );
    return y + 8;
  }
  let x = M;
  for (const key of keys) {
    const label = displayChar(key);
    doc.setFont("courier", "bold");
    doc.setFontSize(12);
    const w = Math.max(10, doc.getTextWidth(label) + 6);
    doc.setFillColor(...CARD);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y - 5.5, w, 8.5, 1.5, 1.5, "FD");
    setColor(doc, INK);
    doc.text(label, x + w / 2, y, { align: "center" });
    x += w + 3;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(doc, MUTED);
  doc.text("Keys with the most mistakes in lessons, worst first.", x + 3, y);
  return y + 10;
}

/** Filled circles for earned stars (out of 3). */
function drawStars(doc: jsPDF, x: number, y: number, stars: number): void {
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 4.2;
    if (i < stars) {
      doc.setFillColor(...GOLD);
      doc.circle(cx, y, 1.5, "F");
    } else {
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.circle(cx, y, 1.5, "S");
    }
  }
}

function levelLine(row: StudentProgressRow): {
  current?: CertificateLevel;
  next?: CertificateLevel;
} {
  const stats = {
    lessonsCompleted: row.lessonsCompleted,
    lessonStars: row.lessonStars,
    bestWpm: row.bestWpm,
  };
  return { current: earnedLevels(stats).at(-1), next: nextLevel(stats) };
}

// ---------------- pages ----------------

function addOverviewPage(
  doc: jsPDF,
  classId: string,
  row: StudentProgressRow,
  activity: StudentActivity,
  lessonDetails: LessonDetailRow[],
  assignments: Assignment[],
  range: DateRange,
): void {
  pageHeader(doc, "Student Progress Report");

  // student
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setColor(doc, INK);
  doc.text(formatName(row.name), M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(doc, MUTED);
  doc.text(
    `Class ${row.classId ?? classId}   |   Report period: ${formatDay(range.start)} - ${formatDay(range.end)}`,
    M,
    y + 7,
  );

  // certificate badge (top right)
  const { current, next } = levelLine(row);
  const badge =
    current !== undefined
      ? `${current.name} - ${current.title}`
      : "Getting started";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const bw = doc.getTextWidth(badge) + 10;
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(PAGE_W - M - bw, y - 7, bw, 10, 5, 5, "F");
  setColor(doc, BRAND);
  doc.text(badge, PAGE_W - M - bw / 2, y - 0.6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setColor(doc, MUTED);
  doc.text("Certificate level", PAGE_W - M - bw / 2, y + 7, {
    align: "center",
  });

  // key results
  y = sectionTitle(doc, y + 18, "Key results");
  const totalLessons = lessonDetails.length;
  y = kpiCards(doc, y, [
    {
      value: row.bestWpm > 0 ? `${Math.round(row.bestWpm)}` : "-",
      label: "Best words / min",
    },
    {
      value: row.bestWpm > 0 ? `${Math.round(row.bestAcc)}%` : "-",
      label: "Best accuracy",
    },
    {
      value:
        totalLessons > 0
          ? `${row.lessonsCompleted}/${totalLessons}`
          : `${row.lessonsCompleted}`,
      label: "Lessons passed",
    },
    { value: `${row.lessonStars}`, label: "Stars earned" },
  ]);

  // curriculum
  y = sectionTitle(doc, y, "Curriculum progress");
  y = progressBar(
    doc,
    y,
    totalLessons > 0 ? row.lessonsCompleted / totalLessons : 0,
    `${row.lessonsCompleted} of ${totalLessons} lessons passed`,
    totalLessons > 0
      ? `${Math.round((row.lessonsCompleted / Math.max(1, totalLessons)) * 100)}% complete`
      : "",
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setColor(doc, INK);
  const levelText =
    next === undefined
      ? `Has reached the top certificate level (${current?.name ?? "Star"}). Outstanding work!`
      : `Next certificate: ${next.name} (${next.title}) - still to go: ${stillNeeds(
          next,
          {
            lessonsCompleted: row.lessonsCompleted,
            lessonStars: row.lessonStars,
            bestWpm: row.bestWpm,
          },
        )}.`;
  doc.text(doc.splitTextToSize(levelText, CONTENT_W) as string[], M, y);
  y += 10;

  // this period + habits, side by side
  const colW = (CONTENT_W - 10) / 2;
  const top = sectionTitle(doc, y, "This period            ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(doc, BRAND);
  doc.text("HABITS & ACTIVITY", M + colW + 10, y);
  const assignmentsDone = assignments.filter(
    (a) => row.assignmentStatus[a.id] === true,
  ).length;
  const leftEnd = factList(doc, M, top, colW, [
    ["Practice sessions", `${activity.testsTaken}`],
    [
      "Average speed",
      activity.testsTaken > 0 ? `${Math.round(activity.avgWpm)} wpm` : "-",
    ],
    [
      "Average accuracy",
      activity.testsTaken > 0 ? `${Math.round(activity.avgAcc)}%` : "-",
    ],
    ["Time typing", formatDuration(activity.timeTypingSeconds)],
    [
      "Assignments done",
      assignments.length > 0
        ? `${assignmentsDone} of ${assignments.length}`
        : "-",
    ],
  ]);
  const rightEnd = factList(doc, M + colW + 10, top, colW, [
    ["Current streak", plural(row.streakLength, "day")],
    ["Longest streak", plural(row.streakMaxLength, "day")],
    ["Total time typing", formatDuration(row.timeTyping)],
    ["Lesson attempts", `${row.lessonAttempts}`],
    ["Last active", formatDayTime(row.lastActive)],
  ]);
  y = Math.max(leftEnd, rightEnd) + 4;

  // keys
  y = sectionTitle(doc, y, "Keys to practise");
  const keys = Object.entries(row.weakKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);
  y = keyChips(doc, y + 1, keys);

  // automatic comments, written from the results above
  y = sectionTitle(doc, y + 2, "Teacher's comments");
  const comment = buildReportComment({
    row,
    activity,
    totalLessons: lessonDetails.length,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(comment, CONTENT_W - 12) as string[];
  const lineH = 5.2;
  const boxH = lines.length * lineH + 9;
  doc.setFillColor(...CARD);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y - 2, CONTENT_W, boxH, 2, 2, "FD");
  doc.setFillColor(...BRAND);
  doc.rect(M, y + 1, 1.2, boxH - 6, "F");
  setColor(doc, INK);
  doc.text(lines, M + 6, y + 4.5, { lineHeightFactor: 1.45 });
}

function addLessonPage(
  doc: jsPDF,
  row: StudentProgressRow,
  lessonDetails: LessonDetailRow[],
): void {
  doc.addPage();
  pageHeader(doc, "Lesson by Lesson");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(doc, INK);
  doc.text(formatName(row.name), M, 38);

  const attempted = lessonDetails.filter((l) => l.attempts > 0);
  const notStarted = lessonDetails.length - attempted.length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setColor(doc, MUTED);
  doc.text(
    `${attempted.length} lessons practised  |  ${lessonDetails.filter((l) => l.completed).length} passed  |  ${notStarted} not started yet`,
    M,
    44,
  );

  autoTable(doc, {
    startY: 49,
    margin: { left: M, right: M, top: 34, bottom: 18 },
    head: [
      [
        "Lesson",
        "Stars",
        "Best speed",
        "Best accuracy",
        "Tries",
        "Time",
        "Last practised",
      ],
    ],
    body:
      attempted.length > 0
        ? attempted.map((l) => [
            l.name,
            "",
            l.bestWpm > 0 ? `${Math.round(l.bestWpm)} wpm` : "-",
            l.bestAcc > 0 ? `${Math.round(l.bestAcc)}%` : "-",
            `${l.attempts}`,
            formatDuration(l.timeSpent),
            l.lastAt > 0 ? formatDay(l.lastAt) : "-",
          ])
        : [
            [
              {
                content: "No lessons practised yet.",
                colSpan: 7,
                styles: { halign: "center", textColor: MUTED },
              },
            ],
          ],
    theme: "plain",
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: { textColor: INK, fontSize: 8.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: CARD },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 16 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const lesson = attempted[data.row.index];
      if (lesson === undefined) return;
      drawStars(
        doc,
        data.cell.x + 3.5,
        data.cell.y + data.cell.height / 2,
        lesson.stars,
      );
    },
  });

  const y = getFinalY(doc, 49) + 7;
  if (y < PAGE_H - 24) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, MUTED);
    doc.text(
      "Stars: 1 = passed, 2 = good, 3 = excellent (speed and accuracy goals for the student's grade).",
      M,
      y,
    );
  }
}

function addClassSummaryPage(
  doc: jsPDF,
  classId: string,
  rows: StudentProgressRow[],
  range: DateRange,
): void {
  pageHeader(doc, "Class Progress Summary");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setColor(doc, INK);
  doc.text(`Class ${classId}`, M, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(doc, MUTED);
  doc.text(
    `${plural(rows.length, "student")}   |   Report period: ${formatDay(range.start)} - ${formatDay(range.end)}`,
    M,
    47,
  );

  // averages only over students who have typed, so new students don't
  // drag the class down
  const typed = rows.filter((r) => r.bestWpm > 0);
  const avg = (
    list: StudentProgressRow[],
    f: (r: StudentProgressRow) => number,
  ): number =>
    list.length === 0 ? 0 : list.reduce((n, r) => n + f(r), 0) / list.length;
  const y = kpiCards(doc, 56, [
    {
      value: `${Math.round(avg(typed, (r) => r.bestWpm))}`,
      label: "Avg best wpm",
    },
    {
      value: `${Math.round(avg(typed, (r) => r.bestAcc))}%`,
      label: "Avg accuracy",
    },
    {
      value: `${Math.round(avg(rows, (r) => r.lessonsCompleted))}`,
      label: "Avg lessons passed",
    },
    {
      value: `${rows.reduce((n, r) => n + r.lessonStars, 0)}`,
      label: "Class stars",
    },
  ]);

  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 34, bottom: 18 },
    head: [
      [
        "Student",
        "Best speed",
        "Accuracy",
        "Lessons",
        "Stars",
        "Level",
        "Last active",
      ],
    ],
    body: sorted.map((r) => [
      formatName(r.name),
      r.bestWpm > 0 ? `${Math.round(r.bestWpm)} wpm` : "-",
      r.bestWpm > 0 ? `${Math.round(r.bestAcc)}%` : "-",
      `${r.lessonsCompleted}`,
      `${r.lessonStars}`,
      levelLine(r).current?.name ?? "-",
      r.lastActive > 0 ? formatDay(r.lastActive) : "Not yet",
    ]),
    theme: "plain",
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: { textColor: INK, fontSize: 8.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: CARD },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      6: { halign: "right" },
    },
  });
}

/** Footer on every page: school, generated date, page N of M. */
function addFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const generated = formatDay(Date.now());
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(doc, MUTED);
    doc.text(`GFA Typing  |  ${SCHOOL}`, M, PAGE_H - 7);
    doc.text(`Generated ${generated}`, PAGE_W / 2, PAGE_H - 7, {
      align: "center",
    });
    doc.text(`Page ${p} of ${total}`, PAGE_W - M, PAGE_H - 7, {
      align: "right",
    });
  }
}

// ---------------- public ----------------

export type StudentReportInput = {
  classId: string;
  row: StudentProgressRow;
  activity: StudentActivity;
  lessonDetails: LessonDetailRow[];
  assignments: Assignment[];
  range: DateRange;
};

/** One student's report: an overview page plus a lesson-by-lesson page. */
export function buildStudentReportPdf(input: StudentReportInput): jsPDF {
  const doc = new jsPDF();
  addOverviewPage(
    doc,
    input.classId,
    input.row,
    input.activity,
    input.lessonDetails,
    input.assignments,
    input.range,
  );
  addLessonPage(doc, input.row, input.lessonDetails);
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

/** A class summary page, then 2 pages per student, as one PDF. */
export function buildClassReportPdf(input: ClassReportInput): jsPDF {
  const doc = new jsPDF();
  addClassSummaryPage(doc, input.classId, input.rows, input.range);
  for (const row of input.rows) {
    doc.addPage();
    addOverviewPage(
      doc,
      input.classId,
      row,
      input.activityByUid[row.uid] ?? EMPTY_ACTIVITY,
      input.lessonDetailsByUid[row.uid] ?? [],
      input.assignments,
      input.range,
    );
    addLessonPage(doc, row, input.lessonDetailsByUid[row.uid] ?? []);
  }
  addFooters(doc);
  return doc;
}

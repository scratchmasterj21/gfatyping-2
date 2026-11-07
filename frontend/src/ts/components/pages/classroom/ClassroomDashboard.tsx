import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  Show,
} from "solid-js";
import { z } from "zod";

import { isCurrentUserAdmin } from "../../../auth";
import {
  getClassActivity,
  getStudentActivity,
} from "../../../classroom/activity-report";
import {
  Announcement,
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
} from "../../../classroom/announcements";
import {
  Assignment,
  AssignmentScope,
  ContentScope,
  ContentType,
  createAssignment,
  createReadingPassage,
  createWordList,
  deleteAssignment,
  deleteReadingPassage,
  deleteWordList,
  getClassProgress,
  getStudentLessonDetails,
  listAssignments,
  listReadingPassages,
  listWordLists,
  ReadingPassage,
  STUCK_ATTEMPTS,
  StudentProgressRow,
  updateAssignment,
  updateReadingPassage,
  updateWordList,
  WordList,
} from "../../../classroom/assignments";
import { storeCertificateBatch } from "../../../classroom/certificate-batch";
import {
  ClassGoal,
  getClassGoals,
  setClassGoal,
} from "../../../classroom/class-goals";
import { buildProgressCsv } from "../../../classroom/progress-csv";
import {
  displayChar,
  formatWeakKeys,
} from "../../../classroom/progress-format";
import { awardCoins } from "../../../coins";
import { CLASS_IDS, GRADES } from "../../../constants/classes";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { lessonGroups } from "../../../lessons/lessons-data";
import { queryClient } from "../../../queries";
import { listChampions, listHistoryForClass } from "../../../race/race-db";
import { RaceHistory } from "../../../race/race-types";
import { getActivePage, getUserId } from "../../../states/core";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { showSimpleModal } from "../../../states/simple-modal";
import { cn } from "../../../utils/cn";
import { download } from "../../../utils/misc";
import { Avatar } from "../../common/Avatar";
import { Button } from "../../common/Button";
import { ClassGoalBar } from "../../common/ClassGoalBar";
import { EmptyState } from "../../common/EmptyState";
import { Fa, FaProps } from "../../common/Fa";
import { H2 } from "../../common/Headers";
import { Page } from "../../common/Page";
import { HallOfChampions } from "../race/HallOfChampions";
import { ActivityTab } from "./ActivityTab";
import { SideImageApprovals } from "./SideImageApprovals";
import { StudentsTab } from "./StudentsTab";
import { UsageTab } from "./UsageTab";

const inputClass =
  "w-full rounded border border-sub-alt bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-sub";
const selectClass =
  "rounded border border-sub-alt bg-bg px-2 py-1 text-text outline-none focus:ring-2 focus:ring-sub";
const panelClass = "rounded-2xl bg-sub-alt p-4";

function LoadingBars(): JSXElement {
  return (
    <div class="grid gap-3" aria-hidden="true">
      <div class="h-4 w-1/3 animate-pulse rounded bg-bg"></div>
      <div class="h-10 animate-pulse rounded bg-bg"></div>
      <div class="h-10 animate-pulse rounded bg-bg"></div>
      <div class="h-10 w-4/5 animate-pulse rounded bg-bg"></div>
    </div>
  );
}

/** Cache classroom Firestore scans — getClassProgress is very read-heavy. */
const CLASSROOM_QUERY_STALE_MS = 5 * 60 * 1000;

const TabSchema = z.enum([
  "students",
  "progress",
  "activity",
  "assignments",
  "wordlists",
  "passages",
  "races",
  "images",
  "announcements",
  "usage",
]);
type Tab = z.infer<typeof TabSchema>;

const CLASS_TABS = new Set<Tab>([
  "progress",
  "activity",
  "assignments",
  "races",
  "announcements",
]);

/**
 * PDF previews open in a new tab. The tab must be opened right away, inside
 * the tap - browsers (Safari/iPad especially) block tabs opened after an
 * await. So: open a "Building..." tab first, build the PDF, then show it
 * there. If the tab was blocked anyway, the PDF downloads instead.
 */
function openPreviewTab(): Window | null {
  const win = window.open("", "_blank");
  if (win !== null) {
    win.document.title = "Building report…";
    win.document.body.style.cssText =
      "font-family:sans-serif;padding:2rem;color:#555";
    win.document.body.textContent = "Building the report…";
  }
  return win;
}

function showPdfInTab(
  win: Window | null,
  doc: import("jspdf").jsPDF,
  fallbackName: string,
): void {
  if (win !== null && !win.closed) {
    win.location.href = String(doc.output("bloburl"));
  } else {
    doc.save(fallbackName);
  }
}

function formatDate(ts: number): string {
  if (ts <= 0) return "never";
  return new Date(ts).toLocaleDateString();
}

/** "12 min ago", "today 2:15 PM", "yesterday 9:03 AM", "Mon 9:03 AM", "Nov 3, 10:20 AM" */
function formatLastActive(ts: number, now = Date.now()): string {
  if (ts <= 0) return "never";
  const mins = Math.floor((now - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const startMs = dayStart.getTime();
  if (ts >= startMs) return `today ${time}`;
  if (ts >= startMs - 86_400_000) return `yesterday ${time}`;
  if (ts >= startMs - 6 * 86_400_000) {
    return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}m`;
}

/** YYYY-MM-DD, for binding to <input type="date"> value. */
function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ScopeFields(props: {
  scope: AssignmentScope;
  classId: string;
  grade: string;
  onClassId: (v: string) => void;
  onGrade: (v: string) => void;
  /** Only used when scope can be "student" (assignments only). */
  studentUid?: string;
  students?: { uid: string; name: string }[];
  onStudentUid?: (v: string) => void;
}): JSXElement {
  return (
    <>
      <Show when={props.scope === "class"}>
        <select
          class={selectClass}
          value={props.classId}
          onChange={(e) => props.onClassId(e.currentTarget.value)}
        >
          <For each={CLASS_IDS}>{(c) => <option value={c}>{c}</option>}</For>
        </select>
      </Show>
      <Show when={props.scope === "grade"}>
        <select
          class={selectClass}
          value={props.grade}
          onChange={(e) => props.onGrade(e.currentTarget.value)}
        >
          <For each={GRADES}>{(g) => <option value={g}>{g}</option>}</For>
        </select>
      </Show>
      <Show when={props.scope === "student"}>
        <select
          class={selectClass}
          value={props.studentUid ?? ""}
          onChange={(e) => props.onStudentUid?.(e.currentTarget.value)}
        >
          <option value="">select student...</option>
          <For each={props.students ?? []}>
            {(s) => <option value={s.uid}>{s.name}</option>}
          </For>
        </select>
      </Show>
    </>
  );
}

function ProgressTab(props: {
  classId: string;
  rows: StudentProgressRow[];
  assignments: Assignment[];
  wordLists: WordList[];
  passages: ReadingPassage[];
  loading: boolean;
}): JSXElement {
  // row.assignmentStatus is already scoped to exactly the assignments
  // relevant to that student (class/grade/school + any student-targeted
  // ones aimed at them - see getClassProgress), so its own keys double as
  // the per-row total instead of props.assignments.length, which would
  // wrongly include every other class/student's assignments too.
  const assignmentTotal = (row: StudentProgressRow): number =>
    Object.keys(row.assignmentStatus).length;
  const assignmentsDone = (row: StudentProgressRow): number =>
    Object.values(row.assignmentStatus).filter(Boolean).length;

  // Surfaces students who've gone quiet without needing a separate filter -
  // there's no push/email notification in this app, so a teacher noticing
  // here is the only realistic nudge path for a student who's stopped opening it.
  const GONE_QUIET_MS = 2 * 24 * 60 * 60 * 1000;
  const isGoneQuiet = (row: StudentProgressRow): boolean =>
    Date.now() - row.lastActive > GONE_QUIET_MS;

  const startOfToday = (): number => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const isActiveToday = (row: StudentProgressRow): boolean =>
    row.lastActive >= startOfToday();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const noPracticeThisWeek = (row: StudentProgressRow): boolean =>
    Date.now() - row.lastActive > WEEK_MS;

  const isStuck = (row: StudentProgressRow): boolean =>
    row.stuckLessons.length > 0;
  const stuckTitle = (row: StudentProgressRow): string =>
    row.stuckLessons
      .map((l) => `${l.name}: ${l.attempts} tries, not passed`)
      .join("\n");

  type ProgressFilter = "all" | "quiet" | "incomplete" | "noWeek" | "stuck";
  const [progressFilter, setProgressFilter] =
    createSignal<ProgressFilter>("all");
  const [showAvatarWall, setShowAvatarWall] = createSignal(false);
  const [selectedForCert, setSelectedForCert] = createSignal<Set<string>>(
    new Set(),
  );

  const toggleCertSelect = (uid: string): void => {
    setSelectedForCert((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  type SortKey =
    | "name"
    | "bestWpm"
    | "bestAcc"
    | "xp"
    | "lessons"
    | "tries"
    | "lessonAcc"
    | "onTask"
    | "assignments"
    | "lastActive";
  const [sortKey, setSortKey] = createSignal<SortKey>("lastActive");
  const [sortDesc, setSortDesc] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [openPanel, setOpenPanel] = createSignal<"rewards" | "reports" | null>(
    null,
  );
  const togglePanel = (panel: "rewards" | "reports"): void => {
    setOpenPanel((cur) => (cur === panel ? null : panel));
  };
  const [allColumns, setAllColumns] = createSignal(false);
  /** Secondary columns hide below lg (iPad) unless "More columns" is on. */
  const extraCol = (): string => (allColumns() ? "" : "hidden lg:table-cell");

  const sortValue = (
    row: StudentProgressRow,
    key: SortKey,
  ): number | string => {
    switch (key) {
      case "name":
        return row.name.toLowerCase();
      case "bestWpm":
        return row.bestWpm;
      case "bestAcc":
        return row.bestAcc;
      case "xp":
        return row.xp;
      case "lessons":
        return row.lessonsCompleted;
      case "tries":
        return row.lessonAttempts;
      case "lessonAcc":
        return row.lessonAvgAcc;
      case "onTask":
        return row.lessonTime;
      case "assignments": {
        const total = assignmentTotal(row);
        return total === 0 ? -1 : assignmentsDone(row) / total;
      }
      case "lastActive":
        return row.lastActive;
    }
  };
  const sortBy = (key: SortKey): void => {
    if (sortKey() === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      // names read best A-Z; numbers best highest-first
      setSortDesc(key !== "name");
    }
  };

  const filteredRows = createMemo(() => {
    let list = props.rows.slice();
    const key = sortKey();
    const dir = sortDesc() ? -1 : 1;
    list.sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return b.lastActive - a.lastActive;
    });
    const q = search().trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    const f = progressFilter();
    if (f === "quiet") {
      list = list.filter(isGoneQuiet);
    } else if (f === "incomplete") {
      list = list.filter((r) => assignmentsDone(r) < assignmentTotal(r));
    } else if (f === "noWeek") {
      list = list.filter(noPracticeThisWeek);
    } else if (f === "stuck") {
      list = list.filter(isStuck);
    }
    return list;
  });

  const classWeakKeys = createMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of props.rows) {
      for (const [char, score] of Object.entries(row.weakKeys)) {
        totals[char] = (totals[char] ?? 0) + score;
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  });

  const weekly = createMemo(() => {
    const rows = props.rows;
    const busiest = rows
      .filter((r) => r.lessonsThisWeek > 0)
      .sort((a, b) => b.lessonsThisWeek - a.lessonsThisWeek)
      .slice(0, 3);
    return {
      busiest,
      stuck: rows.filter(isStuck),
      quiet: rows.filter(isGoneQuiet),
      practicedThisWeek: rows.filter((r) => r.lessonsThisWeek > 0).length,
    };
  });

  const goalsQuery = useQuery(() => ({
    queryKey: ["classroom", "progress", "classGoals"],
    queryFn: getClassGoals,
    staleTime: 1000 * 60 * 30,
  }));
  const currentGoal = (): ClassGoal | undefined =>
    goalsQuery.data?.[props.classId];
  const classStars = createMemo(() =>
    props.rows.reduce((sum, r) => sum + r.lessonStars, 0),
  );
  const [goalStars, setGoalStars] = createSignal(0);
  const [goalReward, setGoalReward] = createSignal("");
  const [savingGoal, setSavingGoal] = createSignal(false);
  createEffect(() => {
    const g = currentGoal();
    setGoalStars(
      g?.stars ?? Math.max(50, Math.ceil((classStars() + 50) / 50) * 50),
    );
    setGoalReward(g?.reward ?? "");
  });
  const saveGoal = async (clear: boolean): Promise<void> => {
    setSavingGoal(true);
    try {
      await setClassGoal(
        props.classId,
        clear ? null : { stars: goalStars(), reward: goalReward() },
      );
      await queryClient.invalidateQueries({ queryKey: ["classGoals"] });
      await goalsQuery.refetch();
      showSuccessNotification(
        clear ? "Class goal removed" : "Class goal saved",
      );
    } catch (e) {
      showErrorNotification("Failed to save class goal");
      console.error(e);
    } finally {
      setSavingGoal(false);
    }
  };

  const selectAllForCert = (): void => {
    const visible = filteredRows().map((r) => r.uid);
    const allSelected = visible.every((uid) => selectedForCert().has(uid));
    setSelectedForCert(allSelected ? new Set<string>() : new Set(visible));
  };

  const summary = createMemo(() => {
    const rows = props.rows;
    const pastDueAssignments = props.assignments.filter(
      (a) => a.dueAt !== undefined && a.dueAt < Date.now(),
    ).length;
    return {
      activeToday: rows.filter(isActiveToday).length,
      quiet: rows.filter(isGoneQuiet).length,
      incomplete: rows.filter((r) => assignmentsDone(r) < assignmentTotal(r))
        .length,
      pastDueAssignments,
    };
  });

  const [openUid, setOpenUid] = createSignal<string | null>(null);
  const toggleOpen = (uid: string): void => {
    setOpenUid((cur) => (cur === uid ? null : uid));
  };

  const exportCsv = (): void => {
    const csv = buildProgressCsv(
      props.classId,
      props.rows,
      props.assignments,
      props.wordLists,
      props.passages,
    );
    download({
      filename: `progress-${props.classId}.csv`,
      data: new Blob([csv], { type: "text/csv" }),
    });
  };

  // PDF reports only date-range the typing activity (tests/wpm/acc/time) -
  // lessons/assignments/xp have no history to filter, so those always show
  // lifetime totals regardless of the range picked here (see activity-report.ts).
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const [rangeStart, setRangeStart] = createSignal(
    formatDateInput(new Date(Date.now() - THIRTY_DAYS_MS)),
  );
  const [rangeEnd, setRangeEnd] = createSignal(formatDateInput(new Date()));
  const [downloadingAll, setDownloadingAll] = createSignal(false);
  const [downloadingUid, setDownloadingUid] = createSignal<string | null>(null);
  const [previewingAll, setPreviewingAll] = createSignal(false);
  const [previewingUid, setPreviewingUid] = createSignal<string | null>(null);

  const applyRangePreset = (days: number): void => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setRangeStart(formatDateInput(start));
    setRangeEnd(formatDateInput(end));
  };

  const [coinAmount, setCoinAmount] = createSignal(10);
  const [rewardingUid, setRewardingUid] = createSignal<string | null>(null);

  const giveCoins = async (row: StudentProgressRow): Promise<void> => {
    const amount = coinAmount();
    if (rewardingUid() !== null || amount <= 0) return;
    setRewardingUid(row.uid);
    try {
      await awardCoins(row.uid, amount);
      showSuccessNotification(`Gave ${amount} coins to ${row.name}`);
    } catch (e) {
      showErrorNotification("Failed to give coins");
      console.error(e);
    } finally {
      setRewardingUid(null);
    }
  };

  /** One write per student; asks first because it can't be undone. */
  const giveCoinsBulk = (
    rowsToPay: StudentProgressRow[],
    who: string,
  ): void => {
    const amount = coinAmount();
    if (rowsToPay.length === 0 || amount <= 0) return;
    const uids = rowsToPay.map((r) => r.uid);
    showSimpleModal({
      title: `Give ${amount} coins to ${uids.length} student${uids.length === 1 ? "" : "s"}?`,
      text: `${who}: ${amount * uids.length} coins in total.`,
      buttonText: "give coins",
      execFn: async () => {
        const results = await Promise.allSettled(
          uids.map(async (uid) => awardCoins(uid, amount)),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) console.error("bulk coins failed", results);
        return failed === 0
          ? {
              status: "success",
              message: `Gave ${amount} coins to ${uids.length} students`,
            }
          : {
              status: "error",
              message: `Gave coins to ${uids.length - failed} of ${uids.length} students - ${failed} failed`,
            };
      },
    });
  };

  const dateRange = (): { start: number; end: number } => ({
    start: new Date(rangeStart()).getTime(),
    end: new Date(rangeEnd()).getTime() + 24 * 60 * 60 * 1000 - 1,
  });

  const buildStudentPdfDoc = async (
    row: StudentProgressRow,
  ): Promise<import("jspdf").jsPDF> => {
    const range = dateRange();
    const [activity, lessonDetails, { buildStudentReportPdf }] =
      await Promise.all([
        getStudentActivity(row.uid, range.start, range.end),
        getStudentLessonDetails(row.uid),
        import("../../../classroom/progress-pdf"),
      ]);
    return buildStudentReportPdf({
      classId: props.classId,
      row,
      activity,
      lessonDetails,
      assignments: props.assignments,
      range,
    });
  };

  const downloadStudentPdf = async (row: StudentProgressRow): Promise<void> => {
    if (downloadingUid() !== null) return;
    setDownloadingUid(row.uid);
    try {
      const doc = await buildStudentPdfDoc(row);
      doc.save(`progress-${props.classId}-${row.name}.pdf`);
    } catch (e) {
      showErrorNotification("Failed to build PDF report");
      console.error(e);
    } finally {
      setDownloadingUid(null);
    }
  };

  const previewStudentPdf = async (row: StudentProgressRow): Promise<void> => {
    if (previewingUid() !== null) return;
    setPreviewingUid(row.uid);
    const win = openPreviewTab();
    try {
      const doc = await buildStudentPdfDoc(row);
      showPdfInTab(win, doc, `progress-${props.classId}-${row.name}.pdf`);
    } catch (e) {
      win?.close();
      showErrorNotification("Failed to preview PDF report");
      console.error(e);
    } finally {
      setPreviewingUid(null);
    }
  };

  const openCertificatesForSelected = (): void => {
    const uids = [...selectedForCert()];
    if (uids.length === 0) {
      showNoticeNotification("Select students using the checkboxes first");
      return;
    }
    const selected = new Set(uids);
    storeCertificateBatch(
      props.rows
        .filter((r) => selected.has(r.uid))
        .map((r) => ({
          uid: r.uid,
          name: r.name,
          classId: r.classId,
          bestWpm: r.bestWpm,
          bestAcc: r.bestAcc,
          lessonsCompleted: r.lessonsCompleted,
          lessonStars: r.lessonStars,
          avatar: r.avatar,
          lessonMarks: r.lessonMarks,
        })),
    );
    window.open("/certificate?batch=1", "_blank");
  };

  const printThisWeek = (): void => {
    applyRangePreset(7);
    void downloadAllPdf();
  };

  const buildClassPdfDoc = async (): Promise<import("jspdf").jsPDF> => {
    const range = dateRange();
    const uids = props.rows.map((r) => r.uid);
    const [activity, lessonDetailsEntries, { buildClassReportPdf }] =
      await Promise.all([
        getClassActivity(uids, range.start, range.end),
        Promise.all(
          uids.map(
            async (uid) => [uid, await getStudentLessonDetails(uid)] as const,
          ),
        ),
        import("../../../classroom/progress-pdf"),
      ]);
    return buildClassReportPdf({
      classId: props.classId,
      rows: props.rows,
      activityByUid: activity,
      lessonDetailsByUid: Object.fromEntries(lessonDetailsEntries),
      assignments: props.assignments,
      range,
    });
  };

  const downloadAllPdf = async (): Promise<void> => {
    if (downloadingAll() || props.rows.length === 0) return;
    setDownloadingAll(true);
    try {
      const doc = await buildClassPdfDoc();
      doc.save(`progress-${props.classId}.pdf`);
    } catch (e) {
      showErrorNotification("Failed to build PDF reports");
      console.error(e);
    } finally {
      setDownloadingAll(false);
    }
  };

  const previewAllPdf = async (): Promise<void> => {
    if (previewingAll() || props.rows.length === 0) return;
    setPreviewingAll(true);
    const win = openPreviewTab();
    try {
      const doc = await buildClassPdfDoc();
      showPdfInTab(win, doc, `progress-${props.classId}.pdf`);
    } catch (e) {
      win?.close();
      showErrorNotification("Failed to preview PDF reports");
      console.error(e);
    } finally {
      setPreviewingAll(false);
    }
  };

  const sortHeader = (
    key: SortKey,
    label: string,
    opts: { right?: boolean; extra?: boolean; short?: string } = {},
  ): JSXElement => (
    <th
      class={cn(
        "p-2",
        opts.right === true && "text-right",
        opts.extra === true && extraCol(),
      )}
      aria-sort={
        sortKey() === key ? (sortDesc() ? "descending" : "ascending") : "none"
      }
    >
      <button
        type="button"
        class={cn(
          "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap hover:text-text",
          sortKey() === key && "text-main",
        )}
        onClick={() => sortBy(key)}
        aria-label={`Sort by ${label}`}
      >
        <Show when={opts.short !== undefined} fallback={label}>
          <span class="lg:hidden">{opts.short}</span>
          <span class="hidden lg:inline">{label}</span>
        </Show>
        <Show when={sortKey() === key}>
          <Fa icon={sortDesc() ? "fa-caret-down" : "fa-caret-up"} />
        </Show>
      </button>
    </th>
  );

  return (
    <Show when={!props.loading} fallback={<LoadingBars />}>
      <Show
        when={props.rows.length > 0}
        fallback={
          <EmptyState
            icon="fa-user-graduate"
            title="No students in this class yet"
            hint="Students show up here after they sign in and pick this class."
          />
        }
      >
        <div class="mb-4 grid gap-2">
          <Show when={currentGoal()} keyed>
            {(g) => (
              <ClassGoalBar
                class="bg-bg"
                classId={props.classId}
                current={classStars()}
                goal={g.stars}
                reward={g.reward}
              />
            )}
          </Show>
        </div>
        <div class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="min-w-0 rounded-xl bg-bg p-3">
            <div class="mb-1 text-xs font-semibold tracking-wide text-sub uppercase">
              <Fa icon="fa-fire" class="mr-1.5 text-main" />
              Busiest this week
            </div>
            <Show
              when={weekly().busiest.length > 0}
              fallback={
                <div class="text-sm text-sub">No lessons yet this week</div>
              }
            >
              <For each={weekly().busiest}>
                {(r) => (
                  <div class="flex justify-between gap-2 text-sm text-text">
                    <span class="truncate">{r.name}</span>
                    <span class="text-sub">{r.lessonsThisWeek} lessons</span>
                  </div>
                )}
              </For>
            </Show>
            <div class="mt-1 text-xs text-sub">
              {weekly().practicedThisWeek}/{props.rows.length} practiced this
              week
            </div>
          </div>
          <div class="min-w-0 rounded-xl bg-bg p-3">
            <div class="mb-1 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold tracking-wide text-sub uppercase">
                <Fa icon="fa-life-ring" class="mr-1.5 text-error" />
                Stuck ({STUCK_ATTEMPTS}+ tries)
              </span>
              <Show when={weekly().stuck.length > 0}>
                <Button
                  variant="text"
                  class="px-1 py-0 text-xs"
                  text="show"
                  onClick={() => setProgressFilter("stuck")}
                />
              </Show>
            </div>
            <Show
              when={weekly().stuck.length > 0}
              fallback={<div class="text-sm text-sub">Nobody is stuck</div>}
            >
              <For each={weekly().stuck.slice(0, 3)}>
                {(r) => (
                  <div class="flex justify-between gap-2 text-sm text-text">
                    <span class="truncate">{r.name}</span>
                    <span class="truncate text-sub">
                      {r.stuckLessons[0]?.name}
                    </span>
                  </div>
                )}
              </For>
              <Show when={weekly().stuck.length > 3}>
                <div class="text-xs text-sub">
                  +{weekly().stuck.length - 3} more
                </div>
              </Show>
            </Show>
          </div>
          <div class="min-w-0 rounded-xl bg-bg p-3">
            <div class="mb-1 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold tracking-wide text-sub uppercase">
                <Fa icon="fa-moon" class="mr-1.5 text-sub" />
                Gone quiet (2d+)
              </span>
              <Show when={weekly().quiet.length > 0}>
                <Button
                  variant="text"
                  class="px-1 py-0 text-xs"
                  text="show"
                  onClick={() => setProgressFilter("quiet")}
                />
              </Show>
            </div>
            <Show
              when={weekly().quiet.length > 0}
              fallback={<div class="text-sm text-sub">Everyone is active</div>}
            >
              <For each={weekly().quiet.slice(0, 3)}>
                {(r) => (
                  <div class="flex justify-between gap-2 text-sm text-text">
                    <span class="truncate">{r.name}</span>
                    <span class="text-sub">
                      {formatLastActive(r.lastActive)}
                    </span>
                  </div>
                )}
              </For>
              <Show when={weekly().quiet.length > 3}>
                <div class="text-xs text-sub">
                  +{weekly().quiet.length - 3} more
                </div>
              </Show>
            </Show>
          </div>
          <div class="min-w-0 rounded-xl bg-bg p-3">
            <div class="mb-1 text-xs font-semibold tracking-wide text-sub uppercase">
              <Fa icon="fa-keyboard" class="mr-1.5 text-main" />
              Trickiest keys
            </div>
            <Show
              when={classWeakKeys().length > 0}
              fallback={
                <div class="text-sm text-sub">No weak keys tracked yet</div>
              }
            >
              <div class="text-sm text-text">
                {classWeakKeys()
                  .map(([char]) => displayChar(char))
                  .join(", ")}
              </div>
            </Show>
            <div class="mt-1 text-xs text-sub">Worst keys across the class</div>
          </div>
        </div>
        <div class="mb-3 flex flex-wrap gap-2 text-sm text-sub">
          <span>
            <strong class="text-text">{summary().activeToday}</strong> active
            today
          </span>
          <span>·</span>
          <span>
            <strong class="text-error">{summary().quiet}</strong> gone quiet
            (2d+)
          </span>
          <span>·</span>
          <span>
            <strong class="text-text">{summary().incomplete}</strong> incomplete
            assignments
          </span>
          <Show when={summary().pastDueAssignments > 0}>
            <span>·</span>
            <span>
              <strong class="text-text">{summary().pastDueAssignments}</strong>{" "}
              assignments past due (class-wide)
            </span>
          </Show>
        </div>
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Button
            variant="text"
            text="All"
            active={progressFilter() === "all"}
            onClick={() => setProgressFilter("all")}
          />
          <Button
            variant="text"
            text="Gone quiet"
            active={progressFilter() === "quiet"}
            onClick={() => setProgressFilter("quiet")}
          />
          <Button
            variant="text"
            text="Incomplete assignments"
            active={progressFilter() === "incomplete"}
            onClick={() => setProgressFilter("incomplete")}
          />
          <Button
            variant="text"
            text="No practice (7d)"
            active={progressFilter() === "noWeek"}
            onClick={() => setProgressFilter("noWeek")}
          />
          <Button
            variant="text"
            text={`Stuck (${weekly().stuck.length})`}
            active={progressFilter() === "stuck"}
            onClick={() => setProgressFilter("stuck")}
          />
          <div class="grow"></div>
          <input
            type="search"
            placeholder="Search name…"
            aria-label="Search students by name"
            class={cn(selectClass, "w-44")}
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <Button
            text="Rewards"
            fa={{ icon: "fa-gift" }}
            active={openPanel() === "rewards"}
            aria-expanded={openPanel() === "rewards"}
            onClick={() => togglePanel("rewards")}
          />
          <Button
            text="Reports"
            fa={{ icon: "fa-file-alt" }}
            active={openPanel() === "reports"}
            aria-expanded={openPanel() === "reports"}
            onClick={() => togglePanel("reports")}
          />
          <Button
            variant="text"
            class="text-sm"
            fa={{ icon: showAvatarWall() ? "fa-table" : "fa-users" }}
            text={showAvatarWall() ? "show table" : "avatar wall"}
            onClick={() => setShowAvatarWall((v) => !v)}
          />
        </div>
        <Show when={openPanel() === "rewards"}>
          <div class="mb-3 grid gap-3 rounded-xl bg-bg p-3">
            <div class="text-xs font-semibold tracking-wide text-sub uppercase">
              Rewards
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm text-sub">
              <Fa icon="fa-flag-checkered" />
              <span>Class goal:</span>
              <input
                type="number"
                min="1"
                class={cn(selectClass, "w-24")}
                aria-label="Goal stars"
                value={goalStars()}
                onChange={(e) =>
                  setGoalStars(Math.max(1, Number(e.currentTarget.value) || 1))
                }
              />
              <span>stars, reward</span>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. class party"
                class={cn(selectClass, "w-48")}
                aria-label="Goal reward"
                value={goalReward()}
                onInput={(e) => setGoalReward(e.currentTarget.value)}
              />
              <Button
                text={currentGoal() === undefined ? "set goal" : "update goal"}
                disabled={savingGoal()}
                onClick={() => void saveGoal(false)}
              />
              <Show when={currentGoal() !== undefined}>
                <Button
                  variant="text"
                  text="remove"
                  disabled={savingGoal()}
                  onClick={() => void saveGoal(true)}
                />
              </Show>
              <span class="text-xs">
                (class has {classStars()} stars now · students see the bar on
                their lessons page)
              </span>
            </div>
            <div class="flex items-center gap-1.5 text-sm text-sub">
              <Fa icon="fa-coins" />
              <span>coins to give:</span>
              <input
                type="number"
                min="1"
                class={cn(selectClass, "w-20")}
                value={coinAmount()}
                onChange={(e) =>
                  setCoinAmount(Math.max(1, Number(e.currentTarget.value) || 1))
                }
              />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                text={`give to selected (${selectedForCert().size})`}
                fa={{ icon: "fa-check-square" }}
                disabled={selectedForCert().size === 0}
                onClick={() =>
                  giveCoinsBulk(
                    props.rows.filter((r) => selectedForCert().has(r.uid)),
                    "Selected students",
                  )
                }
              />
              <Button
                text={`give to whole class (${props.rows.length})`}
                fa={{ icon: "fa-users" }}
                disabled={props.rows.length === 0}
                onClick={() =>
                  giveCoinsBulk(props.rows, `Everyone in ${props.classId}`)
                }
              />
            </div>
            <p class="text-xs text-sub">
              Tick students with the checkboxes in the table (the top box
              selects everyone shown), or use the coin button on one row.
            </p>
          </div>
        </Show>
        <Show when={openPanel() === "reports"}>
          <div class="mb-3 grid gap-3 rounded-xl bg-bg p-3">
            <div class="text-xs font-semibold tracking-wide text-sub uppercase">
              Reports
            </div>
            <div class="flex items-center gap-1.5 text-sm text-sub">
              <span>PDF period:</span>
              <input
                type="date"
                class={selectClass}
                value={rangeStart()}
                max={rangeEnd()}
                onChange={(e) => setRangeStart(e.currentTarget.value)}
              />
              <span>to</span>
              <input
                type="date"
                class={selectClass}
                value={rangeEnd()}
                min={rangeStart()}
                onChange={(e) => setRangeEnd(e.currentTarget.value)}
              />
              <Button
                variant="text"
                text="7d"
                onClick={() => applyRangePreset(7)}
              />
              <Button
                variant="text"
                text="30d"
                onClick={() => applyRangePreset(30)}
              />
              <Button
                variant="text"
                text="90d"
                onClick={() => applyRangePreset(90)}
              />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                text={previewingAll() ? "opening…" : "preview all (pdf)"}
                fa={{ icon: "fa-eye" }}
                onClick={() => void previewAllPdf()}
                disabled={
                  props.rows.length === 0 || previewingAll() || downloadingAll()
                }
              />
              <Button
                text={downloadingAll() ? "building…" : "download all (pdf)"}
                fa={{ icon: "fa-file-pdf" }}
                onClick={() => void downloadAllPdf()}
                disabled={props.rows.length === 0 || downloadingAll()}
              />
              <Button
                text="print this week"
                fa={{ icon: "fa-print" }}
                onClick={printThisWeek}
                disabled={props.rows.length === 0 || downloadingAll()}
              />
              <Button
                text={
                  selectedForCert().size > 0
                    ? `print certificates (${selectedForCert().size})`
                    : "print certificates"
                }
                fa={{ icon: "fa-certificate" }}
                onClick={openCertificatesForSelected}
                disabled={selectedForCert().size === 0}
              />
              <Button
                text="export csv"
                fa={{ icon: "fa-file-csv" }}
                onClick={exportCsv}
                disabled={props.rows.length === 0}
              />
            </div>
            <p class="mb-2 text-xs text-sub">
              PDF date range affects practice stats only; use preview then Print
              → Save as PDF for conferences.
            </p>
          </div>
        </Show>
        <Show when={showAvatarWall()}>
          <div class="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            <For each={filteredRows()}>
              {(r) => (
                <div class="flex min-w-0 flex-col items-center gap-1 rounded bg-sub-alt p-2 text-center">
                  <Avatar
                    color={r.avatar?.color}
                    shape={r.avatar?.shape}
                    hair={r.avatar?.hair}
                    hat={r.avatar?.hat}
                    accessory={r.avatar?.accessory}
                    face={r.avatar?.face}
                    background={r.avatar?.background}
                    highlightColor={r.avatar?.highlight}
                    animalImage={r.avatar?.animalImage}
                    size={56}
                  />
                  <span class="w-full truncate text-xs text-text">
                    {r.name}
                  </span>
                  <span class="text-[0.65em] text-sub">
                    <Fa icon="fa-star" class="mr-0.5 text-main" size={0.7} />
                    {r.lessonStars}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
        <div
          class={cn(
            "mb-2 flex items-center justify-between gap-2 text-sm text-sub",
            showAvatarWall() && "hidden",
          )}
        >
          <span>
            {filteredRows().length} of {props.rows.length} students
          </span>
          <Button
            variant="text"
            class="text-sm lg:hidden"
            fa={{ icon: allColumns() ? "fa-compress-alt" : "fa-expand-alt" }}
            text={allColumns() ? "Fewer columns" : "More columns"}
            onClick={() => setAllColumns((v) => !v)}
          />
        </div>
        <div class={cn("overflow-x-auto", showAvatarWall() ? "hidden" : "")}>
          <table class="w-full text-left text-sm [&_td]:px-1.5 lg:[&_td]:px-2 [&_th]:px-1.5 lg:[&_th]:px-2">
            <thead class="text-sub [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-bg">
              <tr>
                <th class="w-8 p-2">
                  <input
                    type="checkbox"
                    aria-label="Select all shown for certificates"
                    title="Select all shown"
                    checked={
                      filteredRows().length > 0 &&
                      filteredRows().every((r) => selectedForCert().has(r.uid))
                    }
                    onChange={selectAllForCert}
                  />
                </th>
                {sortHeader("name", "name")}
                {sortHeader("bestWpm", "best wpm", {
                  right: true,
                  short: "wpm",
                })}
                {sortHeader("bestAcc", "acc", { right: true })}
                {sortHeader("xp", "xp", { right: true, extra: true })}
                {sortHeader("lessons", "lessons", { right: true })}
                {sortHeader("tries", "tries", { right: true, extra: true })}
                {sortHeader("lessonAcc", "lesson acc", {
                  right: true,
                  extra: true,
                })}
                {sortHeader("onTask", "on task", { right: true, extra: true })}
                {sortHeader("assignments", "assignments", {
                  right: true,
                  short: "tasks",
                })}
                <th class={cn("p-2", extraCol())}>weak keys</th>
                {sortHeader("lastActive", "last active", {
                  right: true,
                  short: "active",
                })}
                <th class="p-2">
                  <span class="sr-only">actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredRows()}>
                {(row) => (
                  <>
                    <tr
                      class="cursor-pointer border-t border-sub-alt hover:bg-sub-alt"
                      onClick={() => toggleOpen(row.uid)}
                    >
                      <td class="p-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedForCert().has(row.uid)}
                          aria-label={`Select ${row.name}`}
                          onChange={() => toggleCertSelect(row.uid)}
                        />
                      </td>
                      <td class="max-w-[8.5rem] p-2 text-text lg:max-w-[14rem]">
                        <span class="flex min-w-0 items-center gap-2">
                          <Fa
                            icon={
                              openUid() === row.uid
                                ? "fa-chevron-down"
                                : "fa-chevron-right"
                            }
                            size={0.75}
                            class="shrink-0"
                          />
                          <span class="truncate" title={row.name}>
                            {row.name}
                          </span>
                          <Show when={row.stuckLessons.length > 0}>
                            <span
                              class="shrink-0 rounded bg-error px-1.5 text-xs text-bg"
                              title={stuckTitle(row)}
                            >
                              stuck
                            </span>
                          </Show>
                        </span>
                      </td>
                      <td class="p-2 text-right">{Math.round(row.bestWpm)}</td>
                      <td class="p-2 text-right">{Math.round(row.bestAcc)}%</td>
                      <td class={cn("p-2 text-right", extraCol())}>{row.xp}</td>
                      <td class="p-2 text-right">{row.lessonsCompleted}</td>
                      <td class={cn("p-2 text-right", extraCol())}>
                        {row.lessonAttempts}
                      </td>
                      <td class={cn("p-2 text-right", extraCol())}>
                        {row.lessonAvgAcc > 0
                          ? `${Math.round(row.lessonAvgAcc)}%`
                          : "-"}
                      </td>
                      <td class={cn("p-2 text-right", extraCol())}>
                        {formatMinutes(row.lessonTime)}
                      </td>
                      <td class="p-2 text-right">
                        {assignmentsDone(row)}/{assignmentTotal(row)}
                      </td>
                      <td
                        class={cn(
                          "max-w-[8rem] truncate p-2 text-sub",
                          extraCol(),
                        )}
                      >
                        {formatWeakKeys(row.weakKeys, 3)}
                      </td>
                      <td
                        class={cn(
                          "p-2 text-right",
                          isGoneQuiet(row) ? "text-error" : "text-sub",
                        )}
                        title={
                          isGoneQuiet(row) ? "Hasn't practiced in 2+ days" : ""
                        }
                      >
                        {formatLastActive(row.lastActive)}
                      </td>
                      <td class="p-1 text-right whitespace-nowrap lg:p-2">
                        <Button
                          variant="text"
                          class="p-1.5 lg:p-[0.5em]"
                          fa={{ icon: "fa-coins" }}
                          balloon={{
                            text: `give ${coinAmount()} coins`,
                            position: "left",
                          }}
                          disabled={rewardingUid() !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            void giveCoins(row);
                          }}
                        />
                        <Button
                          variant="text"
                          class="p-1.5 lg:p-[0.5em]"
                          fa={{ icon: "fa-eye" }}
                          balloon={{
                            text: "preview progress report (pdf)",
                            position: "left",
                          }}
                          disabled={
                            previewingUid() !== null ||
                            downloadingUid() !== null
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            void previewStudentPdf(row);
                          }}
                        />
                        <Button
                          variant="text"
                          class="p-1.5 lg:p-[0.5em]"
                          fa={{ icon: "fa-file-pdf" }}
                          balloon={{
                            text: "download progress report (pdf)",
                            position: "left",
                          }}
                          disabled={downloadingUid() !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadStudentPdf(row);
                          }}
                        />
                        <Button
                          variant="text"
                          class="hidden p-1.5 lg:inline-flex lg:p-[0.5em]"
                          fa={{ icon: "fa-certificate" }}
                          balloon={{
                            text: "print certificate",
                            position: "left",
                          }}
                          href={`/certificate?uid=${row.uid}`}
                          router-link
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    </tr>
                    <Show when={openUid() === row.uid}>
                      <tr>
                        <td colSpan="12" class="bg-bg p-3">
                          <StudentDrilldown
                            uid={row.uid}
                            name={row.name}
                            wordLists={props.wordLists}
                            passages={props.passages}
                            wordListStatus={row.wordListStatus}
                            passageStatus={row.passageStatus}
                          />
                        </td>
                      </tr>
                    </Show>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </Show>
  );
}

function StudentDrilldown(props: {
  uid: string;
  name: string;
  wordLists: WordList[];
  passages: ReadingPassage[];
  wordListStatus: Record<string, boolean>;
  passageStatus: Record<string, boolean>;
}): JSXElement {
  const [details] = createResource(
    () => props.uid,
    async (uid) => getStudentLessonDetails(uid),
  );

  const attemptedWordLists = (): WordList[] =>
    props.wordLists.filter((wl) => wl.id in props.wordListStatus);
  const attemptedPassages = (): ReadingPassage[] =>
    props.passages.filter((p) => p.id in props.passageStatus);

  return (
    <div class="grid gap-4">
      <div class="grid gap-2">
        <div class="text-sub">{props.name} - lesson by lesson</div>
        <Show when={!details.loading} fallback={<LoadingBars />}>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-sub [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-bg">
                <tr>
                  <th class="p-1">lesson</th>
                  <th class="p-1 text-right">stars</th>
                  <th class="p-1 text-right">best wpm</th>
                  <th class="p-1 text-right">best acc</th>
                  <th class="p-1 text-right">attempts</th>
                  <th class="p-1 text-right">time</th>
                  <th class="p-1 text-right">last attempt</th>
                </tr>
              </thead>
              <tbody>
                <For each={details() ?? []}>
                  {(d) => (
                    <tr
                      class={cn(
                        "border-t border-sub-alt",
                        d.completed ? "text-text" : "text-sub",
                      )}
                    >
                      <td class="p-1">
                        <span class="flex items-center gap-2">
                          <Show when={d.completed}>
                            <Fa icon="fa-check" size={0.7} class="text-main" />
                          </Show>
                          {d.name}
                        </span>
                      </td>
                      <td class="p-1 text-right">{d.stars}</td>
                      <td class="p-1 text-right">
                        {d.bestWpm > 0 ? Math.round(d.bestWpm) : "-"}
                      </td>
                      <td class="p-1 text-right">
                        {d.bestAcc > 0 ? `${Math.round(d.bestAcc)}%` : "-"}
                      </td>
                      <td class="p-1 text-right">{d.attempts}</td>
                      <td class="p-1 text-right">
                        {formatMinutes(d.timeSpent)}
                      </td>
                      <td class="p-1 text-right text-sub">
                        {formatDate(d.lastAt)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      <Show when={attemptedWordLists().length > 0}>
        <div class="grid gap-2">
          <div class="text-sub">word lists</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-sub [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-bg">
                <tr>
                  <th class="p-1">title</th>
                  <th class="p-1 text-right">completed</th>
                </tr>
              </thead>
              <tbody>
                <For each={attemptedWordLists()}>
                  {(wl) => (
                    <tr class="border-t border-sub-alt text-text">
                      <td class="p-1">{wl.title}</td>
                      <td class="p-1 text-right">
                        <Show
                          when={props.wordListStatus[wl.id] === true}
                          fallback={<span class="text-sub">-</span>}
                        >
                          <Fa icon="fa-check" size={0.7} class="text-main" />
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      <Show when={attemptedPassages().length > 0}>
        <div class="grid gap-2">
          <div class="text-sub">reading passages</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-sub [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-bg">
                <tr>
                  <th class="p-1">title</th>
                  <th class="p-1 text-right">completed</th>
                </tr>
              </thead>
              <tbody>
                <For each={attemptedPassages()}>
                  {(p) => (
                    <tr class="border-t border-sub-alt text-text">
                      <td class="p-1">{p.title}</td>
                      <td class="p-1 text-right">
                        <Show
                          when={props.passageStatus[p.id] === true}
                          fallback={<span class="text-sub">-</span>}
                        >
                          <Fa icon="fa-check" size={0.7} class="text-main" />
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  );
}

function AssignmentsTab(props: {
  assignments: Assignment[];
  wordLists: WordList[];
  passages: ReadingPassage[];
  rows: StudentProgressRow[];
  onChanged: () => Promise<void>;
}): JSXElement {
  const [title, setTitle] = createSignal("");
  const [scope, setScope] = createSignal<AssignmentScope>("class");
  const [classId, setClassId] = createSignal<string>(CLASS_IDS[0]);
  const [grade, setGrade] = createSignal<string>(GRADES[0]);
  const [studentUid, setStudentUid] = createSignal<string>("");
  const [contentType, setContentType] = createSignal<ContentType>("lesson");
  const [lessonId, setLessonId] = createSignal<string>(
    lessonGroups[0]?.lessons[0]?.id ?? "",
  );
  const [wordListId, setWordListId] = createSignal<string>("");
  const [passageId, setPassageId] = createSignal<string>("");
  const [due, setDue] = createSignal<string>("");

  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editScope, setEditScope] = createSignal<AssignmentScope>("class");
  const [editClassId, setEditClassId] = createSignal<string>(CLASS_IDS[0]);
  const [editGrade, setEditGrade] = createSignal<string>(GRADES[0]);
  const [editStudentUid, setEditStudentUid] = createSignal<string>("");
  const [editContentType, setEditContentType] =
    createSignal<ContentType>("lesson");
  const [editLessonId, setEditLessonId] = createSignal<string>("");
  const [editWordListId, setEditWordListId] = createSignal<string>("");
  const [editPassageId, setEditPassageId] = createSignal<string>("");
  const [editDue, setEditDue] = createSignal<string>("");
  const [editBusy, setEditBusy] = createSignal(false);

  const [openCompletionId, setOpenCompletionId] = createSignal<string | null>(
    null,
  );

  const startEdit = (a: Assignment): void => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditScope(a.scope);
    setEditClassId(a.classId ?? CLASS_IDS[0]);
    setEditGrade(a.grade ?? GRADES[0]);
    setEditStudentUid(a.studentUid ?? "");
    setEditContentType(a.contentType);
    setEditLessonId(a.lessonId ?? "");
    setEditWordListId(a.wordListId ?? "");
    setEditPassageId(a.passageId ?? "");
    setEditDue(
      a.dueAt !== undefined
        ? (new Date(a.dueAt).toISOString().split("T")[0] ?? "")
        : "",
    );
  };

  const saveEdit = async (id: string): Promise<void> => {
    if (editTitle().trim() === "") {
      showErrorNotification("Title is required");
      return;
    }
    if (editScope() === "student" && editStudentUid() === "") {
      showErrorNotification("Pick a student");
      return;
    }
    setEditBusy(true);
    try {
      await updateAssignment(id, {
        title: editTitle().trim(),
        scope: editScope(),
        classId: editClassId(),
        grade: editGrade(),
        studentUid: editStudentUid(),
        contentType: editContentType(),
        lessonId: editLessonId() || undefined,
        wordListId: editWordListId() || undefined,
        passageId: editPassageId() || undefined,
        dueAt: editDue() !== "" ? new Date(editDue()).getTime() : undefined,
      });
      setEditingId(null);
      await props.onChanged();
      showSuccessNotification("Assignment updated");
    } catch (e) {
      showErrorNotification("Failed to update assignment", { error: e });
    } finally {
      setEditBusy(false);
    }
  };

  /** A student-scoped assignment only applies to its one target, not the whole class. */
  const relevantRows = (a: Assignment): StudentProgressRow[] =>
    a.scope === "student"
      ? props.rows.filter((r) => r.uid === a.studentUid)
      : props.rows;

  const completionStudents = (
    a: Assignment,
  ): { name: string; done: boolean }[] =>
    relevantRows(a).map((r) => ({
      name: r.name,
      done: r.assignmentStatus[a.id] === true,
    }));
  const [busy, setBusy] = createSignal(false);

  const completedCount = (a: Assignment): number =>
    relevantRows(a).filter((r) => r.assignmentStatus[a.id] === true).length;

  const submit = async (): Promise<void> => {
    if (title().trim() === "") {
      showErrorNotification("Title is required");
      return;
    }
    if (contentType() === "wordlist" && wordListId() === "") {
      showErrorNotification("Pick a word list");
      return;
    }
    if (contentType() === "passage" && passageId() === "") {
      showErrorNotification("Pick a reading passage");
      return;
    }
    if (scope() === "student" && studentUid() === "") {
      showErrorNotification("Pick a student");
      return;
    }
    setBusy(true);
    try {
      await createAssignment({
        title: title().trim(),
        scope: scope(),
        classId: classId(),
        grade: grade(),
        studentUid: studentUid(),
        contentType: contentType(),
        lessonId: lessonId(),
        wordListId: wordListId(),
        passageId: passageId(),
        dueAt: due() === "" ? undefined : new Date(due()).getTime(),
      });
      setTitle("");
      await props.onChanged();
      showSuccessNotification("Assignment created");
    } catch (e) {
      showErrorNotification("Failed to create assignment", { error: e });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await deleteAssignment(id);
      await props.onChanged();
    } catch (e) {
      showErrorNotification("Failed to delete assignment", { error: e });
    }
  };

  return (
    <div class="grid gap-4">
      <div class="grid gap-3 rounded-xl bg-bg p-4">
        <div class="text-sm font-semibold text-text">
          <Fa icon="fa-plus-circle" class="mr-1.5 text-main" />
          New assignment
        </div>
        <label class="grid min-w-0 gap-1">
          <span class="text-xs font-semibold tracking-wide text-sub uppercase">
            Title
          </span>
          <input
            type="text"
            class={inputClass}
            placeholder="assignment title..."
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&_select]:w-full [&_select]:min-w-0">
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold tracking-wide text-sub uppercase">
              Assign to
            </span>
            <select
              class={selectClass}
              value={scope()}
              onChange={(e) =>
                setScope(e.currentTarget.value as AssignmentScope)
              }
            >
              <option value="class">a class</option>
              <option value="grade">a grade</option>
              <option value="school">whole school</option>
              <option value="student">one student</option>
            </select>
          </label>
          <Show when={scope() !== "school"}>
            <div class="grid min-w-0 gap-1">
              <span class="text-xs font-semibold tracking-wide text-sub uppercase">
                Who
              </span>
              <div class="flex flex-wrap gap-2">
                <ScopeFields
                  scope={scope()}
                  classId={classId()}
                  grade={grade()}
                  onClassId={setClassId}
                  onGrade={setGrade}
                  studentUid={studentUid()}
                  students={props.rows}
                  onStudentUid={setStudentUid}
                />
              </div>
            </div>
          </Show>
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold tracking-wide text-sub uppercase">
              Type
            </span>
            <select
              class={selectClass}
              value={contentType()}
              onChange={(e) =>
                setContentType(e.currentTarget.value as ContentType)
              }
            >
              <option value="lesson">built-in lesson</option>
              <option value="wordlist">word list</option>
              <option value="passage">reading passage</option>
            </select>
          </label>
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold tracking-wide text-sub uppercase">
              Content
            </span>
            <Show when={contentType() === "lesson"}>
              <select
                class={selectClass}
                value={lessonId()}
                onChange={(e) => setLessonId(e.currentTarget.value)}
              >
                <For each={lessonGroups}>
                  {(group) => (
                    <optgroup label={group.name}>
                      <For each={group.lessons}>
                        {(l) => <option value={l.id}>{l.name}</option>}
                      </For>
                    </optgroup>
                  )}
                </For>
              </select>
            </Show>
            <Show when={contentType() === "wordlist"}>
              <select
                class={selectClass}
                value={wordListId()}
                onChange={(e) => setWordListId(e.currentTarget.value)}
              >
                <option value="">select word list...</option>
                <For each={props.wordLists}>
                  {(wl) => <option value={wl.id}>{wl.title}</option>}
                </For>
              </select>
            </Show>
            <Show when={contentType() === "passage"}>
              <select
                class={selectClass}
                value={passageId()}
                onChange={(e) => setPassageId(e.currentTarget.value)}
              >
                <option value="">select passage...</option>
                <For each={props.passages}>
                  {(p) => <option value={p.id}>{p.title}</option>}
                </For>
              </select>
            </Show>
          </label>
        </div>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold tracking-wide text-sub uppercase">
              Due date (optional)
            </span>
            <input
              type="date"
              class={selectClass}
              value={due()}
              onInput={(e) => setDue(e.currentTarget.value)}
            />
          </label>
          <Button
            text={busy() ? "creating..." : "create"}
            fa={{ icon: "fa-plus" }}
            onClick={() => void submit()}
            disabled={busy()}
          />
        </div>
      </div>

      <div class="grid gap-2">
        <For
          each={props.assignments}
          fallback={
            <EmptyState
              icon="fa-tasks"
              title="No assignments yet"
              hint="Create one above to give your class something to practice."
            />
          }
        >
          {(a) => (
            <div class="rounded bg-sub-alt">
              <Show
                when={editingId() === a.id}
                fallback={
                  <div class="flex items-center justify-between gap-2 p-3">
                    <div>
                      <div class="font-medium text-text">{a.title}</div>
                      <div class="text-em-xs text-sub">
                        {a.scope === "class"
                          ? a.classId
                          : a.scope === "grade"
                            ? a.grade
                            : a.scope === "student"
                              ? (props.rows.find((r) => r.uid === a.studentUid)
                                  ?.name ?? "student")
                              : "school"}{" "}
                        · {a.contentType}
                        <Show when={a.dueAt !== undefined}>
                          {" "}
                          · due {formatDate(a.dueAt ?? 0)}
                        </Show>
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="cursor-pointer text-em-xs text-sub hover:text-text"
                        onClick={() =>
                          setOpenCompletionId((cur) =>
                            cur === a.id ? null : a.id,
                          )
                        }
                      >
                        {completedCount(a)}/{relevantRows(a).length} done
                      </button>
                      <Button
                        variant="text"
                        fa={{ icon: "fa-pen" }}
                        aria-label={`Edit ${a.title}`}
                        onClick={() => startEdit(a)}
                      />
                      <Button
                        variant="text"
                        fa={{ icon: "fa-trash" }}
                        aria-label={`Delete ${a.title}`}
                        danger
                        onClick={() => void remove(a.id)}
                      />
                    </div>
                  </div>
                }
              >
                <div class="grid gap-2 p-3">
                  <input
                    type="text"
                    class={inputClass}
                    value={editTitle()}
                    onInput={(e) => setEditTitle(e.currentTarget.value)}
                  />
                  <div class="flex flex-wrap items-center gap-2">
                    <select
                      class={selectClass}
                      value={editScope()}
                      onChange={(e) =>
                        setEditScope(e.currentTarget.value as AssignmentScope)
                      }
                    >
                      <option value="class">a class</option>
                      <option value="grade">a grade</option>
                      <option value="school">whole school</option>
                      <option value="student">one student</option>
                    </select>
                    <ScopeFields
                      scope={editScope()}
                      classId={editClassId()}
                      grade={editGrade()}
                      onClassId={setEditClassId}
                      onGrade={setEditGrade}
                      studentUid={editStudentUid()}
                      students={props.rows}
                      onStudentUid={setEditStudentUid}
                    />
                    <select
                      class={selectClass}
                      value={editContentType()}
                      onChange={(e) =>
                        setEditContentType(e.currentTarget.value as ContentType)
                      }
                    >
                      <option value="lesson">built-in lesson</option>
                      <option value="wordlist">word list</option>
                      <option value="passage">reading passage</option>
                    </select>
                    <Show when={editContentType() === "lesson"}>
                      <select
                        class={selectClass}
                        value={editLessonId()}
                        onChange={(e) => setEditLessonId(e.currentTarget.value)}
                      >
                        <For each={lessonGroups}>
                          {(group) => (
                            <optgroup label={group.name}>
                              <For each={group.lessons}>
                                {(l) => <option value={l.id}>{l.name}</option>}
                              </For>
                            </optgroup>
                          )}
                        </For>
                      </select>
                    </Show>
                    <Show when={editContentType() === "wordlist"}>
                      <select
                        class={selectClass}
                        value={editWordListId()}
                        onChange={(e) =>
                          setEditWordListId(e.currentTarget.value)
                        }
                      >
                        <option value="">select word list...</option>
                        <For each={props.wordLists}>
                          {(wl) => <option value={wl.id}>{wl.title}</option>}
                        </For>
                      </select>
                    </Show>
                    <Show when={editContentType() === "passage"}>
                      <select
                        class={selectClass}
                        value={editPassageId()}
                        onChange={(e) =>
                          setEditPassageId(e.currentTarget.value)
                        }
                      >
                        <option value="">select passage...</option>
                        <For each={props.passages}>
                          {(p) => <option value={p.id}>{p.title}</option>}
                        </For>
                      </select>
                    </Show>
                    <input
                      type="date"
                      class={selectClass}
                      value={editDue()}
                      onInput={(e) => setEditDue(e.currentTarget.value)}
                    />
                    <Button
                      text={editBusy() ? "saving..." : "save"}
                      fa={{ icon: "fa-check" }}
                      onClick={() => void saveEdit(a.id)}
                      disabled={editBusy()}
                    />
                    <Button
                      variant="text"
                      text="cancel"
                      onClick={() => setEditingId(null)}
                    />
                  </div>
                </div>
              </Show>
              <Show when={openCompletionId() === a.id}>
                <div class="border-t border-bg px-3 pb-3">
                  <div class="grid gap-1 pt-2">
                    <For each={completionStudents(a)}>
                      {(s) => (
                        <div class="flex items-center gap-2 text-sm">
                          <Fa
                            icon={s.done ? "fa-check" : "fa-times"}
                            class={s.done ? "text-main" : "text-sub"}
                            size={0.75}
                          />
                          <span class={s.done ? "text-text" : "text-sub"}>
                            {s.name}
                          </span>
                        </div>
                      )}
                    </For>
                    <Show when={props.rows.length === 0}>
                      <div class="text-em-xs text-sub">no students</div>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function AnnouncementsTab(props: {
  announcements: Announcement[];
  rows: StudentProgressRow[];
  onChanged: () => Promise<void>;
}): JSXElement {
  const [title, setTitle] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [scope, setScope] = createSignal<AssignmentScope>("class");
  const [classId, setClassId] = createSignal<string>(CLASS_IDS[0]);
  const [grade, setGrade] = createSignal<string>(GRADES[0]);
  const [studentUid, setStudentUid] = createSignal<string>("");
  const [busy, setBusy] = createSignal(false);

  const submit = async (): Promise<void> => {
    if (title().trim() === "") {
      showErrorNotification("Title is required");
      return;
    }
    if (message().trim() === "") {
      showErrorNotification("Message is required");
      return;
    }
    if (scope() === "student" && studentUid() === "") {
      showErrorNotification("Pick a student");
      return;
    }
    setBusy(true);
    try {
      await createAnnouncement({
        title: title().trim(),
        message: message().trim(),
        scope: scope(),
        classId: classId(),
        grade: grade(),
        studentUid: studentUid(),
      });
      setTitle("");
      setMessage("");
      await props.onChanged();
      showSuccessNotification("Announcement sent");
    } catch (e) {
      showErrorNotification("Failed to send announcement", { error: e });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await deleteAnnouncement(id);
      await props.onChanged();
    } catch (e) {
      showErrorNotification("Failed to delete announcement", { error: e });
    }
  };

  const scopeLabel = (a: Announcement): string => {
    if (a.scope === "class") return a.classId ?? "";
    if (a.scope === "grade") return a.grade ?? "";
    if (a.scope === "student") {
      return props.rows.find((r) => r.uid === a.studentUid)?.name ?? "student";
    }
    return "school";
  };

  return (
    <div class="grid gap-4">
      <div class="grid gap-3 rounded-xl bg-bg p-4">
        <div class="text-sm font-semibold text-text">
          <Fa icon="fa-bullhorn" class="mr-1.5 text-main" />
          New announcement
        </div>
        <label class="grid min-w-0 gap-1">
          <span class="text-xs font-semibold tracking-wide text-sub uppercase">
            Title
          </span>
          <input
            type="text"
            class={inputClass}
            placeholder="announcement title..."
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <label class="grid min-w-0 gap-1">
          <span class="text-xs font-semibold tracking-wide text-sub uppercase">
            Message
          </span>
          <textarea
            class={inputClass}
            placeholder="message..."
            rows={3}
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
          ></textarea>
        </label>
        <div class="flex flex-wrap items-end gap-3">
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold tracking-wide text-sub uppercase">
              Send to
            </span>
            <select
              class={selectClass}
              value={scope()}
              onChange={(e) =>
                setScope(e.currentTarget.value as AssignmentScope)
              }
            >
              <option value="class">a class</option>
              <option value="grade">a grade</option>
              <option value="school">whole school</option>
              <option value="student">one student</option>
            </select>
          </label>
          <Show when={scope() !== "school"}>
            <div class="grid min-w-0 gap-1">
              <span class="text-xs font-semibold tracking-wide text-sub uppercase">
                Who
              </span>
              <div class="flex flex-wrap gap-2">
                <ScopeFields
                  scope={scope()}
                  classId={classId()}
                  grade={grade()}
                  onClassId={setClassId}
                  onGrade={setGrade}
                  studentUid={studentUid()}
                  students={props.rows}
                  onStudentUid={setStudentUid}
                />
              </div>
            </div>
          </Show>
          <div class="grow"></div>
          <Button
            text={busy() ? "sending..." : "send"}
            fa={{ icon: "fa-paper-plane" }}
            onClick={() => void submit()}
            disabled={busy()}
          />
        </div>
      </div>

      <div class="grid gap-2">
        <For
          each={props.announcements}
          fallback={
            <EmptyState
              icon="fa-bullhorn"
              title="No announcements yet"
              hint="Post a message above and students will see it on their lessons page."
            />
          }
        >
          {(a) => (
            <div class="flex items-start justify-between gap-2 rounded bg-sub-alt p-3">
              <div>
                <div class="font-medium text-text">{a.title}</div>
                <div class="text-sm text-sub">{a.message}</div>
                <div class="text-em-xs text-sub">
                  {scopeLabel(a)} · {formatDate(a.createdAt)}
                </div>
              </div>
              <Button
                variant="text"
                fa={{ icon: "fa-trash" }}
                danger
                onClick={() => void remove(a.id)}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function WordListsTab(props: {
  wordLists: WordList[];
  onChanged: () => Promise<void>;
}): JSXElement {
  const [title, setTitle] = createSignal("");
  const [text, setText] = createSignal("");
  const [scope, setScope] = createSignal<ContentScope>("class");
  const [classId, setClassId] = createSignal<string>(CLASS_IDS[0]);
  const [grade, setGrade] = createSignal<string>(GRADES[0]);
  const [busy, setBusy] = createSignal(false);

  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editText, setEditText] = createSignal("");
  const [editScope, setEditScope] = createSignal<ContentScope>("class");
  const [editClassId, setEditClassId] = createSignal<string>(CLASS_IDS[0]);
  const [editGrade, setEditGrade] = createSignal<string>(GRADES[0]);
  const [editBusy, setEditBusy] = createSignal(false);

  const startEdit = (wl: WordList): void => {
    setEditingId(wl.id);
    setEditTitle(wl.title);
    setEditText(wl.text);
    setEditScope(wl.scope);
    setEditClassId(wl.classId ?? CLASS_IDS[0]);
    setEditGrade(wl.grade ?? GRADES[0]);
  };

  const saveEdit = async (id: string): Promise<void> => {
    if (editTitle().trim() === "" || editText().trim() === "") {
      showErrorNotification("Title and words are required");
      return;
    }
    setEditBusy(true);
    try {
      await updateWordList(id, {
        title: editTitle().trim(),
        text: editText().trim(),
        scope: editScope(),
        classId: editClassId(),
        grade: editGrade(),
      });
      setEditingId(null);
      await props.onChanged();
      showSuccessNotification("Word list updated");
    } catch (e) {
      showErrorNotification("Failed to update word list", { error: e });
    } finally {
      setEditBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (title().trim() === "" || text().trim() === "") {
      showErrorNotification("Title and words are required");
      return;
    }
    setBusy(true);
    try {
      await createWordList({
        title: title().trim(),
        text: text().trim(),
        scope: scope(),
        classId: classId(),
        grade: grade(),
      });
      setTitle("");
      setText("");
      await props.onChanged();
      showSuccessNotification("Word list created");
    } catch (e) {
      showErrorNotification("Failed to create word list", { error: e });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await deleteWordList(id);
      await props.onChanged();
    } catch (e) {
      showErrorNotification("Failed to delete word list", { error: e });
    }
  };

  return (
    <div class="grid gap-4">
      <div class="grid gap-2 rounded bg-bg p-3">
        <input
          type="text"
          class={inputClass}
          placeholder="word list title (e.g. Week 5 spelling)..."
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
        <textarea
          class={cn(inputClass, "min-h-24 resize-y")}
          placeholder="paste words separated by spaces or new lines..."
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
        ></textarea>
        <div class="flex flex-wrap items-center gap-2">
          <select
            class={selectClass}
            value={scope()}
            onChange={(e) => setScope(e.currentTarget.value as ContentScope)}
          >
            <option value="class">a class</option>
            <option value="grade">a grade</option>
            <option value="school">whole school</option>
          </select>
          <ScopeFields
            scope={scope()}
            classId={classId()}
            grade={grade()}
            onClassId={setClassId}
            onGrade={setGrade}
          />
          <Button
            text={busy() ? "creating..." : "create"}
            fa={{ icon: "fa-plus" }}
            onClick={() => void submit()}
            disabled={busy()}
          />
        </div>
      </div>

      <div class="grid gap-2">
        <For
          each={props.wordLists}
          fallback={
            <EmptyState
              icon="fa-list"
              title="No word lists yet"
              hint="Add spelling or vocabulary words above to turn them into typing practice."
            />
          }
        >
          {(wl) => (
            <div class="rounded bg-sub-alt">
              <Show
                when={editingId() === wl.id}
                fallback={
                  <div class="grid gap-1 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <div class="font-medium text-text">{wl.title}</div>
                      <div class="flex shrink-0 items-center gap-2">
                        <Button
                          variant="text"
                          fa={{ icon: "fa-pen" }}
                          onClick={() => startEdit(wl)}
                        />
                        <Button
                          variant="text"
                          fa={{ icon: "fa-trash" }}
                          danger
                          onClick={() => void remove(wl.id)}
                        />
                      </div>
                    </div>
                    <div class="truncate text-em-xs text-sub">
                      {wl.scope === "class"
                        ? wl.classId
                        : wl.scope === "grade"
                          ? wl.grade
                          : "school"}{" "}
                      · {wl.text}
                    </div>
                  </div>
                }
              >
                <div class="grid gap-2 p-3">
                  <input
                    type="text"
                    class={inputClass}
                    value={editTitle()}
                    onInput={(e) => setEditTitle(e.currentTarget.value)}
                  />
                  <textarea
                    class={cn(inputClass, "min-h-24 resize-y")}
                    value={editText()}
                    onInput={(e) => setEditText(e.currentTarget.value)}
                  ></textarea>
                  <div class="flex flex-wrap items-center gap-2">
                    <select
                      class={selectClass}
                      value={editScope()}
                      onChange={(e) =>
                        setEditScope(e.currentTarget.value as ContentScope)
                      }
                    >
                      <option value="class">a class</option>
                      <option value="grade">a grade</option>
                      <option value="school">whole school</option>
                    </select>
                    <ScopeFields
                      scope={editScope()}
                      classId={editClassId()}
                      grade={editGrade()}
                      onClassId={setEditClassId}
                      onGrade={setEditGrade}
                    />
                    <Button
                      text={editBusy() ? "saving..." : "save"}
                      fa={{ icon: "fa-check" }}
                      onClick={() => void saveEdit(wl.id)}
                      disabled={editBusy()}
                    />
                    <Button
                      variant="text"
                      text="cancel"
                      onClick={() => setEditingId(null)}
                    />
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function PassagesTab(props: {
  passages: ReadingPassage[];
  onChanged: () => Promise<void>;
}): JSXElement {
  const [title, setTitle] = createSignal("");
  const [text, setText] = createSignal("");
  const [scope, setScope] = createSignal<ContentScope>("class");
  const [classId, setClassId] = createSignal<string>(CLASS_IDS[0]);
  const [grade, setGrade] = createSignal<string>(GRADES[0]);
  const [busy, setBusy] = createSignal(false);

  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editText, setEditText] = createSignal("");
  const [editScope, setEditScope] = createSignal<ContentScope>("class");
  const [editClassId, setEditClassId] = createSignal<string>(CLASS_IDS[0]);
  const [editGrade, setEditGrade] = createSignal<string>(GRADES[0]);
  const [editBusy, setEditBusy] = createSignal(false);

  const startEdit = (p: ReadingPassage): void => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditText(p.text);
    setEditScope(p.scope);
    setEditClassId(p.classId ?? CLASS_IDS[0]);
    setEditGrade(p.grade ?? GRADES[0]);
  };

  const saveEdit = async (id: string): Promise<void> => {
    if (editTitle().trim() === "" || editText().trim() === "") {
      showErrorNotification("Title and passage text are required");
      return;
    }
    setEditBusy(true);
    try {
      await updateReadingPassage(id, {
        title: editTitle().trim(),
        text: editText().trim(),
        scope: editScope(),
        classId: editClassId(),
        grade: editGrade(),
      });
      setEditingId(null);
      await props.onChanged();
      showSuccessNotification("Passage updated");
    } catch (e) {
      showErrorNotification("Failed to update passage", { error: e });
    } finally {
      setEditBusy(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (title().trim() === "" || text().trim() === "") {
      showErrorNotification("Title and passage text are required");
      return;
    }
    setBusy(true);
    try {
      await createReadingPassage({
        title: title().trim(),
        text: text().trim(),
        scope: scope(),
        classId: classId(),
        grade: grade(),
      });
      setTitle("");
      setText("");
      await props.onChanged();
      showSuccessNotification("Passage created");
    } catch (e) {
      showErrorNotification("Failed to create passage", { error: e });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await deleteReadingPassage(id);
      await props.onChanged();
    } catch (e) {
      showErrorNotification("Failed to delete passage", { error: e });
    }
  };

  return (
    <div class="grid gap-4">
      <div class="grid gap-2 rounded bg-bg p-3">
        <input
          type="text"
          class={inputClass}
          placeholder="passage title (e.g. The Lion and the Mouse)..."
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
        <textarea
          class={cn(inputClass, "min-h-32 resize-y")}
          placeholder="paste the full passage text here..."
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
        ></textarea>
        <div class="flex flex-wrap items-center gap-2">
          <select
            class={selectClass}
            value={scope()}
            onChange={(e) => setScope(e.currentTarget.value as ContentScope)}
          >
            <option value="class">a class</option>
            <option value="grade">a grade</option>
            <option value="school">whole school</option>
          </select>
          <ScopeFields
            scope={scope()}
            classId={classId()}
            grade={grade()}
            onClassId={setClassId}
            onGrade={setGrade}
          />
          <Button
            text={busy() ? "creating..." : "create"}
            fa={{ icon: "fa-plus" }}
            onClick={() => void submit()}
            disabled={busy()}
          />
        </div>
      </div>

      <div class="grid gap-2">
        <For
          each={props.passages}
          fallback={
            <EmptyState
              icon="fa-book-open"
              title="No passages yet"
              hint="Paste a short reading passage above for students to type."
            />
          }
        >
          {(p) => (
            <div class="rounded bg-sub-alt">
              <Show
                when={editingId() === p.id}
                fallback={
                  <div class="grid gap-1 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <div class="font-medium text-text">{p.title}</div>
                      <div class="flex shrink-0 items-center gap-2">
                        <Button
                          variant="text"
                          fa={{ icon: "fa-pen" }}
                          onClick={() => startEdit(p)}
                        />
                        <Button
                          variant="text"
                          fa={{ icon: "fa-trash" }}
                          danger
                          onClick={() => void remove(p.id)}
                        />
                      </div>
                    </div>
                    <div class="truncate text-em-xs text-sub">
                      {p.scope === "class"
                        ? p.classId
                        : p.scope === "grade"
                          ? p.grade
                          : "school"}{" "}
                      · {p.text}
                    </div>
                  </div>
                }
              >
                <div class="grid gap-2 p-3">
                  <input
                    type="text"
                    class={inputClass}
                    value={editTitle()}
                    onInput={(e) => setEditTitle(e.currentTarget.value)}
                  />
                  <textarea
                    class={cn(inputClass, "min-h-32 resize-y")}
                    value={editText()}
                    onInput={(e) => setEditText(e.currentTarget.value)}
                  ></textarea>
                  <div class="flex flex-wrap items-center gap-2">
                    <select
                      class={selectClass}
                      value={editScope()}
                      onChange={(e) =>
                        setEditScope(e.currentTarget.value as ContentScope)
                      }
                    >
                      <option value="class">a class</option>
                      <option value="grade">a grade</option>
                      <option value="school">whole school</option>
                    </select>
                    <ScopeFields
                      scope={editScope()}
                      classId={editClassId()}
                      grade={editGrade()}
                      onClassId={setEditClassId}
                      onGrade={setEditGrade}
                    />
                    <Button
                      text={editBusy() ? "saving..." : "save"}
                      fa={{ icon: "fa-check" }}
                      onClick={() => void saveEdit(p.id)}
                      disabled={editBusy()}
                    />
                    <Button
                      variant="text"
                      text="cancel"
                      onClick={() => setEditingId(null)}
                    />
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function RacesTab(props: {
  races: RaceHistory[];
  loading: boolean;
}): JSXElement {
  return (
    <Show when={!props.loading} fallback={<LoadingBars />}>
      <div class="grid gap-2">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg p-4">
          <div>
            <div class="font-semibold text-text">Class race</div>
            <div class="text-sm text-sub">
              Start a live race students join from their Race tab. Results are
              saved below.
            </div>
          </div>
          <Button
            href="/racehost"
            router-link
            active
            fa={{ icon: "fa-stopwatch" }}
            text="Host a race"
          />
        </div>
        <For
          each={props.races}
          fallback={
            <EmptyState
              icon="fa-flag-checkered"
              title="No races yet"
              hint="Host a race and the results will show up here."
            />
          }
        >
          {(r) => (
            <details class="rounded bg-sub-alt p-3">
              <summary class="cursor-pointer text-text">
                {r.contentLabel} ·{" "}
                {r.format === "blitz"
                  ? "word blitz"
                  : r.format === "tug"
                    ? `${r.durationSec}s tug of war`
                    : r.format === "timed"
                      ? `${r.durationSec}s sprint`
                      : r.format === "accuracy"
                        ? "accuracy race"
                        : "first to finish"}{" "}
                · {formatDate(r.savedAt)} · {r.standings.length} players
              </summary>
              <div class="mt-2 grid gap-1">
                <For each={r.standings}>
                  {(s) => (
                    <div class="flex items-center gap-3 text-sm">
                      <span class="w-6 text-center text-main">{s.rank}</span>
                      <span class="min-w-0 flex-1 truncate text-text">
                        {s.name}
                      </span>
                      <span class="text-text">
                        {Math.round(s.finalWpm)} wpm
                      </span>
                      <span class="text-sub">{Math.round(s.finalAcc)}%</span>
                    </div>
                  )}
                </For>
              </div>
            </details>
          )}
        </For>
      </div>
    </Show>
  );
}

export function ClassroomDashboard(): JSXElement {
  const [selectedClass, setSelectedClass] = createSignal<string>(CLASS_IDS[0]);
  const [tab, setTab] = useLocalStorage<Tab>({
    key: "classroomDashboardTab",
    schema: TabSchema,
    fallback: "students",
  });
  if (window.location.hash === "#students") {
    setTab("students");
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  const [selfCoinAmount, setSelfCoinAmount] = createSignal(10);
  const [rewardingSelf, setRewardingSelf] = createSignal(false);

  const rewardSelf = async (): Promise<void> => {
    const uid = getUserId();
    const amount = selfCoinAmount();
    if (uid === null || rewardingSelf() || amount <= 0) return;
    setRewardingSelf(true);
    try {
      await awardCoins(uid, amount);
      showSuccessNotification(`Gave yourself ${amount} coins`);
    } catch (e) {
      showErrorNotification("Failed to give coins");
      console.error(e);
    } finally {
      setRewardingSelf(false);
    }
  };

  const classroomOpen = (): boolean =>
    isCurrentUserAdmin() && getActivePage() === "classroom";
  const tabOn = (...ids: Tab[]): boolean =>
    classroomOpen() && ids.includes(tab());

  const progressQuery = useQuery(() => ({
    queryKey: ["classroom", "progress", selectedClass()],
    queryFn: async () => getClassProgress(selectedClass()),
    enabled: tabOn("progress", "assignments", "announcements"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));

  const assignmentsQuery = useQuery(() => ({
    queryKey: ["classroom", "assignments"],
    queryFn: listAssignments,
    enabled: tabOn("progress", "assignments"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));

  const wordListsQuery = useQuery(() => ({
    queryKey: ["classroom", "wordlists"],
    queryFn: listWordLists,
    enabled: tabOn("progress", "assignments", "wordlists"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));

  const passagesQuery = useQuery(() => ({
    queryKey: ["classroom", "passages"],
    queryFn: listReadingPassages,
    enabled: tabOn("progress", "assignments", "passages"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));

  const racesQuery = useQuery(() => ({
    queryKey: ["classroom", "races", selectedClass()],
    queryFn: async () => listHistoryForClass(selectedClass()),
    enabled: tabOn("races"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));
  const championsQuery = useQuery(() => ({
    queryKey: ["champions", selectedClass()],
    queryFn: async () => listChampions(selectedClass()),
    enabled: tabOn("races"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));

  const announcementsQuery = useQuery(() => ({
    queryKey: ["classroom", "announcements"],
    queryFn: listAnnouncements,
    enabled: tabOn("announcements"),
    staleTime: CLASSROOM_QUERY_STALE_MS,
  }));

  const refetchAnnouncements = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: ["classroom", "announcements"],
    });
  };

  const refetchAssignments = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: ["classroom", "assignments"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["classroom", "progress"],
    });
  };
  const refetchWordLists = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: ["classroom", "wordlists"],
    });
  };
  const refetchPassages = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: ["classroom", "passages"],
    });
  };

  const [refreshing, setRefreshing] = createSignal(false);
  // Every classroom query stays mounted, so only refetch what the open tab
  // shows - the progress scan alone is ~1 read per lesson per student.
  const REFRESH_KEYS: Record<Tab, string[]> = {
    students: ["students"],
    progress: ["progress"],
    activity: ["activity"],
    assignments: ["assignments"],
    wordlists: ["wordlists"],
    passages: ["passages"],
    races: ["races"],
    images: [],
    announcements: ["announcements"],
    usage: ["usage"],
  };
  const refreshAll = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await Promise.all([
        ...REFRESH_KEYS[tab()].map(async (key) =>
          queryClient.invalidateQueries({ queryKey: ["classroom", key] }),
        ),
        ...(tab() === "activity"
          ? [queryClient.invalidateQueries({ queryKey: ["gameAccess"] })]
          : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const rows = createMemo<StudentProgressRow[]>(() => progressQuery.data ?? []);
  const assignments = createMemo<Assignment[]>(
    () => assignmentsQuery.data ?? [],
  );
  const wordLists = createMemo<WordList[]>(() => wordListsQuery.data ?? []);
  const passages = createMemo<ReadingPassage[]>(() => passagesQuery.data ?? []);
  const races = createMemo<RaceHistory[]>(() => racesQuery.data ?? []);
  const announcements = createMemo<Announcement[]>(
    () => announcementsQuery.data ?? [],
  );

  const tabButton = (id: Tab, text: string, fa: FaProps): JSXElement => (
    <Button
      variant="text"
      text={text}
      fa={{ ...fa, fixedWidth: true }}
      active={tab() === id}
      class={cn(
        "min-h-10 shrink-0 whitespace-nowrap",
        tab() === id && "bg-bg hover:bg-bg",
      )}
      onClick={() => setTab(id)}
    />
  );

  const tabGroup = (label: string, buttons: JSXElement): JSXElement => (
    <div class="grid shrink-0 gap-1 rounded-xl bg-sub-alt p-2">
      <div class="px-2 text-xs font-semibold tracking-wide text-sub uppercase">
        {label}
      </div>
      <div class="flex gap-1">{buttons}</div>
    </div>
  );

  return (
    <Page id="classroom">
      <Show
        when={isCurrentUserAdmin()}
        fallback={
          <div class="content-grid p-8 text-center text-sub">
            <Fa icon="fa-lock" class="mr-2" />
            This page is for teachers only.
          </div>
        }
      >
        <div class="content-grid grid gap-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <H2 fa={{ icon: "fa-chalkboard-teacher" }} text="classroom" />
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="text"
                text={refreshing() ? "refreshing…" : "refresh"}
                fa={{
                  icon: "fa-sync-alt",
                  class: refreshing() ? "fa-spin" : undefined,
                }}
                balloon={{
                  text: "Data is cached for 5 minutes. Refresh this tab to load the latest.",
                  position: "left",
                }}
                disabled={refreshing()}
                onClick={() => void refreshAll()}
              />
            </div>
          </div>

          <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {tabGroup(
              "Students",
              <>
                {tabButton("students", "Students", { icon: "fa-users" })}
                {tabButton("progress", "Student progress", {
                  icon: "fa-chart-line",
                })}
                {tabButton("activity", "Lessons vs games", {
                  icon: "fa-gamepad",
                })}
              </>,
            )}
            {tabGroup(
              "Teaching",
              <>
                {tabButton("assignments", "Assignments", {
                  icon: "fa-tasks",
                })}
                {tabButton("wordlists", "Word lists", { icon: "fa-list" })}
                {tabButton("passages", "Passages", {
                  icon: "fa-book-open",
                })}
              </>,
            )}
            {tabGroup(
              "Activities",
              <>
                {tabButton("races", "Races", {
                  icon: "fa-flag-checkered",
                })}
                {tabButton("images", "Side images", { icon: "fa-images" })}
                {tabButton("announcements", "Announcements", {
                  icon: "fa-bullhorn",
                })}
                {tabButton("usage", "Free plan", {
                  icon: "fa-tachometer-alt",
                })}
              </>,
            )}
          </div>

          <Show when={CLASS_TABS.has(tab())}>
            <div
              class="-mx-1 flex items-center gap-2 overflow-x-auto border-b border-sub-alt px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Choose a class"
            >
              <span class="shrink-0 text-xs font-semibold tracking-wide text-sub uppercase">
                Class
              </span>
              <For each={CLASS_IDS}>
                {(c) => (
                  <Button
                    text={c}
                    active={selectedClass() === c}
                    class="min-h-9 shrink-0 rounded-full px-3 text-sm"
                    onClick={() => setSelectedClass(c)}
                  />
                )}
              </For>
            </div>
          </Show>

          <Show when={tab() === "students"}>
            <div class={panelClass}>
              <StudentsTab />
            </div>
          </Show>
          <Show when={tab() === "usage" && classroomOpen()}>
            <div class={panelClass}>
              <UsageTab />
            </div>
          </Show>
          <Show when={tab() === "activity" && classroomOpen()}>
            <div class={panelClass}>
              <ActivityTab classId={selectedClass()} />
            </div>
          </Show>
          <Show when={tab() === "progress"}>
            <div class={panelClass}>
              <ProgressTab
                classId={selectedClass()}
                rows={rows()}
                assignments={assignments()}
                wordLists={wordLists()}
                passages={passages()}
                loading={progressQuery.isPending}
              />
            </div>
          </Show>
          <Show when={tab() === "assignments"}>
            <div class={panelClass}>
              <AssignmentsTab
                assignments={assignments()}
                wordLists={wordLists()}
                passages={passages()}
                rows={rows()}
                onChanged={refetchAssignments}
              />
            </div>
          </Show>
          <Show when={tab() === "wordlists"}>
            <div class={panelClass}>
              <WordListsTab
                wordLists={wordLists()}
                onChanged={refetchWordLists}
              />
            </div>
          </Show>
          <Show when={tab() === "passages"}>
            <div class={panelClass}>
              <PassagesTab passages={passages()} onChanged={refetchPassages} />
            </div>
          </Show>
          <Show when={tab() === "races"}>
            <div class={panelClass}>
              <div class="mb-6">
                <HallOfChampions
                  classId={selectedClass()}
                  champions={championsQuery.data ?? []}
                />
              </div>
              <RacesTab races={races()} loading={racesQuery.isPending} />
            </div>
          </Show>
          <Show when={tab() === "images"}>
            <div class={panelClass}>
              <SideImageApprovals />
            </div>
          </Show>
          <Show when={tab() === "announcements"}>
            <div class={panelClass}>
              <AnnouncementsTab
                announcements={announcements()}
                rows={rows()}
                onChanged={refetchAnnouncements}
              />
            </div>
          </Show>

          <details class="rounded bg-sub-alt p-3 text-sm">
            <summary class="cursor-pointer text-sub">
              <Fa icon="fa-tools" class="mr-2" />
              Admin tools
            </summary>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <Fa icon="fa-coins" class="text-sub" />
              <label class="text-sub" for="admin-self-coin-amount">
                Coins for my test account
              </label>
              <input
                id="admin-self-coin-amount"
                type="number"
                min="1"
                class={cn(selectClass, "w-20")}
                value={selfCoinAmount()}
                onChange={(e) =>
                  setSelfCoinAmount(
                    Math.max(1, Number(e.currentTarget.value) || 1),
                  )
                }
              />
              <Button
                text={rewardingSelf() ? "giving…" : "reward myself"}
                disabled={rewardingSelf()}
                onClick={() => void rewardSelf()}
              />
            </div>
          </details>
        </div>
      </Show>
    </Page>
  );
}

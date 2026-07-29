import { useQuery } from "@tanstack/solid-query";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  Show,
} from "solid-js";

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
  StudentProgressRow,
  updateAssignment,
  updateReadingPassage,
  updateWordList,
  WordList,
} from "../../../classroom/assignments";
import { buildProgressCsv } from "../../../classroom/progress-csv";
import {
  buildClassReportPdf,
  buildStudentReportPdf,
} from "../../../classroom/progress-pdf";
import { awardCoins } from "../../../coins";
import { CLASS_IDS, GRADES } from "../../../constants/classes";
import { lessonGroups } from "../../../lessons/lessons-data";
import { queryClient } from "../../../queries";
import { listHistoryForClass } from "../../../race/race-db";
import { RaceHistory } from "../../../race/race-types";
import { getUserId } from "../../../states/core";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { download } from "../../../utils/misc";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { H2 } from "../../common/Headers";
import { Page } from "../../common/Page";
import { SideImageApprovals } from "./SideImageApprovals";

const inputClass =
  "w-full rounded bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-sub";
const selectClass =
  "rounded bg-bg px-2 py-1 text-text outline-none focus:ring-2 focus:ring-sub";

type Tab =
  | "progress"
  | "assignments"
  | "wordlists"
  | "passages"
  | "races"
  | "images"
  | "announcements";

function formatDate(ts: number): string {
  if (ts <= 0) return "never";
  return new Date(ts).toLocaleDateString();
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

  const dateRange = (): { start: number; end: number } => ({
    start: new Date(rangeStart()).getTime(),
    end: new Date(rangeEnd()).getTime() + 24 * 60 * 60 * 1000 - 1,
  });

  const downloadStudentPdf = async (row: StudentProgressRow): Promise<void> => {
    if (downloadingUid() !== null) return;
    setDownloadingUid(row.uid);
    try {
      const range = dateRange();
      const [activity, lessonDetails] = await Promise.all([
        getStudentActivity(row.uid, range.start, range.end),
        getStudentLessonDetails(row.uid),
      ]);
      const doc = buildStudentReportPdf({
        classId: props.classId,
        row,
        activity,
        lessonDetails,
        assignments: props.assignments,
        range,
      });
      doc.save(`progress-${props.classId}-${row.name}.pdf`);
    } catch (e) {
      showErrorNotification("Failed to build PDF report");
      console.error(e);
    } finally {
      setDownloadingUid(null);
    }
  };

  const downloadAllPdf = async (): Promise<void> => {
    if (downloadingAll() || props.rows.length === 0) return;
    setDownloadingAll(true);
    try {
      const range = dateRange();
      const uids = props.rows.map((r) => r.uid);
      const [activity, lessonDetailsEntries] = await Promise.all([
        getClassActivity(uids, range.start, range.end),
        Promise.all(
          uids.map(
            async (uid) => [uid, await getStudentLessonDetails(uid)] as const,
          ),
        ),
      ]);
      const doc = buildClassReportPdf({
        classId: props.classId,
        rows: props.rows,
        activityByUid: activity,
        lessonDetailsByUid: Object.fromEntries(lessonDetailsEntries),
        assignments: props.assignments,
        range,
      });
      doc.save(`progress-${props.classId}.pdf`);
    } catch (e) {
      showErrorNotification("Failed to build PDF reports");
      console.error(e);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <Show
      when={!props.loading}
      fallback={<div class="text-sub">loading progress...</div>}
    >
      <div class="mb-3 flex flex-wrap items-center justify-end gap-3">
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
        </div>
        <Button
          text={downloadingAll() ? "building…" : "download all (pdf)"}
          fa={{ icon: "fa-file-pdf" }}
          onClick={() => void downloadAllPdf()}
          disabled={props.rows.length === 0 || downloadingAll()}
        />
        <Button
          text="export csv"
          fa={{ icon: "fa-file-csv" }}
          onClick={exportCsv}
          disabled={props.rows.length === 0}
        />
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-sub">
            <tr>
              <th class="p-2">name</th>
              <th class="p-2 text-right">best wpm</th>
              <th class="p-2 text-right">acc</th>
              <th class="p-2 text-right">xp</th>
              <th class="p-2 text-right">lessons</th>
              <th class="p-2 text-right">tries</th>
              <th class="p-2 text-right">lesson acc</th>
              <th class="p-2 text-right">on task</th>
              <th class="p-2 text-right">assignments</th>
              <th class="p-2 text-right">last active</th>
              <th class="p-2"></th>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row) => (
                <>
                  <tr
                    class="cursor-pointer border-t border-sub-alt hover:bg-sub-alt"
                    onClick={() => toggleOpen(row.uid)}
                  >
                    <td class="p-2 text-text">
                      <span class="flex items-center gap-2">
                        <Fa
                          icon={
                            openUid() === row.uid
                              ? "fa-chevron-down"
                              : "fa-chevron-right"
                          }
                          size={0.75}
                        />
                        {row.name}
                      </span>
                    </td>
                    <td class="p-2 text-right">{Math.round(row.bestWpm)}</td>
                    <td class="p-2 text-right">{Math.round(row.bestAcc)}%</td>
                    <td class="p-2 text-right">{row.xp}</td>
                    <td class="p-2 text-right">{row.lessonsCompleted}</td>
                    <td class="p-2 text-right">{row.lessonAttempts}</td>
                    <td class="p-2 text-right">
                      {row.lessonAvgAcc > 0
                        ? `${Math.round(row.lessonAvgAcc)}%`
                        : "-"}
                    </td>
                    <td class="p-2 text-right">
                      {formatMinutes(row.lessonTime)}
                    </td>
                    <td class="p-2 text-right">
                      {assignmentsDone(row)}/{assignmentTotal(row)}
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
                      {formatDate(row.lastActive)}
                    </td>
                    <td class="p-2 text-right whitespace-nowrap">
                      <Button
                        variant="text"
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
                      <td colSpan="11" class="bg-bg p-3">
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
        <Show when={props.rows.length === 0}>
          <div class="p-2 text-sub">no students in this class yet</div>
        </Show>
      </div>
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
        <Show
          when={!details.loading}
          fallback={<div class="text-sub">loading...</div>}
        >
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-sub">
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
              <thead class="text-sub">
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
              <thead class="text-sub">
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
      <div class="grid gap-2 rounded bg-bg p-3">
        <input
          type="text"
          class={inputClass}
          placeholder="assignment title..."
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
        <div class="flex flex-wrap items-center gap-2">
          <select
            class={selectClass}
            value={scope()}
            onChange={(e) => setScope(e.currentTarget.value as AssignmentScope)}
          >
            <option value="class">a class</option>
            <option value="grade">a grade</option>
            <option value="school">whole school</option>
            <option value="student">one student</option>
          </select>
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
          <input
            type="date"
            class={selectClass}
            value={due()}
            onInput={(e) => setDue(e.currentTarget.value)}
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
          each={props.assignments}
          fallback={<div class="text-sub">no assignments yet</div>}
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
                        onClick={() => startEdit(a)}
                      />
                      <Button
                        variant="text"
                        fa={{ icon: "fa-trash" }}
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
      <div class="grid gap-2 rounded bg-bg p-3">
        <input
          type="text"
          class={inputClass}
          placeholder="announcement title..."
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
        <textarea
          class={inputClass}
          placeholder="message..."
          rows={3}
          value={message()}
          onInput={(e) => setMessage(e.currentTarget.value)}
        ></textarea>
        <div class="flex flex-wrap items-center gap-2">
          <select
            class={selectClass}
            value={scope()}
            onChange={(e) => setScope(e.currentTarget.value as AssignmentScope)}
          >
            <option value="class">a class</option>
            <option value="grade">a grade</option>
            <option value="school">whole school</option>
            <option value="student">one student</option>
          </select>
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
          <Button
            text={busy() ? "sending..." : "send"}
            fa={{ icon: "fa-bullhorn" }}
            onClick={() => void submit()}
            disabled={busy()}
          />
        </div>
      </div>

      <div class="grid gap-2">
        <For
          each={props.announcements}
          fallback={<div class="text-sub">no announcements yet</div>}
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
          fallback={<div class="text-sub">no word lists yet</div>}
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
          fallback={<div class="text-sub">no passages yet</div>}
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
    <Show
      when={!props.loading}
      fallback={<div class="text-sub">loading races...</div>}
    >
      <div class="grid gap-2">
        <For
          each={props.races}
          fallback={
            <div class="text-sub">no races recorded for this class yet</div>
          }
        >
          {(r) => (
            <details class="rounded bg-sub-alt p-3">
              <summary class="cursor-pointer text-text">
                {r.contentLabel} ·{" "}
                {r.format === "timed"
                  ? `${r.durationSec}s sprint`
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
  const [tab, setTab] = createSignal<Tab>("progress");

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

  const progressQuery = useQuery(() => ({
    queryKey: ["classroom", "progress", selectedClass()],
    queryFn: async () => getClassProgress(selectedClass()),
    enabled: isCurrentUserAdmin(),
  }));

  const assignmentsQuery = useQuery(() => ({
    queryKey: ["classroom", "assignments"],
    queryFn: listAssignments,
    enabled: isCurrentUserAdmin(),
  }));

  const wordListsQuery = useQuery(() => ({
    queryKey: ["classroom", "wordlists"],
    queryFn: listWordLists,
    enabled: isCurrentUserAdmin(),
  }));

  const passagesQuery = useQuery(() => ({
    queryKey: ["classroom", "passages"],
    queryFn: listReadingPassages,
    enabled: isCurrentUserAdmin(),
  }));

  const racesQuery = useQuery(() => ({
    queryKey: ["classroom", "races", selectedClass()],
    queryFn: async () => listHistoryForClass(selectedClass()),
    enabled: isCurrentUserAdmin(),
  }));

  const announcementsQuery = useQuery(() => ({
    queryKey: ["classroom", "announcements"],
    queryFn: listAnnouncements,
    enabled: isCurrentUserAdmin(),
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

  const tabButton = (id: Tab, text: string): JSXElement => (
    <Button
      variant="text"
      text={text}
      active={tab() === id}
      onClick={() => setTab(id)}
    />
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
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-1.5 text-sm text-sub">
                <Fa icon="fa-coins" />
                <input
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
              <select
                class={selectClass}
                value={selectedClass()}
                onChange={(e) => setSelectedClass(e.currentTarget.value)}
              >
                <For each={CLASS_IDS}>
                  {(c) => <option value={c}>{c}</option>}
                </For>
              </select>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 border-b border-sub-alt pb-2">
            {tabButton("progress", "progress")}
            {tabButton("assignments", "assignments")}
            {tabButton("wordlists", "word lists")}
            {tabButton("passages", "passages")}
            {tabButton("races", "races")}
            {tabButton("images", "side images")}
            {tabButton("announcements", "announcements")}
          </div>

          <Show when={tab() === "progress"}>
            <ProgressTab
              classId={selectedClass()}
              rows={rows()}
              assignments={assignments()}
              wordLists={wordLists()}
              passages={passages()}
              loading={progressQuery.isLoading}
            />
          </Show>
          <Show when={tab() === "assignments"}>
            <AssignmentsTab
              assignments={assignments()}
              wordLists={wordLists()}
              passages={passages()}
              rows={rows()}
              onChanged={refetchAssignments}
            />
          </Show>
          <Show when={tab() === "wordlists"}>
            <WordListsTab
              wordLists={wordLists()}
              onChanged={refetchWordLists}
            />
          </Show>
          <Show when={tab() === "passages"}>
            <PassagesTab passages={passages()} onChanged={refetchPassages} />
          </Show>
          <Show when={tab() === "races"}>
            <RacesTab races={races()} loading={racesQuery.isLoading} />
          </Show>
          <Show when={tab() === "images"}>
            <SideImageApprovals />
          </Show>
          <Show when={tab() === "announcements"}>
            <AnnouncementsTab
              announcements={announcements()}
              rows={rows()}
              onChanged={refetchAnnouncements}
            />
          </Show>
        </div>
      </Show>
    </Page>
  );
}

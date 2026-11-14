import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, JSXElement, Show } from "solid-js";

import {
  formatMinutes,
  getClassActivity,
  weekTotalsOf,
} from "../../../classroom/activity";
import { StudentProgressRow } from "../../../classroom/assignments";
import {
  getClassGoals,
  goalCurrent,
  goalKind,
} from "../../../classroom/class-goals";
import {
  buildWeekReport,
  lastSeenText,
  WeekStudent,
} from "../../../classroom/week-report";
import { buildWeeklySummary } from "../../../classroom/weekly-summary";
import {
  EARN_LESSONS_DEFAULT,
  getGameAccess,
} from "../../../games/game-access";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { ClassGoalBar } from "../../common/ClassGoalBar";
import { Fa } from "../../common/Fa";

function chip(active: boolean): string {
  return cn(
    "min-h-9 cursor-pointer rounded-full px-3 py-1 text-sm",
    active ? "bg-main text-bg" : "bg-bg text-sub hover:text-text",
  );
}

/** "+12", "-3", "same" vs last week */
function Change(props: {
  now: number;
  prev: number;
  unit?: string;
}): JSXElement {
  const diff = (): number => props.now - props.prev;
  return (
    <span
      class={cn(
        "text-xs",
        diff() > 0 ? "text-main" : diff() < 0 ? "text-error" : "text-sub",
      )}
    >
      <Show when={diff() !== 0} fallback="same as last week">
        <Fa icon={diff() > 0 ? "fa-arrow-up" : "fa-arrow-down"} class="mr-1" />
        {Math.abs(diff())}
        {props.unit ?? ""} vs last week
      </Show>
    </span>
  );
}

/**
 * Teacher's weekly class summary: who practised, who hasn't, who's stuck,
 * who's doing more than last week. Reads one user doc per student (shared
 * with the Lessons vs games tab) plus the progress scan already cached for
 * Student progress - both 5 minutes.
 */
export function WeekTab(props: {
  classId: string;
  rows: StudentProgressRow[];
  rowsLoading: boolean;
}): JSXElement {
  const activityQuery = useQuery(() => ({
    queryKey: ["classroom", "activity", props.classId],
    queryFn: async () => getClassActivity(props.classId),
    staleTime: 5 * 60 * 1000,
  }));
  const goalsQuery = useQuery(() => ({
    queryKey: ["classroom", "progress", "classGoals"],
    queryFn: getClassGoals,
    staleTime: 1000 * 60 * 30,
  }));
  const accessQuery = useQuery(() => ({
    queryKey: ["gameAccess"],
    queryFn: getGameAccess,
    staleTime: 5 * 60 * 1000,
  }));

  const [weeksBefore, setWeeksBefore] = createSignal<0 | 1>(0);

  const report = createMemo(() => {
    const byUid = new Map(props.rows.map((r) => [r.uid, r]));
    return buildWeekReport(
      (activityQuery.data ?? []).map((s) => {
        const row = byUid.get(s.uid);
        return {
          uid: s.uid,
          name: s.name,
          activity: s.activity,
          lastActive: row?.lastActive,
          stuckLessons: row?.stuckLessons,
        };
      }),
      { weeksBefore: weeksBefore() },
    );
  });

  const goal = createMemo(() => {
    const g = goalsQuery.data?.[props.classId];
    if (g === undefined) return undefined;
    const counts = { totalStars: 0, weekLessons: 0, weekTypingSec: 0 };
    for (const s of activityQuery.data ?? []) {
      const w = weekTotalsOf(s.activity);
      counts.weekLessons += w.weekLessons;
      counts.weekTypingSec += w.weekTypingSec;
    }
    counts.totalStars = props.rows.reduce((n, r) => n + r.lessonStars, 0);
    return { ...g, kind: goalKind(g), current: goalCurrent(g, counts) };
  });

  // ClassDojo post (moved here from Lessons vs games)
  const [postOpen, setPostOpen] = createSignal(false);
  const post = createMemo(() => {
    const policy = accessQuery.data?.classes[props.classId];
    return buildWeeklySummary(props.classId, activityQuery.data ?? [], {
      ...(policy?.mode === "earn"
        ? { earnLessons: policy.earnLessons ?? EARN_LESSONS_DEFAULT }
        : {}),
    });
  });
  const [postBox, setPostBox] = createSignal<HTMLTextAreaElement>();
  const copyPost = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(postBox()?.value ?? post());
      showSuccessNotification("Copied - paste it into ClassDojo");
    } catch (error) {
      showErrorNotification("Could not copy - select the text and copy it", {
        error,
      });
    }
  };

  const r = report;
  const count = (): number => r().students.length;

  return (
    <section class="grid gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="text-xl text-text">{props.classId} this week</h3>
          <p class="mt-1 text-sm text-sub">
            Weeks run Monday to Sunday (Japan time). &ldquo;Practised&rdquo; =
            1+ minute of typing or a ⭐⭐ lesson. Updates every 5 minutes.
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class={chip(weeksBefore() === 0)}
            onClick={() => setWeeksBefore(0)}
          >
            This week
          </button>
          <button
            type="button"
            class={chip(weeksBefore() === 1)}
            onClick={() => setWeeksBefore(1)}
          >
            Last week
          </button>
        </div>
      </div>

      <Show
        when={!activityQuery.isPending}
        fallback={<div class="text-sub">Loading this week…</div>}
      >
        <Show
          when={count() > 0}
          fallback={<div class="text-sub">No students in this class yet.</div>}
        >
          {/* headline numbers */}
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-xl bg-bg p-4">
              <div class="text-3xl font-bold text-text">
                {r().practiced.length}
                <span class="text-lg text-sub"> / {count()}</span>
              </div>
              <div class="text-sm text-sub">students practised</div>
              <Show when={r().prevTotals} keyed>
                {(p) => (
                  <Change now={r().practiced.length} prev={p.practiced} />
                )}
              </Show>
            </div>
            <div class="rounded-xl bg-bg p-4">
              <div class="text-3xl font-bold text-text">
                {r().totals.lessonsPassed}
              </div>
              <div class="text-sm text-sub">⭐⭐ lessons passed</div>
              <Show when={r().prevTotals} keyed>
                {(p) => (
                  <Change
                    now={r().totals.lessonsPassed}
                    prev={p.lessonsPassed}
                  />
                )}
              </Show>
            </div>
            <div class="rounded-xl bg-bg p-4">
              <div class="text-3xl font-bold text-text">
                {formatMinutes(r().totals.typingSec)}
              </div>
              <div class="text-sm text-sub">of typing</div>
              <Show when={r().prevTotals} keyed>
                {(p) => (
                  <Change
                    now={Math.round(r().totals.typingSec / 60)}
                    prev={Math.round(p.typingSec / 60)}
                    unit="m"
                  />
                )}
              </Show>
            </div>
          </div>

          <Show when={weeksBefore() === 0 && goal()} keyed>
            {(g) => (
              <ClassGoalBar
                class="bg-bg"
                classId={props.classId}
                kind={g.kind}
                current={g.current}
                goal={g.stars}
                reward={g.reward}
              />
            )}
          </Show>

          {/* who needs a nudge / a high five */}
          <div class="grid gap-3 md:grid-cols-3">
            <ListCard
              icon={<Fa icon="fa-moon" class="mr-1.5 text-sub" />}
              title={`Not practised yet (${r().notYet.length})`}
              empty="Everyone practised! 🎉"
              students={r().notYet}
              detail={(s) =>
                s.lastActive === undefined
                  ? ""
                  : `seen ${lastSeenText(s.lastActive)}`
              }
            />
            <ListCard
              icon={<Fa icon="fa-life-ring" class="mr-1.5 text-error" />}
              title={`Stuck on a lesson (${r().stuck.length})`}
              empty={
                props.rowsLoading ? "Checking lessons…" : "Nobody is stuck"
              }
              students={r().stuck}
              detail={(s) =>
                s.stuckLessons
                  .map((l) => `${l.name} (${l.attempts} tries)`)
                  .join(", ")
              }
            />
            <ListCard
              icon={<Fa icon="fa-chart-line" class="mr-1.5 text-main" />}
              title={
                weeksBefore() === 0
                  ? `Doing more than last week (${r().improving.length})`
                  : "Most lessons"
              }
              empty={
                weeksBefore() === 0
                  ? "Nobody yet - check again later in the week"
                  : "No lessons last week"
              }
              students={
                weeksBefore() === 0 ? r().improving : r().practiced.slice(0, 5)
              }
              detail={(s) =>
                weeksBefore() === 0
                  ? `${formatMinutes(s.prevTypingSec ?? 0)} → ${formatMinutes(s.typingSec)}`
                  : `${s.lessonsPassed} lessons`
              }
            />
          </div>

          {/* everyone, day by day */}
          <div class="overflow-x-auto rounded-xl bg-bg p-3">
            <table class="w-full min-w-xl text-sm">
              <thead>
                <tr class="text-left text-xs text-sub">
                  <th class="py-1 pr-2 font-semibold">Student</th>
                  <For each={r().days}>
                    {(d) => (
                      <th class="w-9 py-1 text-center font-semibold">
                        {d.label}
                      </th>
                    )}
                  </For>
                  <th class="py-1 pl-3 text-right font-semibold">
                    ⭐⭐ lessons
                  </th>
                  <th class="py-1 pl-3 text-right font-semibold">Typing</th>
                  <th class="py-1 pl-3 text-right font-semibold">Games</th>
                </tr>
              </thead>
              <tbody>
                <For each={r().students}>
                  {(s) => (
                    <tr class="border-t border-sub-alt">
                      <td class="py-1.5 pr-2 text-text">
                        <span class="flex items-center gap-1.5">
                          <span class="truncate">{s.name}</span>
                          <Show when={s.improving}>
                            <span title="Doing more than last week">
                              <Fa icon="fa-arrow-up" class="text-main" />
                            </span>
                          </Show>
                          <Show when={s.stuckLessons.length > 0}>
                            <span title="Stuck on a lesson">
                              <Fa icon="fa-life-ring" class="text-error" />
                            </span>
                          </Show>
                        </span>
                      </td>
                      <For each={r().days}>
                        {(d, i) => (
                          <td class="py-1.5 text-center">
                            <span
                              class={cn(
                                "inline-block size-4 rounded-full",
                                d.future
                                  ? "bg-transparent"
                                  : s.practiced[i()] === true
                                    ? "bg-main"
                                    : "bg-sub/30",
                              )}
                              title={
                                d.future
                                  ? ""
                                  : s.practiced[i()] === true
                                    ? `${d.label}: practised`
                                    : `${d.label}: no practice`
                              }
                            ></span>
                          </td>
                        )}
                      </For>
                      <td class="py-1.5 pl-3 text-right text-text">
                        {s.lessonsPassed}
                      </td>
                      <td class="py-1.5 pl-3 text-right text-text">
                        {formatMinutes(s.typingSec)}
                      </td>
                      <td
                        class={cn(
                          "py-1.5 pl-3 text-right",
                          s.gameSec > s.typingSec && s.gameSec >= 600
                            ? "font-bold text-error"
                            : "text-sub",
                        )}
                      >
                        {formatMinutes(s.gameSec)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* weekly post for parents / students */}
          <div class="grid gap-3 rounded-xl bg-bg p-4">
            <div class="flex flex-wrap items-center gap-2">
              <span class="mr-1 font-semibold text-text">
                📋 Weekly post for ClassDojo
              </span>
              <button
                type="button"
                class={chip(postOpen())}
                onClick={() => setPostOpen((v) => !v)}
              >
                {postOpen() ? "Hide" : "Make this week's post"}
              </button>
            </div>
            <Show when={postOpen()}>
              <p class="text-sm text-sub">
                Last 7 days, first names only. Edit it if you like, then copy
                and paste it into ClassDojo.
              </p>
              <textarea
                ref={setPostBox}
                class="min-h-64 w-full rounded bg-sub-alt p-3 font-sans text-sm text-text outline-none focus:ring-2 focus:ring-sub"
                value={post()}
              ></textarea>
              <div>
                <button
                  type="button"
                  class={chip(true)}
                  onClick={() => void copyPost()}
                >
                  <Fa icon="fa-copy" /> Copy
                </button>
              </div>
            </Show>
          </div>
        </Show>
      </Show>
    </section>
  );
}

function ListCard(props: {
  icon: JSXElement;
  title: string;
  empty: string;
  students: WeekStudent[];
  detail: (s: WeekStudent) => string;
}): JSXElement {
  return (
    <div class="min-w-0 rounded-xl bg-bg p-3">
      <div class="mb-2 text-xs font-semibold tracking-wide text-sub uppercase">
        {props.icon}
        {props.title}
      </div>
      <Show
        when={props.students.length > 0}
        fallback={<div class="text-sm text-sub">{props.empty}</div>}
      >
        <div class="grid max-h-64 gap-1 overflow-y-auto">
          <For each={props.students}>
            {(s) => (
              <div class="flex flex-wrap justify-between gap-x-2 text-sm">
                <span class="truncate text-text">{s.name}</span>
                <span class="text-sub">{props.detail(s)}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

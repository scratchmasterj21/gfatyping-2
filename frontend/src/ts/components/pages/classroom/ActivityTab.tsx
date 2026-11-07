import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, JSXElement, Show } from "solid-js";

import {
  formatMinutes,
  getClassActivity,
  isMostlyGames,
  StudentActivity,
  summarizeActivity,
} from "../../../classroom/activity";
import { buildWeeklySummary } from "../../../classroom/weekly-summary";
import {
  checkGameAccess,
  EARN_LESSONS_DEFAULT,
  EARN_LESSONS_MAX,
  GameAccessDoc,
  GameMode,
  GamePolicy,
  getGameAccess,
  giveBonusGameTime,
  resolvePolicy,
  setClassGamePolicy,
  StudentPolicy,
  updateStudentGamePolicy,
} from "../../../games/game-access";
import { games } from "../../../games/games-data";
import { queryClient } from "../../../queries";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";

const FREE_PLAY = games.filter((g) => g.type === "builtin");
const ACCESS_KEY = ["gameAccess"];

const MODE_LABEL: Record<GameMode, string> = {
  on: "Games on",
  off: "Games off",
  earn: "Earn with lessons",
};

function chip(active: boolean): string {
  return cn(
    "min-h-9 cursor-pointer rounded-full px-3 py-1 text-sm",
    active ? "bg-main text-bg" : "bg-bg text-sub hover:text-text",
  );
}

/**
 * Teacher view: are students doing lessons or mostly playing games? Plus
 * class and per-student game controls (off / earn with lessons / blocked
 * games / bonus game time). Reads: one user doc per student + one shared
 * settings doc, both cached 5 minutes.
 */
export function ActivityTab(props: { classId: string }): JSXElement {
  const activityQuery = useQuery(() => ({
    queryKey: ["classroom", "activity", props.classId],
    queryFn: async () => getClassActivity(props.classId),
    staleTime: 5 * 60 * 1000,
  }));
  const accessQuery = useQuery(() => ({
    queryKey: ACCESS_KEY,
    queryFn: getGameAccess,
    staleTime: 5 * 60 * 1000,
  }));
  const [saving, setSaving] = createSignal(false);

  const access = (): GameAccessDoc | undefined => accessQuery.data;
  const classPolicy = (): GamePolicy => access()?.classes[props.classId] ?? {};

  const save = async (
    work: () => Promise<void>,
    done?: string,
  ): Promise<void> => {
    if (saving()) return;
    setSaving(true);
    try {
      await work();
      await queryClient.invalidateQueries({ queryKey: ACCESS_KEY });
      if (done !== undefined) showSuccessNotification(done);
    } catch (e) {
      showErrorNotification("Could not save game settings", { error: e });
    } finally {
      setSaving(false);
    }
  };

  const setClassPolicy = (patch: GamePolicy): void => {
    const merged: GamePolicy = { ...classPolicy(), ...patch };
    // keep only non-default values so "on + nothing blocked" clears the entry
    // (Firestore also rejects undefined fields)
    const next: GamePolicy = {};
    if (merged.mode === "off" || merged.mode === "earn") {
      next.mode = merged.mode;
    }
    if (merged.mode === "earn") {
      next.earnLessons = merged.earnLessons ?? EARN_LESSONS_DEFAULT;
    }
    if (merged.blocked !== undefined && merged.blocked.length > 0) {
      next.blocked = merged.blocked;
    }
    const classId = props.classId;
    void save(async () =>
      setClassGamePolicy(classId, Object.keys(next).length === 0 ? null : next),
    );
  };

  const toggleClassBlocked = (gameId: string): void => {
    const cur = classPolicy().blocked ?? [];
    setClassPolicy({
      blocked: cur.includes(gameId)
        ? cur.filter((g) => g !== gameId)
        : [...cur, gameId],
    });
  };

  const rows = createMemo(() =>
    (activityQuery.data ?? []).map((s) => {
      const week = summarizeActivity(s.activity, 7);
      return {
        student: s,
        today: summarizeActivity(s.activity, 1),
        week,
        flagged: isMostlyGames(week),
      };
    }),
  );
  const flaggedCount = (): number => rows().filter((r) => r.flagged).length;
  const [flaggedOnly, setFlaggedOnly] = createSignal(false);
  const shown = createMemo(() =>
    [...rows()]
      .filter((r) => !flaggedOnly() || r.flagged)
      .sort((a, b) => Number(b.flagged) - Number(a.flagged)),
  );

  const [summaryOpen, setSummaryOpen] = createSignal(false);
  const summary = createMemo(() =>
    buildWeeklySummary(props.classId, activityQuery.data ?? [], {
      ...(classPolicy().mode === "earn"
        ? { earnLessons: classPolicy().earnLessons ?? EARN_LESSONS_DEFAULT }
        : {}),
    }),
  );
  // the teacher may edit the text before copying
  const [summaryBox, setSummaryBox] = createSignal<HTMLTextAreaElement>();
  const copySummary = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summaryBox()?.value ?? summary());
      showSuccessNotification("Copied - paste it into ClassDojo");
    } catch (error) {
      showErrorNotification("Could not copy - select the text and copy it", {
        error,
      });
    }
  };

  return (
    <section class="grid gap-4">
      <div>
        <h3 class="text-xl text-text">Lessons vs games</h3>
        <p class="mt-1 text-sm text-sub">
          Typing = lessons and practice tests. Games = free-play games from the
          Lessons page (lesson checkpoint games and your class races count as
          lessons). Counting started Nov 5, 2026. Updates every 5 minutes - use
          refresh for the latest.
        </p>
      </div>

      {/* weekly post for parents / students */}
      <div class="grid gap-3 rounded bg-bg p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-1 font-semibold text-text">
            📋 Weekly summary for ClassDojo
          </span>
          <button
            type="button"
            class={chip(summaryOpen())}
            disabled={activityQuery.isPending}
            onClick={() => setSummaryOpen((v) => !v)}
          >
            {summaryOpen() ? "Hide" : "Make this week's post"}
          </button>
        </div>
        <Show when={summaryOpen()}>
          <p class="text-sm text-sub">
            Last 7 days for {props.classId}, first names only. Edit it if you
            like, then copy and paste it into ClassDojo.
          </p>
          <textarea
            ref={setSummaryBox}
            class="min-h-64 w-full rounded bg-sub-alt p-3 font-sans text-sm text-text outline-none focus:ring-2 focus:ring-sub"
            value={summary()}
          ></textarea>
          <div>
            <button
              type="button"
              class={chip(true)}
              onClick={() => void copySummary()}
            >
              <Fa icon="fa-copy" /> Copy
            </button>
          </div>
        </Show>
      </div>

      {/* class controls */}
      <div class="grid gap-3 rounded bg-bg p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-1 font-semibold text-text">
            {props.classId} games
          </span>
          <For each={["on", "off", "earn"] as const}>
            {(mode) => (
              <button
                type="button"
                class={chip((classPolicy().mode ?? "on") === mode)}
                disabled={saving() || accessQuery.isPending}
                onClick={() =>
                  setClassPolicy({
                    mode,
                    earnLessons:
                      mode === "earn"
                        ? (classPolicy().earnLessons ?? EARN_LESSONS_DEFAULT)
                        : undefined,
                  })
                }
              >
                {MODE_LABEL[mode]}
              </button>
            )}
          </For>
        </div>
        <Show when={classPolicy().mode === "earn"}>
          <EarnStepper
            value={classPolicy().earnLessons ?? EARN_LESSONS_DEFAULT}
            disabled={saving()}
            onChange={(n) => setClassPolicy({ earnLessons: n })}
          />
        </Show>
        <div>
          <div class="mb-2 text-sm text-sub">
            Turn off single games for the whole class (tap to block):
          </div>
          <GameChips
            blocked={classPolicy().blocked ?? []}
            disabled={saving()}
            onToggle={toggleClassBlocked}
          />
        </div>
      </div>

      {/* students */}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class={chip(!flaggedOnly())}
          onClick={() => setFlaggedOnly(false)}
        >
          All {rows().length}
        </button>
        <button
          type="button"
          class={chip(flaggedOnly())}
          onClick={() => setFlaggedOnly(true)}
        >
          Mostly games {flaggedCount()}
        </button>
      </div>

      <Show
        when={!activityQuery.isPending}
        fallback={<div class="text-sub">Loading activity…</div>}
      >
        <Show
          when={shown().length > 0}
          fallback={
            <div class="text-sub">
              {flaggedOnly()
                ? "Nobody is mostly playing games."
                : "No students in this class yet."}
            </div>
          }
        >
          <div class="grid gap-2">
            <For each={shown()}>
              {(row) => (
                <StudentRow
                  student={row.student}
                  today={row.today}
                  week={row.week}
                  flagged={row.flagged}
                  classId={props.classId}
                  access={access()}
                  saving={saving()}
                  save={save}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  );
}

function EarnStepper(props: {
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
}): JSXElement {
  const stepBtn =
    "grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-sub-alt text-text hover:bg-text hover:text-bg disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div class="flex items-center gap-2 text-sm text-sub">
      Pass
      <button
        type="button"
        class={stepBtn}
        aria-label="Fewer lessons"
        disabled={props.disabled || props.value <= 1}
        onClick={() => props.onChange(props.value - 1)}
      >
        <Fa icon="fa-minus" />
      </button>
      <span class="w-6 text-center text-lg font-bold text-text">
        {props.value}
      </span>
      <button
        type="button"
        class={stepBtn}
        aria-label="More lessons"
        disabled={props.disabled || props.value >= EARN_LESSONS_MAX}
        onClick={() => props.onChange(props.value + 1)}
      >
        <Fa icon="fa-plus" />
      </button>
      different lessons with ⭐⭐ (2+ stars on that try) each day to unlock
      games. Retries of old lessons count.
    </div>
  );
}

function GameChips(props: {
  blocked: string[];
  disabled: boolean;
  onToggle: (gameId: string) => void;
}): JSXElement {
  return (
    <div class="flex flex-wrap gap-2">
      <For each={FREE_PLAY}>
        {(game) => {
          const isBlocked = (): boolean => props.blocked.includes(game.id);
          return (
            <button
              type="button"
              class={cn(
                "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm",
                isBlocked()
                  ? "bg-error text-bg"
                  : "bg-sub-alt text-text hover:bg-text hover:text-bg",
              )}
              aria-pressed={isBlocked()}
              disabled={props.disabled}
              onClick={() => props.onToggle(game.id)}
            >
              <Fa icon={isBlocked() ? "fa-ban" : game.icon} />
              {game.name}
            </button>
          );
        }}
      </For>
    </div>
  );
}

function StudentRow(props: {
  student: StudentActivity;
  today: ReturnType<typeof summarizeActivity>;
  week: ReturnType<typeof summarizeActivity>;
  flagged: boolean;
  classId: string;
  access: GameAccessDoc | undefined;
  saving: boolean;
  save: (work: () => Promise<void>, done?: string) => Promise<void>;
}): JSXElement {
  const [open, setOpen] = createSignal(false);
  const uid = (): string => props.student.uid;
  const own = (): StudentPolicy => props.access?.students[uid()] ?? {};
  const policy = createMemo(() =>
    resolvePolicy(props.access, props.classId, uid()),
  );
  const status = createMemo(() =>
    checkGameAccess(undefined, policy(), {
      lessonsPassed: props.today.lessonsPassed,
      gameSec: props.today.gameSec,
    }),
  );
  const statusText = (): string => {
    const s = status();
    if (s.allowed) {
      return s.bonusLeftMin !== undefined
        ? `🎁 Bonus: ${s.bonusLeftMin}m left`
        : "Can play";
    }
    if (s.reason === "earn") {
      return `Locked: ${props.today.lessonsPassed}/${policy().earnLessons} ⭐⭐ lessons`;
    }
    return "Games off";
  };
  const weekTotal = (): number =>
    Math.max(1, props.week.typingSec + props.week.gameSec);

  const setMode = (value: string): void => {
    const id = uid();
    const earn = own().earnLessons ?? policy().earnLessons;
    const mode =
      value === "on" || value === "off" || value === "earn" ? value : undefined;
    void props.save(async () =>
      updateStudentGamePolicy(id, {
        mode: mode ?? null,
        earnLessons: mode === "earn" ? earn : null,
      }),
    );
  };

  const toggleBlocked = (gameId: string): void => {
    const cur = policy().blocked;
    const next = cur.includes(gameId)
      ? cur.filter((g) => g !== gameId)
      : [...cur, gameId];
    const id = uid();
    void props.save(async () => updateStudentGamePolicy(id, { blocked: next }));
  };

  const giveBonus = (minutes: number): void => {
    const id = uid();
    const current = own();
    void props.save(
      async () => giveBonusGameTime(id, current, minutes),
      `Gave ${props.student.name} ${minutes} min of game time today`,
    );
  };

  return (
    <div
      class={cn(
        "grid gap-2 rounded bg-bg p-3",
        props.flagged && "ring-2 ring-error",
      )}
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex min-w-40 flex-1 items-center gap-2">
          <span class="truncate font-semibold text-text">
            {props.student.name}
          </span>
          <Show when={props.flagged}>
            <span class="shrink-0 rounded-full bg-error px-2 py-0.5 text-xs font-bold text-bg">
              Mostly games
            </span>
          </Show>
        </div>

        <div class="grid min-w-52 gap-1 text-sm">
          <div class="text-sub">
            Today:{" "}
            <span class="text-text">
              ⌨️ {formatMinutes(props.today.typingSec)}
            </span>{" "}
            ·{" "}
            <span class="text-text">
              🎮 {formatMinutes(props.today.gameSec)}
            </span>{" "}
            · {props.today.lessonsPassed} ⭐⭐ lessons
          </div>
          <div class="flex items-center gap-2 text-sub">
            7 days:
            <div
              class="flex h-2.5 w-28 overflow-hidden rounded-full bg-sub-alt"
              title="typing vs games"
            >
              <div
                class="h-full bg-main"
                style={{
                  width: `${(props.week.typingSec / weekTotal()) * 100}%`,
                }}
              ></div>
              <div
                class="h-full bg-error"
                style={{
                  width: `${(props.week.gameSec / weekTotal()) * 100}%`,
                }}
              ></div>
            </div>
            <span class="text-text">
              ⌨️ {formatMinutes(props.week.typingSec)} · 🎮{" "}
              {formatMinutes(props.week.gameSec)}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span
            class={cn(
              "rounded-full px-2 py-0.5",
              status().allowed ? "bg-sub-alt text-text" : "bg-sub-alt text-sub",
            )}
          >
            {statusText()}
          </span>
          <select
            class="min-h-9 rounded bg-sub-alt px-2 text-text"
            aria-label={`Game access for ${props.student.name}`}
            value={own().mode ?? "class"}
            disabled={props.saving}
            onChange={(e) => setMode(e.currentTarget.value)}
          >
            <option value="class">Class setting</option>
            <option value="on">Games on</option>
            <option value="off">Games off</option>
            <option value="earn">Earn with lessons</option>
          </select>
          <button
            type="button"
            class={chip(false)}
            disabled={props.saving}
            onClick={() => giveBonus(15)}
          >
            🎁 +15 min
          </button>
          <button
            type="button"
            class={chip(false)}
            disabled={props.saving}
            onClick={() => giveBonus(30)}
          >
            🎁 +30 min
          </button>
          <button
            type="button"
            class={chip(open())}
            aria-expanded={open()}
            onClick={() => setOpen((o) => !o)}
          >
            <Fa icon="fa-sliders-h" /> More
          </button>
        </div>
      </div>

      <Show when={open()}>
        <div class="grid gap-3 border-t border-sub-alt pt-3">
          <Show when={own().mode === "earn"}>
            <EarnStepper
              value={own().earnLessons ?? policy().earnLessons}
              disabled={props.saving}
              onChange={(n) => {
                const id = uid();
                void props.save(async () =>
                  updateStudentGamePolicy(id, { earnLessons: n }),
                );
              }}
            />
          </Show>
          <div>
            <div class="mb-2 flex flex-wrap items-center gap-2 text-sm text-sub">
              Blocked games for {props.student.name}
              {own().blocked === undefined ? " (using class list)" : ""}:
              <Show when={own().blocked !== undefined}>
                <button
                  type="button"
                  class="cursor-pointer text-main underline"
                  disabled={props.saving}
                  onClick={() => {
                    const id = uid();
                    void props.save(async () =>
                      updateStudentGamePolicy(id, { blocked: null }),
                    );
                  }}
                >
                  use class list
                </button>
              </Show>
            </div>
            <GameChips
              blocked={policy().blocked}
              disabled={props.saving}
              onToggle={toggleBlocked}
            />
          </div>
          <Show when={policy().bonusMinutes > 0}>
            <div class="flex items-center gap-2 text-sm text-sub">
              🎁 {policy().bonusMinutes} min of bonus game time today
              <button
                type="button"
                class="cursor-pointer text-main underline"
                disabled={props.saving}
                onClick={() => {
                  const id = uid();
                  void props.save(async () =>
                    updateStudentGamePolicy(id, {
                      bonusDate: null,
                      bonusMinutes: null,
                    }),
                  );
                }}
              >
                remove
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

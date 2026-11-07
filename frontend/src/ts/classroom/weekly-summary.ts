import {
  ActivityDays,
  formatMinutes,
  summarizeActivity,
  tokyoDate,
} from "./activity";

/**
 * A friendly weekly post for ClassDojo, built from the class's activity
 * counters (last 7 Japan days). First names only. Pure - easy to test.
 */

export type SummaryStudent = { name: string; activity: ActivityDays };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days of typing in a week to count as "practiced (almost) every day". */
const STEADY_DAYS = 4;

/** "Ann Smith" -> "Ann"; usernames like "AnnSmith" -> "Ann". */
function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.replace(/^([A-Z][a-z]+)[A-Z].*$/, "$1");
}

/** "Ann", "Ann and Ben", "Ann, Ben and Cal" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function practiceDays(activity: ActivityDays, now: number): number {
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const d = activity[tokyoDate(now - i * DAY_MS)];
    if (d !== undefined && Math.max(d.t ?? 0, d.l ?? 0) >= 60) days++;
  }
  return days;
}

/** Top few by a score (ties included at the cut), skipping zeros. */
function top<T>(list: T[], score: (x: T) => number, count: number): T[] {
  const sorted = list
    .filter((x) => score(x) > 0)
    .sort((a, b) => score(b) - score(a));
  const cut = sorted[count - 1];
  if (cut === undefined) return sorted;
  return sorted.filter((x) => score(x) >= score(cut)).slice(0, count + 2);
}

export function buildWeeklySummary(
  classId: string,
  students: SummaryStudent[],
  options: { earnLessons?: number; now?: number } = {},
): string {
  const now = options.now ?? Date.now();
  const rows = students.map((s) => ({
    name: firstName(s.name),
    week: summarizeActivity(s.activity, 7, now),
    days: practiceDays(s.activity, now),
  }));
  const active = rows.filter(
    (r) => r.week.typingSec >= 60 || r.week.lessonsPassed > 0,
  );
  const lessons = rows.reduce((n, r) => n + r.week.lessonsPassed, 0);
  const typingSec = rows.reduce((n, r) => n + r.week.typingSec, 0);

  const lines: string[] = [];
  lines.push(`⌨️ GFA Typing - ${classId} weekly report`);
  lines.push("");
  if (active.length === 0) {
    lines.push(
      "We had a quiet typing week! Let's get back to practicing - even 10 minutes a day makes a big difference. 💪",
    );
  } else {
    lines.push(
      `This week ${active.length} of ${rows.length} students practiced, passing ${lessons} lesson${lessons === 1 ? "" : "s"} with 2+ stars and typing for ${formatMinutes(typingSec)} in total. ${active.length * 2 >= rows.length ? `Great job, ${classId}! 🎉` : "Let's get even more of us practicing next week! 💪"}`,
    );
  }

  const stars = top(rows, (r) => r.week.lessonsPassed, 3);
  const workers = top(rows, (r) => r.week.typingSec, 3);
  const steady = rows.filter((r) => r.days >= STEADY_DAYS);
  if (stars.length > 0 || workers.length > 0 || steady.length > 0) {
    lines.push("");
    lines.push("🌟 Shout-outs:");
    if (stars.length > 0) {
      lines.push(
        `⭐ Lesson stars: ${joinNames(stars.map((r) => `${r.name} (${r.week.lessonsPassed})`))}`,
      );
    }
    if (workers.length > 0) {
      lines.push(
        `⏱️ Hardest workers: ${joinNames(workers.map((r) => `${r.name} (${formatMinutes(r.week.typingSec)})`))}`,
      );
    }
    if (steady.length > 0) {
      lines.push(
        `📅 Practiced ${STEADY_DAYS}+ days: ${joinNames(steady.map((r) => r.name))}`,
      );
    }
  }

  lines.push("");
  lines.push(
    "🏠 Keep practicing at home! Log in to GFA Typing, do your lessons, and try for 2 stars on each one.",
  );
  if (options.earnLessons !== undefined && options.earnLessons > 0) {
    lines.push(
      `🎮 Remember: pass ${options.earnLessons} lesson${options.earnLessons === 1 ? "" : "s"} with 2 stars each day to unlock the games!`,
    );
  }
  return lines.join("\n");
}

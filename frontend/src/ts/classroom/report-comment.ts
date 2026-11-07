import type { StudentActivity } from "./activity-report";
import type { StudentProgressRow } from "./assignments";
import { earnedLevels, nextLevel, stillNeeds } from "./certificate-levels";
import { displayChar } from "./progress-format";

/**
 * The automatic "Teacher's comments" on a progress report: a few friendly,
 * specific sentences from the student's results - progress, speed, accuracy,
 * practice habits, where they're stuck, keys to work on, and the next goal.
 * Pure, so it's easy to test. Uses the first name only and no pronouns.
 */

export type CommentInput = {
  row: Pick<
    StudentProgressRow,
    | "name"
    | "bestWpm"
    | "bestAcc"
    | "lessonsCompleted"
    | "lessonStars"
    | "streakMaxLength"
    | "weakKeys"
    | "stuckLessons"
  >;
  activity: StudentActivity;
  totalLessons: number;
};

/** "Ann Smith" -> "Ann"; usernames like "AnnSmith" -> "Ann". */
export function firstNameOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.replace(/^([A-Z][a-z]+)[A-Z].*$/, "$1");
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function progressSentence(input: CommentInput, name: string): string {
  const { row, totalLessons } = input;
  if (row.lessonsCompleted === 0) {
    return `${name} is just getting started with the typing lessons.`;
  }
  const level = earnedLevels(row).at(-1);
  const of = totalLessons > 0 ? ` of ${totalLessons}` : "";
  const pct =
    totalLessons > 0
      ? ` (${Math.round((row.lessonsCompleted / totalLessons) * 100)}%)`
      : "";
  const levelPart =
    level !== undefined
      ? `, reaching the ${level.name} certificate (${level.title})`
      : "";
  return `${name} has passed ${row.lessonsCompleted}${of} lessons${pct} and earned ${row.lessonStars} stars${levelPart}.`;
}

function skillSentence(row: CommentInput["row"]): string | undefined {
  if (row.bestWpm <= 0) return undefined;
  const wpm = Math.round(row.bestWpm);
  const acc = Math.round(row.bestAcc);
  const speed =
    wpm >= 35
      ? `an impressive best speed of ${wpm} words per minute`
      : wpm >= 25
        ? `a strong best speed of ${wpm} words per minute`
        : wpm >= 15
          ? `a good, steady speed of ${wpm} words per minute`
          : `a growing speed of ${wpm} words per minute`;
  const accuracy =
    acc >= 97
      ? `excellent accuracy (${acc}%)`
      : acc >= 92
        ? `good accuracy (${acc}%)`
        : acc >= 85
          ? `accuracy of ${acc}% - slowing down a little will help it improve`
          : `accuracy of ${acc}% - the best next step is to focus on correct keys before speed, aiming for 90% or more`;
  return `Typing shows ${speed} with ${accuracy}.`;
}

function habitSentence(input: CommentInput): string {
  const { activity, row } = input;
  const minutes = Math.round(activity.timeTypingSeconds / 60);
  let s: string;
  if (activity.testsTaken === 0) {
    s =
      "There was no practice in this period; short, regular sessions (about 10 minutes a day) would make a big difference.";
  } else if (activity.testsTaken >= 15 || minutes >= 60) {
    s = `Practice this period was very consistent (${activity.testsTaken} sessions, ${minutes} minutes).`;
  } else {
    s = `There were ${activity.testsTaken} practice session${activity.testsTaken === 1 ? "" : "s"} this period; a little more regular practice will help progress faster.`;
  }
  if (row.streakMaxLength >= 7) {
    s += ` A best streak of ${row.streakMaxLength} days shows great commitment.`;
  }
  return s;
}

export function buildReportComment(input: CommentInput): string {
  const { row } = input;
  const name = firstNameOf(row.name);
  const parts: string[] = [progressSentence(input, name)];

  const skill = skillSentence(row);
  if (skill !== undefined) parts.push(skill);

  parts.push(habitSentence(input));

  const stuck = row.stuckLessons.slice(0, 2).map((l) => `"${l.name}"`);
  if (stuck.length > 0) {
    parts.push(
      `${name} is working hard on ${joinList(stuck)}; a few more careful tries there will help ${name} move forward.`,
    );
  }

  const keys = Object.entries(row.weakKeys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => displayChar(k));
  if (keys.length > 0) {
    parts.push(`Keys to focus on next: ${joinList(keys)}.`);
  }

  const next = nextLevel(row);
  if (next === undefined) {
    parts.push(
      `${name} has reached the highest certificate level - outstanding work!`,
    );
  } else if (row.lessonsCompleted > 0) {
    parts.push(
      `Next goal: the ${next.name} certificate (${stillNeeds(next, row)}). Keep up the great work!`,
    );
  } else {
    parts.push(
      `First goal: the ${next.name} certificate. We look forward to seeing ${name} practise!`,
    );
  }
  return parts.join(" ");
}

import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { createSignal } from "solid-js";

import {
  ActivityDay,
  parseActivityDays,
  tokyoDate,
} from "../classroom/activity";
import { getAuthenticatedUser, getDb } from "../firebase";
import { queryClient } from "../queries";
import { getSnapshot } from "../states/snapshot";

/**
 * Teacher control over free-play games (Lessons page > Games), per class and
 * per student. One small shared doc: schoolConfig/gameAccess (admin-write,
 * domain-read). Lesson checkpoint games and teacher-hosted class games are
 * never blocked.
 */

export type GameMode = "on" | "off" | "earn";

/** Game word level a teacher can fix (unset = from lessons). */
export type QuestLevel = "Easy" | "Medium" | "Hard";
const QUEST_LEVELS: readonly string[] = ["Easy", "Medium", "Hard"];
/** Teacher chips (undefined = follow lesson progress). */
export const QUEST_LEVEL_CHOICES: { level?: QuestLevel; label: string }[] = [
  { label: "By lessons" },
  { level: "Easy", label: "Easy" },
  { level: "Medium", label: "Medium" },
  { level: "Hard", label: "Hard" },
];

export type GamePolicy = {
  mode?: GameMode;
  /** "earn": distinct lessons to pass with 2+ stars today to unlock games */
  earnLessons?: number;
  /** "earn": also this many minutes of free typing today (Practice, not lessons) */
  earnTypingMin?: number;
  /** game ids that stay locked */
  blocked?: string[];
  /**
   * Easy/medium/hard games (real words, every letter) need the All Keys
   * lessons finished first. Student value overrides the class (false = let
   * this student play early).
   */
  needAllKeys?: boolean;
  /**
   * My Zoo turned off (default on). Student value overrides the class
   * (false = this student keeps the zoo while the class has it off).
   */
  zooOff?: boolean;
  /**
   * Monster Quest heroes bought with coins turned off (default on): hidden
   * in the picker and can't be bought. Student value overrides the class.
   */
  questHeroesOff?: boolean;
  /**
   * Game word level fixed by the teacher, for every game (unset = set by the
   * student's lesson progress; see game-level.ts). Field name kept from when
   * it was Monster Quest only. Student value overrides the class.
   */
  questLevel?: QuestLevel;
};

/** Why a teacher paused a student's games. */
export type PauseReason = "fingers" | "behaviour" | "other";
export const PAUSE_REASONS: Record<
  PauseReason,
  { emoji: string; label: string }
> = {
  fingers: { emoji: "🖐️", label: "Finger placement" },
  behaviour: { emoji: "🙅", label: "Behaviour" },
  other: { emoji: "⏸️", label: "Other" },
};
/** "Until I unpause" */
export const PAUSE_FOREVER = "9999-12-31";

export type StudentPolicy = GamePolicy & {
  /** teacher-given game time, valid on bonusDate (Japan date) only */
  bonusDate?: string;
  bonusMinutes?: number;
  /** all games paused through this Japan date (inclusive) */
  pauseUntil?: string;
  pauseReason?: PauseReason;
};

export type GameAccessDoc = {
  classes: Record<string, GamePolicy>;
  students: Record<string, StudentPolicy>;
};

export const EARN_LESSONS_DEFAULT = 2;
export const EARN_LESSONS_MAX = 10;
/** Most typing minutes a teacher can ask for before games. */
export const EARN_TYPING_MAX = 30;
const MAX_BONUS_MINUTES = 240;

function accessRef(): ReturnType<typeof doc> {
  return doc(getDb(), "schoolConfig", "gameAccess");
}

function parsePolicy(raw: unknown): StudentPolicy {
  if (raw === null || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: StudentPolicy = {};
  if (r["mode"] === "on" || r["mode"] === "off" || r["mode"] === "earn") {
    out.mode = r["mode"];
  }
  const earn = Number(r["earnLessons"]);
  if (Number.isFinite(earn) && earn >= 0) {
    out.earnLessons = Math.min(EARN_LESSONS_MAX, Math.round(earn));
  }
  const typing = Number(r["earnTypingMin"]);
  if (Number.isFinite(typing) && typing >= 0) {
    out.earnTypingMin = Math.min(EARN_TYPING_MAX, Math.round(typing));
  }
  if (Array.isArray(r["blocked"])) {
    out.blocked = (r["blocked"] as unknown[]).filter(
      (x): x is string => typeof x === "string",
    );
  }
  if (typeof r["needAllKeys"] === "boolean") {
    out.needAllKeys = r["needAllKeys"];
  }
  if (typeof r["zooOff"] === "boolean") out.zooOff = r["zooOff"];
  if (typeof r["questHeroesOff"] === "boolean") {
    out.questHeroesOff = r["questHeroesOff"];
  }
  if (
    typeof r["questLevel"] === "string" &&
    QUEST_LEVELS.includes(r["questLevel"])
  ) {
    out.questLevel = r["questLevel"] as QuestLevel;
  }
  if (typeof r["bonusDate"] === "string") out.bonusDate = r["bonusDate"];
  if (
    typeof r["pauseUntil"] === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r["pauseUntil"])
  ) {
    out.pauseUntil = r["pauseUntil"];
  }
  if (
    r["pauseReason"] === "fingers" ||
    r["pauseReason"] === "behaviour" ||
    r["pauseReason"] === "other"
  ) {
    out.pauseReason = r["pauseReason"];
  }
  const bonus = Number(r["bonusMinutes"]);
  if (Number.isFinite(bonus) && bonus > 0) {
    out.bonusMinutes = Math.min(MAX_BONUS_MINUTES, Math.round(bonus));
  }
  return out;
}

export function parseGameAccess(data: unknown): GameAccessDoc {
  const out: GameAccessDoc = { classes: {}, students: {} };
  if (data === null || typeof data !== "object") return out;
  const d = data as Record<string, unknown>;
  for (const key of ["classes", "students"] as const) {
    const raw = d[key];
    if (raw === null || typeof raw !== "object") continue;
    for (const [id, p] of Object.entries(raw as Record<string, unknown>)) {
      out[key][id] = parsePolicy(p);
    }
  }
  return out;
}

/** One small shared doc - cache it (callers use a 5 min+ staleTime). */
export async function getGameAccess(): Promise<GameAccessDoc> {
  const snap = await getDoc(accessRef());
  return parseGameAccess(snap.exists() ? snap.data() : null);
}

/** Admin only. `null` clears the class back to "games on". */
export async function setClassGamePolicy(
  classId: string,
  policy: GamePolicy | null,
): Promise<void> {
  await setDoc(
    accessRef(),
    { classes: { [classId]: policy ?? deleteField() } },
    // replace the class entry whole (merge: true would keep removed fields)
    { mergeFields: [`classes.${classId}`] },
  );
}

/**
 * Admin only. Merges the given fields into one student's override; pass a
 * field as null to remove it (back to the class setting).
 */
export async function updateStudentGamePolicy(
  uid: string,
  patch: { [K in keyof StudentPolicy]?: StudentPolicy[K] | null },
): Promise<void> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    fields[k] = v ?? deleteField();
  }
  await setDoc(accessRef(), { students: { [uid]: fields } }, { merge: true });
}

/** A Japan date `days` after `from` (YYYY-MM-DD). */
export function addDays(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Admin only: pause all of a student's free-play games through `until`
 * (Japan date, inclusive; PAUSE_FOREVER = until unpaused).
 */
export async function pauseStudentGames(
  uid: string,
  until: string,
  reason: PauseReason,
): Promise<void> {
  await updateStudentGamePolicy(uid, {
    pauseUntil: until,
    pauseReason: reason,
  });
}

export async function unpauseStudentGames(uid: string): Promise<void> {
  await updateStudentGamePolicy(uid, { pauseUntil: null, pauseReason: null });
}

/** Admin only: give a student extra game time for today. */
export async function giveBonusGameTime(
  uid: string,
  current: StudentPolicy | undefined,
  minutes: number,
): Promise<void> {
  const today = tokyoDate();
  const already =
    current?.bonusDate === today ? (current.bonusMinutes ?? 0) : 0;
  await updateStudentGamePolicy(uid, {
    bonusDate: today,
    bonusMinutes: Math.min(MAX_BONUS_MINUTES, already + minutes),
  });
}

export type EffectivePolicy = {
  mode: GameMode;
  earnLessons: number;
  /** minutes of free typing (Practice) today also needed (0 = none) */
  earnTypingMin: number;
  blocked: string[];
  /** easy/medium/hard games need All Keys finished */
  needAllKeys: boolean;
  /** the student's own needAllKeys override (undefined = class setting) */
  ownNeedAllKeys?: boolean;
  /** My Zoo turned off by the teacher */
  zooOff: boolean;
  /** bought Monster Quest heroes turned off by the teacher */
  questHeroesOff: boolean;
  /** Monster Quest words fixed by the teacher (undefined = from lessons) */
  questLevel?: QuestLevel;
  /** bonus minutes valid today (0 = none) */
  bonusMinutes: number;
  /** true when any setting comes from the student's own override */
  personal: boolean;
  /** games paused by the teacher (today is on or before `until`) */
  pause?: { until: string; reason: PauseReason };
};

/** Student override wins field by field over the class setting. */
export function resolvePolicy(
  access: GameAccessDoc | undefined,
  classId: string | undefined,
  uid: string | undefined,
  today = tokyoDate(),
): EffectivePolicy {
  const cls =
    classId !== undefined
      ? (access?.classes[classId] ?? {})
      : ({} as GamePolicy);
  const stu = uid !== undefined ? (access?.students[uid] ?? {}) : {};
  return {
    mode: stu.mode ?? cls.mode ?? "on",
    earnLessons: stu.earnLessons ?? cls.earnLessons ?? EARN_LESSONS_DEFAULT,
    earnTypingMin: stu.earnTypingMin ?? cls.earnTypingMin ?? 0,
    blocked: stu.blocked ?? cls.blocked ?? [],
    needAllKeys: stu.needAllKeys ?? cls.needAllKeys ?? false,
    ...(stu.needAllKeys !== undefined
      ? { ownNeedAllKeys: stu.needAllKeys }
      : {}),
    zooOff: stu.zooOff ?? cls.zooOff ?? false,
    questHeroesOff: stu.questHeroesOff ?? cls.questHeroesOff ?? false,
    ...((stu.questLevel ?? cls.questLevel) !== undefined
      ? { questLevel: stu.questLevel ?? cls.questLevel }
      : {}),
    bonusMinutes: stu.bonusDate === today ? (stu.bonusMinutes ?? 0) : 0,
    personal:
      stu.mode !== undefined ||
      stu.earnLessons !== undefined ||
      stu.earnTypingMin !== undefined ||
      stu.blocked !== undefined ||
      stu.needAllKeys !== undefined,
    ...(stu.pauseUntil !== undefined && stu.pauseUntil >= today
      ? { pause: { until: stu.pauseUntil, reason: stu.pauseReason ?? "other" } }
      : {}),
  };
}

export type GameAccess =
  | { allowed: true; bonusLeftMin?: number }
  | {
      allowed: false;
      reason: "blocked" | "off" | "earn" | "paused" | "keys";
      /** "earn": lessons still to pass today */
      lessonsLeft?: number;
      /** "earn": minutes of free typing still to do today */
      typingMinLeft?: number;
      /** "paused": why and until when */
      pause?: { until: string; reason: PauseReason };
    };

/**
 * Whether a free-play game can be opened right now. `skills.levelGame`: the
 * game uses easy/medium/hard words (see games-data `words: "levels"`).
 */
export function checkGameAccess(
  gameId: string | undefined,
  policy: EffectivePolicy,
  today: { lessonsPassed: number; gameSec: number; practiceSec?: number },
  skills?: { levelGame: boolean; allKeysDone: boolean },
): GameAccess {
  const typingMinLeft = Math.max(
    0,
    Math.ceil(policy.earnTypingMin - (today.practiceSec ?? 0) / 60),
  );
  // a teacher's pause beats everything, bonus time included
  if (policy.pause !== undefined) {
    return { allowed: false, reason: "paused", pause: policy.pause };
  }
  if (gameId !== undefined && policy.blocked.includes(gameId)) {
    return { allowed: false, reason: "blocked" };
  }
  if (
    skills !== undefined &&
    skills.levelGame &&
    policy.needAllKeys &&
    !skills.allKeysDone
  ) {
    return { allowed: false, reason: "keys" };
  }
  if (policy.mode === "on") return { allowed: true };
  if (
    policy.mode === "earn" &&
    today.lessonsPassed >= policy.earnLessons &&
    typingMinLeft === 0
  ) {
    return { allowed: true };
  }
  // teacher-given time: spends today's game minutes until it runs out
  const bonusLeftMin = Math.floor(policy.bonusMinutes - today.gameSec / 60);
  if (policy.bonusMinutes > 0 && bonusLeftMin > 0) {
    return { allowed: true, bonusLeftMin };
  }
  return policy.mode === "off"
    ? { allowed: false, reason: "off" }
    : {
        allowed: false,
        reason: "earn",
        lessonsLeft: Math.max(0, policy.earnLessons - today.lessonsPassed),
        typingMinLeft,
      };
}

/** "until Friday" / "for today" / "" (no end) for a pause. */
export function pauseUntilText(until: string, today = tokyoDate()): string {
  if (until >= PAUSE_FOREVER) return "";
  if (until === today) return "for today";
  const day = new Date(`${until}T00:00:00Z`).toLocaleDateString("en", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `until ${day} (${until.slice(5).replace("-", "/")})`;
}

/** What the student sees when their games are paused. */
export function pauseMessage(pause: {
  until: string;
  reason: PauseReason;
}): string {
  const when = pauseUntilText(pause.until);
  const end = when === "" ? "" : ` ${when}`;
  if (pause.reason === "fingers") {
    return `🖐️ Games are paused${end}. Practice your lessons with your fingers on the home row (F and J bumps!) and show your teacher.`;
  }
  if (pause.reason === "behaviour") {
    return `⏸️ Your teacher paused your games${end}. Show great typing in your lessons to get them back!`;
  }
  return `⏸️ Your teacher paused your games${end}. Keep practicing your lessons!`;
}

export const KEYS_LOCK_TEXT =
  "Finish the All Keys lessons to play this game - it uses every letter!";

/** "Get ⭐⭐ on 1 more lesson and type 3 more minutes" */
export function earnTodo(lessonsLeft: number, typingMinLeft: number): string {
  const parts: string[] = [];
  if (lessonsLeft > 0) {
    parts.push(
      `get ⭐⭐ on ${lessonsLeft} more lesson${lessonsLeft === 1 ? "" : "s"}`,
    );
  }
  if (typingMinLeft > 0) {
    parts.push(
      `type ${typingMinLeft} more minute${typingMinLeft === 1 ? "" : "s"} in Practice`,
    );
  }
  const text = parts.join(" and ") || "keep typing";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} today`;
}

/** Kid-friendly lock message. */
export function gameLockMessage(access: GameAccess): string {
  if (access.allowed) return "";
  if (access.reason === "paused" && access.pause !== undefined) {
    return pauseMessage(access.pause);
  }
  if (access.reason === "blocked") {
    return "🔒 Your teacher turned this game off";
  }
  if (access.reason === "keys") {
    return `🔒 ${KEYS_LOCK_TEXT}`;
  }
  if (access.reason === "off") {
    return "🔒 Your teacher turned games off for now";
  }
  return `🔒 ${earnTodo(access.lessonsLeft ?? 0, access.typingMinLeft ?? 0)} to unlock games`;
}

// ---- the signed-in student's own activity today ----
// The snapshot holds what the server had at sign-in; add what happened on
// this device since then so locks/unlocks update without a reload.

type LocalToday = {
  date: string;
  gameSec: number;
  typingSec: number;
  /** free typing only (not lessons) */
  practiceSec: number;
  lessons: string[];
};
const [localToday, setLocalToday] = createSignal<LocalToday>({
  date: tokyoDate(),
  gameSec: 0,
  typingSec: 0,
  practiceSec: 0,
  lessons: [],
});

function freshLocal(): LocalToday {
  const cur = localToday();
  return cur.date === tokyoDate()
    ? cur
    : {
        date: tokyoDate(),
        gameSec: 0,
        typingSec: 0,
        practiceSec: 0,
        lessons: [],
      };
}

export function noteLessonPassed(lessonId: string): void {
  const cur = freshLocal();
  if (cur.lessons.includes(lessonId)) return;
  setLocalToday({ ...cur, lessons: [...cur.lessons, lessonId] });
}

/** A typing test was saved on this device (seconds; `lesson`: a lesson try). */
export function noteTypingSeconds(seconds: number, lesson = false): void {
  const cur = freshLocal();
  const s = Math.max(0, seconds);
  setLocalToday({
    ...cur,
    typingSec: cur.typingSec + s,
    practiceSec: cur.practiceSec + (lesson ? 0 : s),
  });
}

/** `serverTotal` from the API (today's game seconds incl. this session). */
export function noteGameSeconds(seconds: number, serverTotal?: number): void {
  const cur = freshLocal();
  const fromSnapshot = snapshotToday().g ?? 0;
  setLocalToday({
    ...cur,
    gameSec:
      serverTotal !== undefined
        ? Math.max(0, serverTotal - fromSnapshot)
        : cur.gameSec + seconds,
  });
}

function snapshotToday(): ActivityDay {
  return parseActivityDays(getSnapshot()?.activityDays)[tokyoDate()] ?? {};
}

/** Reactive: ⭐⭐ lessons passed today on this device (not yet in the snapshot). */
export function myLocalTodayLessons(): string[] {
  return freshLocal().lessons;
}

/** Reactive: lessons passed, game and typing seconds today for the signed-in user. */
export function myToday(): {
  lessonsPassed: number;
  gameSec: number;
  typingSec: number;
  practiceSec: number;
} {
  const snap = snapshotToday();
  const local = freshLocal();
  const lessons = new Set([...(snap.lx ?? []), ...local.lessons]);
  return {
    lessonsPassed: lessons.size,
    gameSec: (snap.g ?? 0) + local.gameSec,
    typingSec: (snap.t ?? 0) + local.typingSec,
    practiceSec: Math.max(0, (snap.t ?? 0) - (snap.l ?? 0)) + local.practiceSec,
  };
}

/**
 * Whether the signed-in student is in "earn with lessons" mode, from the
 * cached settings the Lessons page already loaded (no extra read).
 */
export function isEarnModeActive(): boolean {
  const access = queryClient.getQueryData<GameAccessDoc>(["gameAccess"]);
  if (access === undefined) return false;
  return (
    resolvePolicy(access, getSnapshot()?.classId, getAuthenticatedUser()?.uid)
      .mode === "earn"
  );
}

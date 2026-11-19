import { doc, getDoc } from "firebase/firestore";
import { createSignal } from "solid-js";

import { loadFromLocalStorage } from "../config/lifecycle";
import { setConfig } from "../config/setters";
import { Config } from "../config/store";
import type { Grade } from "../constants/classes";
import { navigationEvent } from "../events/navigation";
import { restartTestEvent } from "../events/test";
import { getAuthenticatedUser, getDb } from "../firebase";
import { setActiveLesson } from "../lessons/lesson-progress";
import { getActivePage, setCustomTextIndicator } from "../states/core";
import { getSnapshot } from "../states/snapshot";
import * as CustomText from "../test/custom-text";
import { Story, storyById } from "./stories";

/**
 * Free typing extras: story chapters, "race your best", the word garden,
 * speed badges, stars against a grade goal and the weekly class boards.
 */

// ---------------------------------------------------------------- storage

const who = (): string => getAuthenticatedUser()?.uid ?? "guest";
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // not important
  }
}

// ---------------------------------------------------------------- stories

/** story id -> chapters finished */
export type StoryProgress = Record<string, number>;
const progressKey = (): string => `practice-stories:${who()}`;
const [progress, setProgress] = createSignal<StoryProgress>({});
export const storyProgress = (): StoryProgress => progress();
export function loadStoryProgress(): void {
  setProgress(read<StoryProgress>(progressKey()) ?? {});
}

/** The chapter being typed right now (from story mode). */
const [active, setActive] = createSignal<{
  story: Story;
  chapter: number;
} | null>(null);
export const activeStory = active;

/** Start typing a story chapter on the test page. */
export function startStoryChapter(storyId: string, chapter: number): void {
  const story = storyById(storyId);
  const ch = story?.chapters[chapter];
  if (story === undefined || ch === undefined) return;
  setActiveLesson(null);
  setActive({ story, chapter });
  setConfig("mode", "custom", { nosave: true });
  setConfig("punctuation", false, { nosave: true });
  setConfig("numbers", false, { nosave: true });
  CustomText.setPipeDelimiter(false);
  CustomText.setMode("repeat");
  const words = ch.text.split(" ");
  CustomText.setText(words);
  CustomText.setLimitMode("word");
  CustomText.setLimitValue(words.length);
  setCustomTextIndicator({
    name: `${story.emoji} ${story.title}, chapter ${chapter + 1}`,
    isLong: false,
  });
  if (getActivePage() === "test") restartTestEvent.dispatch();
  else navigationEvent.dispatch({ url: "/test", options: {} });
}

/** A chapter's test finished: unlock the next one. */
export function finishStoryChapter(): {
  story: Story;
  chapter: number;
  next?: number;
} | null {
  const a = active();
  if (a === null) return null;
  const done = Math.max(progress()[a.story.id] ?? 0, a.chapter + 1);
  const next = { ...progress(), [a.story.id]: done };
  setProgress(next);
  write(progressKey(), next);
  return {
    story: a.story,
    chapter: a.chapter,
    ...(a.chapter + 1 < a.story.chapters.length ? { next: a.chapter + 1 } : {}),
  };
}

/** Leave story mode: back to the student's own settings. */
export async function exitStory(): Promise<void> {
  if (active() === null) return;
  setActive(null);
  setCustomTextIndicator(undefined);
  await loadFromLocalStorage();
}

// ---------------------------------------------------------------- race your best

export const racingBest = (): boolean => Config.paceCaret === "pb";
export function setRaceBest(on: boolean): void {
  setConfig("paceCaret", on ? "pb" : "off");
}

// ---------------------------------------------------------------- garden

/** Words for each plant in the garden. */
export const WORDS_PER_PLANT = 100;
const PLANTS = [
  "🌱",
  "🌷",
  "🌻",
  "🌳",
  "🌸",
  "🍄",
  "🌵",
  "🌼",
  "🌲",
  "🪴",
  "🍓",
  "🎋",
];
/** The plant grown by the n-th 100 words (0-based). */
export const plantFor = (n: number): string =>
  PLANTS[n % PLANTS.length] ?? "🌱";
export const gardenSize = (words: number): number =>
  Math.floor(words / WORDS_PER_PLANT);

// ---------------------------------------------------------------- badges + stars

/** Speed badges (best words per minute). */
export const SPEED_BADGES = [5, 10, 15, 20, 25, 30, 40, 50, 60];
export const badgesFor = (bestWpm: number): number[] =>
  SPEED_BADGES.filter((b) => bestWpm >= b);

/** Best wpm across the student's time / words personal bests. */
export function bestWpm(): number {
  const pbs = getSnapshot()?.personalBests as
    | Record<string, Record<string, { wpm?: number }[]>>
    | undefined;
  let best = 0;
  for (const mode of ["time", "words"]) {
    for (const list of Object.values(pbs?.[mode] ?? {})) {
      for (const pb of list ?? []) best = Math.max(best, pb.wpm ?? 0);
    }
  }
  return Math.round(best);
}

/** A typing goal for each grade (words per minute) - used for stars. */
export const GRADE_GOAL: Record<Grade, number> = {
  G1: 8,
  G2: 12,
  G3: 16,
  G4: 20,
  G5: 25,
  G6: 30,
};

/**
 * 1-3 stars for a free typing test: 1 for finishing, 2 for 90%+ accuracy
 * at 80% of the goal speed, 3 for 95%+ accuracy at the goal. The goal is
 * the grade's, but never more than 90% of the student's own best, so every
 * child can reach 3 stars.
 */
export function practiceStars(
  wpm: number,
  acc: number,
  grade: Grade | undefined,
  best: number,
): number {
  const gradeGoal = grade === undefined ? 20 : GRADE_GOAL[grade];
  const goal =
    best > 0 ? Math.min(gradeGoal, Math.max(5, best * 0.9)) : gradeGoal * 0.7;
  if (wpm <= 0) return 0;
  if (acc >= 95 && wpm >= goal) return 3;
  if (acc >= 90 && wpm >= goal * 0.8) return 2;
  return 1;
}

// ---------------------------------------------------------------- daily goal

/** Minutes of typing a day the ring asks for. */
export const DAILY_GOAL_MIN = 5;

// ---------------------------------------------------------------- weekly boards

/** Monday 00:00 Japan time, as written by api/submit-result.ts. */
export function weekId(now = Date.now()): number {
  const offset = 9 * 60 * 60 * 1000;
  const shifted = new Date(now + offset);
  const sinceMonday = (shifted.getUTCDay() + 6) % 7;
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - sinceMonday,
    ) - offset
  );
}

/** Class word goal medals for a week. */
export const CLASS_GOALS = [
  { words: 5000, medal: "🥉" },
  { words: 10_000, medal: "🥈" },
  { words: 20_000, medal: "🥇" },
];

/** classId -> words typed this week (one small doc). */
export async function getClassGoals(
  week: number,
): Promise<Record<string, number>> {
  const snap = await getDoc(doc(getDb(), "classGoals", String(week)));
  const classes = (snap.data()?.["classes"] ?? {}) as Record<
    string,
    { words?: unknown }
  >;
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(classes)) {
    if (typeof v.words === "number") out[id] = v.words;
  }
  return out;
}

export type Improver = {
  uid: string;
  name: string;
  gain: number;
  wpm: number;
  classId: string;
};

/** This week's most improved students in a grade (one small doc). */
export async function getImprovedBoard(
  grade: string,
  week: number,
): Promise<Improver[]> {
  const snap = await getDoc(doc(getDb(), "improvedBoard", `${grade}-${week}`));
  const students = (snap.data()?.["students"] ?? {}) as Record<
    string,
    { name?: unknown; gain?: unknown; wpm?: unknown; classId?: unknown }
  >;
  return Object.entries(students)
    .filter(([, v]) => typeof v.gain === "number")
    .map(([uid, v]) => ({
      uid,
      name: typeof v.name === "string" ? v.name : "",
      gain: v.gain as number,
      wpm: typeof v.wpm === "number" ? v.wpm : 0,
      classId: typeof v.classId === "string" ? v.classId : "",
    }))
    .sort((a, b) => b.gain - a.gain);
}

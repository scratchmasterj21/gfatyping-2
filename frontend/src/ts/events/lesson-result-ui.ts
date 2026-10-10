import { createEvent } from "../hooks/createEvent";

/** Per-key counts from the last lesson run (expected char -> hits/misses). */
export type LessonKeyStats = Record<
  string,
  { correct: number; missed: number }
>;

export type LessonResultHeaderState = {
  title: string;
  subtitle: string;
  keyStats?: LessonKeyStats;
};

export const lessonResultHeaderEvent = createEvent<LessonResultHeaderState>();

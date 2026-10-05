import { createEvent } from "../hooks/createEvent";

export type LessonResultHeaderState = {
  title: string;
  subtitle: string;
};

export const lessonResultHeaderEvent = createEvent<LessonResultHeaderState>();

import { createEvent } from "../hooks/createEvent";

export const restartTestEvent = createEvent<
  { isQuickRestart?: boolean } | undefined
>();

/** Every typed character on the test page (for the typing buddy avatar). */
export const typedCharEvent = createEvent<{ correct: boolean }>();

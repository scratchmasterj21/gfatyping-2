import { createSignal } from "solid-js";

const KEY = "gfa-mini-games-muted";

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

const [muted, setMutedSignal] = createSignal(readMuted());

/** Whether game sound effects are off (shared by every game). */
export { muted };

export function setMuted(value: boolean): void {
  setMutedSignal(value);
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // storage blocked - mute still works for this session
  }
}

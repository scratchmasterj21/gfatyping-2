import { createSignal } from "solid-js";

import type { FaSolidIcon } from "../types/font-awesome";

export type CelebrationInfo = {
  title: string;
  message: string;
  icon: FaSolidIcon;
};

const [celebration, setCelebration] = createSignal<CelebrationInfo | null>(
  null,
);

export const getCelebration = celebration;

let clearTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerCelebration(info: CelebrationInfo): void {
  if (clearTimer !== null) {
    clearTimeout(clearTimer);
  }
  setCelebration(info);
  clearTimer = setTimeout(() => {
    setCelebration(null);
    clearTimer = null;
  }, 3000);
}

export function dismissCelebration(): void {
  if (clearTimer !== null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  setCelebration(null);
}

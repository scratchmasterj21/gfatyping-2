import { Accessor, createSignal, onCleanup } from "solid-js";

/** Seconds left, ticking 10x a second; calls onDone once at zero. */
export function useCountdown(
  seconds: number,
  onDone: () => void,
): { remaining: Accessor<number>; stop: () => void } {
  const endAt = Date.now() + seconds * 1000;
  const [remaining, setRemaining] = createSignal(seconds);
  let done = false;
  const timer = setInterval(() => {
    const left = Math.max(0, (endAt - Date.now()) / 1000);
    setRemaining(left);
    if (left <= 0 && !done) {
      done = true;
      clearInterval(timer);
      onDone();
    }
  }, 100);
  const stop = (): void => {
    done = true;
    clearInterval(timer);
  };
  onCleanup(stop);
  return { remaining, stop };
}

export const shuffled = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

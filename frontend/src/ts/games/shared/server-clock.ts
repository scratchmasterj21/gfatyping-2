import { onValue, ref } from "firebase/database";

import { getRealtimeDb } from "../../firebase";

/**
 * The database clock, shared by online games so every screen times turns and
 * fuses the same. A one-off get() of .info/serverTimeOffset can answer 0
 * before the connection is up (and never updates after a reconnect), leaving
 * each iPad on its own - often wrong - clock. Listen instead: .info paths are
 * local, so this costs no reads.
 */
let offset = 0;
let watching = false;

export function watchServerClock(): void {
  if (watching) return;
  try {
    onValue(ref(getRealtimeDb(), ".info/serverTimeOffset"), (snap) => {
      const v = snap.val() as unknown;
      if (typeof v === "number") offset = v;
    });
    watching = true;
  } catch {
    // not initialised yet - fall back to the local clock, try again next time
  }
}

export const serverClockNow = (): number => Date.now() + offset;

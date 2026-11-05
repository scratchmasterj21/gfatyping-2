import {
  playBossDefeated,
  playMiss,
  playPop,
  playWaveClear,
} from "../shared/sounds";
import { muted } from "../shared/sound-mute";

export { muted, setMuted } from "../shared/sound-mute";

let ctx: AudioContext | null = null;
const audio = (): AudioContext | null => {
  if (typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

/** One short tone with a pitch glide. */
function tone(
  from: number,
  to: number,
  seconds: number,
  type: OscillatorType = "sine",
  volume = 0.2,
  delay = 0,
): void {
  const c = audio();
  if (c === null) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + seconds);
  const g = c.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

const guard = (fn: () => void) => (): void => {
  if (muted()) return;
  try {
    fn();
  } catch {
    // audio unavailable - games stay silent
  }
};

// C major pentatonic, two-plus octaves
const NOTES = [
  262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568,
  1760,
];

/** Sound effects for the DOM mini games; all respect the mute toggle. */
export const sfx = {
  /** a correct word / serve / key */
  good: guard(() => tone(520, 880, 0.12, "triangle", 0.18)),
  /** a bigger win: double jump, rush hour, round cleared */
  great: guard(playWaveClear),
  /** a typo */
  oops: guard(playMiss),
  /** something bad happened: slide down, customer leaves, life lost */
  bad: guard(() => tone(600, 140, 0.45, "triangle", 0.2)),
  pop: guard(playPop),
  coin: guard(() => {
    tone(988, 988, 0.08, "square", 0.08);
    tone(1319, 1319, 0.25, "square", 0.08, 0.08);
  }),
  finish: guard(playBossDefeated),
  /** a musical note; higher index = higher pitch */
  note: (index: number): void => {
    if (muted()) return;
    const f = NOTES[Math.max(0, Math.min(NOTES.length - 1, index))] ?? 440;
    try {
      tone(f, f, 0.32, "triangle", 0.2);
    } catch {
      // audio unavailable
    }
  },
};

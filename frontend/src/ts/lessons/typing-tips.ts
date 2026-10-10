import { FaSolidIcon } from "../types/font-awesome";

export type TypingTip = { icon: FaSolidIcon; text: string };

export const TYPING_TIPS: TypingTip[] = [
  { icon: "fa-hand-paper", text: "Rest your fingers on A S D F and J K L ;" },
  {
    icon: "fa-hand-pointer",
    text: "Feel the bumps on F and J with your pointer fingers.",
  },
  { icon: "fa-user", text: "Sit up tall with your feet flat on the floor." },
  { icon: "fa-eye", text: "Look at the screen, not your hands." },
  { icon: "fa-feather", text: "Tap the keys softly — no need to press hard." },
  { icon: "fa-arrows-alt-h", text: "Use your thumb for the space bar." },
  {
    icon: "fa-check-circle",
    text: "Go slow and get it right. Speed comes later!",
  },
  { icon: "fa-home", text: "After each key, bring your finger back home." },
];

/** Same tip all day, a different one tomorrow. */
export function tipOfTheDay(offset = 0): TypingTip {
  const day = Math.floor(Date.now() / 86_400_000);
  const tip = TYPING_TIPS[(day + offset) % TYPING_TIPS.length];
  return (
    tip ?? { icon: "fa-keyboard", text: "Keep your fingers on the home row." }
  );
}

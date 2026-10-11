import { FaSolidIcon } from "../types/font-awesome";

export type TitleId =
  | "speedy"
  | "accuracy-ace"
  | "streak-star"
  | "streak-legend";

export type TitleItem = {
  id: TitleId;
  label: string;
  icon: FaSolidIcon;
  /** Achievement that unlocks it; the server re-checks before saving. */
  achievement: string;
  hint: string;
};

/** Mirrors TITLE_ACHIEVEMENTS in api/_lib/catalogs.ts. */
export const TITLES: TitleItem[] = [
  {
    id: "speedy",
    label: "Speedy",
    icon: "fa-bolt",
    achievement: "speed-50",
    hint: "Type 50 WPM in a 30 second test",
  },
  {
    id: "accuracy-ace",
    label: "Accuracy Ace",
    icon: "fa-bullseye",
    achievement: "accuracy-perfect",
    hint: "Finish a timed test with 100% accuracy",
  },
  {
    id: "streak-star",
    label: "Streak Star",
    icon: "fa-fire",
    achievement: "streak-30",
    hint: "Practice 30 days in a row",
  },
  {
    id: "streak-legend",
    label: "Streak Legend",
    icon: "fa-crown",
    achievement: "streak-60",
    hint: "Practice 60 days in a row",
  },
];

export function findTitle(id: unknown): TitleItem | undefined {
  return typeof id === "string" ? TITLES.find((t) => t.id === id) : undefined;
}

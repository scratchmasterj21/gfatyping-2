import { FaSolidIcon } from "../../../types/font-awesome";

/** The big picture buttons at the top of the lessons page. */
export type LessonsTab = "learn" | "practice" | "games" | "japanese" | "me";

export const LESSONS_TABS: {
  id: LessonsTab;
  label: string;
  icon: FaSolidIcon;
}[] = [
  { id: "learn", label: "Learn", icon: "fa-graduation-cap" },
  { id: "practice", label: "Practice", icon: "fa-pencil-alt" },
  { id: "games", label: "Games", icon: "fa-gamepad" },
  { id: "japanese", label: "Japanese", icon: "fa-language" },
  { id: "me", label: "My Stuff", icon: "fa-gift" },
];

const STORAGE_KEY = "lessonsTab";

const isTab = (v: unknown): v is LessonsTab =>
  LESSONS_TABS.some((t) => t.id === v);

/** ?tab= in the address, else the last tab used, else Learn. */
export function initialLessonsTab(): LessonsTab {
  const fromUrl = new URLSearchParams(window.location.search).get("tab");
  if (isTab(fromUrl)) return fromUrl;
  // a #lesson-group link always means the lessons list
  if (window.location.hash.length > 1) return "learn";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTab(stored)) return stored;
  } catch {
    // ignore
  }
  return "learn";
}

/** Remember the tab (address + storage) so refresh and next visit keep it. */
export function saveLessonsTab(tab: LessonsTab): void {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url);
}

import { GAME_PREFIX } from "./lesson-progress";
import { findLesson, lessonGroups } from "./lessons-data";

const titleCase = (slug: string): string =>
  slug
    .split("-")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * Human name for any lesson-progress key, for teacher views.
 * Lessons use their own name; checkpoint games ("game:<group>:<game>")
 * become e.g. "Home row · Word Defender checkpoint". Unknown keys pass through.
 */
export function lessonDisplayName(key: string): string {
  const lesson = findLesson(key);
  if (lesson !== undefined) return lesson.name;
  if (key.startsWith(GAME_PREFIX)) {
    const [groupId, gameId] = key.slice(GAME_PREFIX.length).split(":");
    if (groupId !== undefined && gameId !== undefined) {
      const group = lessonGroups.find((g) => g.id === groupId);
      const groupName = group?.name ?? titleCase(groupId);
      return `${groupName} · ${titleCase(gameId)} checkpoint`;
    }
  }
  return key;
}

import { Lesson, lessonGroups } from "../../../lessons/lessons-data";

export type WordListOption = {
  id: string;
  label: string;
  group: string;
  getWords: () => Promise<string[]>;
};

/** lesson groups that aren't plain words - never used as game word lists */
const NOT_WORDS = new Set([
  "capitals",
  "punctuation",
  "numbers",
  "symbols",
  "tab-enter",
]);

/** lesson groups games can use as word lists */
export const gameListGroups = lessonGroups.filter((g) => !NOT_WORDS.has(g.id));

/**
 * Finger drills for row keys that need no Shift keep those keys: the key is
 * the point of the drill. Every other list is plain words only.
 */
const DRILL_KEYS: Record<string, string> = {
  "home-pinky": ";",
  "home-all": ";",
  "bottom-middle": ",",
  "bottom-ring": ".",
  "bottom-pinky": "/",
  "bottom-all": ",./",
  "bottom-home": ",./",
};

const escapeClass = (keys: string): string => keys.replace(/[\\\]^-]/g, "\\$&");

/**
 * Games use plain lowercase words: no capitals, punctuation, quotes,
 * brackets or numbers. Trims marks around a word ("hi," -> "hi") and drops
 * anything with marks inside ("don't", "a-b"). `keep` lists row keys a
 * finger drill may still use ("z/z").
 */
export function plainWords(words: string[], keep = ""): string[] {
  const ok = `a-z${escapeClass(keep)}`;
  const edges = new RegExp(`^[^${ok}]+|[^${ok}]+$`, "g");
  const whole = new RegExp(`^[${ok}]+$`);
  const out = new Set<string>();
  for (const w of words) {
    const t = w.toLowerCase().replace(edges, "");
    if (whole.test(t)) out.add(t);
  }
  return [...out];
}

const lessonWords = async (lesson: Lesson): Promise<string[]> =>
  plainWords(await lesson.generate(), DRILL_KEYS[lesson.id]);

export function getWordListOptions(): WordListOption[] {
  const options: WordListOption[] = [];
  for (const group of gameListGroups) {
    // Group-level option (all lessons in this group combined)
    const g = group;
    options.push({
      id: g.id,
      label: g.name,
      group: g.name,
      getWords: async () => {
        const all = new Set<string>();
        for (const lesson of g.lessons) {
          for (const w of await lessonWords(lesson)) all.add(w);
        }
        return [...all];
      },
    });
    // Individual lesson options
    for (const lesson of group.lessons) {
      const l = lesson;
      const gName = group.name;
      options.push({
        id: l.id,
        label: l.name,
        group: gName,
        getWords: async () => lessonWords(l),
      });
    }
  }
  return options;
}

export function shuffleCyclic(
  words: string[],
  rng: () => number = Math.random,
): string[] {
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i] as string;
    arr[i] = arr[j] as string;
    arr[j] = tmp;
  }
  return arr;
}

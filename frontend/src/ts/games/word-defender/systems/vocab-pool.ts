import { lessonGroups } from "../../../lessons/lessons-data";

export type WordListOption = {
  id: string;
  label: string;
  group: string;
  getWords: () => Promise<string[]>;
};

export function getWordListOptions(): WordListOption[] {
  const options: WordListOption[] = [];
  for (const group of lessonGroups) {
    // Group-level option (all lessons in this group combined)
    const g = group;
    options.push({
      id: g.id,
      label: g.name,
      group: g.name,
      getWords: async () => {
        const all: string[] = [];
        for (const lesson of g.lessons) {
          const words = await lesson.generate();
          all.push(...words);
        }
        // Deduplicate, filter empties, keep unique
        return [...new Set(all.filter((w) => w.length > 0))];
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
        getWords: async () => {
          const words = await l.generate();
          return [...new Set(words.filter((w) => w.length > 0))];
        },
      });
    }
  }
  return options;
}

export function shuffleCyclic(words: string[]): string[] {
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as string;
    arr[i] = arr[j] as string;
    arr[j] = tmp;
  }
  return arr;
}

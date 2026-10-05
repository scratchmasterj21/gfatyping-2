import { WordListOption } from "../word-defender/systems/vocab-pool";

export type WordListGroup = { group: string; items: WordListOption[] };

export function groupWordListOptions(
  options: WordListOption[],
): WordListGroup[] {
  const map = new Map<string, WordListOption[]>();
  for (const o of options) {
    const list = map.get(o.group) ?? [];
    list.push(o);
    map.set(o.group, list);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

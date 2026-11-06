import { lessonGroups } from "../../../lessons/lessons-data";
import { CHAMP_ROUND_ORDER, ChampRoundKind } from "../../../race/championship";
import type { RaceContentSource } from "../../../race/race-db";

export type ContentKind = RaceContentSource["type"];

/** Editable content choice for one round. */
export type ContentDraft = {
  kind: ContentKind;
  count: number;
  custom: string;
  lessonId: string;
  wordListId: string;
  passageId: string;
  /** words to use from a list/passage/text/lesson (0 = all of them) */
  limit: number;
};

export type RoundDraft = {
  kind: ChampRoundKind;
  enabled: boolean;
  durationSec: number;
  content: ContentDraft;
};

export function defaultContent(): ContentDraft {
  return {
    kind: "random",
    count: 20,
    custom: "",
    lessonId: lessonGroups[0]?.lessons[0]?.id ?? "",
    wordListId: "",
    passageId: "",
    limit: 20,
  };
}

export function defaultRounds(): RoundDraft[] {
  return CHAMP_ROUND_ORDER.map((kind) => ({
    kind,
    enabled: true,
    durationSec: 30,
    content: defaultContent(),
  }));
}

export function contentSource(c: ContentDraft): RaceContentSource {
  switch (c.kind) {
    case "random":
      return { type: "random", count: c.count };
    case "custom":
      return { type: "custom", text: c.custom };
    case "lesson":
      return { type: "lesson", lessonId: c.lessonId };
    case "wordlist":
      return { type: "wordlist", wordListId: c.wordListId };
    case "passage":
      return { type: "passage", passageId: c.passageId };
  }
}

/** A problem with a round's content, or undefined if it's ready. */
export function contentProblem(c: ContentDraft): string | undefined {
  if (c.kind === "wordlist" && c.wordListId === "") return "pick a word list";
  if (c.kind === "passage" && c.passageId === "") return "pick a passage";
  if (c.kind === "custom" && c.custom.trim() === "") return "paste some text";
  return undefined;
}

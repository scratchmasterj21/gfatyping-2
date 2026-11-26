import { describe, expect, it } from "vitest";

import {
  levelLock,
  speedLock,
  wordLevelFor,
  wordListLock,
} from "../../src/ts/games/game-level";
import { pickAllowed } from "../../src/ts/games/use-game-level";
import { lessonGroups } from "../../src/ts/lessons/lessons-data";

const doneThrough = (groupId: string) => {
  const upto = lessonGroups.findIndex((g) => g.id === groupId);
  const ids = new Set(
    lessonGroups.slice(0, upto + 1).flatMap((g) => g.lessons.map((l) => l.id)),
  );
  return (id: string): boolean => ids.has(id);
};

describe("game word lists follow lessons", () => {
  it("new student: home row only", () => {
    const lock = wordListLock(lessonGroups, () => false);
    expect(lock("home-row")).toBeUndefined();
    expect(lock("home-index")).toBeUndefined();
    expect(lock("top-row")).toBe("finish Home row first");
  });

  it("current group + last part of the one before", () => {
    const lock = wordListLock(lessonGroups, doneThrough("home-row"));
    expect(lock("top-row")).toBeUndefined();
    expect(lock("top-index")).toBeUndefined();
    expect(lock("home-all")).toBeUndefined();
    expect(lock("home-words")).toBeUndefined();
    expect(lock("home-index")).toBe("you're past this!");
    expect(lock("home-row")).toBe("you're past this!");
    expect(lock("bottom-row")).toBe("finish Top row first");
  });

  it("teacher level picks the group", () => {
    const lock = wordListLock(lessonGroups, () => false, "Medium");
    expect(lock("top-row")).toBeUndefined();
    expect(lock("home-words")).toBeUndefined();
    expect(lock("home-index")).toBe("set by your teacher");
  });

  it("everything finished: end of All Keys and later groups", () => {
    const lock = wordListLock(lessonGroups, () => true);
    expect(lock("all-keys-6")).toBeUndefined();
    expect(lock("home-words")).toBe("you're past this!");
    expect(lock("all-keys-1")).toBe("you're past this!");
  });
});

describe("game levels", () => {
  it("level from lessons", () => {
    expect(wordLevelFor(() => false)).toBe("Easy");
    expect(wordLevelFor((id) => id === "top-row")).toBe("Medium");
    expect(wordLevelFor((id) => id === "all-keys")).toBe("Hard");
  });

  it("words: own level only; speed: own or faster", () => {
    expect(levelLock("Easy", "Medium", false)).toBe("you're past this!");
    expect(levelLock("Hard", "Medium", false)).toBe("finish All Keys lessons");
    expect(speedLock("Easy", "Medium", false)).toBe("you're past this!");
    expect(speedLock("Hard", "Medium", false)).toBeUndefined();
    expect(speedLock("Medium", "Medium", false)).toBeUndefined();
    expect(speedLock("Easy", "Hard", true)).toBe("set by your teacher");
    expect(speedLock("Turbo", "Hard", false)).toBeUndefined();
  });

  it("moves a locked pick to the first allowed", () => {
    const opts = [{ label: "Easy" }, { label: "Medium" }, { label: "Hard" }];
    const lock = (o: { label: string }) => speedLock(o.label, "Medium", false);
    expect(pickAllowed(opts[0], lock, opts)).toBe(opts[1]);
    expect(pickAllowed(opts[2], lock, opts)).toBeUndefined();
  });
});

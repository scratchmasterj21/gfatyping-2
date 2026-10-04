import { describe, expect, it } from "vitest";

import {
  checkpointLockMessage,
  isLessonBlockedByCheckpoint,
} from "../../src/ts/lessons/lesson-checkpoint-order";
import { LessonProgress } from "../../src/ts/lessons/lesson-progress";

describe("isLessonBlockedByCheckpoint", () => {
  it("blocks the lesson after an incomplete checkpoint", () => {
    const progress = new Map<string, LessonProgress>();
    expect(isLessonBlockedByCheckpoint("home-ring", progress)).toBe(true);
  });

  it("unblocks once the checkpoint is completed", () => {
    const progress = new Map<string, LessonProgress>([
      [
        "game:home-row:balloon-pop",
        {
          lessonId: "game:home-row:balloon-pop",
          bestWpm: 0,
          bestAcc: 0,
          stars: 1,
          completed: true,
          attempts: 1,
          timeSpent: 0,
          lastAt: 0,
        },
      ],
    ]);
    expect(isLessonBlockedByCheckpoint("home-ring", progress)).toBe(false);
  });

  it("does not block the first lesson in the curriculum", () => {
    expect(isLessonBlockedByCheckpoint("home-index", new Map())).toBe(false);
  });
});

describe("checkpointLockMessage", () => {
  it("mentions waves for wave-based checkpoints", () => {
    expect(
      checkpointLockMessage({
        afterLessonId: "x",
        gameType: "balloon",
        reviewLessonIds: [],
        label: "Balloon Pop",
        icon: "fa-circle",
      }),
    ).toContain("3 waves");
  });

  it("mentions full round for type toss", () => {
    expect(
      checkpointLockMessage({
        afterLessonId: "x",
        gameType: "toss",
        reviewLessonIds: [],
        label: "Type Toss",
        icon: "fa-hourglass",
      }),
    ).toContain("full round");
  });
});

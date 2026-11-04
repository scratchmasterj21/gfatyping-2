import { describe, expect, it } from "vitest";

import { lessonDisplayName } from "../../src/ts/lessons/lesson-display-name";
import { lessonOrder, findLesson } from "../../src/ts/lessons/lessons-data";

describe("lessonDisplayName", () => {
  it("uses the lesson's own name for curriculum lessons", () => {
    const id = lessonOrder[0] as string;
    expect(lessonDisplayName(id)).toBe(findLesson(id)?.name);
  });

  it("names checkpoint games readably", () => {
    expect(lessonDisplayName("game:home-row:word-defender")).toBe(
      "Home row · Word Defender checkpoint",
    );
    expect(lessonDisplayName("game:unknown-group:balloon-pop")).toBe(
      "Unknown Group · Balloon Pop checkpoint",
    );
  });

  it("passes unknown keys through", () => {
    expect(lessonDisplayName("mystery")).toBe("mystery");
    expect(lessonDisplayName("game:broken")).toBe("game:broken");
  });
});

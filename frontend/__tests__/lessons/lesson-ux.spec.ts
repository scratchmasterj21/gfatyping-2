import { describe, expect, it } from "vitest";

import {
  initialLessonGroupCollapseState,
  lessonLockMessage,
} from "../../src/ts/lessons/lesson-ux";

describe("lessonLockMessage", () => {
  it("explains incomplete prerequisites", () => {
    expect(lessonLockMessage("Home Row", false, 0)).toBe(
      "Complete Home Row first",
    );
  });

  it("explains the two-star progression gate", () => {
    expect(lessonLockMessage("Home Row", true, 1)).toBe(
      "Earn 2 stars on Home Row (currently 1)",
    );
  });
});

describe("initialLessonGroupCollapseState", () => {
  it("collapses completed groups and opens the current group", () => {
    expect(
      initialLessonGroupCollapseState(
        ["home", "top", "bottom"],
        new Set(["home", "top"]),
        "top",
        new Set(),
        new Set(["bottom"]),
      ),
    ).toEqual(new Set(["home", "bottom"]));
  });

  it("preserves groups manually toggled during the session", () => {
    expect(
      initialLessonGroupCollapseState(
        ["home", "top"],
        new Set(["home"]),
        "top",
        new Set(["home", "top"]),
        new Set(["top"]),
      ),
    ).toEqual(new Set(["top"]));
  });
});

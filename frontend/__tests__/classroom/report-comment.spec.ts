import { describe, expect, it } from "vitest";

import {
  buildReportComment,
  CommentInput,
  firstNameOf,
} from "../../src/ts/classroom/report-comment";

const base = (
  row: Partial<CommentInput["row"]> = {},
  activity: Partial<CommentInput["activity"]> = {},
): CommentInput => ({
  row: {
    name: "AnnaTanaka",
    bestWpm: 23,
    bestAcc: 96,
    lessonsCompleted: 18,
    lessonStars: 38,
    streakMaxLength: 11,
    weakKeys: { q: 9, z: 7, p: 5, x: 1 },
    stuckLessons: [],
    ...row,
  },
  activity: {
    testsTaken: 18,
    avgWpm: 20,
    avgAcc: 94,
    timeTypingSeconds: 2700,
    ...activity,
  },
  totalLessons: 50,
});

describe("automatic report comments", () => {
  it("uses the first name", () => {
    expect(firstNameOf("AnnaTanaka")).toBe("Anna");
    expect(firstNameOf("Ben Sato")).toBe("Ben");
    expect(firstNameOf("Cal")).toBe("Cal");
  });

  it("describes progress, skill, habits, keys and the next goal", () => {
    const c = buildReportComment(base());
    expect(c).toContain("Anna has passed 18 of 50 lessons (36%)");
    expect(c).toContain("Silver certificate (Confident Typist)");
    expect(c).toContain("good, steady speed of 23 words per minute");
    expect(c).toContain("good accuracy (96%)");
    expect(c).toContain("very consistent (18 sessions, 45 minutes)");
    expect(c).toContain("best streak of 11 days");
    expect(c).toContain("Keys to focus on next: Q, Z and P.");
    expect(c).toContain("Next goal: the Gold certificate");
    expect(c).not.toMatch(/\b(he|she|his|her)\b/i);
  });

  it("gives accuracy advice and mentions stuck lessons", () => {
    const c = buildReportComment(
      base(
        {
          bestAcc: 80,
          stuckLessons: [{ lessonId: "l7", name: "Pinky (q p)", attempts: 6 }],
        },
        { testsTaken: 3, timeTypingSeconds: 600 },
      ),
    );
    expect(c).toContain("focus on correct keys before speed");
    expect(c).toContain('working hard on "Pinky (q p)"');
    expect(c).toContain("3 practice sessions this period");
  });

  it("encourages a student who hasn't started", () => {
    const c = buildReportComment(
      base(
        {
          bestWpm: 0,
          bestAcc: 0,
          lessonsCompleted: 0,
          lessonStars: 0,
          streakMaxLength: 0,
          weakKeys: {},
        },
        { testsTaken: 0, timeTypingSeconds: 0 },
      ),
    );
    expect(c).toContain("just getting started");
    expect(c).toContain("no practice in this period");
    expect(c).toContain("First goal: the Bronze certificate");
    expect(c).not.toContain("words per minute");
  });
});

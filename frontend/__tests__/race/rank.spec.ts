import { describe, expect, it } from "vitest";

import {
  RaceParticipant,
  rankParticipants,
} from "../../src/ts/race/race-types";

const p = (uid: string, over: Partial<RaceParticipant>): RaceParticipant => ({
  uid,
  name: uid,
  joinedAt: 0,
  wordIndex: 0,
  progress: 0,
  finished: false,
  ...over,
});

describe("rankParticipants when the host ends early", () => {
  it("accuracy: finishers first, then the rest by accuracy so far", () => {
    const ranks = rankParticipants(
      [
        p("few", { finalAcc: 100, finalWpm: 20, progress: 0.1 }),
        p("done", {
          finished: true,
          finishedAt: 5,
          finalAcc: 95,
          finalWpm: 30,
        }),
        p("half", { finalAcc: 98, finalWpm: 25, progress: 0.5 }),
      ],
      "accuracy",
    );
    expect(ranks.map((r) => [r.uid, r.finalAcc])).toEqual([
      ["done", 95],
      ["few", 100],
      ["half", 98],
    ]);
  });

  it("finish: unfinished keep their speed and accuracy so far", () => {
    const ranks = rankParticipants(
      [
        p("slow", { finalAcc: 90, finalWpm: 12, progress: 0.3 }),
        p("done", {
          finished: true,
          finishedAt: 5,
          finalAcc: 95,
          finalWpm: 30,
        }),
      ],
      "finish",
    );
    expect(ranks.map((r) => [r.uid, r.finalWpm])).toEqual([
      ["done", 30],
      ["slow", 12],
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  championshipCoins,
  pickRoundWords,
  previousRanks,
  rankChampionship,
  scoreRound,
} from "../../src/ts/race/championship";
import type { RaceStanding } from "../../src/ts/race/race-types";

const st = (
  uid: string,
  rank: number,
  extra: Partial<RaceStanding> = {},
): RaceStanding => ({
  uid,
  name: uid,
  rank,
  finalWpm: 20,
  finalAcc: 95,
  finishedAt: 0,
  progress: 0.5,
  ...extra,
});

describe("championship scoring", () => {
  it("gives 10/8/6... by place and 1 point beyond 7th", () => {
    const standings = Array.from({ length: 9 }, (_, i) =>
      st(`s${i + 1}`, i + 1),
    );
    const scores = scoreRound({}, standings, "timed");
    expect(scores["s1"]!.points).toBe(10);
    expect(scores["s2"]!.points).toBe(8);
    expect(scores["s7"]!.points).toBe(2);
    expect(scores["s9"]!.points).toBe(1);
    expect(scores["s1"]!.wins).toBe(1);
  });

  it("students who didn't type score 0 and don't take a place", () => {
    const scores = scoreRound(
      {},
      [
        st("a", 1),
        st("idle", 2, { progress: 0, finalWpm: 0, words: 0 }),
        st("b", 3),
      ],
      "timed",
    );
    expect(scores["idle"]!.points).toBe(0);
    expect(scores["b"]!.points).toBe(8);
    expect(scores["idle"]!.places).toEqual([0]);
  });

  it("adds up over rounds and ranks by points, then wins", () => {
    let scores = scoreRound({}, [st("a", 1), st("b", 2), st("c", 3)], "timed");
    scores = scoreRound(
      scores,
      [st("b", 1), st("a", 2), st("c", 3)],
      "accuracy",
    );
    // a: 10+8 = 18 (1 win), b: 8+10 = 18 (1 win) - tie on points and wins,
    // last round place breaks it: b was 1st
    const ranked = rankChampionship(scores);
    expect(ranked.map((r) => r.uid)).toEqual(["b", "a", "c"]);
    expect(ranked[2]!.points).toBe(12);
  });

  it("keeps players who left the room in the table", () => {
    let scores = scoreRound({}, [st("a", 1), st("gone", 2)], "timed");
    scores = scoreRound(scores, [st("a", 1)], "finish");
    expect(scores["gone"]!.places).toEqual([2, 0]);
    expect(scores["gone"]!.points).toBe(8);
  });

  it("late joiners get 0 for earlier rounds", () => {
    let scores = scoreRound({}, [st("a", 1)], "timed");
    scores = scoreRound(scores, [st("a", 1), st("late", 2)], "finish");
    expect(scores["late"]!.places).toEqual([0, 2]);
  });

  it("coins for the podium and taking part", () => {
    const ranked = rankChampionship(
      scoreRound({}, [st("a", 1), st("b", 2), st("c", 3), st("d", 4)], "timed"),
    );
    expect(ranked.map(championshipCoins)).toEqual([50, 30, 20, 5]);
  });

  it("previous ranks for movement arrows", () => {
    let scores = scoreRound({}, [st("a", 1), st("b", 2)], "timed");
    scores = scoreRound(scores, [st("b", 1), st("a", 2)], "finish");
    expect(previousRanks(scores)).toEqual({ a: 1, b: 2 });
  });
});

describe("round words", () => {
  const list = Array.from({ length: 50 }, (_, i) => `w${i}`);
  let seed = 1;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  it("samples a word list down to the limit, mixed up", () => {
    const words = pickRoundWords(list, 20, false, rng);
    expect(words).toHaveLength(20);
    expect(new Set(words).size).toBe(20);
    expect(words.every((w) => list.includes(w))).toBe(true);
  });

  it("keeps a passage in order as one stretch", () => {
    const words = pickRoundWords(list, 10, true, rng);
    const start = list.indexOf(words[0]!);
    expect(words).toEqual(list.slice(start, start + 10));
  });

  it("uses everything when the limit is 0 or bigger than the list", () => {
    expect(pickRoundWords(list, 0, true)).toEqual(list);
    expect(pickRoundWords(list.slice(0, 5), 20, true)).toHaveLength(5);
  });
});

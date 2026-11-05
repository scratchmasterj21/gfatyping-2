import { describe, expect, it } from "vitest";

import {
  echoIsOver,
  echoOnMistake,
  echoOnRoundWin,
  echoStars,
  initialEcho,
  makeSequence,
} from "../../src/ts/games/echo-keys/echo-rules";
import {
  initialSnack,
  isRushHour,
  makeOrder,
  snackIsOver,
  snackOnMiss,
  snackOnServe,
  snackStars,
} from "../../src/ts/games/snack-shop/snack-rules";
import {
  initialTower,
  STREAK_FOR_DOUBLE,
  towerOnTypo,
  towerOnWord,
  towerScore,
  towerStars,
} from "../../src/ts/games/tower-climb/tower-rules";
import { waveAccuracy, waveStars } from "../../src/ts/games/shared/wave-result";
import { questStars } from "../../src/ts/games/typing-rpg/quest-stars";
import { tossStars, tossWpm } from "../../src/ts/games/type-toss/toss-result";
import {
  raceHeadline,
  raceStars,
} from "../../src/ts/games/type-racer/racer-result";

/** Deterministic rng cycling through the given values. */
const seq = (...values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

describe("tower climb", () => {
  it("climbs one floor per word and double-jumps on a clean streak", () => {
    let s = initialTower();
    for (let i = 0; i < STREAK_FOR_DOUBLE; i++) s = towerOnWord(s, true);
    expect(s.floor).toBe(STREAK_FOR_DOUBLE + 1);
    expect(s.doubleJumps).toBe(1);
  });

  it("slides after three cracks but never below the ground", () => {
    let s = towerOnWord(initialTower(), true);
    s = towerOnTypo(s, 2).state;
    s = towerOnTypo(s, 2).state;
    const third = towerOnTypo(s, 2);
    expect(third.slid).toBe(true);
    expect(third.state.floor).toBe(0);
    expect(third.state.cracks).toBe(0);
    expect(third.state.highest).toBe(1);
  });

  it("a typo resets the streak and the score rewards height", () => {
    const s = towerOnTypo(towerOnWord(initialTower(), true), 1).state;
    expect(s.streak).toBe(0);
    expect(towerScore({ ...s, highest: 10, words: 10, typos: 0 })).toBe(120);
  });

  it("gives stars scaled to the round length", () => {
    expect(towerStars(0, 60)).toBe(0);
    expect(towerStars(3, 60)).toBe(1);
    expect(towerStars(8, 60)).toBe(2);
    expect(towerStars(15, 60)).toBe(3);
    expect(towerStars(11, 45)).toBe(3);
  });
});

describe("snack shop", () => {
  it("gives stars for customers served", () => {
    expect([0, 1, 8, 15].map(snackStars)).toEqual([0, 1, 2, 3]);
  });

  it("builds orders from the word list", () => {
    expect(makeOrder(["cat", "dog"], 1, seq(0))).toBe("cat");
    expect(makeOrder(["cat", "dog", "sun"], 3, seq(0.99, 0, 0.5, 0.99))).toBe(
      "cat dog sun",
    );
    expect(makeOrder([], 2, seq(0))).toBe("snack");
  });

  it("scores serves, doubles in rush hour, and ends after 3 misses", () => {
    let s = initialSnack();
    s = snackOnServe(s, "cat", 1); // 6 + 10
    expect(s.score).toBe(16);
    s = snackOnServe(snackOnServe(s, "cat", 0), "cat", 0);
    expect(isRushHour(s)).toBe(true);
    const before = s.score;
    s = snackOnServe(s, "cat", 0);
    expect(s.score - before).toBe(12);
    s = snackOnMiss(snackOnMiss(snackOnMiss(s)));
    expect(s.combo).toBe(0);
    expect(snackIsOver(s)).toBe(true);
  });
});

describe("echo keys", () => {
  it("gives stars for the longest pattern", () => {
    expect([0, 3, 5, 8].map(echoStars)).toEqual([0, 1, 2, 3]);
  });

  it("never repeats a key twice in a row", () => {
    const keys = ["a", "s", "d"];
    const out = makeSequence(keys, 6, seq(0, 0, 0, 0, 0, 0));
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
  });

  it("grows the pattern on a win and ends when lives run out", () => {
    let s = echoOnRoundWin(initialEcho());
    expect(s).toMatchObject({ length: 4, score: 30, rounds: 1, longest: 3 });
    s = echoOnMistake(echoOnMistake(echoOnMistake(s)));
    expect(echoIsOver(s)).toBe(true);
  });
});

describe("wave game result", () => {
  const base = { score: 50, wave: 1, hits: 3, misses: 1 };
  it("gives stars by wave, and 3 for a cleared lesson", () => {
    expect(waveStars({ ...base, score: 0 })).toBe(0);
    expect(waveStars(base)).toBe(1);
    expect(waveStars({ ...base, wave: 3 })).toBe(2);
    expect(waveStars({ ...base, wave: 6 })).toBe(3);
    expect(waveStars({ ...base, cleared: true })).toBe(3);
    expect(waveAccuracy(base)).toBe(75);
  });
});

describe("type racer result", () => {
  const r = {
    playerWon: false,
    wpm: 20,
    accuracy: 90,
    elapsed: 60,
    wordsTyped: 10,
    marginChars: 30,
  };
  it("gives 3 for a win, 2 for a photo finish, 1 otherwise", () => {
    expect(raceStars({ ...r, playerWon: true })).toBe(3);
    expect(raceStars({ ...r, marginChars: 4 })).toBe(2);
    expect(raceStars(r)).toBe(1);
    expect(raceStars({ ...r, wordsTyped: 0 })).toBe(0);
    expect(raceHeadline({ ...r, marginChars: 2 })).toBe("Photo finish!");
  });
});

describe("type toss result", () => {
  const d = {
    score: 50,
    wordsTyped: 10,
    hits: 10,
    misses: 0,
    totalChars: 50,
    totalTime: 60,
  };
  it("gives stars by words per minute", () => {
    expect(tossWpm(d)).toBe(10);
    expect(tossStars(d)).toBe(2);
    expect(tossStars({ ...d, totalChars: 100 })).toBe(3);
    expect(tossStars({ ...d, totalChars: 20 })).toBe(1);
    expect(tossStars({ ...d, wordsTyped: 0 })).toBe(0);
  });
});

describe("typing quest result", () => {
  it("gives stars by waves cleared", () => {
    expect([0, 1, 2, 5].map(questStars)).toEqual([0, 1, 2, 3]);
  });
});

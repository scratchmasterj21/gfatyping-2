import { describe, expect, it } from "vitest";

import {
  botReturn,
  botShot,
  giantWord,
  goldenRally,
  powerWord,
  TOURNAMENT,
  initialPong,
  onMiss,
  onReturn,
  PONG_DIFFICULTIES,
  pongScore,
  pongStars,
  speedFor,
  WIN_POINTS,
  wordForRally,
} from "../../src/ts/games/word-pong/pong-rules";

const easy = PONG_DIFFICULTIES[0]!;

describe("word ping-pong", () => {
  it("sends the ball back and forth, counting hits", () => {
    let s = initialPong("cat", "left");
    s = onReturn(s, "dog");
    expect(s.toSide).toBe("right");
    expect(s.hits).toBe(1);
    expect(s.seq).toBe(2);
    expect(s.word).toBe("dog");
  });

  it("a miss scores for the other side and resets the rally", () => {
    let s = onReturn(initialPong("cat", "left"), "dog");
    s = onMiss(s, "sun");
    expect(s.score).toEqual({ left: 1, right: 0 });
    expect(s.hits).toBe(0);
    expect(s.toSide).toBe("left");
    expect(s.lastPoint).toBe("left");
  });

  it("ends at the winning score", () => {
    let s = initialPong("cat", "right");
    for (let i = 0; i < WIN_POINTS; i++)
      s = onMiss({ ...s, toSide: "right", golden: false }, "x");
    expect(s.over).toBe(true);
    expect(s.score.left).toBe(WIN_POINTS);
  });

  it("speeds up with hits but never past the minimum", () => {
    expect(speedFor(easy, 0)).toBe(8000);
    expect(speedFor(easy, 3)).toBe(6800);
    expect(speedFor(easy, 99)).toBe(easy.minMs);
  });

  it("starts rallies with short words and grows them", () => {
    const pool = ["cat", "dog", "apple", "bananas", "mountain"];
    expect(wordForRally(pool, 0, 1).length).toBeLessThanOrEqual(5);
    expect(wordForRally(pool, 8, 1).length).toBeGreaterThanOrEqual(7);
    expect(wordForRally([], 0, 1)).toBe("pong");
  });

  it("Tappy is slower and less accurate on long words", () => {
    expect(botReturn(easy, "cat", () => 0).returns).toBe(true);
    expect(botReturn(easy, "cat", () => 0.99).returns).toBe(false);
    expect(botReturn(easy, "cat", () => 0).delayMs).toBeLessThan(
      botReturn(easy, "elephant", () => 0).delayMs,
    );
  });

  it("scores and stars", () => {
    expect(pongScore(7, true)).toBe(100);
    expect(pongStars(7, true)).toBe(3);
    expect(pongStars(5, false)).toBe(2);
    expect(pongStars(1, false)).toBe(1);
    expect(pongStars(0, false)).toBe(0);
  });

  it("smashes and fire balls fly faster, giant balls slower", () => {
    const base = speedFor(easy, 2);
    expect(speedFor(easy, 2, { smash: true })).toBeLessThan(base);
    expect(speedFor(easy, 2, { ball: "fire" })).toBeLessThan(base);
    expect(speedFor(easy, 2, { ball: "giant" })).toBeGreaterThan(base);
    // a smash takes about half the time
    expect(speedFor(easy, 2, { smash: true })).toBeLessThanOrEqual(base * 0.5);
    // never impossibly fast
    expect(
      speedFor(easy, 99, { smash: true, ball: "fire" }),
    ).toBeGreaterThanOrEqual(easy.minMs * 0.42);
    expect(speedFor(easy, 99, { ball: "fire" })).toBeGreaterThanOrEqual(
      easy.minMs * 0.55,
    );
  });

  it("a return carries the shot, the next return clears it", () => {
    let s = onReturn(initialPong("cat", "left"), "dog", {
      shot: "spin",
      smash: true,
    });
    expect(s.ball).toBe("spin");
    expect(s.smash).toBe(true);
    s = onReturn(s, "sun");
    expect(s.ball).toBeUndefined();
    expect(s.smash).toBeUndefined();
  });

  it("golden rallies are worth 2 and some rallies are golden", () => {
    const golden = { ...initialPong("cat", "right"), golden: true };
    expect(onMiss(golden, "x").score.left).toBe(2);
    const goldens = Array.from({ length: 120 }, (_, i) => i).filter(
      goldenRally,
    );
    expect(goldens.length).toBeGreaterThan(8);
    expect(goldens.length).toBeLessThan(40);
  });

  it("tournament target and series count wins", () => {
    let s = initialPong("cat", "right", { target: 5 });
    for (let i = 0; i < 5; i++)
      s = onMiss({ ...s, toSide: "right", golden: false }, "x");
    expect(s.over).toBe(true);
    expect(s.series).toEqual({ left: 1, right: 0 });
  });

  it("giant words are long, power words short", () => {
    const pool = ["cat", "dog", "sun", "elephant", "butterfly", "map"];
    expect(giantWord(pool, 3).length).toBeGreaterThanOrEqual(8);
    expect(powerWord(pool, 2).length).toBeLessThanOrEqual(4);
  });

  it("tricky bots send special shots", () => {
    const frog = TOURNAMENT.find((b) => b.id === "frog")!;
    expect(botShot(frog, 3, 0.5).shot).toBeDefined();
    expect(botShot(frog, 1, 0.5).shot).toBeUndefined();
    expect(botReturn(easy, "cat", () => 0.55, "ghost").returns).toBe(false);
  });
});

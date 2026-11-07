import { describe, expect, it } from "vitest";

import {
  applyBoom,
  applyPass,
  BOMB_DIFFICULTIES,
  BombDifficulty,
  bombPlace,
  bombScore,
  BombState,
  bombStars,
  BOOM_PAUSE_MS,
  explodeAt,
  fuseFor,
  newBombMatch,
  nextAlive,
  START_LIVES,
  wordForPass,
} from "../../src/ts/games/word-bomb/bomb-rules";

const D = BOMB_DIFFICULTIES[0] as BombDifficulty;
const rng0 = (): number => 0;

function start(order = ["a", "b", "c"]): BombState {
  return newBombMatch(order, D, 0, rng0);
}

describe("word bomb", () => {
  it("starts everyone with lives and a lit bomb", () => {
    const s = start();
    expect(s.lives).toEqual({ a: START_LIVES, b: START_LIVES, c: START_LIVES });
    expect(s.holder).toBe("a");
    expect(s.word.length).toBeGreaterThan(0);
    expect(s.fuseEndAt).toBeGreaterThan(s.roundStartAt);
  });

  it("only the holder can pass, and only while lit", () => {
    const s = start();
    expect(applyPass(s, "a", D, 0, rng0)).toBeNull(); // not lit yet
    const now = s.roundStartAt + 100;
    expect(applyPass(s, "b", D, now, rng0)).toBeNull();
    const p = applyPass(s, "a", D, now, rng0) as BombState;
    expect(p.holder).toBe("b");
    expect(p.passes).toBe(1);
    expect(p.totalPasses.a).toBe(1);
    expect(p.lastPass).toEqual({ from: "a", to: "b" });
    expect(applyPass(s, "a", D, explodeAt(s), rng0)).toBeNull();
  });

  it("passing goes round the circle, skipping knocked-out players", () => {
    const s = { ...start(), lives: { a: 1, b: 0, c: 2 } };
    expect(nextAlive(s, "a")).toBe("c");
    expect(nextAlive(s, "c")).toBe("a");
  });

  it("never goes off right after you catch it", () => {
    const s = start();
    const late = s.fuseEndAt - 100;
    const p = applyPass(s, "a", D, late, rng0) as BombState;
    expect(explodeAt(p)).toBe(late + D.minHoldMs);
  });

  it("boom costs the holder a life and lights a new round for the next player", () => {
    const s = start();
    expect(applyBoom(s, D, explodeAt(s) - 1, rng0)).toBeNull();
    const at = explodeAt(s);
    const b = applyBoom(s, D, at, rng0) as BombState;
    expect(b.lives.a).toBe(START_LIVES - 1);
    expect(b.lastBoom).toEqual({ id: "a", at });
    expect(b.holder).toBe("b");
    expect(b.roundNo).toBe(2);
    expect(b.roundStartAt).toBe(at + BOOM_PAUSE_MS);
  });

  it("last player standing wins; places and scores follow knock-out order", () => {
    let s = start(["a", "b", "c"]);
    // a loses all lives, then b
    const boomOn = (id: string): void => {
      s = { ...s, holder: id };
      s = applyBoom(s, D, explodeAt(s), rng0) as BombState;
    };
    for (let i = 0; i < START_LIVES; i++) boomOn("a");
    expect(s.outAt?.a).toBeDefined();
    expect(s.over).toBe(false);
    for (let i = 0; i < START_LIVES; i++) boomOn("b");
    expect(s.over).toBe(true);
    expect(s.winner).toBe("c");
    expect(bombPlace(s, "c")).toBe(1);
    expect(bombPlace(s, "b")).toBe(2);
    expect(bombPlace(s, "a")).toBe(3);
    expect(bombStars(s, "c")).toBe(3);
    expect(bombScore(s, "c")).toBeGreaterThan(bombScore(s, "b"));
    expect(bombScore(s, "b")).toBeGreaterThan(bombScore(s, "a"));
  });

  it("words get longer later in a round; fuses get shorter each round", () => {
    const easy = wordForPass(D, 0, rng0);
    const later = wordForPass(D, D.harderAfter, rng0);
    expect(D.words[0]).toContain(easy);
    expect(D.words[1]).toContain(later);
    expect(fuseFor(D, 5, rng0)).toBeLessThan(fuseFor(D, 1, rng0));
    expect(wordForPass(D, 0, rng0, easy)).not.toBe(easy);
  });
});

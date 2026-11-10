import { describe, expect, it } from "vitest";

import {
  assignRaidTeams,
  currentCharge,
  heartsAt,
  raidDifficultyFor,
  RaidFacts,
  raidScore,
  raidView,
  RAID_TIME_LIMIT_MS,
  seededRandom,
  shieldWord,
  START_HEARTS,
  waveFor,
  wordDamage,
  wordStream,
} from "../../src/ts/games/monster-raid/raid-rules";

const EASY = raidDifficultyFor("Easy");
const START = 1_000_000;

function facts(over: Partial<RaidFacts> = {}): RaidFacts {
  return {
    mode: "coop",
    difficulty: EASY,
    startAt: START,
    teams: { a: "red", b: "red" },
    dealt: {},
    blocked: {},
    clearedAt: {},
    ...over,
  };
}

describe("monster raid rules", () => {
  it("longer, clean words hit harder", () => {
    expect(wordDamage("cat", true, 1)).toBe(2);
    expect(wordDamage("elephant", true, 1)).toBe(4);
    expect(wordDamage("elephant", true, 3)).toBe(5);
    expect(wordDamage("elephant", true, 6)).toBe(6);
    expect(wordDamage("elephant", false, 6)).toBe(4);
  });

  it("waves split the HP: minion, minion, boss", () => {
    expect(waveFor(0, 200)).toMatchObject({ index: 0, hp: 50, maxHp: 50 });
    expect(waveFor(60, 200)).toMatchObject({ index: 1, hp: 40 });
    expect(waveFor(150, 200)).toMatchObject({ index: 2, hp: 50, maxHp: 100 });
    expect(waveFor(250, 200)).toMatchObject({ cleared: true, hp: 0 });
  });

  it("attacks charge before they land", () => {
    const every = EASY.attackEveryMs;
    expect(currentCharge(START, START + 1000, EASY)).toBeNull();
    const c = currentCharge(START, START + every - 1000, EASY);
    expect(c).toEqual({
      k: 1,
      startsAt: START + every - EASY.chargeMs,
      landsAt: START + every,
    });
  });

  it("unblocked attacks cost hearts", () => {
    const every = EASY.attackEveryMs;
    expect(heartsAt(START, START + every * 2, EASY, new Set()).hearts).toBe(
      START_HEARTS - 2,
    );
    expect(heartsAt(START, START + every * 2, EASY, new Set([1])).hearts).toBe(
      START_HEARTS - 1,
    );
    const ko = heartsAt(START, START + every * 9, EASY, new Set());
    expect(ko).toEqual({ hearts: 0, knockedOutAt: START + every * 5 });
  });

  it("everyone sees the same words", () => {
    const words = ["apple", "tiger", "cat", "rocket", "pizza"];
    expect(shieldWord(7, 3, words)).toBe(shieldWord(7, 3, words));
    expect(shieldWord(7, 3, words).length).toBeGreaterThanOrEqual(4);
    expect(wordStream(7, "u1", words)).toEqual(wordStream(7, "u1", words));
    expect(wordStream(7, "u1", words).toSorted()).toEqual(words.toSorted());
  });

  it("teams are even, 2-4 of them", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    const t3 = assignRaidTeams(six, 3, seededRandom(1));
    expect(new Set(Object.values(t3)).size).toBe(2);
    const t2 = assignRaidTeams(six, 2, seededRandom(1));
    expect(new Set(Object.values(t2)).size).toBe(3);
    expect(Object.values(t2).filter((t) => t === "red").length).toBe(2);
    expect(new Set(Object.values(assignRaidTeams(["a", "b"], 3))).size).toBe(2);
  });

  it("co-op: beat the boss to win, lose all hearts to lose", () => {
    const now = START + 5000;
    const won = raidView(facts({ clearedAt: { red: now - 100 } }), now);
    expect(won).toMatchObject({ over: true, winner: "red", reason: "cleared" });

    const lost = raidView(facts(), START + EASY.attackEveryMs * 6);
    expect(lost).toMatchObject({ over: true, reason: "hearts" });
    expect(lost.winner).toBeUndefined();
    expect(lost.teams[0]?.hearts).toBe(0);

    const going = raidView(facts({ dealt: { a: 10, b: 5 } }), now);
    expect(going.over).toBe(false);
    expect(going.teams[0]?.dealt).toBe(15);
    expect(going.teams[0]?.maxHp).toBe(EASY.hpPerPlayer * 2);
  });

  it("teams: first to beat their boss wins", () => {
    const f = facts({
      mode: "teams",
      teams: { a: "red", b: "red", c: "blue", d: "blue" },
      clearedAt: { blue: START + 9000, red: START + 9500 },
    });
    expect(raidView(f, START + 10_000).winner).toBe("blue");
  });

  it("teams: time up - furthest team wins", () => {
    const f = facts({
      mode: "teams",
      teams: { a: "red", c: "blue" },
      dealt: { a: 50, c: 20 },
      blocked: {
        red: new Set(Array.from({ length: 40 }, (_, i) => i + 1)),
        blue: new Set(Array.from({ length: 40 }, (_, i) => i + 1)),
      },
    });
    const v = raidView(f, START + RAID_TIME_LIMIT_MS + 1);
    expect(v).toMatchObject({ over: true, reason: "time", winner: "red" });
  });

  it("score adds damage, blocks and bonuses", () => {
    expect(raidScore({ dealt: 30, blocks: 2, won: true, mvp: true })).toBe(100);
    expect(raidScore({ dealt: 0, blocks: 0, won: false, mvp: false })).toBe(0);
  });
});

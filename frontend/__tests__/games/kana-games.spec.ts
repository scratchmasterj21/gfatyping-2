import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/ts/utils/json-data", () => ({ getLanguage: vi.fn() }));

import {
  buildFish,
  fishPoints,
  goldfishRanking,
  GOLDFISH_MS,
  visibleFish,
} from "../../src/ts/games/kana/goldfish-rules";
import {
  KANA_DIFFICULTIES,
  KanaDifficulty,
  KARUTA_CARDS,
  seededRng,
} from "../../src/ts/games/kana/kana-words";
import {
  applyKarutaSkip,
  applyKarutaTake,
  KARUTA_ROUND_MS,
  KarutaState,
  newKarutaMatch,
  satOut,
} from "../../src/ts/games/kana/karuta-rules";
import {
  applyShiritoriPass,
  chainKana,
  chainOptions,
  newShiritoriMatch,
} from "../../src/ts/games/kana/shiritori-rules";
import { kanaUnits } from "../../src/ts/lessons/kana-romaji";

const EASY = KANA_DIFFICULTIES[0] as KanaDifficulty;
const HARD = KANA_DIFFICULTIES[2] as KanaDifficulty;
const rng = seededRng(7);

describe("karuta cards", () => {
  it("every card can be typed", () => {
    for (const c of KARUTA_CARDS) {
      expect(kanaUnits(c.kana).length).toBeGreaterThan(0);
    }
    expect(new Set(KARUTA_CARDS.map((c) => c.kana)).size).toBe(
      KARUTA_CARDS.length,
    );
  });
});

describe("karuta battle", () => {
  const start = (): KarutaState => newKarutaMatch(["a", "b"], EASY, 0, rng);

  it("deals a table and picks a clue from it", () => {
    const s = start();
    expect(s.table).toHaveLength(6);
    expect(s.table).toContain(s.clue);
    expect(s.table.every((k) => k.length <= EASY.maxLen)).toBe(true);
  });

  it("taking the clue card scores and refills the table", () => {
    const s = start();
    const t = applyKarutaTake(s, "a", s.clue, s.roundStartAt, rng);
    expect(t?.scores.a).toBe(1);
    expect(t?.table).not.toContain(s.clue);
    expect(t?.table).toHaveLength(6);
    expect(t?.round).toBe(2);
  });

  it("a wrong card makes you sit out the round", () => {
    const s = start();
    const wrong = s.table.find((k) => k !== s.clue) as string;
    const f = applyKarutaTake(
      s,
      "a",
      wrong,
      s.roundStartAt,
      rng,
    ) as KarutaState;
    expect(satOut(f, "a")).toBe(true);
    expect(applyKarutaTake(f, "a", f.clue, f.roundStartAt, rng)).toBeNull();
    expect(applyKarutaTake(f, "b", f.clue, f.roundStartAt, rng)).not.toBeNull();
  });

  it("nobody finds it: a new clue after the round time", () => {
    const s = start();
    expect(applyKarutaSkip(s, s.roundStartAt + 10, rng)).toBeNull();
    const k = applyKarutaSkip(s, s.roundStartAt + KARUTA_ROUND_MS, rng);
    expect(k?.round).toBe(2);
    expect(k?.last?.kind).toBe("skip");
  });

  it("the game ends when the cards run out", () => {
    let s = start();
    while (!s.over) {
      s = applyKarutaTake(s, "a", s.clue, s.roundStartAt, rng) as KarutaState;
    }
    expect(s.scores.a).toBe(16);
  });
});

describe("goldfish scooping", () => {
  const pool = ["いぬ", "ねこ", "さかな", "くじら", "かめ", "たこ", "とり"];

  it("the same seed builds the same pond for everyone", () => {
    const a = buildFish(42, EASY, pool);
    const b = buildFish(42, EASY, pool);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(20);
    expect(a.every((f) => f.spawnAt < GOLDFISH_MS)).toBe(true);
    expect(a.every((f) => f.word.length <= EASY.maxLen)).toBe(true);
  });

  it("scooped fish disappear and score their kana (golden x2)", () => {
    const fish = buildFish(42, HARD, pool);
    const game = { startAt: 0, order: ["a", "b"] };
    const first = fish[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const t = first.spawnAt + 100;
    expect(visibleFish(fish, game, {}, t)).toContain(first);
    const caught = { [String(first.index)]: "a" };
    expect(visibleFish(fish, game, caught, t)).not.toContain(first);
    expect(goldfishRanking(game, fish, caught)[0]).toEqual({
      id: "a",
      points: fishPoints(first),
      count: 1,
    });
  });
});

describe("shiritori bomb", () => {
  const pool = [
    "りんご",
    "ごりら",
    "らっぱ",
    "ぱんだ",
    "だんご",
    "ごま",
    "まくら",
    "らいおん",
    "きゃべつ",
    "つみき",
  ];

  it("finds the kana the next word starts with", () => {
    expect(chainKana("りんご")).toBe("ご");
    expect(chainKana("きしゃ")).toBe("や");
    expect(chainKana("らーめん")).toBe("ん");
    expect(chainKana("こーひー")).toBe("ひ");
  });

  it("offers words that continue the chain and never end in ん", () => {
    const opts = chainOptions("ごりら", pool, HARD, rng);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((w) => w.startsWith("ら"))).toBe(true);
    expect(opts).not.toContain("らいおん");
  });

  it("passing with an option extends the chain", () => {
    const s = newShiritoriMatch(["a", "b"], HARD, pool, 0, rng);
    const holder = s.holder;
    const option = s.options[0] as string;
    expect(
      applyShiritoriPass(s, holder, "nope", HARD, pool, s.roundStartAt, rng),
    ).toBeNull();
    const p = applyShiritoriPass(
      s,
      holder,
      option,
      HARD,
      pool,
      s.roundStartAt,
      rng,
    );
    expect(p?.word).toBe(option);
    expect(p?.holder).not.toBe(holder);
    expect(p?.options.every((w) => w.startsWith(chainKana(option)))).toBe(true);
  });
});

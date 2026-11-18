import { describe, expect, it } from "vitest";

import {
  buildParty,
  HeroInput,
  pendingDeadline,
  QuestInput,
  questDifficultyFor,
  QuestSetup,
  runQuest,
  tallyVotes,
  TWIST_IDS,
  weeklyPlan,
  typingPower,
  VOTE_MS,
} from "../../src/ts/games/monster-quest/quest-rules";

const solo = (seed = 42): QuestSetup => ({
  seed,
  difficulty: questDifficultyFor("Easy"),
  party: buildParty([{ uid: "me", name: "Ann", cls: "mage" }]),
});

/** Play a whole quest answering every prompt the same way. */
function playThrough(
  setup: QuestSetup,
  answer: (s: ReturnType<typeof runQuest>) => QuestInput,
): ReturnType<typeof runQuest> {
  const inputs: QuestInput[] = [];
  let s = runQuest(setup, inputs);
  for (let i = 0; i < 500 && !s.over; i++) {
    const p = s.pending;
    inputs.push(
      p?.kind === "vote"
        ? { kind: "vote", votes: { me: pick(p.topic, p.options) } }
        : p?.kind === "pick"
          ? { kind: "vote", votes: { me: p.options.me?.[0]?.id ?? "" } }
          : p?.kind === "challenge"
            ? { kind: "guard", guards: { me: true } }
            : answer(s),
    );
    s = runQuest(setup, inputs);
  }
  return s;
}

let landPick = "forest";
let bossPick = 0;
const pick = (topic: string, options: { id: string }[]): string =>
  topic === "land" ? landPick : (options[bossPick]?.id ?? "x");

/** Past the land vote. */
const started = (setup: QuestSetup): ReturnType<typeof runQuest> =>
  runQuest(setup, [{ kind: "vote", votes: { me: "forest" } }]);

describe("monster quest", () => {
  it("fills the party with helpers", () => {
    const party = buildParty([
      { uid: "a", name: "A", cls: "healer" },
      { uid: "b", name: "B", cls: "healer" },
    ]);
    expect(party.map((h) => h.cls)).toEqual([
      "healer",
      "knight",
      "mage",
      "guardian",
    ]);
    expect(party.filter((h) => h.uid === null)).toHaveLength(2);
  });

  it("scores typing", () => {
    expect(typingPower("cat", 0, 1000)).toBe(1.5);
    expect(typingPower("cat", 0, 9000)).toBe(1);
    expect(typingPower("cat", 1, 1000)).toBe(0.75);
    expect(typingPower("cat", 5, 1000)).toBe(0.55);
  });

  it("starts with a vote for the land", () => {
    const s = runQuest(solo(), []);
    expect(s.over).toBe(false);
    expect(s.pending?.kind).toBe("vote");
    expect(s.events).toHaveLength(0);
    expect(pendingDeadline(s, 1000, [])).toBe(1000 + VOTE_MS);
  });

  it("waits for the player's turn", () => {
    const s = started(solo());
    expect(s.land).toBe("forest");
    expect(s.pending?.kind).toBe("hero");
    expect(s.events[0]?.type).toBe("path");
    expect(s.events[1]?.type).toBe("battle");
  });

  it("counts votes, ties go to the seed", () => {
    const opts = [{ id: "a" }, { id: "b" }, { id: "c" }].map((o) => ({
      ...o,
      label: o.id,
      emoji: "",
      detail: "",
    }));
    const rng = (): number => 0.99;
    expect(
      tallyVotes(opts, { x: "b", y: "b", z: "a" }, ["x", "y", "z"], rng).id,
    ).toBe("b");
    expect(tallyVotes(opts, { x: "a", y: "b" }, ["x", "y"], rng).id).toBe("b");
    expect(tallyVotes(opts, {}, ["x"], rng).id).toBe("c");
    // votes from outsiders don't count
    expect(tallyVotes(opts, { q: "a" }, ["x"], rng).id).toBe("c");
  });

  it("is the same on every screen", () => {
    const a = playThrough(solo(7), () => ({
      kind: "hero",
      action: "skill",
      power: 1,
    }));
    const b = playThrough(solo(7), () => ({
      kind: "hero",
      action: "skill",
      power: 1,
    }));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it("a good player beats every land and boss", () => {
    for (const land of ["forest", "mountain", "castle"]) {
      for (const boss of [0, 1]) {
        landPick = land;
        bossPick = boss;
        for (const seed of [1, 2, 3]) {
          const s = playThrough(solo(seed), (st) =>
            st.pending?.kind === "guard"
              ? { kind: "guard", guards: { me: true } }
              : { kind: "hero", action: "skill", power: 1.5 },
          );
          expect(s.won, `${land} ${boss} ${seed}`).toBe(true);
        }
      }
    }
    landPick = "forest";
    bossPick = 0;
  });

  it("a good player beats the quest", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = playThrough(solo(seed), (st) =>
        st.pending?.kind === "guard"
          ? { kind: "guard", guards: { me: true } }
          : { kind: "hero", action: "skill", power: 1.5 },
      );
      expect(s.over).toBe(true);
      expect(s.won).toBe(true);
      expect(s.battle).toBe(2);
    }
  });

  it("an idle player is taken over by a helper", () => {
    const timeout: HeroInput = {
      kind: "hero",
      action: "attack",
      power: 0.4,
      timeout: true,
    };
    const s = playThrough(solo(9), (st) =>
      st.pending?.kind === "guard" ? { kind: "guard", guards: {} } : timeout,
    );
    expect(s.over).toBe(true);
    expect(s.heroes[0]?.away).toBe(true);
    // only a couple of prompts before the helper took over
    expect(s.used).toBeLessThan(15);
  });

  it("has journey stops, weather and a level up before the boss", () => {
    const s = playThrough(solo(11), (st) =>
      st.pending?.kind === "guard"
        ? { kind: "guard", guards: { me: true } }
        : { kind: "hero", action: "ultimate", power: 1.5 },
    );
    const types = s.events.map((e) => e.type);
    expect(types.filter((t) => t === "journey")).toHaveLength(2);
    expect(types.filter((t) => t === "levelup")).toHaveLength(1);
    // level up comes before the boss battle
    const lvl = types.indexOf("levelup");
    const bossBattle = s.events.findIndex(
      (e) => e.type === "battle" && e.battle === 2,
    );
    expect(lvl).toBeLessThan(bossBattle);
    expect(
      s.heroes.every((h) => h.level === 2 && h.ultimate !== undefined),
    ).toBe(true);
    // my pick (the first choice) was used
    expect(s.heroes[0]?.ultimate).toBe("icestorm");
    const ult = s.events.find(
      (e) => e.type === "action" && e.actor === "h0" && e.move === "Ice Storm",
    );
    expect(ult).toBeDefined();
    for (const e of s.events) {
      if (e.type === "battle") {
        expect(["clear", "rain", "sun", "wind"]).toContain(e.weather);
      }
    }
  });

  it("chains combos and fires Team Attacks", () => {
    let combos = 0;
    let teams = 0;
    for (const seed of [1, 2, 3, 4]) {
      const s = playThrough(solo(seed), (st) =>
        st.pending?.kind === "guard"
          ? { kind: "guard", guards: { me: true } }
          : { kind: "hero", action: "skill", power: 1.5 },
      );
      for (const e of s.events) {
        if (e.type === "action" && e.combo !== undefined) combos++;
        if (e.type === "team") {
          teams++;
          expect(e.hits.length).toBeGreaterThan(0);
          expect(e.ids).toContain("h0");
        }
      }
      expect(s.spirit).toBeLessThan(16);
    }
    expect(combos).toBeGreaterThan(0);
    expect(teams).toBeGreaterThan(0);
  });

  it("weekly quest: same plan all week, no land / boss vote, twist applies", () => {
    const week = Date.UTC(2026, 10, 16) - 9 * 3600_000;
    const a = weeklyPlan(week);
    expect(weeklyPlan(week)).toEqual(a);
    expect(TWIST_IDS).toContain(a.twist);
    // several weeks give different quests
    const plans = [0, 1, 2, 3, 4, 5].map((n) =>
      JSON.stringify(weeklyPlan(week + n * 7 * 86400_000)),
    );
    expect(new Set(plans).size).toBeGreaterThan(2);

    for (const twist of TWIST_IDS) {
      const setup: QuestSetup = {
        seed: a.seed,
        difficulty: questDifficultyFor("Medium"),
        party: buildParty([{ uid: "me", name: "Ann", cls: "mage" }]),
        weekly: { ...a, twist },
      };
      const first = runQuest(setup, []);
      expect(first.pending?.kind).toBe("hero");
      expect(first.land).toBe(a.land);
      if (twist === "giant") expect(first.potions).toBe(5);
      if (twist === "gold") expect(first.gold).toBe(25);
      const s = playThrough(setup, (st) =>
        st.pending?.kind === "guard"
          ? { kind: "guard", guards: { me: true } }
          : { kind: "hero", action: "skill", power: 1.5 },
      );
      const bossBattle = s.events.find(
        (e) => e.type === "battle" && e.battle === 2,
      );
      if (bossBattle?.type === "battle") {
        expect(bossBattle.monsters[0]?.kind).toBe(a.boss);
      }
      expect(
        s.events.some((e) => e.type === "path" && e.topic === "boss"),
      ).toBe(true);
      if (twist === "rain") {
        for (const e of s.events) {
          if (e.type === "battle") expect(e.weather).toBe("rain");
        }
      }
      if (twist === "gold") {
        expect(s.events.filter((e) => e.type === "journey").at(-1)).toEqual({
          type: "journey",
          what: "shop",
        });
      }
    }
  });

  it("levels up after the first fight and super moves recharge", () => {
    const s = playThrough(solo(3), (st) =>
      st.pending?.kind === "guard"
        ? { kind: "guard", guards: { me: true } }
        : { kind: "hero", action: "ultimate", power: 1.5 },
    );
    const lvl = s.events.findIndex((e) => e.type === "levelup");
    const battle2 = s.events.findIndex(
      (e) => e.type === "battle" && e.battle === 1,
    );
    expect(lvl).toBeGreaterThan(-1);
    expect(lvl).toBeLessThan(battle2);
    // used again in the same battle once it recharged
    let battle = -1;
    const perBattle: Record<number, number> = {};
    for (const e of s.events) {
      if (e.type === "battle") battle = e.battle;
      if (e.type === "action" && e.actor === "h0" && e.ultimate !== undefined) {
        perBattle[battle] = (perBattle[battle] ?? 0) + 1;
      }
    }
    expect(Math.max(...Object.values(perBattle))).toBeGreaterThan(1);
  });

  it("gives a turn deadline", () => {
    const s = started(solo());
    const d = pendingDeadline(s, 1000, [2000]);
    expect(d).toBeGreaterThan(2000 + 20_000);
  });

  it("asks for several words per move", () => {
    const p = started(solo()).pending;
    expect(p?.kind).toBe("hero");
    if (p?.kind !== "hero") return;
    expect(p.words.attack.split(" ")).toHaveLength(3);
    expect(p.words.skill.split(" ")).toHaveLength(4);
    expect(p.words.defend.split(" ")).toHaveLength(3);
    expect(p.words.ultimate.split(" ")).toHaveLength(5);
    const hard = started({
      ...solo(),
      difficulty: questDifficultyFor("Hard"),
    }).pending;
    if (hard?.kind === "hero") {
      expect(hard.words.attack.split(" ")).toHaveLength(5);
      expect(hard.words.skill.split(" ")).toHaveLength(6);
    }
  });
});

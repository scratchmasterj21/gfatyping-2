import { describe, expect, it } from "vitest";

import {
  buildParty,
  CLASS_INFO,
  comboFor,
  FREE_HEROES,
  HERO_CLASSES,
  HERO_SETS,
  HeroClass,
  HeroInput,
  LANDS,
  QuestEvent,
  SPIRIT_TURNS,
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
    for (const land of ["forest", "mountain", "castle", "ruins"]) {
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

  it("an idle player is taken over by a helper (online only)", () => {
    const timeout: HeroInput = {
      kind: "hero",
      action: "attack",
      power: 0.4,
      timeout: true,
    };
    const answer = (st: ReturnType<typeof runQuest>): QuestInput =>
      st.pending?.kind === "guard" ? { kind: "guard", guards: {} } : timeout;
    const online = playThrough(
      {
        ...solo(9),
        party: buildParty([
          { uid: "a", name: "A", cls: "mage" },
          { uid: "b", name: "B", cls: "knight" },
        ]),
      },
      answer,
    );
    expect(online.heroes[0]?.away).toBe(true);
    // solo: never handed over - the player keeps their turns
    const s = playThrough(solo(9), answer);
    expect(s.heroes[0]?.away).toBe(false);
  });

  it("an away player still gets short turns and comes back by typing", () => {
    const party = buildParty([
      { uid: "a", name: "A", cls: "mage" },
      { uid: "b", name: "B", cls: "knight" },
    ]);
    const setup = { ...solo(9), party };
    const inputs: QuestInput[] = [];
    const timeout: HeroInput = {
      kind: "hero",
      action: "attack",
      power: 0.4,
      timeout: true,
    };
    // "a" misses turns until away; everyone else answers
    let st = runQuest(setup, inputs);
    let guard = 0;
    while (st.heroes[0]?.away !== true && guard++ < 50) {
      const p = st.pending;
      if (p === null) break;
      inputs.push(
        p.kind === "hero"
          ? p.uid === "a"
            ? timeout
            : { kind: "hero", action: "attack", power: 1 }
          : p.kind === "guard" || p.kind === "challenge"
            ? { kind: "guard", guards: {} }
            : { kind: "vote", votes: {} },
      );
      st = runQuest(setup, inputs);
    }
    expect(st.heroes[0]?.away).toBe(true);
    // play on until it's "a"'s turn again: still asked, with a short timer
    while (
      guard++ < 80 &&
      st.pending !== null &&
      !(st.pending.kind === "hero" && st.pending.uid === "a")
    ) {
      const p = st.pending;
      inputs.push(
        p.kind === "hero"
          ? { kind: "hero", action: "attack", power: 1 }
          : p.kind === "guard" || p.kind === "challenge"
            ? { kind: "guard", guards: {} }
            : { kind: "vote", votes: {} },
      );
      st = runQuest(setup, inputs);
    }
    const p = st.pending;
    expect(p?.kind === "hero" && p.uid === "a" && p.away === true).toBe(true);
    const dl = pendingDeadline(
      st,
      0,
      inputs.map(() => 0),
    );
    expect(dl).not.toBeNull();
    // typing a move brings them back
    inputs.push({ kind: "hero", action: "attack", power: 1 });
    st = runQuest(setup, inputs);
    expect(st.heroes[0]?.away).toBe(false);
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
    expect(p.words.attack.split(" ")).toHaveLength(2);
    expect(p.words.skill.split(" ")).toHaveLength(3);
    expect(p.words.defend.split(" ")).toHaveLength(2);
    expect(p.words.ultimate.split(" ")).toHaveLength(3);
    const hard = started({
      ...solo(),
      difficulty: questDifficultyFor("Hard"),
    }).pending;
    if (hard?.kind === "hero") {
      expect(hard.words.attack.split(" ")).toHaveLength(3);
      expect(hard.words.skill.split(" ")).toHaveLength(3);
    }
  });
});

describe("monster quest: Legends heroes and the Ruins", () => {
  const as = (cls: HeroClass, seed: number): QuestSetup => ({
    seed,
    difficulty: questDifficultyFor("Easy"),
    party: buildParty([{ uid: "me", name: "Ann", cls }]),
  });
  /** perfect typing, always the skill, on the first monster / weakest friend */
  const skiller = (st: ReturnType<typeof runQuest>): QuestInput =>
    st.pending?.kind === "guard"
      ? { kind: "guard", guards: { me: true } }
      : { kind: "hero", action: "skill", power: 1.5 };
  const actions = (events: QuestEvent[], move: string): number =>
    events.filter((e) => e.type === "action" && e.move === move).length;
  const statuses = (events: QuestEvent[], what: string): number =>
    events.filter((e) => e.type === "status" && e.what === what).length;

  it("helpers only use the free heroes", () => {
    const party = buildParty([{ uid: "a", name: "A", cls: "rogue" }]);
    expect(party.map((h) => h.cls)).toEqual([
      "rogue",
      "knight",
      "mage",
      "healer",
    ]);
    for (const h of party.slice(1)) {
      expect(FREE_HEROES as HeroClass[]).toContain(h.cls);
    }
  });

  it("every hero is in exactly one set or free", () => {
    const sets = HERO_SETS.flatMap((s) => s.heroes);
    expect(new Set([...FREE_HEROES, ...sets]).size).toBe(HERO_CLASSES.length);
    // sets of 4, each with a hit-everyone skill
    for (const set of HERO_SETS) {
      expect(set.heroes).toHaveLength(4);
      expect(
        set.heroes.some((h) => CLASS_INFO[h].skillTarget === "allMonsters"),
      ).toBe(true);
    }
  });

  it("each Legends hero can win a quest in the Ruins", () => {
    landPick = "ruins";
    for (const cls of ["paladin", "rogue", "ranger", "summoner"] as const) {
      for (const boss of [0, 1]) {
        bossPick = boss;
        for (const seed of [1, 2, 3]) {
          const s = playThrough(as(cls, seed), skiller);
          expect(s.won, `${cls} ${boss} ${seed}`).toBe(true);
        }
      }
    }
    landPick = "forest";
    bossPick = 0;
  });

  it("is the same on every screen with the new heroes", () => {
    landPick = "ruins";
    const a = playThrough(as("summoner", 5), skiller);
    const b = playThrough(as("summoner", 5), skiller);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    landPick = "forest";
  });

  it("the Ruins have their own monsters and boss", () => {
    expect(LANDS.ruins.minions).toEqual(["beetle", "mimic", "wisp"]);
    expect(LANDS.ruins.bosses).toContain("hollowking");
  });

  it("the weekly quest never picks a new land", () => {
    for (let week = 0; week < 60; week++) {
      expect(weeklyPlan(week * 7 * 86_400_000).land).not.toBe("ruins");
    }
  });

  it("the summoner's spirit pounces 3 times per summon", () => {
    landPick = "forest";
    const s = playThrough(as("summoner", 3), skiller);
    const summons = actions(s.events, "Summon Spirit");
    const pounces = actions(s.events, "Spirit Pounce");
    expect(summons).toBeGreaterThan(0);
    expect(pounces).toBeGreaterThanOrEqual(summons);
    expect(pounces).toBeLessThanOrEqual(summons * SPIRIT_TURNS);
  });

  it("the ranger's volley cracks shells and mimics drop gold", () => {
    landPick = "ruins";
    let cracked = 0;
    let gold = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = playThrough(as("ranger", seed), skiller);
      cracked += statuses(s.events, "shellCracked");
      gold += statuses(s.events, "mimicGold");
    }
    expect(cracked).toBeGreaterThan(0);
    expect(gold).toBeGreaterThan(0);
    landPick = "forest";
  });

  it("the Hollow King calls beetles when angry", () => {
    landPick = "ruins";
    bossPick = 0;
    const s = playThrough(as("paladin", 2), skiller);
    const spawns = s.events.filter(
      (e) => e.type === "spawn" && e.monster.kind === "beetle",
    );
    expect(spawns).toHaveLength(2);
    landPick = "forest";
  });

  it("paladin's Smite heals a friend, rogue's skill finds gold", () => {
    const p = playThrough(as("paladin", 4), skiller);
    expect(p.stats[0]?.healed).toBeGreaterThan(0);
    const r = runQuest(as("rogue", 4), [
      { kind: "vote", votes: { me: "forest" } },
      { kind: "hero", action: "skill", power: 1 },
    ]);
    const sneak = r.events.find(
      (e) => e.type === "action" && e.move === "Sneak Attack",
    );
    expect(sneak).toBeDefined();
  });

  it("any two different heroes combo; same set gets the set combo", () => {
    expect(comboFor("knight", "mage")?.name).toBe("Flame Blade");
    expect(comboFor("paladin", "ranger")?.name).toBe("Legendary Strike");
    expect(comboFor("paladin", "mage")?.name).toBe("Team Combo");
    expect(comboFor("rogue", "rogue")).toBeUndefined();
  });
});

describe("monster quest: Wanderers heroes and Lantern Peaks", () => {
  const as = (cls: HeroClass, seed: number): QuestSetup => ({
    seed,
    difficulty: questDifficultyFor("Easy"),
    party: buildParty([{ uid: "me", name: "Ann", cls }]),
  });
  const skiller = (st: ReturnType<typeof runQuest>): QuestInput =>
    st.pending?.kind === "guard"
      ? { kind: "guard", guards: { me: true } }
      : { kind: "hero", action: "skill", power: 1.5 };
  const ulter = (st: ReturnType<typeof runQuest>): QuestInput => {
    if (st.pending?.kind === "guard")
      return { kind: "guard", guards: { me: true } };
    const me = st.heroes[0];
    const ready = me?.ultimate !== undefined && me.ultimateCooldown === 0;
    return { kind: "hero", action: ready ? "ultimate" : "skill", power: 1.5 };
  };
  const moves = (events: QuestEvent[]): string[] =>
    events.flatMap((e) => (e.type === "action" ? [e.move] : []));

  it("each Wanderers hero can win a quest in Lantern Peaks", () => {
    landPick = "peaks";
    for (const cls of ["monk", "ninja", "sorcerer", "bard"] as const) {
      for (const boss of [0, 1]) {
        bossPick = boss;
        for (const seed of [1, 2, 3]) {
          const s = playThrough(as(cls, seed), skiller);
          expect(s.won, `${cls} ${boss} ${seed}`).toBe(true);
        }
      }
    }
    landPick = "forest";
    bossPick = 0;
  });

  it("Lantern Peaks monsters do their tricks", () => {
    landPick = "peaks";
    bossPick = 0;
    const all: string[] = [];
    let foxDodges = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      // plain attacks, so the monsters live long enough to show off
      const s = playThrough(as("monk", seed), (st) =>
        st.pending?.kind === "guard"
          ? { kind: "guard", guards: { me: true } }
          : { kind: "hero", action: "attack", power: 1 },
      );
      all.push(...moves(s.events));
      // monster indexes start again each battle
      let kinds: string[] = [];
      for (const e of s.events) {
        if (e.type === "battle") kinds = e.monsters.map((m) => m.kind);
        if (e.type === "spawn") kinds.push(e.monster.kind);
        if (e.type !== "action" || !e.actor.startsWith("h")) continue;
        for (const h of e.hits) {
          const kind = kinds[Number(h.id.slice(1))];
          if (h.miss === true && kind === "fox") foxDodges++;
        }
      }
    }
    expect(all).toContain("Thunder Croak");
    expect(all).toContain("Thunderclap");
    expect(foxDodges).toBeGreaterThan(0);
    landPick = "forest";
  });

  /** play a quest using the given super move whenever it's ready */
  const withUlt = (cls: HeroClass, ult: string, seed: number) => {
    const setup = as(cls, seed);
    const inputs: QuestInput[] = [];
    let s = runQuest(setup, inputs);
    for (let i = 0; i < 500 && !s.over; i++) {
      const p = s.pending;
      inputs.push(
        p?.kind === "vote"
          ? {
              kind: "vote",
              votes: {
                me: p.topic === "land" ? "forest" : (p.options[0]?.id ?? ""),
              },
            }
          : p?.kind === "pick"
            ? { kind: "vote", votes: { me: ult } }
            : p?.kind === "challenge" || p?.kind === "guard"
              ? { kind: "guard", guards: { me: true } }
              : ulter(s),
      );
      s = runQuest(setup, inputs);
    }
    return s;
  };

  it("Lullaby puts monsters to sleep, Smoke Bomb makes them miss", () => {
    let slept = 0;
    let smoked = 0;
    for (const seed of [1, 2, 3]) {
      const bard = withUlt("bard", "lullaby", seed);
      expect(bard.heroes[0]?.ultimate).toBe("lullaby");
      slept += bard.events.filter(
        (e) => e.type === "status" && e.what === "monsterAsleep",
      ).length;
      const ninja = withUlt("ninja", "smokebomb", seed);
      smoked += ninja.events.filter(
        (e) => e.type === "action" && e.note?.includes("smoke") === true,
      ).length;
    }
    expect(slept).toBeGreaterThan(0);
    expect(smoked).toBeGreaterThan(0);
  });

  it("chain lightning hits every monster, less on each bounce", () => {
    const s = runQuest(as("sorcerer", 1), [
      { kind: "vote", votes: { me: "forest" } },
      { kind: "hero", action: "skill", target: 0, power: 1 },
    ]);
    const e = s.events.find(
      (x) => x.type === "action" && x.move === "Chain Lightning",
    );
    expect(e?.type === "action" && e.hits.length).toBe(2);
  });
});

describe("monster quest: Wild Ones heroes and Wildwood Jungle", () => {
  const as = (cls: HeroClass, seed: number): QuestSetup => ({
    seed,
    difficulty: questDifficultyFor("Easy"),
    party: buildParty([{ uid: "me", name: "Ann", cls }]),
  });
  const skiller = (st: ReturnType<typeof runQuest>): QuestInput =>
    st.pending?.kind === "guard"
      ? { kind: "guard", guards: { me: true } }
      : { kind: "hero", action: "skill", power: 1.5 };
  const attacker = (st: ReturnType<typeof runQuest>): QuestInput =>
    st.pending?.kind === "guard"
      ? { kind: "guard", guards: { me: true } }
      : { kind: "hero", action: "attack", power: 1 };
  const count = (events: QuestEvent[], pred: (e: QuestEvent) => boolean) =>
    events.filter(pred).length;

  it("each Wild Ones hero can win a quest in Wildwood Jungle", () => {
    landPick = "jungle";
    for (const cls of ["berserker", "druid", "hunter", "shaman"] as const) {
      for (const boss of [0, 1]) {
        bossPick = boss;
        for (const seed of [1, 2, 3]) {
          const s = playThrough(as(cls, seed), skiller);
          expect(s.won, `${cls} ${boss} ${seed}`).toBe(true);
        }
      }
    }
    landPick = "forest";
    bossPick = 0;
  });

  it("jungle monsters do their tricks", () => {
    landPick = "jungle";
    bossPick = 0;
    let stampede = 0;
    let croc = 0;
    let gold = 0;
    let poison = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = playThrough(as("knight", seed), attacker);
      stampede += count(
        s.events,
        (e) => e.type === "action" && e.move === "Wild Stampede",
      );
      croc += count(
        s.events,
        (e) => e.type === "action" && e.note?.includes("croc") === true,
      );
      gold += count(
        s.events,
        (e) => e.type === "action" && e.note?.includes("stole gold") === true,
      );
      poison += count(
        s.events,
        (e) => e.type === "status" && e.what === "poison",
      );
    }
    expect(stampede).toBeGreaterThan(0);
    expect(croc).toBeGreaterThan(0);
    expect(gold).toBeGreaterThan(0);
    expect(poison).toBeGreaterThan(0);
    landPick = "forest";
  });

  it("the shaman's totem heals, the hunter marks", () => {
    const sh = playThrough(as("shaman", 2), skiller);
    expect(
      count(sh.events, (e) => e.type === "action" && e.move === "Totem Pulse"),
    ).toBeGreaterThan(0);
    const hu = runQuest(as("hunter", 2), [
      { kind: "vote", votes: { me: "forest" } },
      { kind: "hero", action: "skill", target: 0, power: 1 },
    ]);
    const marked = hu.monsters.filter((m) => m.marked === true);
    expect(
      marked.length + hu.monsters.filter((m) => m.hp <= 0).length,
    ).toBeGreaterThan(0);
  });
});

describe("monster quest: Frontier heroes and Dustbowl Canyon", () => {
  const as = (cls: HeroClass, seed: number): QuestSetup => ({
    seed,
    difficulty: questDifficultyFor("Easy"),
    party: buildParty([{ uid: "me", name: "Ann", cls }]),
  });
  const skiller = (st: ReturnType<typeof runQuest>): QuestInput =>
    st.pending?.kind === "guard"
      ? { kind: "guard", guards: { me: true } }
      : { kind: "hero", action: "skill", power: 1.5 };
  const attacker = (st: ReturnType<typeof runQuest>): QuestInput =>
    st.pending?.kind === "guard"
      ? { kind: "guard", guards: { me: true } }
      : { kind: "hero", action: "attack", power: 1 };
  const count = (events: QuestEvent[], pred: (e: QuestEvent) => boolean) =>
    events.filter(pred).length;
  const noted = (events: QuestEvent[], text: string) =>
    count(
      events,
      (e) => e.type === "action" && e.note?.includes(text) === true,
    );

  it("each Frontier hero can win a quest in Dustbowl Canyon", () => {
    landPick = "canyon";
    for (const cls of ["lancer", "samurai", "engineer", "cleric"] as const) {
      for (const boss of [0, 1]) {
        bossPick = boss;
        for (const seed of [1, 2, 3]) {
          const s = playThrough(as(cls, seed), skiller);
          expect(s.won, `${cls} ${boss} ${seed}`).toBe(true);
        }
      }
    }
    landPick = "forest";
    bossPick = 0;
  });

  it("canyon monsters do their tricks", () => {
    landPick = "canyon";
    bossPick = 0;
    let angry = 0;
    let rolled = 0;
    let blown = 0;
    let dug = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = playThrough(as("knight", seed), attacker);
      angry += count(
        s.events,
        (e) => e.type === "action" && e.move === "Angry Sting",
      );
      rolled += count(
        s.events,
        (e) => e.type === "spawn" && e.monster.kind === "tumbleweed",
      );
      blown += noted(s.events, "blew away a potion");
      dug += noted(s.events, "digs underground");
    }
    expect(angry).toBeGreaterThan(0);
    expect(rolled).toBeGreaterThan(0);
    expect(blown).toBeGreaterThan(0);
    expect(dug).toBeGreaterThan(0);
    landPick = "forest";
  });

  it("samurai strikes back, cleric shields soak damage", () => {
    landPick = "forest";
    let counters = 0;
    for (const seed of [1, 2, 3]) {
      counters += noted(
        playThrough(as("samurai", seed), skiller).events,
        "counter strike",
      );
    }
    expect(counters).toBeGreaterThan(0);
    const c = runQuest(as("cleric", 2), [
      { kind: "vote", votes: { me: "forest" } },
      { kind: "hero", action: "skill", target: 0, power: 1 },
    ]);
    const bless = c.events.find(
      (e) => e.type === "action" && e.move === "Bless",
    );
    expect(bless).toBeDefined();
  });
});

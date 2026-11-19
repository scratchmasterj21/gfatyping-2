import { describe, expect, it } from "vitest";

import {
  boostId,
  buildCrew,
  RUN_MS,
  shipZones,
  stationOf,
  shipDifficultyFor,
  ShipFacts,
  ShipSetup,
  shipStars,
  shipTasks,
  shipView,
  START_HP,
} from "../../src/ts/games/rescue-ship/ship-rules";

const setupFor = (seed = 3, label = "Easy"): ShipSetup => ({
  seed,
  difficulty: shipDifficultyFor(label),
  crew: buildCrew([{ uid: "me", name: "Ann", station: "rescuer" }]),
});

/** Facts for a player who finishes every task of their station after `delay`. */
function playerFacts(
  setup: ShipSetup,
  delay: number | null,
  handsDelay: number | null = delay,
): ShipFacts {
  const facts: ShipFacts = { startAt: 0, done: {}, hands: {} };
  const me = setup.crew.find((c) => c.uid === "me");
  for (const task of shipTasks(setup.seed, setup.difficulty)) {
    if (task.kind === "hands") {
      if (handsDelay !== null)
        facts.hands[task.id] = { me: task.at + handsDelay };
    } else if (delay !== null && task.station === me?.station) {
      facts.done[task.id] = { by: "me", at: task.at + delay };
    }
  }
  return facts;
}

describe("rescue ship", () => {
  it("puts the crew in station order with helpers", () => {
    const crew = buildCrew([
      { uid: "a", name: "A", station: "shields" },
      { uid: "b", name: "B", station: "shields" },
    ]);
    expect(crew.map((c) => c.station)).toEqual([
      "pilot",
      "shields",
      "engineer",
      "rescuer",
    ]);
    expect(crew.find((c) => c.uid === "b")?.station).toBe("pilot");
    expect(crew.filter((c) => c.uid === null)).toHaveLength(2);
  });

  it("makes the same tasks for the same seed", () => {
    const d = shipDifficultyFor("Medium");
    expect(shipTasks(5, d)).toEqual(shipTasks(5, d));
    const kinds = new Set(shipTasks(5, d).map((t) => t.kind));
    for (const k of ["boss", "break", "charge", "hands", "hazard", "pet"]) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });

  it("a good crew gets home with pets", () => {
    for (const seed of [1, 2, 3, 4]) {
      const setup = setupFor(seed);
      const v = shipView(
        setup,
        shipTasks(seed, setup.difficulty),
        playerFacts(setup, 1500),
        RUN_MS,
      );
      expect(v.over).toBe(true);
      expect(v.reason).toBe("home");
      expect(v.pets).toBeGreaterThanOrEqual(8);
      expect(v.stats["me"]?.rescues ?? 0).toBeGreaterThan(5);
    }
  });

  it("an idle player is replaced by a helper", () => {
    const setup = setupFor(7);
    const v = shipView(
      setup,
      shipTasks(7, setup.difficulty),
      playerFacts(setup, null, null),
      RUN_MS,
    );
    expect(v.away.has("rescuer")).toBe(true);
    expect(v.pets).toBeGreaterThan(0);
  });

  it("shows open tasks at a moment", () => {
    const setup = setupFor(2);
    const tasks = shipTasks(2, setup.difficulty);
    const first = tasks.find((t) => t.kind === "pet")!;
    const v = shipView(
      setup,
      tasks,
      { startAt: 0, done: {}, hands: {} },
      first.at + 100,
    );
    expect(v.open.some((t) => t.id === first.id)).toBe(true);
    expect(v.hp).toBeLessThanOrEqual(START_HP);
  });

  it("a player who comes back takes the station back", () => {
    const setup = setupFor(11);
    const tasks = shipTasks(11, setup.difficulty);
    const facts: ShipFacts = { startAt: 0, done: {}, hands: {} };
    // idle for the first minute, then answers everything
    for (const task of tasks) {
      if (task.station === "rescuer" && task.at > 60_000) {
        facts.done[task.id] = { by: "me", at: task.at + 1500 };
      }
    }
    const early = shipView(setup, tasks, facts, 58_000);
    expect(early.away.has("rescuer")).toBe(true);
    const late = shipView(setup, tasks, facts, RUN_MS);
    expect(late.away.has("rescuer")).toBe(false);
    expect(late.stats["me"]?.rescues ?? 0).toBeGreaterThan(5);
  });

  it("picks 3 different flying zones, then the boss and the station", () => {
    const zones = shipZones(9);
    expect(zones).toEqual(shipZones(9));
    expect(new Set(zones.slice(0, 3).map((z) => z.kind)).size).toBe(3);
    expect(zones[3]?.kind).toBe("boss");
    expect(zones[4]?.kind).toBe("station");
    expect(zones[4]?.end).toBe(RUN_MS);
  });

  it("a solo captain can do every job and send the boss off", () => {
    for (const seed of [1, 5, 8]) {
      const setup: ShipSetup = {
        seed,
        difficulty: shipDifficultyFor("Medium"),
        crew: buildCrew([]),
        captain: "me",
      };
      const tasks = shipTasks(seed, setup.difficulty, { captain: true });
      const facts: ShipFacts = { startAt: 0, done: {}, hands: {} };
      for (const task of tasks) {
        if (task.kind === "hands")
          facts.hands[task.id] = { me: task.at + 1500 };
        else facts.done[task.id] = { by: "me", at: task.at + 1200 };
      }
      const v = shipView(setup, tasks, facts, RUN_MS);
      expect(v.reason).toBe("home");
      expect(v.boss).toBe("won");
      expect(v.perfect).toBe(true);
      expect(shipStars(v)).toBe(3);
      expect(v.stats["helper"]).toBeUndefined();
      expect(v.stats["me"]?.boss).toBe(v.bossMax);
    }
  });

  it("idle captain: slow helpers still get some jobs done", () => {
    const setup: ShipSetup = {
      seed: 4,
      difficulty: shipDifficultyFor("Easy"),
      crew: buildCrew([]),
      captain: "me",
    };
    const v = shipView(
      setup,
      shipTasks(4, setup.difficulty, { captain: true }),
      { startAt: 0, done: {}, hands: {} },
      RUN_MS,
    );
    expect(v.stats["helper"]?.dodges ?? 0).toBeGreaterThan(0);
    expect(v.perfect).toBe(false);
  });

  it("stations swap every zone when playing together", () => {
    const setup: ShipSetup = {
      seed: 3,
      difficulty: shipDifficultyFor("Easy"),
      crew: buildCrew([
        { uid: "a", name: "A", station: "pilot" },
        { uid: "b", name: "B", station: "shields" },
      ]),
      rotate: true,
    };
    const zones = shipZones(3);
    expect(stationOf(setup, zones, "a", 1000)).toBe("pilot");
    expect(stationOf(setup, zones, "a", zones[1]!.start + 1)).toBe("shields");
    expect(stationOf(setup, zones, "b", zones[2]!.start + 1)).toBe("rescuer");
    // a's zone-2 shield words count for a
    const tasks = shipTasks(3, setup.difficulty);
    const facts: ShipFacts = { startAt: 0, done: {}, hands: {} };
    for (const task of tasks) {
      if (
        task.station === "shields" &&
        task.at >= zones[1]!.start &&
        task.at < zones[1]!.end
      ) {
        facts.done[task.id] = { by: "a", at: task.at + 500 };
      }
    }
    const v = shipView(setup, tasks, facts, zones[2]!.start);
    expect(v.stats["a"]?.charges ?? 0).toBeGreaterThan(10);
  });

  it("a combo boost charges the shield", () => {
    const setup = setupFor(6);
    const tasks = shipTasks(6, setup.difficulty);
    const base: ShipFacts = { startAt: 0, done: {}, hands: {} };
    const plain = shipView(setup, tasks, base, 40_000);
    const boosted = shipView(
      setup,
      tasks,
      { ...base, done: { [boostId(0, 0)]: { by: "me", at: 39_000 } } },
      40_000,
    );
    expect(boosted.shield).toBeGreaterThan(plain.shield);
  });

  it("captain mode has fewer jobs that wait longer", () => {
    const d = shipDifficultyFor("Medium");
    const crew = shipTasks(5, d);
    const solo = shipTasks(5, d, { captain: true });
    expect(solo.length).toBeLessThan(crew.length * 0.75);
    const firstPet = (list: typeof crew) => list.find((t) => t.kind === "pet")!;
    expect(firstPet(solo).window).toBeGreaterThan(firstPet(crew).window);
  });
});

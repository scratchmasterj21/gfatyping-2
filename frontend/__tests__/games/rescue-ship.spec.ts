import { describe, expect, it } from "vitest";

import {
  buildCrew,
  RUN_MS,
  shipDifficultyFor,
  ShipFacts,
  ShipSetup,
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
    expect([...kinds].sort()).toEqual(
      ["break", "charge", "hands", "hazard", "pet"].sort(),
    );
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
});

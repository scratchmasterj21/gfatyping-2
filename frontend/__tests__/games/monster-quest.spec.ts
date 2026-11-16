import { describe, expect, it } from "vitest";

import {
  buildParty,
  HeroInput,
  pendingDeadline,
  QuestInput,
  questDifficultyFor,
  QuestSetup,
  runQuest,
  typingPower,
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
    inputs.push(answer(s));
    s = runQuest(setup, inputs);
  }
  return s;
}

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

  it("waits for the player's turn", () => {
    const s = runQuest(solo(), []);
    expect(s.over).toBe(false);
    expect(s.pending).not.toBeNull();
    expect(s.events[0]?.type).toBe("battle");
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

  it("gives a turn deadline", () => {
    const s = runQuest(solo(), []);
    const d = pendingDeadline(s, 1000, []);
    expect(d).toBeGreaterThan(1000 + 20_000);
  });

  it("asks for several words per move", () => {
    const p = runQuest(solo(), []).pending;
    expect(p?.kind).toBe("hero");
    if (p?.kind !== "hero") return;
    expect(p.words.attack.split(" ")).toHaveLength(2);
    expect(p.words.skill.split(" ")).toHaveLength(3);
    expect(p.words.defend.split(" ")).toHaveLength(2);
    const hard = runQuest(
      { ...solo(), difficulty: questDifficultyFor("Hard") },
      [],
    ).pending;
    if (hard?.kind === "hero") {
      expect(hard.words.attack.split(" ")).toHaveLength(3);
    }
  });
});

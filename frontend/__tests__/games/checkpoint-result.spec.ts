import { describe, expect, it, vi } from "vitest";

// minimal Phaser stand-in: just enough for the game-over scenes
vi.mock("phaser", () => ({
  Scene: class {
    game = { events: { emit: vi.fn() } };
    registry = { get: vi.fn() };
    scene = { stop: vi.fn(), start: vi.fn(), launch: vi.fn() };
  },
}));

import { GameOverScene as BalloonOver } from "../../src/ts/games/balloon-pop/scenes/GameOverScene";
import { GameOverScene as GhostOver } from "../../src/ts/games/ghost-hunter/scenes/GameOverScene";
import { GameOverScene as DefenderOver } from "../../src/ts/games/word-defender/scenes/GameOverScene";

/**
 * Lesson checkpoint games unlock the next lesson only if the server sees
 * `cleared` (or a wave above 3). Ghost Hunter ends on wave 3 after the
 * Ghost King, so the flag must reach the "game-result" event.
 */
describe("checkpoint game results", () => {
  for (const [name, Scene] of [
    ["ghost hunter", GhostOver],
    ["balloon pop", BalloonOver],
    ["word defender", DefenderOver],
  ] as const) {
    it(`${name} reports a cleared checkpoint`, () => {
      const scene = new Scene();
      const emit = (
        scene as unknown as {
          game: { events: { emit: ReturnType<typeof vi.fn> } };
        }
      ).game.events.emit;
      scene.create({ score: 120, wave: 3, hits: 30, misses: 2, cleared: true });
      expect(emit).toHaveBeenCalledWith("game-result", {
        score: 120,
        wave: 3,
        cleared: true,
      });
    });
    it(`${name} reports a loss as not cleared`, () => {
      const scene = new Scene();
      const emit = (
        scene as unknown as {
          game: { events: { emit: ReturnType<typeof vi.fn> } };
        }
      ).game.events.emit;
      scene.create({ score: 40, wave: 2, hits: 10, misses: 5 });
      expect(emit).toHaveBeenCalledWith("game-result", {
        score: 40,
        wave: 2,
        cleared: false,
      });
    });
  }
});

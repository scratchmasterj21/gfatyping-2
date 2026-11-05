import { Scene } from "phaser";

import type { RaceEnd } from "../racer-result";

/**
 * End of a race. The result card is drawn by the modal (DOM) over the
 * canvas; this scene reports the result and restarts on request.
 */
export class GameOverScene extends Scene {
  constructor() {
    super({ key: "GameOver" });
  }

  create(data: RaceEnd): void {
    this.game.events.emit("game-result", {
      score: data.wpm,
      wave: data.wordsTyped,
    });
    this.game.events.emit("game-over-screen", {
      ...data,
      multiplayer: this.registry.get("multiplayer") === true,
    });
  }

  /** Same restart as the old in-canvas "Play Again" button (solo only). */
  playAgain(): void {
    this.scene.start("Game");
  }
}

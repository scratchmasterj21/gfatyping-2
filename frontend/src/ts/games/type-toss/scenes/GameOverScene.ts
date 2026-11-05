import { Scene } from "phaser";

import type { TossEnd } from "../toss-result";

/**
 * End of a round. The result card is drawn by the modal (DOM) over the
 * canvas; this scene reports the result and restarts on request.
 */
export class GameOverScene extends Scene {
  constructor() {
    super({ key: "GameOver" });
  }

  create(data: TossEnd): void {
    this.game.events.emit("game-result", {
      score: data.score,
      wave: data.wordsTyped,
      cleared: this.registry.get("lessonCheckpoint") === true,
    });
    this.game.events.emit("game-over-screen", {
      ...data,
      multiplayer: this.registry.get("multiplayer") === true,
    });
  }

  /** Same restart as the old in-canvas "Play Again" button (solo only). */
  playAgain(): void {
    this.scene.stop("UI");
    this.scene.start("Boot");
    this.scene.launch("UI");
  }
}

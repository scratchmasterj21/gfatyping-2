import { Scene } from "phaser";

import type { WaveEnd } from "../../shared/wave-result";

/**
 * End of a run. The result card is drawn by the modal (DOM) over the
 * canvas; this scene reports the result and restarts on request.
 */
export class GameOverScene extends Scene {
  constructor() {
    super({ key: "GameOver" });
  }

  create(data: WaveEnd): void {
    this.game.events.emit("game-result", {
      score: data.score,
      wave: data.wave,
    });
    this.game.events.emit("game-over-screen", data);
  }

  /** Same restart as the old in-canvas "Play Again" button. */
  playAgain(): void {
    this.scene.stop("UI");
    this.scene.start("Boot");
    this.scene.launch("UI");
  }
}

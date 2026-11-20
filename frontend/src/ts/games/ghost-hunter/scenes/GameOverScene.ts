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
    if (data.reported !== true) this.reportResult(data);
    this.game.events.emit("game-over-screen", data);
  }

  private reportResult(data: WaveEnd): void {
    this.game.events.emit("game-result", {
      score: data.score,
      wave: data.wave,
      // a lesson checkpoint's last wave was beaten (the server unlocks the
      // next lesson on this, whatever the wave number)
      cleared: data.cleared === true,
    });
  }

  /** Same restart as the old in-canvas "Play Again" button. */
  playAgain(): void {
    this.scene.stop("UI");
    this.scene.start("Boot");
    this.scene.launch("UI");
  }
}

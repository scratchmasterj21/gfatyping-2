import { GameObjects, Scene, Structs, Time, Tweens } from "phaser";

import { hex } from "../../shared/game-palette";
import { HudChip, rowLayout } from "../../shared/phaser-ui";

const LOW_TIME_SECONDS = 10;
/** Row below the booth's valance and the page's mute/back buttons. */
const ROW_Y = 86;

export class UIScene extends Scene {
  private scoreChip!: HudChip;
  private timerChip!: HudChip;
  private streakChip!: HudChip;
  private bufferChip!: HudChip;
  private doubleChip!: HudChip;
  private timerBar!: GameObjects.Graphics;
  private lastFrac = 1;
  private lowTimePulse: Tweens.Tween | null = null;
  private doublePointsClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    this.scoreChip = new HudChip(this, 0, ROW_Y, "🎟️ 0");
    this.timerChip = new HudChip(this, 0, ROW_Y, "⏱ —");
    this.timerBar = this.add.graphics();
    this.doubleChip = new HudChip(this, 0, ROW_Y + 52, "✨ Double points!")
      .setColors("purple", "cream")
      .setVisible(false);
    this.streakChip = new HudChip(this, 0, 0, "").setVisible(false);
    this.bufferChip = new HudChip(this, 0, 0, "").setVisible(false);

    this.layout();
    this.scale.on("resize", (_size: Structs.Size) => this.layout());

    this.game.events.on("ui-score", (score: number) => {
      this.scoreChip.setLabel(`🎟️ ${score}`);
      this.layout();
    });
    this.game.events.on("ui-timer", (left: number, total: number) => {
      const frac = total > 0 ? left / total : 1;
      this.lastFrac = frac;
      this.timerChip
        .setLabel(`⏱ ${left}s`)
        .setColors(
          frac < 0.25 ? "red" : frac < 0.5 ? "orange" : "cream",
          frac < 0.5 ? "cream" : "ink",
        );
      this.layout();

      if (left <= LOW_TIME_SECONDS && left > 0) {
        this.lowTimePulse ??= this.tweens.add({
          targets: this.timerChip,
          scale: 1.15,
          duration: 260,
          yoyo: true,
          repeat: -1,
        });
      } else if (this.lowTimePulse !== null) {
        this.lowTimePulse.stop();
        this.lowTimePulse = null;
        this.timerChip.setScale(1);
      }
    });
    this.game.events.on("ui-double-points", (durationMs: number) => {
      this.doubleChip.setVisible(true);
      this.doublePointsClearTimer?.remove();
      this.doublePointsClearTimer = this.time.delayedCall(durationMs, () => {
        this.doubleChip.setVisible(false);
      });
    });
    this.game.events.on("ui-streak", (streak: number) => {
      if (streak >= 10) {
        this.streakChip
          .setLabel(`🔥 ${streak} in a row - triple tickets!`)
          .setColors("red", "cream")
          .setVisible(true);
      } else if (streak >= 5) {
        this.streakChip
          .setLabel(`⚡ ${streak} in a row - double tickets!`)
          .setColors("orange", "cream")
          .setVisible(true);
      } else {
        this.streakChip.setVisible(false);
      }
      this.layout();
    });
    this.game.events.on("ui-buffer", (buf: string, locked: string | null) => {
      this.bufferChip
        .setLabel(buf.length > 0 ? `${buf}_` : "")
        .setColors(locked !== null ? "yellow" : "cream", "ink")
        .setVisible(buf.length > 0);
      this.layout();
    });
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    rowLayout([this.scoreChip, this.timerChip], W / 2);
    this.doubleChip.setX(W / 2);
    this.streakChip.setPosition(W / 2, H - 92);
    this.bufferChip.setPosition(W / 2, H - 56);
    this.redrawBar();
  }

  private redrawBar(): void {
    const W = this.scale.width;
    const barW = Math.min(360, W * 0.6);
    const x = W / 2 - barW / 2;
    const y = ROW_Y + 22;
    const frac = Math.max(0, Math.min(1, this.lastFrac));
    this.timerBar.clear();
    this.timerBar.fillStyle(hex("ink"), 0.3);
    this.timerBar.fillRoundedRect(x, y, barW, 10, 5);
    this.timerBar.fillStyle(
      frac < 0.25 ? hex("red") : frac < 0.5 ? hex("orange") : hex("green"),
      1,
    );
    if (frac > 0) {
      this.timerBar.fillRoundedRect(x, y, Math.max(10, barW * frac), 10, 5);
    }
  }

  shutdown(): void {
    this.lowTimePulse?.stop();
    this.doublePointsClearTimer?.remove();
    this.game.events.off("ui-score");
    this.game.events.off("ui-timer");
    this.game.events.off("ui-double-points");
    this.game.events.off("ui-streak");
    this.game.events.off("ui-buffer");
  }
}

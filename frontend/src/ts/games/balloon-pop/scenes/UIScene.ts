import { Scene, Structs, Time } from "phaser";

import { HudChip, rowLayout } from "../../shared/phaser-ui";
import { LIVES } from "./GameScene";

/**
 * Balloons escape off the TOP, so the HUD lives along the bottom where it
 * never hides a balloon that's about to get away.
 */
export class UIScene extends Scene {
  private waveChip!: HudChip;
  private scoreChip!: HudChip;
  private livesChip!: HudChip;
  private powerUpChip!: HudChip;
  private gustChip!: HudChip;
  private bufferChip!: HudChip;
  private streakChip!: HudChip;
  private gustClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    this.waveChip = new HudChip(this, 0, 0, "Wave 1");
    this.scoreChip = new HudChip(this, 0, 0, "⭐ 0");
    // starts full: the first lives event fires before this scene exists
    this.livesChip = new HudChip(this, 0, 0, "❤".repeat(LIVES)).setColors(
      "cream",
      "red",
    );
    this.powerUpChip = new HudChip(this, 0, 0, "")
      .setColors("gold", "ink")
      .setVisible(false);
    this.gustChip = new HudChip(this, 0, 0, "🌪️ Balloons held!")
      .setColors("sky", "ink")
      .setVisible(false);
    this.bufferChip = new HudChip(this, 0, 0, "").setVisible(false);
    this.streakChip = new HudChip(this, 0, 0, "")
      .setColors("orange", "cream")
      .setVisible(false);

    this.layout();
    this.scale.on("resize", (_size: Structs.Size) => this.layout());

    this.game.events.on("ui-wave", (wave: number) => {
      this.waveChip.setLabel(`Wave ${wave}`);
      this.layout();
    });
    this.game.events.on("ui-score", (score: number) => {
      this.scoreChip.setLabel(`⭐ ${score}`);
      this.layout();
    });
    this.game.events.on("ui-lives", (lives: number) => {
      this.livesChip.setLabel(lives > 0 ? "❤".repeat(lives) : "💔");
      this.layout();
    });
    this.game.events.on("ui-powerup", (kind: "gust" | "golden" | null) => {
      if (kind === null) {
        this.powerUpChip.setVisible(false);
      } else {
        const icon = kind === "gust" ? "🌪️" : "🌟";
        this.powerUpChip
          .setLabel(`${icon} Press ENTER to use!`)
          .setVisible(true);
      }
      this.layout();
    });
    this.game.events.on("ui-frozen", (durationMs: number) => {
      this.gustChip.setVisible(true);
      this.layout();
      this.gustClearTimer?.remove();
      this.gustClearTimer = this.time.delayedCall(durationMs, () => {
        this.gustChip.setVisible(false);
      });
    });
    this.game.events.on("ui-buffer", (buf: string, locked: string | null) => {
      this.bufferChip
        .setLabel(buf.length > 0 ? `${buf}_` : "")
        .setColors(locked !== null ? "yellow" : "cream", "ink")
        .setVisible(buf.length > 0);
      this.layout();
    });
    this.game.events.on("ui-streak", (streak: number) => {
      this.streakChip
        .setLabel(`🎈 ${streak} in a row!`)
        .setVisible(streak >= 5);
      this.layout();
    });
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    for (const c of [this.waveChip, this.scoreChip, this.livesChip]) {
      c.setY(H - 26);
    }
    rowLayout([this.waveChip, this.scoreChip, this.livesChip], W / 2);
    this.bufferChip.setPosition(W / 2, H - 64);
    this.streakChip.setPosition(W / 2, H - 100);
    this.powerUpChip.setPosition(W / 2, H - 136);
    this.gustChip.setPosition(W / 2, H - 172);
  }

  shutdown(): void {
    this.gustClearTimer?.remove();
    this.game.events.off("ui-wave");
    this.game.events.off("ui-score");
    this.game.events.off("ui-lives");
    this.game.events.off("ui-powerup");
    this.game.events.off("ui-frozen");
    this.game.events.off("ui-buffer");
    this.game.events.off("ui-streak");
  }
}

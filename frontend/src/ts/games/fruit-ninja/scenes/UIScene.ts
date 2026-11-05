import { Scene, Structs } from "phaser";

import { HudChip, rowLayout } from "../../shared/phaser-ui";
import { LIVES } from "./GameScene";

/** Row below the page's mute/back buttons. */
const ROW_Y = 74;

export class UIScene extends Scene {
  private waveChip!: HudChip;
  private scoreChip!: HudChip;
  private livesChip!: HudChip;
  private bufferChip!: HudChip;
  private streakChip!: HudChip;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    this.waveChip = new HudChip(this, 0, ROW_Y, "Wave 1");
    this.scoreChip = new HudChip(this, 0, ROW_Y, "⭐ 0");
    // starts full: the first lives event fires before this scene exists
    this.livesChip = new HudChip(this, 0, ROW_Y, "🍎".repeat(LIVES));
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
      this.livesChip.setLabel(lives > 0 ? "🍎".repeat(lives) : "💔");
      this.layout();
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
        .setLabel(`🔥 ${streak} in a row!`)
        .setVisible(streak >= 5);
      this.layout();
    });
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    rowLayout([this.waveChip, this.scoreChip, this.livesChip], W / 2);
    // typed letters + streak sit bottom-centre, between Tappy and the cushion
    this.bufferChip.setPosition(W / 2, H - 26);
    this.streakChip.setPosition(W / 2, H - 64);
  }

  shutdown(): void {
    this.game.events.off("ui-wave");
    this.game.events.off("ui-score");
    this.game.events.off("ui-lives");
    this.game.events.off("ui-buffer");
    this.game.events.off("ui-streak");
  }
}

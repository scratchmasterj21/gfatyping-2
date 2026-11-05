import { Scene, Structs, Time } from "phaser";

import { HudChip, rowLayout } from "../../shared/phaser-ui";
import { LIVES } from "./GameScene";

/** Row below the page's mute/back buttons. */
const ROW_Y = 74;

export class UIScene extends Scene {
  private waveChip!: HudChip;
  private scoreChip!: HudChip;
  private livesChip!: HudChip;
  private bossChip!: HudChip;
  private powerUpChip!: HudChip;
  private empChip!: HudChip;
  private bufferChip!: HudChip;
  private streakChip!: HudChip;
  private empClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    this.waveChip = new HudChip(this, 0, ROW_Y, "Wave 1");
    this.scoreChip = new HudChip(this, 0, ROW_Y, "⭐ 0");
    // starts full: the first lives event fires before this scene exists
    this.livesChip = new HudChip(this, 0, ROW_Y, "❤".repeat(LIVES)).setColors(
      "cream",
      "red",
    );
    this.bossChip = new HudChip(this, 0, ROW_Y, "👾 Mothership!").setColors(
      "pink",
      "ink",
    );
    this.bossChip.setVisible(false);
    this.powerUpChip = new HudChip(this, 0, ROW_Y + 38, "").setColors(
      "gold",
      "ink",
    );
    this.powerUpChip.setVisible(false);
    this.empChip = new HudChip(this, 0, ROW_Y + 76, "⚡ Ships frozen!")
      .setColors("sky", "ink")
      .setVisible(false);
    this.bufferChip = new HudChip(this, 0, 0, "").setVisible(false);
    this.streakChip = new HudChip(this, 0, 0, "")
      .setColors("orange", "cream")
      .setVisible(false);

    this.layout(this.scale.width, this.scale.height);
    this.scale.on("resize", (size: Structs.Size) => {
      this.layout(size.width, size.height);
    });

    this.game.events.on("ui-wave", (wave: number) => {
      this.waveChip.setLabel(`Wave ${wave}`);
      this.layoutTop();
    });
    this.game.events.on("ui-score", (score: number) => {
      this.scoreChip.setLabel(`⭐ ${score}`);
      this.layoutTop();
    });
    this.game.events.on("ui-lives", (lives: number) => {
      this.livesChip.setLabel(lives > 0 ? "❤".repeat(lives) : "💔");
      this.layoutTop();
    });
    this.game.events.on("ui-powerup", (kind: "emp" | "nuke" | null) => {
      if (kind === null) {
        this.powerUpChip.setVisible(false);
      } else {
        const icon = kind === "emp" ? "⚡" : "💥";
        this.powerUpChip
          .setLabel(`${icon} Press ENTER to use!`)
          .setVisible(true)
          .setX(this.scale.width / 2);
      }
    });
    this.game.events.on("ui-frozen", (durationMs: number) => {
      this.empChip.setVisible(true).setX(this.scale.width / 2);
      this.empClearTimer?.remove();
      this.empClearTimer = this.time.delayedCall(durationMs, () => {
        this.empChip.setVisible(false);
      });
    });
    this.game.events.on("ui-buffer", (buf: string, locked: string | null) => {
      this.bufferChip
        .setLabel(buf.length > 0 ? `${buf}_` : "")
        .setColors(locked !== null ? "yellow" : "cream", "ink")
        .setVisible(buf.length > 0);
      this.layoutBottom(this.scale.width, this.scale.height);
    });
    this.game.events.on("ui-streak", (streak: number) => {
      this.streakChip
        .setLabel(`🔥 ${streak} in a row!`)
        .setVisible(streak >= 5);
      this.layoutBottom(this.scale.width, this.scale.height);
    });
    this.game.events.on("ui-boss", (active: boolean) => {
      this.bossChip.setVisible(active);
      this.layoutTop();
    });
  }

  private layout(W: number, H: number): void {
    this.layoutTop();
    this.powerUpChip.setX(W / 2);
    this.empChip.setX(W / 2);
    this.layoutBottom(W, H);
  }

  private layoutTop(): void {
    rowLayout(
      [this.waveChip, this.scoreChip, this.livesChip, this.bossChip],
      this.scale.width / 2,
    );
  }

  /** Typed letters + streak sit bottom-right, clear of the base. */
  private layoutBottom(W: number, H: number): void {
    this.bufferChip.setPosition(W - 16 - this.bufferChip.chipWidth / 2, H - 26);
    this.streakChip.setPosition(W - 16 - this.streakChip.chipWidth / 2, H - 64);
  }

  shutdown(): void {
    this.empClearTimer?.remove();
    this.game.events.off("ui-wave");
    this.game.events.off("ui-score");
    this.game.events.off("ui-lives");
    this.game.events.off("ui-powerup");
    this.game.events.off("ui-frozen");
    this.game.events.off("ui-buffer");
    this.game.events.off("ui-streak");
    this.game.events.off("ui-boss");
  }
}

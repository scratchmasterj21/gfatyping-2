import { Scene, Structs, Time } from "phaser";

import { HudChip, rowLayout } from "../../shared/phaser-ui";
import { LOG_MAX_HP } from "./GameScene";

/** Row below the page's mute/back buttons. */
const ROW_Y = 74;

export class UIScene extends Scene {
  private waveChip!: HudChip;
  private scoreChip!: HudChip;
  private leftLogChip!: HudChip;
  private rightLogChip!: HudChip;
  private facingChip!: HudChip;
  private powerUpChip!: HudChip;
  private frozenChip!: HudChip;
  private bufferChip!: HudChip;
  private streakChip!: HudChip;
  private frozenClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    this.waveChip = new HudChip(this, 0, ROW_Y, "Wave 1");
    this.scoreChip = new HudChip(this, 0, ROW_Y, "⭐ 0");
    // start full: the first log events fire before this scene exists
    this.leftLogChip = new HudChip(
      this,
      0,
      ROW_Y + 38,
      "🪵".repeat(LOG_MAX_HP),
    );
    this.rightLogChip = new HudChip(
      this,
      0,
      ROW_Y + 38,
      "🪵".repeat(LOG_MAX_HP),
    );
    this.facingChip = new HudChip(this, 0, ROW_Y + 38, "Looking ▶").setColors(
      "yellow",
      "ink",
    );
    if (this.registry.get("bothSides") === true) {
      this.facingChip.setVisible(false);
    }
    this.powerUpChip = new HudChip(this, 0, ROW_Y + 76, "")
      .setColors("gold", "ink")
      .setVisible(false);
    this.frozenChip = new HudChip(this, 0, ROW_Y + 114, "❄️ Ghosts frozen!")
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
    this.game.events.on("ui-log-left", (hp: number) => {
      this.leftLogChip
        .setLabel(hp > 0 ? "🪵".repeat(hp) : "💥 broken")
        .setColors(hp > 0 ? "cream" : "red", hp > 0 ? "ink" : "cream");
      this.layout();
    });
    this.game.events.on("ui-log-right", (hp: number) => {
      this.rightLogChip
        .setLabel(hp > 0 ? "🪵".repeat(hp) : "💥 broken")
        .setColors(hp > 0 ? "cream" : "red", hp > 0 ? "ink" : "cream");
      this.layout();
    });
    this.game.events.on("ui-facing", (facing: "left" | "right") => {
      this.facingChip.setLabel(facing === "left" ? "◀ Looking" : "Looking ▶");
      this.layout();
    });
    this.game.events.on("ui-powerup", (kind: "freeze" | "tnt" | null) => {
      if (kind === null) {
        this.powerUpChip.setVisible(false);
      } else {
        const icon = kind === "freeze" ? "❄️" : "🎆";
        this.powerUpChip
          .setLabel(`${icon} Press ENTER to use!`)
          .setVisible(true);
      }
      this.layout();
    });
    this.game.events.on("ui-frozen", (durationMs: number) => {
      this.frozenChip.setVisible(true);
      this.layout();
      this.frozenClearTimer?.remove();
      this.frozenClearTimer = this.time.delayedCall(durationMs, () => {
        this.frozenChip.setVisible(false);
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
        .setLabel(`🔥 ${streak} in a row!`)
        .setVisible(streak >= 5);
      this.layout();
    });
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    rowLayout([this.waveChip, this.scoreChip], W / 2);
    // each side's barricade health sits on its own side
    this.leftLogChip.setX(12 + this.leftLogChip.chipWidth / 2);
    this.rightLogChip.setX(W - 12 - this.rightLogChip.chipWidth / 2);
    this.facingChip.setX(W / 2);
    this.powerUpChip.setX(W / 2);
    this.frozenChip.setX(W / 2);
    this.bufferChip.setPosition(W / 2, H - 26);
    this.streakChip.setPosition(W / 2, H - 62);
  }

  shutdown(): void {
    this.frozenClearTimer?.remove();
    this.game.events.off("ui-wave");
    this.game.events.off("ui-score");
    this.game.events.off("ui-log-left");
    this.game.events.off("ui-log-right");
    this.game.events.off("ui-facing");
    this.game.events.off("ui-powerup");
    this.game.events.off("ui-frozen");
    this.game.events.off("ui-buffer");
    this.game.events.off("ui-streak");
  }
}

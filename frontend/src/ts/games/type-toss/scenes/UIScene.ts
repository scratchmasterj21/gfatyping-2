import { Scene, GameObjects, Structs, Time, Tweens } from "phaser";

const LOW_TIME_SECONDS = 10;

export class UIScene extends Scene {
  private scoreText!: GameObjects.Text;
  private timerText!: GameObjects.Text;
  private streakText!: GameObjects.Text;
  private bufferText!: GameObjects.Text;
  private doublePointsText!: GameObjects.Text;
  private timerBar!: GameObjects.Graphics;
  private barX = 0;
  private barW = 0;
  private barY = 52;
  private lastFrac = 1;
  private lowTimePulse: Tweens.Tween | null = null;
  private doublePointsClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.buildUI(W, H);

    this.scale.on("resize", (size: Structs.Size) => {
      const w = size.width;
      const h = size.height;
      this.timerText.setX(w / 2);
      this.doublePointsText.setX(w / 2);
      this.streakText.setX(w / 2).setY(h - 46);
      this.bufferText.setX(w / 2).setY(h - 14);
      this.barX = w * 0.12;
      this.barW = w * 0.76;
      this.redrawBar(this.lastFrac);
    });

    this.game.events.on("ui-score", (score: number) => {
      this.scoreText.setText(`Score: ${score}`);
    });
    this.game.events.on("ui-timer", (left: number, total: number) => {
      this.timerText.setText(`${left}`);
      const frac = total > 0 ? left / total : 1;
      this.lastFrac = frac;
      this.timerText.setColor(
        frac < 0.25 ? "#ff3333" : frac < 0.5 ? "#ff8800" : "#ffdd44",
      );
      this.redrawBar(frac);

      if (left <= LOW_TIME_SECONDS && left > 0) {
        this.lowTimePulse ??= this.tweens.add({
          targets: this.timerText,
          scale: 1.25,
          duration: 260,
          yoyo: true,
          repeat: -1,
        });
      } else if (this.lowTimePulse !== null) {
        this.lowTimePulse.stop();
        this.lowTimePulse = null;
        this.timerText.setScale(1);
      }
    });
    this.game.events.on("ui-double-points", (durationMs: number) => {
      this.doublePointsText.setText("✨ DOUBLE POINTS!");
      this.doublePointsClearTimer?.remove();
      this.doublePointsClearTimer = this.time.delayedCall(durationMs, () => {
        this.doublePointsText.setText("");
      });
    });
    this.game.events.on("ui-streak", (streak: number) => {
      if (streak >= 10) {
        this.streakText.setText(`🔥 ${streak}× TRIPLE!`).setColor("#ff4400");
      } else if (streak >= 5) {
        this.streakText.setText(`⚡ ${streak}× DOUBLE`).setColor("#ffaa00");
      } else {
        this.streakText.setText("").setColor("#ffffff");
      }
    });
    this.game.events.on("ui-buffer", (buf: string, locked: string | null) => {
      this.bufferText.setText(buf.length > 0 ? `${buf}_` : "");
      this.bufferText.setColor(locked !== null ? "#ffcc44" : "#ffffff");
    });
  }

  private buildUI(W: number, H: number): void {
    const top = { fontSize: "15px", fontFamily: "monospace", color: "#ffffff" };

    this.scoreText = this.add.text(14, 10, "Score: 0", top);

    this.timerText = this.add
      .text(W / 2, 10, "—", {
        fontSize: "32px",
        fontFamily: "monospace",
        color: "#ffdd44",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.barX = W * 0.12;
    this.barW = W * 0.76;
    this.timerBar = this.add.graphics();
    this.redrawBar(1);

    this.doublePointsText = this.add
      .text(W / 2, 70, "", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#e040fb",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.streakText = this.add
      .text(W / 2, H - 46, "", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffaa00",
      })
      .setOrigin(0.5, 1);

    this.bufferText = this.add
      .text(W / 2, H - 14, "", {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#ffffff",
        backgroundColor: "#00000055",
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5, 1);
  }

  private redrawBar(frac: number): void {
    const barColor = frac < 0.25 ? 0xff3333 : frac < 0.5 ? 0xff8800 : 0x44cc44;
    this.timerBar.clear();
    this.timerBar.fillStyle(0x000000, 0.3);
    this.timerBar.fillRect(this.barX, this.barY, this.barW, 8);
    this.timerBar.fillStyle(barColor, 1);
    this.timerBar.fillRect(this.barX, this.barY, this.barW * frac, 8);
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

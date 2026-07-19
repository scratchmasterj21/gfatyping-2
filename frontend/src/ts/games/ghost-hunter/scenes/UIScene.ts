import { Scene, GameObjects, Structs, Time } from "phaser";

export class UIScene extends Scene {
  private waveText!: GameObjects.Text;
  private scoreText!: GameObjects.Text;
  private leftLogText!: GameObjects.Text;
  private rightLogText!: GameObjects.Text;
  private facingText!: GameObjects.Text;
  private powerUpText!: GameObjects.Text;
  private frozenText!: GameObjects.Text;
  private bufferText!: GameObjects.Text;
  private streakText!: GameObjects.Text;
  private frozenClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const top = { fontSize: "15px", fontFamily: "monospace", color: "#aaaacc" };
    const buf = {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#ffffff",
      backgroundColor: "#ffffff22",
      padding: { x: 10, y: 4 },
    };

    this.waveText = this.add.text(12, 10, "Wave 1", top);
    this.scoreText = this.add.text(12, 30, "Score: 0", top);
    this.leftLogText = this.add.text(12, 50, "🪵".repeat(5), {
      ...top,
      color: "#d8a860",
    });
    this.rightLogText = this.add
      .text(W - 12, 50, "🪵".repeat(5), { ...top, color: "#d8a860" })
      .setOrigin(1, 0);
    this.facingText = this.add
      .text(W / 2, 10, "▶", { ...top, fontSize: "20px", color: "#ffdd44" })
      .setOrigin(0.5, 0);
    this.powerUpText = this.add
      .text(W / 2, 34, "", { ...top, fontSize: "14px", color: "#ffdd44" })
      .setOrigin(0.5, 0);
    this.frozenText = this.add
      .text(W / 2, H / 2 - 110, "", {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#88ddff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.bufferText = this.add.text(W / 2, H - 16, "", buf).setOrigin(0.5, 1);
    this.streakText = this.add
      .text(W / 2, H - 50, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ffaa00",
      })
      .setOrigin(0.5, 1);

    this.scale.on("resize", (size: Structs.Size) => {
      this.rightLogText.setX(size.width - 12);
      this.facingText.setX(size.width / 2);
      this.powerUpText.setX(size.width / 2);
      this.frozenText.setX(size.width / 2).setY(size.height / 2 - 110);
      this.bufferText.setX(size.width / 2).setY(size.height - 16);
      this.streakText.setX(size.width / 2).setY(size.height - 50);
    });

    this.game.events.on("ui-wave", (wave: number) => {
      this.waveText.setText(`Wave ${wave}`);
    });
    this.game.events.on("ui-score", (score: number) => {
      this.scoreText.setText(`Score: ${score}`);
    });
    this.game.events.on("ui-log-left", (hp: number) => {
      this.leftLogText.setText(hp > 0 ? "🪵".repeat(hp) : "💥 broken");
    });
    this.game.events.on("ui-log-right", (hp: number) => {
      this.rightLogText.setText(hp > 0 ? "🪵".repeat(hp) : "💥 broken");
    });
    this.game.events.on("ui-facing", (facing: "left" | "right") => {
      this.facingText.setText(facing === "left" ? "◀" : "▶");
    });
    this.game.events.on("ui-powerup", (kind: "freeze" | "tnt" | null) => {
      if (kind === null) {
        this.powerUpText.setText("");
      } else {
        const icon = kind === "freeze" ? "❄️" : "🧨";
        this.powerUpText.setText(`${icon} Press ENTER to use!`);
      }
    });
    this.game.events.on("ui-frozen", (durationMs: number) => {
      this.frozenText.setText("❄️ FROZEN!");
      this.frozenClearTimer?.remove();
      this.frozenClearTimer = this.time.delayedCall(durationMs, () => {
        this.frozenText.setText("");
      });
    });
    this.game.events.on("ui-buffer", (buf: string, locked: string | null) => {
      this.bufferText.setText(buf.length > 0 ? `${buf}_` : "");
      this.bufferText.setColor(locked !== null ? "#ffcc44" : "#ffffff");
    });
    this.game.events.on("ui-streak", (streak: number) => {
      this.streakText.setText(streak >= 5 ? `🔥 ${streak} streak!` : "");
    });
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

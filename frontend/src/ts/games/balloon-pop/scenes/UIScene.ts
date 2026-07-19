import { Scene, GameObjects, Structs, Time } from "phaser";

export class UIScene extends Scene {
  private waveText!: GameObjects.Text;
  private scoreText!: GameObjects.Text;
  private livesText!: GameObjects.Text;
  private powerUpText!: GameObjects.Text;
  private gustText!: GameObjects.Text;
  private bufferText!: GameObjects.Text;
  private streakText!: GameObjects.Text;
  private gustClearTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const topStyle = {
      fontSize: "15px",
      fontFamily: "monospace",
      color: "#aaaaaa",
    };
    const bufStyle = {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#ffffff",
      backgroundColor: "#ffffff22",
      padding: { x: 10, y: 4 },
    };

    this.waveText = this.add.text(12, 10, "Wave 1", topStyle);
    this.scoreText = this.add.text(12, 30, "Score: 0", topStyle);
    this.livesText = this.add
      .text(W / 2, 10, "❤ ❤ ❤ ❤ ❤ ❤ ❤ ❤", { ...topStyle, color: "#ee4444" })
      .setOrigin(0.5, 0);
    this.powerUpText = this.add
      .text(W / 2, 34, "", { ...topStyle, fontSize: "14px", color: "#ffdd44" })
      .setOrigin(0.5, 0);
    this.gustText = this.add
      .text(W / 2, H / 2 - 110, "", {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#88ddff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.bufferText = this.add
      .text(W / 2, H - 16, "", bufStyle)
      .setOrigin(0.5, 1);
    this.streakText = this.add
      .text(W / 2, H - 50, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ffaa00",
      })
      .setOrigin(0.5, 1);

    this.scale.on("resize", (size: Structs.Size) => {
      this.livesText.setX(size.width / 2);
      this.powerUpText.setX(size.width / 2);
      this.gustText.setX(size.width / 2).setY(size.height / 2 - 110);
      this.bufferText.setX(size.width / 2).setY(size.height - 16);
      this.streakText.setX(size.width / 2).setY(size.height - 50);
    });

    this.game.events.on("ui-wave", (wave: number) => {
      this.waveText.setText(`Wave ${wave}`);
    });
    this.game.events.on("ui-score", (score: number) => {
      this.scoreText.setText(`Score: ${score}`);
    });
    this.game.events.on("ui-lives", (lives: number) => {
      this.livesText.setText("❤ ".repeat(lives).trim());
    });
    this.game.events.on("ui-powerup", (kind: "gust" | "golden" | null) => {
      if (kind === null) {
        this.powerUpText.setText("");
      } else {
        const icon = kind === "gust" ? "🌪️" : "🎇";
        this.powerUpText.setText(`${icon} Press ENTER to use!`);
      }
    });
    this.game.events.on("ui-frozen", (durationMs: number) => {
      this.gustText.setText("🌪️ GUST!");
      this.gustClearTimer?.remove();
      this.gustClearTimer = this.time.delayedCall(durationMs, () => {
        this.gustText.setText("");
      });
    });
    this.game.events.on("ui-buffer", (buf: string, locked: string | null) => {
      this.bufferText.setText(buf.length > 0 ? `${buf}_` : "");
      this.bufferText.setColor(locked !== null ? "#ffcc44" : "#ffffff");
    });
    this.game.events.on("ui-streak", (streak: number) => {
      this.streakText.setText(streak >= 5 ? `🎈 ${streak} streak!` : "");
    });
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

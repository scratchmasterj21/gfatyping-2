import { Scene, GameObjects, Structs } from "phaser";

export class UIScene extends Scene {
  private waveText!: GameObjects.Text;
  private scoreText!: GameObjects.Text;
  private livesText!: GameObjects.Text;
  private bufferText!: GameObjects.Text;
  private streakText!: GameObjects.Text;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    const top = { fontSize: "15px", fontFamily: "monospace", color: "#ffffff" };
    const buf = {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#ffffff",
      backgroundColor: "#00000055",
      padding: { x: 10, y: 4 },
    };

    this.waveText = this.add.text(12, 10, "Wave 1", top);
    this.scoreText = this.add.text(12, 30, "Score: 0", top);
    this.livesText = this.add
      .text(W / 2, 10, "🍎 🍎 🍎 🍎 🍎 🍎 🍎 🍎", { ...top, color: "#ffdd44" })
      .setOrigin(0.5, 0);
    this.bufferText = this.add.text(W / 2, H - 16, "", buf).setOrigin(0.5, 1);
    this.streakText = this.add
      .text(W / 2, H - 50, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ffcc00",
      })
      .setOrigin(0.5, 1);

    this.scale.on("resize", (size: Structs.Size) => {
      this.livesText.setX(size.width / 2);
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
      this.livesText.setText("🍎 ".repeat(lives).trim() || "💀");
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
    this.game.events.off("ui-wave");
    this.game.events.off("ui-score");
    this.game.events.off("ui-lives");
    this.game.events.off("ui-buffer");
    this.game.events.off("ui-streak");
  }
}

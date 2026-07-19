import { Geom, Scene } from "phaser";

type GameOverData = {
  score: number;
  wordsTyped: number;
  hits: number;
  misses: number;
  totalChars: number;
  totalTime: number;
};

export class GameOverScene extends Scene {
  constructor() {
    super({ key: "GameOver" });
  }

  create(data: GameOverData): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    const wpm = Math.round(data.totalChars / 5 / (data.totalTime / 60));
    const accuracy =
      data.hits + data.misses > 0
        ? Math.round((data.hits / (data.hits + data.misses)) * 100)
        : 0;

    this.game.events.emit("game-result", {
      score: data.score,
      wave: data.wordsTyped,
    });

    const panel = this.add.graphics();
    panel.fillStyle(0x3b1a06, 0.95);
    panel.fillRoundedRect(cx - 210, cy - 155, 420, 310, 16);
    panel.lineStyle(2.5, 0xf9a825, 0.8);
    panel.strokeRoundedRect(cx - 210, cy - 155, 420, 310, 16);

    const h = { fontSize: "26px", fontFamily: "monospace", color: "#f9a825" };
    const s = { fontSize: "14px", fontFamily: "monospace", color: "#c8a97a" };
    const v = { fontSize: "15px", fontFamily: "monospace", color: "#ffffff" };

    this.add.text(cx, cy - 122, "🎪 TIME'S UP!", h).setOrigin(0.5);

    const rows: [string, string][] = [
      ["Words typed", `${data.wordsTyped}`],
      ["Score", `${data.score}`],
      ["WPM", `${wpm}`],
      ["Accuracy", `${accuracy}%`],
    ];
    rows.forEach(([label, value], i) => {
      const y = cy - 72 + i * 44;
      this.add.text(cx - 60, y, label, s).setOrigin(1, 0.5);
      this.add.text(cx - 44, y, value, v).setOrigin(0, 0.5);
    });

    const btnY = cy + 118;
    this.makeBtn(cx - 80, btnY, "Play Again", () => {
      this.scene.stop("UI");
      this.scene.start("Boot");
      this.scene.launch("UI");
    });
    this.makeBtn(cx + 80, btnY, "Exit", () => {
      this.game.events.emit("exit-game");
    });
  }

  private makeBtn(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x8b4513, 1);
    bg.fillRoundedRect(x - 65, y - 18, 130, 36, 8);
    bg.lineStyle(1.5, 0xf9a825, 0.7);
    bg.strokeRoundedRect(x - 65, y - 18, 130, 36, 8);

    const txt = this.add
      .text(x, y, label, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    bg.setInteractive({
      hitArea: new Geom.Rectangle(x - 65, y - 18, 130, 36),
      hitAreaCallback: Geom.Rectangle.Contains,
      useHandCursor: true,
    })
      .on("pointerdown", onClick)
      .on("pointerover", () => txt.setColor("#f9a825"))
      .on("pointerout", () => txt.setColor("#ffffff"));
  }
}

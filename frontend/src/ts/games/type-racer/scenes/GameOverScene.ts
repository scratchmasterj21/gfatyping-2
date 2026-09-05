import { Scene } from "phaser";

type GameOverData = {
  playerWon: boolean;
  wpm: number;
  accuracy: number;
  elapsed: number;
  wordsTyped: number;
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

    const panel = this.add.graphics();
    panel.fillStyle(0x0a0a1a, 0.94);
    panel.fillRect(cx - 210, cy - 150, 420, 300);
    panel.lineStyle(2, data.playerWon ? 0x44aa44 : 0xcc3322, 0.7);
    panel.strokeRect(cx - 210, cy - 150, 420, 300);

    const title = data.playerWon ? "YOU WIN! 🏆" : "CPU WINS";
    const titleColor = data.playerWon ? "#44ee44" : "#ee4444";

    this.add
      .text(cx, cy - 118, title, {
        fontSize: "30px",
        fontFamily: "monospace",
        color: titleColor,
      })
      .setOrigin(0.5);

    const s = { fontSize: "14px", fontFamily: "monospace", color: "#888888" };
    const v = { fontSize: "14px", fontFamily: "monospace", color: "#ffffff" };

    const rows: [string, string][] = [
      ["WPM", `${data.wpm}`],
      ["Accuracy", `${data.accuracy}%`],
      ["Words typed", `${data.wordsTyped}`],
      ["Time", `${data.elapsed}s`],
    ];

    rows.forEach(([label, value], i) => {
      const y = cy - 68 + i * 36;
      this.add.text(cx - 80, y, label, s).setOrigin(0, 0.5);
      this.add.text(cx + 80, y, value, v).setOrigin(1, 0.5);
    });

    this.game.events.emit("game-result", {
      score: data.wpm,
      wave: data.wordsTyped,
    });

    const btnY = cy + 118;
    this.makeBtn(cx - 90, btnY, "Play Again", () => {
      this.scene.start("Boot");
    });
    this.makeBtn(cx + 90, btnY, "Back to Lessons", () => {
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
    bg.fillStyle(0x224466, 1);
    bg.fillRect(x - 80, y - 20, 160, 40);
    const txt = this.add
      .text(x, y, label, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .on("pointerover", () => {
        txt.setColor("#ffcc44");
      })
      .on("pointerout", () => {
        txt.setColor("#ffffff");
      });

    bg.setInteractive({ useHandCursor: true })
      .on("pointerdown", onClick)
      .on("pointerover", () => txt.setColor("#ffcc44"))
      .on("pointerout", () => txt.setColor("#ffffff"));
  }
}

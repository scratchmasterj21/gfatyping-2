import { Geom, Scene } from "phaser";

type GameOverData = {
  score: number;
  wave: number;
  hits: number;
  misses: number;
  /** true when ending because the (lesson-capped) wave target was cleared, rather than running out of lives */
  cleared?: boolean;
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

    const accuracy =
      data.hits + data.misses > 0
        ? Math.round((data.hits / (data.hits + data.misses)) * 100)
        : 0;

    this.game.events.emit("game-result", {
      score: data.score,
      wave: data.wave,
    });

    const panel = this.add.graphics();
    panel.fillStyle(0x0d0022, 0.94);
    panel.fillRoundedRect(cx - 200, cy - 140, 400, 280, 16);
    panel.lineStyle(2, 0x6644aa, 0.7);
    panel.strokeRoundedRect(cx - 200, cy - 140, 400, 280, 16);

    const h = {
      fontSize: "28px",
      fontFamily: "monospace",
      color: data.cleared === true ? "#44ee88" : "#aa44ff",
    };
    const s = { fontSize: "15px", fontFamily: "monospace", color: "#aaaacc" };
    const v = { fontSize: "15px", fontFamily: "monospace", color: "#ffffff" };

    this.add
      .text(
        cx,
        cy - 110,
        data.cleared === true ? "CLEARED! 🎉" : "GAME OVER",
        h,
      )
      .setOrigin(0.5);
    this.add.text(cx, cy - 60, "Wave reached", s).setOrigin(0.5);
    this.add.text(cx, cy - 38, `${data.wave}`, v).setOrigin(0.5);
    this.add.text(cx, cy, "Score", s).setOrigin(0.5);
    this.add.text(cx, cy + 22, `${data.score}`, v).setOrigin(0.5);
    this.add.text(cx, cy + 60, "Accuracy", s).setOrigin(0.5);
    this.add
      .text(
        cx,
        cy + 82,
        `${accuracy}%  (${data.hits} hit / ${data.misses} miss)`,
        v,
      )
      .setOrigin(0.5);

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
    bg.fillStyle(0x3a1a66, 1);
    bg.fillRoundedRect(x - 60, y - 16, 120, 32, 8);

    const txt = this.add
      .text(x, y, label, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    bg.setInteractive({
      hitArea: new Geom.Rectangle(x - 60, y - 16, 120, 32),
      hitAreaCallback: Geom.Rectangle.Contains,
      useHandCursor: true,
    })
      .on("pointerdown", onClick)
      .on("pointerover", () => {
        txt.setColor("#cc88ff");
      })
      .on("pointerout", () => {
        txt.setColor("#ffffff");
      });
  }
}

import { Scene, GameObjects } from "phaser";

export class BombEntity extends GameObjects.Container {
  readonly word: string;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;

  constructor(scene: Scene, x: number, y: number, word: string) {
    super(scene, x, y);
    this.word = word;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0xff3300, 0.85);
    gfx.lineStyle(1.5, 0xff6644, 1);
    gfx.beginPath();
    gfx.moveTo(0, -13);
    gfx.lineTo(11, 0);
    gfx.lineTo(0, 13);
    gfx.lineTo(-11, 0);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();
    this.add(gfx);

    const style = { fontSize: "13px", fontFamily: "monospace" };
    this.labelTyped = scene.add.text(0, 20, "", {
      ...style,
      color: "#88ff88",
    });
    this.labelTyped.setOrigin(1, 0.5);
    this.labelRemain = scene.add.text(0, 20, word, {
      ...style,
      color: "#ffaaaa",
    });
    this.labelRemain.setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();

    scene.add.existing(this);
  }

  private positionLabels(): void {
    const total = this.labelTyped.width + this.labelRemain.width;
    const offsetX = -total / 2 + this.labelTyped.width;
    this.labelTyped.setX(offsetX);
    this.labelRemain.setX(offsetX);
  }

  updateTyped(typed: string): void {
    const remain = this.word.slice(typed.length);
    this.labelTyped.setText(typed);
    this.labelRemain.setText(remain);
    this.positionLabels();
  }
}

import { Scene, GameObjects } from "phaser";

export const FRUIT_COLORS = [0xffcc00, 0xff3333, 0x33cc44, 0xff7722, 0xaa44dd];

export class Fruit extends GameObjects.Container {
  readonly word: string;
  readonly typeIdx: number;
  readonly isBomb: boolean;
  vx = 0;
  vy = 0;
  omega = 0;
  private ring!: GameObjects.Graphics;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    typeIdx: number,
    isBomb = false,
  ) {
    super(scene, x, y);
    this.word = word;
    this.typeIdx = typeIdx;
    this.isBomb = isBomb;
    this.drawBody(scene);

    const ts = { fontSize: "18px", fontFamily: "monospace" };
    this.labelTyped = scene.add
      .text(0, -34, "", { ...ts, color: "#88ffaa" })
      .setOrigin(1, 0.5);
    this.labelRemain = scene.add
      .text(0, -34, word, {
        ...ts,
        color: isBomb ? "#ff6666" : "#ffffff",
      })
      .setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();

    if (isBomb) {
      scene.tweens.add({
        targets: this.ring,
        alpha: 0.25,
        duration: 320,
        yoyo: true,
        loop: -1,
        ease: "Sine.easeInOut",
      });
    }

    scene.add.existing(this);
  }

  private drawBody(scene: Scene): void {
    if (this.isBomb) {
      const g = scene.add.graphics();
      g.fillStyle(0x111122, 1);
      g.fillCircle(0, 0, 20);
      g.fillStyle(0x334, 0.5);
      g.fillCircle(-5, -7, 6);
      this.add(g);

      this.ring = scene.add.graphics();
      this.ring.lineStyle(3, 0xff2200, 1);
      this.ring.strokeCircle(0, 0, 27);
      this.add(this.ring);
    } else {
      const color =
        FRUIT_COLORS[this.typeIdx % FRUIT_COLORS.length] ?? 0xffcc00;
      const g = scene.add.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, 20);
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(-6, -8, 7);
      this.add(g);

      this.ring = scene.add.graphics();
      this.ring.lineStyle(2.5, 0xffffff, 0.9);
      this.ring.strokeCircle(0, 0, 24);
      this.ring.setVisible(false);
      this.add(this.ring);
    }
  }

  setHighlighted(on: boolean): void {
    if (!this.isBomb) this.ring.setVisible(on);
  }

  private positionLabels(): void {
    const total = this.labelTyped.width + this.labelRemain.width;
    const half = total / 2;
    this.labelTyped.setX(-half + this.labelTyped.width);
    this.labelRemain.setX(-half + this.labelTyped.width);
  }

  updateTyped(typed: string): void {
    const remain = this.word.slice(typed.length);
    this.labelTyped.setText(typed);
    this.labelRemain.setText(remain);
    this.positionLabels();
  }

  /** Cancels out the container's tumbling rotation so the word stays upright/readable. */
  keepLabelsUpright(): void {
    this.labelTyped.setRotation(-this.rotation);
    this.labelRemain.setRotation(-this.rotation);
  }

  /** Phaser's GameObject.destroy() doesn't kill tweens targeting it - the bomb's
   * infinite (loop: -1) ring pulse would otherwise keep running forever. */
  override destroy(fromScene?: boolean): void {
    if (this.isBomb) {
      this.scene.tweens.killTweensOf(this.ring);
    }
    super.destroy(fromScene);
  }
}

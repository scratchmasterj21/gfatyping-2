import { Scene, GameObjects } from "phaser";

const TINTS = {
  normal: 0xffffff,
  partial: 0xddaa22,
  locked: 0xff6622,
};

export class EnemyShip extends GameObjects.Container {
  readonly word: string;
  private shipImg: GameObjects.Image;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;
  private frozenBadge: GameObjects.Text;
  private shipState: "normal" | "partial" | "locked" = "normal";
  private frozen = false;

  constructor(scene: Scene, x: number, y: number, word: string) {
    super(scene, x, y);
    this.word = word;

    this.shipImg = scene.add.image(0, -6, "ship");
    this.shipImg.setDisplaySize(52, 52);
    this.add(this.shipImg);

    const style = {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffffff",
    };
    this.labelTyped = scene.add.text(0, 24, "", { ...style, color: "#88ff88" });
    this.labelTyped.setOrigin(1, 0.5);

    this.labelRemain = scene.add.text(0, 24, word, style);
    this.labelRemain.setOrigin(0, 0.5);

    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();

    this.frozenBadge = scene.add
      .text(0, -34, "⚡", { fontSize: "16px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

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

  highlight(mode: "normal" | "partial" | "locked"): void {
    if (this.shipState === mode) return;
    this.shipState = mode;
    this.shipImg.setTint(TINTS[mode]);
  }

  getTopY(): number {
    return this.y - 32;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /** Freezes just this ship (not globally) - see EMP power-up effect in GameScene. */
  setFrozen(value: boolean): void {
    this.frozen = value;
    this.frozenBadge.setVisible(value);
  }
}

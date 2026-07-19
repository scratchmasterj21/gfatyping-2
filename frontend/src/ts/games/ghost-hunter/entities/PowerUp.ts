import { Scene, GameObjects } from "phaser";

export type PowerUpKind = "freeze" | "tnt";

const ICONS: Record<PowerUpKind, string> = { freeze: "❄️", tnt: "🧨" };

// PLACEHOLDER: emoji icon on a glowing disc — replace with a sprite
export class PowerUp extends GameObjects.Container {
  readonly word: string;
  readonly kind: PowerUpKind;
  readonly side: "left" | "right";
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;
  private targetable = false;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    kind: PowerUpKind,
    side: "left" | "right",
  ) {
    super(scene, x, y);
    this.word = word;
    this.kind = kind;
    this.side = side;

    const glow = scene.add.graphics();
    glow.fillStyle(kind === "freeze" ? 0x66ccff : 0xff8844, 0.3);
    glow.fillCircle(0, 0, 26);
    this.add(glow);

    const icon = scene.add
      .text(0, 0, ICONS[kind], { fontSize: "30px" })
      .setOrigin(0.5);
    this.add(icon);

    const textStyle = { fontSize: "15px", fontFamily: "monospace" };
    this.labelTyped = scene.add
      .text(0, -38, "", { ...textStyle, color: "#88ffaa" })
      .setOrigin(1, 0.5);
    this.labelRemain = scene.add
      .text(0, -38, word, { ...textStyle, color: "#ffffff" })
      .setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();
    this.setTargetable(false);

    scene.add.existing(this);
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

  isTargetable(): boolean {
    return this.targetable;
  }

  /** Only visible/typeable while the player is facing this pickup's side (same rule as ghosts). */
  setTargetable(value: boolean): void {
    this.targetable = value;
    this.labelTyped.setVisible(value);
    this.labelRemain.setVisible(value);
    this.setAlpha(value ? 1 : 0.4);
  }
}

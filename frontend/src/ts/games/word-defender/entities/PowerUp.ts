import { Scene, GameObjects } from "phaser";

export type PowerUpKind = "emp" | "nuke";

const ICONS: Record<PowerUpKind, string> = { emp: "⚡", nuke: "☢️" };

// PLACEHOLDER: emoji icon on a glowing disc — replace with a sprite. Drifts
// down like a ship (same update-loop movement in GameScene) but reaching the
// base costs nothing if uncollected - it's just a missed bonus.
export class PowerUp extends GameObjects.Container {
  readonly word: string;
  readonly kind: PowerUpKind;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    kind: PowerUpKind,
  ) {
    super(scene, x, y);
    this.word = word;
    this.kind = kind;

    const glow = scene.add.graphics();
    glow.fillStyle(kind === "emp" ? 0x66ccff : 0x66ff66, 0.3);
    glow.fillCircle(0, 0, 28);
    this.add(glow);

    const icon = scene.add
      .text(0, 0, ICONS[kind], { fontSize: "30px" })
      .setOrigin(0.5);
    this.add(icon);

    const textStyle = { fontSize: "14px", fontFamily: "monospace" };
    this.labelTyped = scene.add
      .text(0, 30, "", { ...textStyle, color: "#88ff88" })
      .setOrigin(1, 0.5);
    this.labelRemain = scene.add
      .text(0, 30, word, { ...textStyle, color: "#ffffff" })
      .setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();

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
}

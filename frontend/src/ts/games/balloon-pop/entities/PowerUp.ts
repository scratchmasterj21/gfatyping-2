import { Scene, GameObjects } from "phaser";

export type PowerUpKind = "gust" | "golden";

const ICONS: Record<PowerUpKind, string> = { gust: "🌪️", golden: "🎇" };

// PLACEHOLDER: emoji icon on a glowing disc — replace with a sprite. Rises
// like a normal balloon (same update-loop movement/escape handling in
// GameScene) but escaping costs nothing - it's just a missed bonus.
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
    glow.fillStyle(kind === "gust" ? 0x66ccff : 0xffdd44, 0.3);
    glow.fillCircle(0, 0, 30);
    this.add(glow);

    const icon = scene.add
      .text(0, 0, ICONS[kind], { fontSize: "32px" })
      .setOrigin(0.5);
    this.add(icon);

    const textStyle = {
      fontSize: "15px",
      fontFamily: "monospace",
      stroke: "#00000088",
      strokeThickness: 3,
    };
    this.labelTyped = scene.add
      .text(0, -46, "", { ...textStyle, color: "#88ffaa" })
      .setOrigin(1, 0.5);
    this.labelRemain = scene.add
      .text(0, -46, word, { ...textStyle, color: "#ffffff" })
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

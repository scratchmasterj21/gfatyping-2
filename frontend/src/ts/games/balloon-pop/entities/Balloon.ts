import { Scene, GameObjects } from "phaser";

const COLORS = {
  partial: 0xddaa22,
  locked: 0xff3322,
};

// Resting (not-yet-targeted) balloons pick a random color from this palette
// purely for visual variety - partial/locked always override to the fixed
// feedback colors above regardless of a balloon's resting color.
const NORMAL_COLORS = [0x4488ee, 0xee6699, 0x44cc88, 0x9955ee, 0xff9933];

const RADIUS = 34;
const BIG_SCALE = 1.35;

export class Balloon extends GameObjects.Container {
  readonly word: string;
  readonly isBig: boolean;
  private bg: GameObjects.Graphics;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;
  private frozenBadge: GameObjects.Text;
  private shipState: "normal" | "partial" | "locked" = "normal";
  private normalColor: number;
  private frozen = false;

  constructor(scene: Scene, x: number, y: number, word: string, isBig = false) {
    super(scene, x, y);
    this.word = word;
    this.isBig = isBig;
    this.normalColor = NORMAL_COLORS[
      Math.floor(Math.random() * NORMAL_COLORS.length)
    ] as number;

    this.bg = scene.add.graphics();
    this.drawBalloon(this.normalColor);
    this.add(this.bg);

    const style = {
      fontSize: "15px",
      fontFamily: "monospace",
      color: "#ffffff",
      stroke: "#00000088",
      strokeThickness: 3,
    };
    this.labelTyped = scene.add.text(0, -2, "", { ...style, color: "#aaffaa" });
    this.labelTyped.setOrigin(1, 0.5);

    this.labelRemain = scene.add.text(0, -2, word, style);
    this.labelRemain.setOrigin(0, 0.5);

    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();

    this.frozenBadge = scene.add
      .text(0, -RADIUS - 14, "❄️", { fontSize: "18px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

    if (isBig) this.setScale(BIG_SCALE);

    scene.add.existing(this);
  }

  private positionLabels(): void {
    const total = this.labelTyped.width + this.labelRemain.width;
    const offsetX = -total / 2 + this.labelTyped.width;
    this.labelTyped.setX(offsetX);
    this.labelRemain.setX(offsetX);
  }

  private drawBalloon(color: number): void {
    this.bg.clear();
    // Main balloon body
    this.bg.fillStyle(color, 0.9);
    this.bg.fillCircle(0, 0, RADIUS);
    // Shine highlight
    this.bg.fillStyle(0xffffff, 0.25);
    this.bg.fillCircle(-10, -12, 10);
    // Knot at bottom
    this.bg.fillStyle(color, 1);
    this.bg.fillTriangle(-4, RADIUS, 4, RADIUS, 0, RADIUS + 8);
    // String
    this.bg.lineStyle(1, 0xffffff, 0.35);
    this.bg.lineBetween(0, RADIUS + 8, 0, RADIUS + 28);
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
    this.drawBalloon(mode === "normal" ? this.normalColor : COLORS[mode]);
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /** Freezes just this balloon (not globally) - see PowerUp gust effect in GameScene. */
  setFrozen(value: boolean): void {
    this.frozen = value;
    this.frozenBadge.setVisible(value);
  }
}

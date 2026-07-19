import { Scene, GameObjects } from "phaser";

// ASSETS: To swap in real sprites, replace drawBody() with:
//   this.sprite = scene.add.sprite(0, -30, "ghost");
//   this.sprite.setFlipX(side === "right");
//   this.add(this.sprite);
// and load the texture in BootScene.preload() with this.load.image("ghost", "url").

export class Ghost extends GameObjects.Container {
  readonly word: string;
  readonly side: "left" | "right";
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;
  private bobPhase: number;
  private spawnY: number;
  private targetable = false;
  private frozen = false;
  private frozenBadge: GameObjects.Text;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    side: "left" | "right",
  ) {
    super(scene, x, y);
    this.word = word;
    this.side = side;
    this.spawnY = y;
    this.bobPhase = Math.random() * Math.PI * 2;

    this.drawBody(scene, side);

    const textStyle = { fontSize: "15px", fontFamily: "monospace" };
    this.labelTyped = scene.add
      .text(0, -72, "", { ...textStyle, color: "#88ffaa" })
      .setOrigin(1, 0.5);
    this.labelRemain = scene.add
      .text(0, -72, word, { ...textStyle, color: "#ffffff" })
      .setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();
    this.setTargetable(false);

    this.frozenBadge = scene.add
      .text(0, -20, "❄️", { fontSize: "18px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

    scene.add.existing(this);
  }

  private drawBody(scene: Scene, side: "left" | "right"): void {
    const g = scene.add.graphics();

    // Body — soft blue-white blob
    g.fillStyle(0xd8e4ff, 0.88);
    g.fillEllipse(0, -36, 46, 50);
    g.fillRect(-23, -28, 46, 28);
    // Wavy bottom: three bumps
    for (let i = 0; i < 3; i++) {
      g.fillCircle(-15 + i * 15, 2, 9);
    }

    // Eyes — face toward center
    const ex = side === "left" ? 7 : -7;
    g.fillStyle(0x1a004a, 1);
    g.fillEllipse(ex, -40, 11, 14);
    g.fillEllipse(ex - 14, -40, 11, 14);

    // Eye gleam
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(ex + 2, -44, 3);
    g.fillCircle(ex - 12, -44, 3);

    // Mouth — small oval
    g.fillStyle(0x1a004a, 0.7);
    g.fillEllipse(ex - 7, -28, 10, 7);

    this.add(g);
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

  bob(time: number): void {
    this.y = this.spawnY + Math.sin(time * 0.0022 + this.bobPhase) * 7;
  }

  isTargetable(): boolean {
    return this.targetable;
  }

  /**
   * Only ghosts on the player's faced side, within reach of their current
   * patrol position, can be seen/typed - everything else is dimmed and its
   * word hidden so it can't be read or matched until the player turns/moves
   * to face it.
   */
  setTargetable(value: boolean): void {
    this.targetable = value;
    this.labelTyped.setVisible(value);
    this.labelRemain.setVisible(value);
    this.setAlpha(value ? 1 : 0.45);
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Freezes just this ghost (not movement globally) - only ghosts that
   * existed at the moment freeze was activated should stop, not ones that
   * spawn later during the same freeze window.
   */
  setFrozen(value: boolean): void {
    this.frozen = value;
    this.frozenBadge.setVisible(value);
  }
}

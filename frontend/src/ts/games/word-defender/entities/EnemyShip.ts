import { Scene, GameObjects } from "phaser";

import { hex } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { UFO_COLORS } from "../art";

export class EnemyShip extends GameObjects.Container {
  readonly word: string;
  private shipImg: GameObjects.Image;
  private tag: WordTag;
  private frozenBadge: GameObjects.Text;
  private shipState: "normal" | "partial" | "locked" = "normal";
  private frozen = false;

  constructor(scene: Scene, x: number, y: number, word: string) {
    super(scene, x, y);
    this.word = word;

    const variant = Math.floor(Math.random() * UFO_COLORS.length);
    this.shipImg = scene.add.image(0, -8, `wd-ufo-${variant}`);
    this.shipImg.setDisplaySize(64, 51);
    this.add(this.shipImg);
    // gentle hover wobble (visual only - the container's x/y drive gameplay)
    scene.tweens.add({
      targets: this.shipImg,
      angle: { from: -4, to: 4 },
      duration: 900 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tag = new WordTag(scene, 0, 32, word, 17);
    this.add(this.tag);

    this.frozenBadge = scene.add
      .text(26, -30, "⚡", { fontSize: "18px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }

  highlight(mode: "normal" | "partial" | "locked"): void {
    if (this.shipState === mode) return;
    this.shipState = mode;
    this.tag.setMode(mode);
    this.shipImg.setScale(
      (64 / this.shipImg.width) * (mode === "locked" ? 1.15 : 1),
    );
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
    if (value) this.shipImg.setTint(hex("sky"));
    else this.shipImg.clearTint();
  }
}

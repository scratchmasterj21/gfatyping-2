import { Scene, GameObjects } from "phaser";

import { WordTag } from "../../shared/phaser-ui";

export type PowerUpKind = "freeze" | "tnt";

export class PowerUp extends GameObjects.Container {
  readonly word: string;
  readonly kind: PowerUpKind;
  readonly side: "left" | "right";
  private tag: WordTag;
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

    const orb = scene.add
      .image(0, 0, kind === "freeze" ? "gh-orb-freeze" : "gh-orb-tnt")
      .setDisplaySize(50, 50);
    this.add(orb);
    scene.tweens.add({
      targets: orb,
      scale: orb.scale * 1.12,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tag = new WordTag(scene, 0, -40, word, 16, "yellow");
    this.add(this.tag);
    this.setTargetable(false);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }

  isTargetable(): boolean {
    return this.targetable;
  }

  /** Only visible/typeable while the player is facing this pickup's side (same rule as ghosts). */
  setTargetable(value: boolean): void {
    this.targetable = value;
    this.tag.setVisible(value);
    this.setAlpha(value ? 1 : 0.4);
  }
}

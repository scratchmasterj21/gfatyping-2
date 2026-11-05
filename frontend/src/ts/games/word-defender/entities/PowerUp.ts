import { Scene, GameObjects } from "phaser";

import { WordTag } from "../../shared/phaser-ui";

export type PowerUpKind = "emp" | "nuke";

// Drifts down like a ship (same update-loop movement in GameScene) but
// reaching the base costs nothing if uncollected - it's just a missed bonus.
export class PowerUp extends GameObjects.Container {
  readonly word: string;
  readonly kind: PowerUpKind;
  private tag: WordTag;

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

    const orb = scene.add
      .image(0, 0, kind === "emp" ? "wd-orb-emp" : "wd-orb-nuke")
      .setDisplaySize(52, 52);
    this.add(orb);
    scene.tweens.add({
      targets: orb,
      scale: orb.scale * 1.12,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tag = new WordTag(scene, 0, 36, word, 16, "yellow");
    this.add(this.tag);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }
}

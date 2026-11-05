import { Scene, GameObjects } from "phaser";

import { WordTag } from "../../shared/phaser-ui";

export type PowerUpKind = "gust" | "golden";

// Rises like a normal balloon (same update-loop movement/escape handling in
// GameScene) but escaping costs nothing - it's just a missed bonus.
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

    const img =
      kind === "gust"
        ? scene.add.image(0, 0, "bp-gust").setDisplaySize(88, 66)
        : scene.add
            .image(0, 0, "bp-golden")
            .setDisplaySize(76, 106)
            .setOrigin(0.5, 40 / 112);
    this.add(img);
    scene.tweens.add({
      targets: img,
      scale: img.scale * 1.08,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tag = new WordTag(scene, 0, -58, word, 16, "yellow");
    this.add(this.tag);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }
}

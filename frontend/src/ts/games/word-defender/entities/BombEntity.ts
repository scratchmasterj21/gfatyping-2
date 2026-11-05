import { Scene, GameObjects } from "phaser";

import { WordTag } from "../../shared/phaser-ui";

/** A little flaming meteor the boss drops. */
export class BombEntity extends GameObjects.Container {
  readonly word: string;
  private tag: WordTag;

  constructor(scene: Scene, x: number, y: number, word: string) {
    super(scene, x, y);
    this.word = word;

    const rock = scene.add.image(0, -6, "wd-rock").setDisplaySize(30, 38);
    this.add(rock);
    scene.tweens.add({
      targets: rock,
      angle: { from: -8, to: 8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.tag = new WordTag(scene, 0, 24, word, 14, "blush");
    this.add(this.tag);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }
}

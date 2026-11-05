import { Scene, GameObjects } from "phaser";

import { hex } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { FRUIT_KINDS } from "../art";

/** Drawn size of a fruit, px. */
export const FRUIT_SIZE = 60;

export class Fruit extends GameObjects.Container {
  readonly word: string;
  readonly typeIdx: number;
  readonly isBomb: boolean;
  vx = 0;
  vy = 0;
  omega = 0;
  private ring: GameObjects.Graphics;
  private tag: WordTag;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    typeIdx: number,
    isBomb = false,
  ) {
    super(scene, x, y);
    this.word = word;
    this.typeIdx = typeIdx;
    this.isBomb = isBomb;

    this.ring = scene.add.graphics();
    this.add(this.ring);
    if (isBomb) {
      this.ring.lineStyle(4, hex("red"), 1);
      this.ring.strokeCircle(0, 2, 34);
    } else {
      this.ring.fillStyle(hex("yellow"), 0.45);
      this.ring.fillCircle(0, 0, 38);
      this.ring.setVisible(false);
    }

    const key = isBomb
      ? "fn-bomb"
      : `fn-${FRUIT_KINDS[typeIdx % FRUIT_KINDS.length] ?? "apple"}`;
    this.add(scene.add.image(0, 0, key).setDisplaySize(FRUIT_SIZE, FRUIT_SIZE));

    this.tag = new WordTag(scene, 0, -48, word, 18, isBomb ? "blush" : "cream");
    this.add(this.tag);

    if (isBomb) {
      scene.tweens.add({
        targets: this.ring,
        alpha: 0.25,
        duration: 320,
        yoyo: true,
        loop: -1,
        ease: "Sine.easeInOut",
      });
    }

    scene.add.existing(this);
  }

  setHighlighted(on: boolean): void {
    this.tag.setMode(on ? "locked" : "normal");
    if (!this.isBomb) this.ring.setVisible(on);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }

  /** Cancels out the container's tumbling rotation so the word stays upright/readable. */
  keepLabelsUpright(): void {
    this.tag.setRotation(-this.rotation);
    // keep the tag above the fruit whichever way it spins
    this.tag.setPosition(
      -48 * Math.sin(this.rotation),
      -48 * Math.cos(this.rotation),
    );
  }

  /** Phaser's GameObject.destroy() doesn't kill tweens targeting it - the bomb's
   * infinite (loop: -1) ring pulse would otherwise keep running forever. */
  override destroy(fromScene?: boolean): void {
    if (this.isBomb) {
      this.scene.tweens.killTweensOf(this.ring);
    }
    super.destroy(fromScene);
  }
}

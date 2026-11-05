import { Scene, GameObjects } from "phaser";

import { hex } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { GHOST_TINTS } from "../art";

export class Ghost extends GameObjects.Container {
  readonly word: string;
  readonly side: "left" | "right";
  private ghostImg: GameObjects.Image;
  private tag: WordTag;
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

    // faces the middle of the lawn (art looks right by default)
    const tint = Math.floor(Math.random() * GHOST_TINTS.length);
    this.ghostImg = scene.add
      .image(0, 10, `gh-ghost-${tint}`)
      .setDisplaySize(56, 64)
      .setOrigin(0.5, 1)
      .setFlipX(side === "right");
    this.add(this.ghostImg);

    this.tag = new WordTag(scene, 0, -72, word, 16);
    this.add(this.tag);
    this.setTargetable(false);

    this.frozenBadge = scene.add
      .text(0, -20, "❄️", { fontSize: "18px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
    this.tag.setMode(typed.length > 0 ? "locked" : "normal");
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
    this.tag.setVisible(value);
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
    if (value) this.ghostImg.setTint(hex("sky"));
    else this.ghostImg.clearTint();
  }
}

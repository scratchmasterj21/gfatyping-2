import { Scene, GameObjects } from "phaser";

import { hex } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { GHOST_TINTS } from "../art";

export class Ghost extends GameObjects.Container {
  readonly word: string;
  readonly side: "left" | "right";
  /** Ghost King (boss wave): hits left, counting this word */
  readonly boss: { hp: number; maxHp: number } | null;
  /** scene time (ms) until which the Ghost King stands still after a hit */
  staggeredUntil = 0;
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
    boss: { hp: number; maxHp: number } | null = null,
  ) {
    super(scene, x, y);
    this.word = word;
    this.side = side;
    this.boss = boss;
    this.spawnY = y;
    this.bobPhase = Math.random() * Math.PI * 2;

    // faces the middle of the lawn (art looks right by default)
    const tint = Math.floor(Math.random() * GHOST_TINTS.length);
    this.ghostImg = scene.add
      .image(0, 10, boss === null ? `gh-ghost-${tint}` : "gh-king")
      .setDisplaySize(boss === null ? 56 : 105, boss === null ? 64 : 144)
      .setOrigin(0.5, 1)
      .setFlipX(side === "right");
    this.add(this.ghostImg);

    if (boss !== null) {
      // hits-left bar over the crown
      const barW = 84;
      const bar = scene.add.graphics();
      bar.fillStyle(hex("ink"), 0.8);
      bar.fillRoundedRect(-barW / 2 - 2, -148, barW + 4, 12, 6);
      bar.fillStyle(hex("red"), 1);
      bar.fillRoundedRect(-barW / 2, -146, (barW * boss.hp) / boss.maxHp, 8, 4);
      this.add(bar);
    }

    this.tag = new WordTag(
      scene,
      0,
      boss === null ? -72 : -164,
      word,
      boss === null ? 16 : 20,
    );
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

import { Scene, GameObjects } from "phaser";

import { hex } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { GHOST_TINTS } from "../art";
import { GhostKind, KIND_INFO } from "../ghost-kinds";

export class Ghost extends GameObjects.Container {
  readonly word: string;
  readonly side: "left" | "right";
  /** Ghost King (boss wave): hits left, counting this word */
  readonly boss: { hp: number; maxHp: number } | null;
  /** Ghost Party guest: wears a party hat */
  readonly party: boolean;
  readonly kind: GhostKind;
  /** armored ghosts: still wearing it (needs one more word) */
  armored: boolean;
  /** scene time (ms) until which the Ghost King stands still after a hit */
  staggeredUntil = 0;
  private ghostImg: GameObjects.Image;
  private imgKey: string;
  private tag: WordTag;
  private bobPhase: number;
  private spawnY: number;
  private targetable = false;
  private frozen = false;
  private frozenBadge: GameObjects.Text;
  /** shy ghosts hide their word until revealed */
  private revealed: boolean;
  private hidden: GameObjects.Text | null = null;
  private armorGfx: GameObjects.Graphics | null = null;
  private kindBadge: GameObjects.Text | null = null;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    side: "left" | "right",
    boss: { hp: number; maxHp: number } | null = null,
    party = false,
    kind: GhostKind = "normal",
  ) {
    super(scene, x, y);
    this.word = word;
    this.side = side;
    this.boss = boss;
    this.party = party;
    this.kind = boss === null ? kind : "normal";
    this.armored = this.kind === "armored";
    this.revealed = this.kind !== "shy";
    this.spawnY = y;
    this.bobPhase = Math.random() * Math.PI * 2;

    // faces the middle of the lawn (art looks right by default)
    const tint = Math.floor(Math.random() * GHOST_TINTS.length);
    this.imgKey = boss === null ? `gh-ghost-${tint}` : "gh-king";
    const small = this.kind === "speedy" || this.kind === "mini";
    const [w, h] = boss !== null ? [105, 144] : small ? [42, 48] : [56, 64];
    const back = side === "left" ? -1 : 1;
    if (this.kind === "twin") {
      // its twin peeking out from behind
      this.add(
        scene.add
          .image(back * 16, 4, this.imgKey)
          .setDisplaySize(w * 0.8, h * 0.8)
          .setOrigin(0.5, 1)
          .setFlipX(side === "right")
          .setAlpha(0.7),
      );
    }
    if (this.kind === "speedy") {
      // speed lines trailing behind
      const lines = scene.add.graphics();
      lines.lineStyle(3, hex("cream"), 0.7);
      for (const [dy, len] of [
        [-34, 22],
        [-22, 30],
        [-10, 18],
      ] as const) {
        lines.lineBetween(back * 22, dy, back * (22 + len), dy);
      }
      this.add(lines);
      scene.tweens.add({
        targets: lines,
        alpha: 0.25,
        duration: 140,
        yoyo: true,
        repeat: -1,
      });
    }
    this.ghostImg = scene.add
      .image(0, 10, this.imgKey)
      .setDisplaySize(w, h)
      .setOrigin(0.5, 1)
      .setFlipX(side === "right");
    this.add(this.ghostImg);
    if (this.kind === "shy") {
      // fading in and out, nervous
      scene.tweens.add({
        targets: this.ghostImg,
        alpha: 0.35,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    if (this.armored) {
      // a knight's helmet with a visor slit
      const a = scene.add.graphics();
      a.fillStyle(hex("grey"), 1);
      a.fillRoundedRect(-22, -56, 44, 26, { tl: 18, tr: 18, bl: 4, br: 4 });
      a.lineStyle(2, hex("ink"), 0.8);
      a.strokeRoundedRect(-22, -56, 44, 26, { tl: 18, tr: 18, bl: 4, br: 4 });
      a.fillStyle(hex("ink"), 1);
      a.fillRect(-14, -42, 28, 4);
      a.fillStyle(hex("red"), 1);
      a.fillTriangle(-3, -56, 3, -56, 0, -68);
      this.armorGfx = a;
      this.add(a);
    }

    if (party && boss === null) {
      // a little striped party hat, tilted
      const hat = scene.add.graphics();
      const colors = ["pink", "yellow", "sky", "mint"] as const;
      const c = colors[Math.floor(Math.random() * colors.length)] ?? "pink";
      hat.fillStyle(hex(c), 1);
      hat.fillTriangle(-9, -50, 9, -50, 0, -68);
      hat.lineStyle(2, hex("ink"), 0.8);
      hat.strokeTriangle(-9, -50, 9, -50, 0, -68);
      hat.fillStyle(hex("cream"), 1);
      hat.fillRect(-6, -57, 12, 2);
      hat.fillStyle(hex("yellow"), 1);
      hat.fillCircle(0, -69, 3.5);
      hat.setAngle(side === "left" ? 12 : -12);
      this.add(hat);
    }

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

    if (this.kind !== "normal" && this.kind !== "mini") {
      this.kindBadge = scene.add
        .text(back * -30, -44, KIND_INFO[this.kind].emoji, {
          fontSize: "16px",
        })
        .setOrigin(0.5);
      this.add(this.kindBadge);
    }
    if (!this.revealed) {
      this.hidden = scene.add
        .text(0, -72, "❓", { fontSize: "20px" })
        .setOrigin(0.5);
      this.add(this.hidden);
    }

    this.frozenBadge = scene.add
      .text(0, -20, "❄️", { fontSize: "18px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

    scene.add.existing(this);
  }

  /** Its picture, so a catch effect can animate a copy. */
  picture(): { key: string; w: number; h: number; flip: boolean } {
    return {
      key: this.imgKey,
      w: this.ghostImg.displayWidth,
      h: this.ghostImg.displayHeight,
      flip: this.ghostImg.flipX,
    };
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
    this.tag.setVisible(value && this.revealed);
    this.setAlpha(value ? 1 : 0.45);
  }

  isRevealed(): boolean {
    return this.revealed;
  }

  /** A shy ghost shows its word (it can be typed from now on). */
  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    this.hidden?.destroy();
    this.hidden = null;
    this.tag.setVisible(this.targetable);
    this.scene.tweens.killTweensOf(this.ghostImg);
    this.ghostImg.setAlpha(1);
    this.scene.tweens.add({
      targets: this.tag,
      scale: { from: 1.5, to: 1 },
      duration: 220,
      ease: "Back.easeOut",
    });
  }

  /** The first word knocks the armor off; the same word catches it. */
  breakArmor(): void {
    if (!this.armored) return;
    this.armored = false;
    this.armorGfx?.destroy();
    this.armorGfx = null;
    this.kindBadge?.destroy();
    this.kindBadge = null;
    this.updateTyped("");
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

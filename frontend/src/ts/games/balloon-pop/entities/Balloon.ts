import { Scene, GameObjects } from "phaser";

import { hex, PaletteName } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { BALLOON_COLORS } from "../art";

const BIG_SCALE = 1.35;
const BALLOON_W = 76;
const BALLOON_H = 106;

export class Balloon extends GameObjects.Container {
  readonly word: string;
  readonly isBig: boolean;
  /** Resting colour, used for the pop confetti. */
  readonly colorName: PaletteName;
  private img: GameObjects.Image;
  private tag: WordTag;
  private frozenBadge: GameObjects.Text;
  private shipState: "normal" | "partial" | "locked" = "normal";
  private frozen = false;

  constructor(scene: Scene, x: number, y: number, word: string, isBig = false) {
    super(scene, x, y);
    this.word = word;
    this.isBig = isBig;
    this.colorName = BALLOON_COLORS[
      Math.floor(Math.random() * BALLOON_COLORS.length)
    ] as PaletteName;

    // body centre sits on the container origin (the string hangs below)
    this.img = scene.add
      .image(0, 0, `bp-balloon-${this.colorName}`)
      .setDisplaySize(BALLOON_W, BALLOON_H)
      .setOrigin(0.5, 40 / 112);
    this.add(this.img);
    scene.tweens.add({
      targets: this.img,
      angle: { from: -5, to: 5 },
      duration: 1400 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tag = new WordTag(scene, 0, 0, word, 16);
    this.add(this.tag);

    this.frozenBadge = scene.add
      .text(0, -52, "❄️", { fontSize: "20px" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.frozenBadge);

    if (isBig) this.setScale(BIG_SCALE);

    scene.add.existing(this);
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }

  highlight(mode: "normal" | "partial" | "locked"): void {
    if (this.shipState === mode) return;
    this.shipState = mode;
    this.tag.setMode(mode);
    const base = this.isBig ? BIG_SCALE : 1;
    this.setScale(mode === "locked" ? base * 1.1 : base);
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /** Freezes just this balloon (not globally) - see PowerUp gust effect in GameScene. */
  setFrozen(value: boolean): void {
    this.frozen = value;
    this.frozenBadge.setVisible(value);
    if (value) this.img.setTint(hex("mint"));
    else this.img.clearTint();
  }
}

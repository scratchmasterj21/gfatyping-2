import { Scene, GameObjects } from "phaser";

import { hex } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";

const BAR_W = 100;
const BAR_H = 10;

/** The big alien mothership: every word typed knocks off one HP. */
export class BossShip extends GameObjects.Container {
  private _word: string;
  private _hp: number;
  readonly maxHp: number;
  readonly oscillateSpeed: number;
  readonly descentSpeed: number;
  oscillateDir = 1;

  private glow: GameObjects.Image;
  private tag: WordTag;
  private hpBarGfx: GameObjects.Graphics;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    hp: number,
    oscillateSpeed: number,
    descentSpeed: number,
  ) {
    super(scene, x, y);
    this._word = word;
    this._hp = hp;
    this.maxHp = hp;
    this.oscillateSpeed = oscillateSpeed;
    this.descentSpeed = descentSpeed;

    this.glow = scene.add.image(0, -4, "wd-glow").setDisplaySize(190, 150);
    this.glow.setAlpha(0.35);
    this.add(this.glow);

    const body = scene.add.image(0, -10, "wd-mothership");
    body.setDisplaySize(132, 91);
    this.add(body);

    this.tag = new WordTag(scene, 0, 48, word, 20, "cream");
    this.add(this.tag);

    this.hpBarGfx = scene.add.graphics();
    this.add(this.hpBarGfx);

    this.redraw();
    scene.add.existing(this);
  }

  get word(): string {
    return this._word;
  }

  get hp(): number {
    return this._hp;
  }

  private getColor(): number {
    const ratio = this._hp / this.maxHp;
    if (ratio > 0.6) return hex("green");
    if (ratio > 0.3) return hex("yellow");
    return hex("red");
  }

  private redraw(): void {
    const color = this.getColor();
    this.glow.setTint(color);

    const bx = -BAR_W / 2;
    const by = 72;
    this.hpBarGfx.clear();
    this.hpBarGfx.fillStyle(hex("ink"), 0.6);
    this.hpBarGfx.fillRoundedRect(bx - 2, by - 2, BAR_W + 4, BAR_H + 4, 7);
    this.hpBarGfx.fillStyle(color, 1);
    this.hpBarGfx.fillRoundedRect(
      bx,
      by,
      Math.max(BAR_H, Math.round(BAR_W * (this._hp / this.maxHp))),
      BAR_H,
      5,
    );
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }

  hit(newWord: string): void {
    this._hp--;
    this._word = newWord;
    this.tag.setWord(newWord);
    this.redraw();
  }

  pulse(scene: Scene): void {
    scene.tweens.add({
      targets: this,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  resetToTop(): void {
    this.y = -60;
    this.tag.setTyped("");
  }
}

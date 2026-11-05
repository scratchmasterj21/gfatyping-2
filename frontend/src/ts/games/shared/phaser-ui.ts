import { GameObjects, Scene, Types } from "phaser";

import { hex, PALETTE, PaletteName } from "./game-palette";
import { tappySvg, TappyMood, themeMainColor } from "./tappy-svg";

export const KID_FONT = '"Fredoka", "Lexend Deca", sans-serif';

/** Rounded kid font text style. */
export function kidText(
  size: number,
  color: PaletteName = "ink",
  extra: Types.GameObjects.Text.TextStyle = {},
): Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: KID_FONT,
    fontSize: `${size}px`,
    fontStyle: "bold",
    color: PALETTE[color],
    ...extra,
  };
}

export type TagMode = "normal" | "partial" | "locked";

/**
 * A word on a cream pill: typed letters turn green. "partial" = this word
 * matches what's typed so far, "locked" = it's the one being typed.
 */
export class WordTag extends GameObjects.Container {
  private bg: GameObjects.Graphics;
  private typedText: GameObjects.Text;
  private restText: GameObjects.Text;
  private word: string;
  private mode: TagMode = "normal";
  private readonly size: number;
  private readonly fill: PaletteName;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    size = 18,
    fill: PaletteName = "cream",
  ) {
    super(scene, x, y);
    this.word = word;
    this.size = size;
    this.fill = fill;
    this.bg = scene.add.graphics();
    this.typedText = scene.add.text(0, 0, "", kidText(size, "green"));
    this.restText = scene.add.text(0, 0, word, kidText(size, "ink"));
    this.typedText.setOrigin(0, 0.5);
    this.restText.setOrigin(0, 0.5);
    this.add([this.bg, this.typedText, this.restText]);
    this.layout();
  }

  setWord(word: string): void {
    this.word = word;
    this.setTyped("");
  }

  setTyped(typed: string): void {
    this.typedText.setText(typed);
    this.restText.setText(this.word.slice(typed.length));
    this.layout();
  }

  setMode(mode: TagMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.layout();
  }

  private layout(): void {
    const w = this.typedText.width + this.restText.width;
    const padX = this.size * 0.6;
    const h = this.size * 1.6;
    const left = -w / 2;
    this.typedText.setX(left);
    this.restText.setX(left + this.typedText.width);

    const bgColor =
      this.mode === "locked"
        ? hex("yellow")
        : this.mode === "partial"
          ? hex("cream")
          : hex(this.fill);
    this.bg.clear();
    this.bg.fillStyle(hex("ink"), 0.28);
    this.bg.fillRoundedRect(left - padX, -h / 2 + 3, w + padX * 2, h, h / 2);
    this.bg.fillStyle(bgColor, 1);
    this.bg.fillRoundedRect(left - padX, -h / 2, w + padX * 2, h, h / 2);
    if (this.mode !== "normal") {
      this.bg.lineStyle(3, hex(this.mode === "locked" ? "orange" : "gold"), 1);
      this.bg.strokeRoundedRect(left - padX, -h / 2, w + padX * 2, h, h / 2);
    }
  }
}

/** A small cream HUD pill: icon + label, resizes to its text. */
export class HudChip extends GameObjects.Container {
  private bg: GameObjects.Graphics;
  private label: GameObjects.Text;
  private fill: PaletteName = "cream";
  private textColor: PaletteName = "ink";

  constructor(scene: Scene, x: number, y: number, text: string) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, 0, text, kidText(15)).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.redraw();
    scene.add.existing(this);
  }

  setLabel(text: string): this {
    this.label.setText(text);
    this.redraw();
    return this;
  }

  setColors(fill: PaletteName, textColor: PaletteName): this {
    this.fill = fill;
    this.textColor = textColor;
    this.label.setColor(PALETTE[textColor]);
    this.redraw();
    return this;
  }

  get chipWidth(): number {
    return this.label.width + 24;
  }

  private redraw(): void {
    const w = this.chipWidth;
    const h = 30;
    this.bg.clear();
    this.bg.fillStyle(hex("ink"), 0.3);
    this.bg.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h / 2);
    this.bg.fillStyle(hex(this.fill), 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.label.setColor(PALETTE[this.textColor]);
  }
}

/** Lay chips out in a centred row. */
export function rowLayout(chips: HudChip[], cx: number, gap = 8): void {
  const visible = chips.filter((c) => c.visible);
  const total =
    visible.reduce((sum, c) => sum + c.chipWidth, 0) +
    gap * Math.max(0, visible.length - 1);
  let x = cx - total / 2;
  for (const c of visible) {
    c.setX(x + c.chipWidth / 2);
    x += c.chipWidth + gap;
  }
}

/** Big pill banner that pops in, then floats up and fades. */
export function popBanner(
  scene: Scene,
  x: number,
  y: number,
  text: string,
  fill: PaletteName = "yellow",
  durationMs = 2200,
): void {
  const label = scene.add.text(0, 0, text, kidText(30)).setOrigin(0.5);
  const w = label.width + 48;
  const h = 56;
  const bg = scene.add.graphics();
  bg.fillStyle(hex("ink"), 0.3);
  bg.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, h / 2);
  bg.fillStyle(hex(fill), 1);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const box = scene.add.container(x, y, [bg, label]).setDepth(50);
  box.setScale(0.3);
  scene.tweens.add({
    targets: box,
    scale: 1,
    duration: 320,
    ease: "Back.easeOut",
  });
  scene.tweens.add({
    targets: box,
    alpha: 0,
    y: y - 50,
    delay: durationMs * 0.6,
    duration: durationMs * 0.4,
    onComplete: () => box.destroy(),
  });
}

/** SVG texture defs for Tappy's three moods (use with addSvgTextures). */
export function tappyTextureDefs(): Record<
  string,
  { svg: string; width: number; height: number }
> {
  const main = themeMainColor();
  const moods: TappyMood[] = ["happy", "cheer", "sad"];
  return Object.fromEntries(
    moods.map((m) => [
      `tappy-${m}`,
      { svg: tappySvg(m, main), width: 120, height: 124 },
    ]),
  );
}

/** Tappy as a sidekick: idles with a bob, cheers on hits, frowns on misses. */
export class TappyBuddy extends GameObjects.Container {
  private img: GameObjects.Image;
  private moodTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(scene: Scene, x: number, y: number, size = 64) {
    super(scene, x, y);
    this.img = scene.add.image(0, 0, "tappy-happy").setOrigin(0.5, 1);
    this.img.setDisplaySize(size, (size * 124) / 120);
    this.add(this.img);
    scene.add.existing(this);
    scene.tweens.add({
      targets: this.img,
      y: -4,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.once("destroy", () => clearTimeout(this.moodTimer));
  }

  cheer(): void {
    this.show("cheer");
    this.scene.tweens.add({
      targets: this,
      scaleY: { from: 0.85, to: 1 },
      scaleX: { from: 1.12, to: 1 },
      duration: 280,
      ease: "Back.easeOut",
    });
  }

  sad(): void {
    this.show("sad");
    this.scene.tweens.add({
      targets: this,
      angle: { from: -6, to: 0 },
      duration: 320,
      ease: "Sine.easeOut",
    });
  }

  private show(mood: TappyMood): void {
    this.img.setTexture(`tappy-${mood}`);
    clearTimeout(this.moodTimer);
    this.moodTimer = setTimeout(() => {
      if (this.active) this.img.setTexture("tappy-happy");
    }, 900);
  }
}

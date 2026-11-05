import { Scene, GameObjects } from "phaser";

import { hex, PaletteName } from "../../shared/game-palette";
import { WordTag } from "../../shared/phaser-ui";
import { PRIZES } from "../art";

const BORDERS: PaletteName[] = ["yellow", "blue", "purple", "green", "pink"];

export type TargetKind = "normal" | "bonusTime" | "doublePoints" | "trap";

const SPECIAL_STYLE: Record<
  Exclude<TargetKind, "normal">,
  { fill: PaletteName; border: PaletteName; icon: string }
> = {
  bonusTime: { fill: "mint", border: "green", icon: "tt-clock" },
  doublePoints: { fill: "cream", border: "purple", icon: "tt-sparkle2x" },
  trap: { fill: "blush", border: "red", icon: "tt-bomb" },
};

/** A prize card on the booth shelf: a drawn prize with its word below. */
export class Target extends GameObjects.Container {
  readonly word: string;
  readonly typeIdx: number;
  readonly kind: TargetKind;
  private ring!: GameObjects.Graphics;
  private flashOverlay!: GameObjects.Graphics;
  private tag: WordTag;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    word: string,
    w: number,
    h: number,
    fontSize: number,
    typeIdx: number,
    kind: TargetKind = "normal",
  ) {
    super(scene, x, y);
    this.word = word;
    this.typeIdx = typeIdx;
    this.kind = kind;
    this.drawBody(scene, w, h, typeIdx, kind);

    this.tag = new WordTag(scene, 0, h * 0.27, word, fontSize + 2);
    this.add(this.tag);
    scene.add.existing(this);
  }

  private drawBody(
    scene: Scene,
    w: number,
    h: number,
    typeIdx: number,
    kind: TargetKind,
  ): void {
    const hw = w / 2;
    const hh = h / 2;
    const special = kind !== "normal" ? SPECIAL_STYLE[kind] : null;
    const fill = special?.fill ?? "cream";
    const border =
      special?.border ?? BORDERS[typeIdx % BORDERS.length] ?? "yellow";

    const g = scene.add.graphics();
    g.fillStyle(hex("ink"), 0.25);
    g.fillRoundedRect(-hw, -hh + 6, w, h, 14);
    g.fillStyle(hex(fill), 1);
    g.fillRoundedRect(-hw, -hh, w, h, 14);
    g.lineStyle(special !== null ? 5 : 4, hex(border), 1);
    g.strokeRoundedRect(-hw, -hh, w, h, 14);
    this.add(g);

    const iconSize = Math.max(26, Math.min(h * 0.5, w * 0.45));
    const icon =
      special?.icon ?? `tt-${PRIZES[typeIdx % PRIZES.length] ?? "star"}`;
    this.add(
      scene.add.image(0, -hh * 0.28, icon).setDisplaySize(iconSize, iconSize),
    );

    this.ring = scene.add.graphics();
    this.ring.lineStyle(5, hex("gold"), 1);
    this.ring.strokeRoundedRect(-hw - 6, -hh - 6, w + 12, h + 12, 18);
    this.ring.setVisible(false);
    this.add(this.ring);

    this.flashOverlay = scene.add.graphics();
    this.flashOverlay.fillStyle(hex("red"), 0.35);
    this.flashOverlay.fillRoundedRect(-hw, -hh, w, h, 14);
    this.flashOverlay.setVisible(false);
    this.add(this.flashOverlay);
  }

  setHighlighted(on: boolean): void {
    this.ring.setVisible(on);
    this.tag.setMode(on ? "locked" : "normal");
  }

  flashRed(): void {
    this.flashOverlay.setVisible(true);
    this.scene.time.delayedCall(160, () => {
      if (this.active) this.flashOverlay.setVisible(false);
    });
  }

  updateTyped(typed: string): void {
    this.tag.setTyped(typed);
  }
}

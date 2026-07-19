import { Scene, GameObjects } from "phaser";

// ASSETS: To swap in real sprites, replace drawBody() with:
//   this.sprite = scene.add.sprite(0, -hh * 0.3, typeIdx % 2 === 0 ? "duck" : "panda");
//   this.add(this.sprite);
// Load textures in BootScene.preload() with:
//   this.load.image("duck", "url"); this.load.image("panda", "url");

const BODY_COLORS = [0xfff176, 0xe1f5fe, 0xf3e5f5, 0xe8f5e9, 0xfce4ec];
const BORDER_COLORS = [0xf9a825, 0x0277bd, 0x7b1fa2, 0x2e7d32, 0xc62828];
const EMOJIS = ["🦆", "🐼", "🎯", "⭐", "🎪"];

export type TargetKind = "normal" | "bonusTime" | "doublePoints" | "trap";

const SPECIAL_STYLE: Record<
  Exclude<TargetKind, "normal">,
  { body: number; border: number; emoji: string }
> = {
  bonusTime: { body: 0xfff59d, border: 0xf9a825, emoji: "⏱️" },
  doublePoints: { body: 0xe1bee7, border: 0x8e24aa, emoji: "✨" },
  trap: { body: 0xffab91, border: 0xc62828, emoji: "💣" },
};

export class Target extends GameObjects.Container {
  readonly word: string;
  readonly typeIdx: number;
  readonly kind: TargetKind;
  private ring!: GameObjects.Graphics;
  private flashOverlay!: GameObjects.Graphics;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;

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

    const ts = { fontSize: `${fontSize}px`, fontFamily: "monospace" };
    this.labelTyped = scene.add
      .text(0, h * 0.15, "", { ...ts, color: "#1a7a3a" })
      .setOrigin(1, 0.5);
    this.labelRemain = scene.add
      .text(0, h * 0.15, word, { ...ts, color: "#1a1a2e" })
      .setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);
    this.positionLabels();
    scene.add.existing(this);
  }

  // PLACEHOLDER: colored rounded rect with emoji character
  // ASSETS: see comment at top of file
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
    const bodyColor =
      special?.body ?? BODY_COLORS[typeIdx % BODY_COLORS.length] ?? 0xfff176;
    const borderColor =
      special?.border ??
      BORDER_COLORS[typeIdx % BORDER_COLORS.length] ??
      0xf9a825;

    const g = scene.add.graphics();
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-hw, -hh, w, h, 10);
    g.lineStyle(special !== null ? 3.5 : 2.5, borderColor, 1);
    g.strokeRoundedRect(-hw, -hh, w, h, 10);
    this.add(g);

    const emojiSize = Math.max(16, Math.floor(h * 0.32));
    const emoji = special?.emoji ?? EMOJIS[typeIdx % EMOJIS.length] ?? "🎯";
    this.add(
      scene.add
        .text(0, -hh * 0.28, emoji, { fontSize: `${emojiSize}px` })
        .setOrigin(0.5),
    );

    this.ring = scene.add.graphics();
    this.ring.lineStyle(3.5, borderColor, 0.9);
    this.ring.strokeRoundedRect(-hw - 4, -hh - 4, w + 8, h + 8, 12);
    this.ring.setVisible(false);
    this.add(this.ring);

    this.flashOverlay = scene.add.graphics();
    this.flashOverlay.fillStyle(0xff2222, 0.38);
    this.flashOverlay.fillRoundedRect(-hw, -hh, w, h, 10);
    this.flashOverlay.setVisible(false);
    this.add(this.flashOverlay);
  }

  setHighlighted(on: boolean): void {
    this.ring.setVisible(on);
  }

  flashRed(): void {
    this.flashOverlay.setVisible(true);
    this.scene.time.delayedCall(160, () => {
      if (this.active) this.flashOverlay.setVisible(false);
    });
  }

  private positionLabels(): void {
    const total = this.labelTyped.width + this.labelRemain.width;
    const half = total / 2;
    this.labelTyped.setX(-half + this.labelTyped.width);
    this.labelRemain.setX(-half + this.labelTyped.width);
  }

  updateTyped(typed: string): void {
    const remain = this.word.slice(typed.length);
    this.labelTyped.setText(typed);
    this.labelRemain.setText(remain);
    this.positionLabels();
  }
}

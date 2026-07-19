import { Scene, GameObjects } from "phaser";

const HP_COLORS = [0x44ff88, 0xffcc00, 0xff4422] as const;
const HEX_RADIUS = 44;

function hexPoints(r: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });
}

export class BossShip extends GameObjects.Container {
  private _word: string;
  private _hp: number;
  readonly maxHp: number;
  readonly oscillateSpeed: number;
  readonly descentSpeed: number;
  oscillateDir = 1;

  private glowGfx: GameObjects.Graphics;
  private bodyGfx: GameObjects.Graphics;
  private hpBarGfx: GameObjects.Graphics;
  private labelTyped: GameObjects.Text;
  private labelRemain: GameObjects.Text;

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

    this.glowGfx = scene.add.graphics();
    this.add(this.glowGfx);

    this.bodyGfx = scene.add.graphics();
    this.add(this.bodyGfx);

    const style = {
      fontSize: "17px",
      fontFamily: "monospace",
      fontStyle: "bold",
    };
    this.labelTyped = scene.add.text(0, 0, "", {
      ...style,
      color: "#88ff88",
    });
    this.labelTyped.setOrigin(1, 0.5);
    this.labelRemain = scene.add.text(0, 0, word, {
      ...style,
      color: "#ffffff",
    });
    this.labelRemain.setOrigin(0, 0.5);
    this.add([this.labelTyped, this.labelRemain]);

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
    if (ratio > 0.6) return HP_COLORS[0];
    if (ratio > 0.3) return HP_COLORS[1];
    return HP_COLORS[2];
  }

  private redraw(): void {
    const color = this.getColor();

    this.glowGfx.clear();
    this.glowGfx.fillStyle(color, 0.1);
    this.glowGfx.fillCircle(0, 0, HEX_RADIUS + 18);

    this.bodyGfx.clear();
    this.bodyGfx.fillStyle(color, 0.28);
    this.bodyGfx.lineStyle(2.5, color, 1);
    const pts = hexPoints(HEX_RADIUS);
    this.bodyGfx.beginPath();
    const first = pts[0];
    if (first !== undefined) this.bodyGfx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const pt = pts[i];
      if (pt !== undefined) this.bodyGfx.lineTo(pt.x, pt.y);
    }
    this.bodyGfx.closePath();
    this.bodyGfx.fillPath();
    this.bodyGfx.strokePath();

    const bw = 90;
    const bh = 7;
    const bx = -bw / 2;
    const by = HEX_RADIUS + 10;
    this.hpBarGfx.clear();
    this.hpBarGfx.fillStyle(0x222233, 1);
    this.hpBarGfx.fillRect(bx, by, bw, bh);
    this.hpBarGfx.fillStyle(color, 1);
    this.hpBarGfx.fillRect(
      bx,
      by,
      Math.round(bw * (this._hp / this.maxHp)),
      bh,
    );

    this.positionLabels();
  }

  private positionLabels(): void {
    const total = this.labelTyped.width + this.labelRemain.width;
    const offsetX = -total / 2 + this.labelTyped.width;
    this.labelTyped.setPosition(offsetX, 0);
    this.labelRemain.setPosition(offsetX, 0);
  }

  updateTyped(typed: string): void {
    const remain = this._word.slice(typed.length);
    this.labelTyped.setText(typed);
    this.labelRemain.setText(remain);
    this.positionLabels();
  }

  hit(newWord: string): void {
    this._hp--;
    this._word = newWord;
    this.labelTyped.setText("");
    this.labelRemain.setText(newWord);
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
    this.labelTyped.setText("");
    this.labelRemain.setText(this._word);
    this.positionLabels();
  }
}

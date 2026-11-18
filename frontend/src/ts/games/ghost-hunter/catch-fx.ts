import { GameObjects, Scene, TintModes } from "phaser";

import { hex, PaletteName, PALETTE } from "../shared/game-palette";
import { kidText } from "../shared/phaser-ui";

/**
 * Ghost Hunter catch effects: the ghost gets vacuumed into the flashlight
 * beam, a little spirit floats away, the word's letters scatter, and the
 * score pops up. Streaks make it fancier. Visual only - nothing here changes
 * the game, so online games stay in step.
 */

const DEPTH = 60;

export type CatchFxInput = {
  /** ghost position (its feet) */
  x: number;
  y: number;
  word: string;
  points: number;
  streak: number;
  /** typed with no mistakes */
  perfect: boolean;
  /** caught right before it reached the player */
  close: boolean;
  /** where the flashlight is */
  fromX: number;
  fromY: number;
  /** the ghost's picture, to vacuum a copy of it */
  image?: { key: string; w: number; h: number; flip: boolean };
};

const RAINBOW: PaletteName[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "sky",
  "blue",
  "purple",
  "pink",
];

/** Sparkle colours get fancier with the streak. */
function sparkleTints(streak: number): number[] {
  if (streak >= 10) return RAINBOW.map(hex);
  if (streak >= 5) return [hex("gold"), hex("yellow"), hex("cream")];
  return [hex("yellow"), hex("cream"), hex("mint"), hex("pink")];
}

function burst(
  scene: Scene,
  x: number,
  y: number,
  count: number,
  tints: number[],
  speed = 140,
  texture = "gh-sparkle",
): void {
  const p = scene.add
    .particles(x, y, texture, {
      lifespan: 600,
      speed: { min: speed * 0.35, max: speed },
      scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: tints,
      emitting: false,
    })
    .setDepth(DEPTH);
  p.explode(count);
  scene.time.delayedCall(700, () => p.destroy());
}

function ring(
  scene: Scene,
  x: number,
  y: number,
  color: number,
  size: number,
  width = 4,
  ms = 380,
): void {
  const g = scene.add.graphics().setDepth(DEPTH);
  g.lineStyle(width, color, 1);
  g.strokeCircle(0, 0, size / 2);
  g.setPosition(x, y).setScale(0.2);
  scene.tweens.add({
    targets: g,
    scale: 1,
    alpha: 0,
    duration: ms,
    ease: "Cubic.easeOut",
    onComplete: () => g.destroy(),
  });
}

function floatText(
  scene: Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: PaletteName,
  rise = 50,
  ms = 800,
): void {
  const t = scene.add
    .text(
      x,
      y,
      text,
      kidText(size, color, { stroke: PALETTE.ink, strokeThickness: 4 }),
    )
    .setOrigin(0.5)
    .setDepth(DEPTH + 2)
    .setScale(0.4);
  scene.tweens.add({
    targets: t,
    scale: 1,
    duration: 160,
    ease: "Back.easeOut",
  });
  scene.tweens.add({
    targets: t,
    y: y - rise,
    alpha: 0,
    delay: ms * 0.45,
    duration: ms * 0.55,
    onComplete: () => t.destroy(),
  });
}

/** A thick pulsing beam with light orbs racing to the ghost. */
function beam(scene: Scene, c: CatchFxInput, gy: number): void {
  const g = scene.add.graphics().setDepth(DEPTH - 1);
  const glow = c.streak >= 20 ? hex("orange") : hex("yellow");
  g.lineStyle(20, glow, 0.25);
  g.lineBetween(c.fromX, c.fromY, c.x, gy);
  g.lineStyle(9, glow, 0.55);
  g.lineBetween(c.fromX, c.fromY, c.x, gy);
  g.lineStyle(4, hex("cream"), 1);
  g.lineBetween(c.fromX, c.fromY, c.x, gy);
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: 340,
    onComplete: () => g.destroy(),
  });
  // muzzle flash at the flashlight
  const flash = scene.add
    .circle(c.fromX, c.fromY, 14, hex("cream"), 0.95)
    .setDepth(DEPTH);
  scene.tweens.add({
    targets: flash,
    scale: 2.2,
    alpha: 0,
    duration: 220,
    onComplete: () => flash.destroy(),
  });
  // orbs racing along the beam
  for (let i = 0; i < 4; i++) {
    const orb = scene.add
      .circle(c.fromX, c.fromY, 5, hex("cream"), 1)
      .setDepth(DEPTH);
    scene.tweens.add({
      targets: orb,
      x: c.x,
      y: gy,
      delay: i * 45,
      duration: 170,
      ease: "Quad.easeIn",
      onComplete: () => orb.destroy(),
    });
  }
}

/** The ghost stretches toward the flashlight, spins, flashes and pops. */
function vacuum(
  scene: Scene,
  c: CatchFxInput,
  onPop: (x: number, y: number) => void,
): void {
  const img = c.image;
  if (img === undefined) {
    onPop(c.x, c.y - 30);
    return;
  }
  const ghost = scene.add
    .image(c.x, c.y + 10, img.key)
    .setDisplaySize(img.w, img.h)
    .setOrigin(0.5, 1)
    .setFlipX(img.flip)
    .setDepth(DEPTH - 1);
  const sx = ghost.scaleX;
  const sy = ghost.scaleY;
  const tx = c.x + (c.fromX - c.x) * 0.3;
  const ty = c.y + (c.fromY - c.y) * 0.3;
  scene.tweens.add({
    targets: ghost,
    x: tx,
    y: ty,
    scaleX: sx * 0.25,
    scaleY: sy * 1.35,
    angle: c.x < c.fromX ? 300 : -300,
    alpha: 0.2,
    duration: 300,
    ease: "Quad.easeIn",
    onUpdate: (tw) => {
      if (tw.progress > 0.55) {
        ghost.setTint(hex("cream")).setTintMode(TintModes.FILL);
      }
    },
    onComplete: () => {
      ghost.destroy();
      onPop(tx, ty - img.h * 0.3);
    },
  });
}

/** A tiny happy spirit drifts up and waves bye. */
function spirit(scene: Scene, x: number, y: number): void {
  const s = scene.add
    .text(x, y, "👻", { fontSize: "22px" })
    .setOrigin(0.5)
    .setDepth(DEPTH + 1)
    .setAlpha(0.95);
  scene.tweens.add({
    targets: s,
    y: y - 70,
    alpha: 0,
    duration: 1100,
    ease: "Sine.easeOut",
    onComplete: () => s.destroy(),
  });
  scene.tweens.add({
    targets: s,
    x: x + 12,
    angle: 12,
    yoyo: true,
    repeat: 2,
    duration: 180,
  });
}

/** The typed word breaks into letters that scatter and fade. */
function letters(
  scene: Scene,
  word: string,
  x: number,
  y: number,
  streak: number,
): void {
  const size = 18;
  const step = size * 0.62;
  const start = x - ((word.length - 1) * step) / 2;
  const colors: PaletteName[] =
    streak >= 10 ? RAINBOW : streak >= 5 ? ["gold", "yellow"] : ["cream"];
  [...word].forEach((ch, i) => {
    const t = scene.add
      .text(
        start + i * step,
        y,
        ch,
        kidText(size, colors[i % colors.length] ?? "cream", {
          stroke: PALETTE.ink,
          strokeThickness: 3,
        }),
      )
      .setOrigin(0.5)
      .setDepth(DEPTH + 1);
    const a = (i / Math.max(1, word.length - 1)) * Math.PI - Math.PI;
    const dist = 50 + Math.random() * 40;
    scene.tweens.add({
      targets: t,
      x: t.x + Math.cos(a) * dist,
      y: t.y + Math.sin(a) * dist - 10,
      angle: (Math.random() - 0.5) * 360,
      alpha: 0,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  });
}

/** A gentle full-screen tint (a camera flash washes everything out). */
function softFlash(scene: Scene, color: number, alpha: number): void {
  const { width: W, height: H } = scene.scale;
  const r = scene.add
    .rectangle(W / 2, H / 2, W, H, color, alpha)
    .setDepth(DEPTH + 4)
    .setScrollFactor(0);
  scene.tweens.add({
    targets: r,
    alpha: 0,
    duration: 350,
    onComplete: () => r.destroy(),
  });
}

export function playCatchFx(scene: Scene, c: CatchFxInput): void {
  const gy = c.y - 30;
  beam(scene, c, gy);
  letters(scene, c.word, c.x, c.y - 72, c.streak);
  vacuum(scene, c, (px, py) => {
    const big = c.streak >= 10;
    burst(
      scene,
      px,
      py,
      big ? 18 : 12,
      sparkleTints(c.streak),
      big ? 190 : 140,
    );
    ring(
      scene,
      px,
      py,
      c.streak >= 5 ? hex("gold") : hex("cream"),
      big ? 110 : 80,
    );
    if (c.perfect) {
      burst(scene, px, py, 8, [hex("gold"), hex("yellow")], 120);
      ring(scene, px, py, hex("gold"), 60, 3, 300);
    }
    spirit(scene, px, py);
  });
  floatText(
    scene,
    c.x,
    c.y - 100,
    `+${c.points}${c.perfect ? " ⭐" : ""}`,
    c.streak >= 10 ? 26 : 22,
    c.perfect ? "gold" : "yellow",
  );
  // streak milestones
  if (c.streak > 0 && c.streak % 10 === 0) {
    const W = scene.scale.width;
    floatText(
      scene,
      W / 2,
      scene.scale.height * 0.28,
      `COMBO x${c.streak}! 🔥`,
      40,
      "gold",
      30,
      1300,
    );
    softFlash(scene, hex("gold"), 0.22);
  } else if (c.streak === 5) {
    floatText(
      scene,
      scene.scale.width / 2,
      scene.scale.height * 0.28,
      "5 in a row! ✨",
      30,
      "yellow",
      30,
      1100,
    );
  }
  if (c.close) {
    floatText(
      scene,
      c.fromX,
      c.fromY - 70,
      "Close one! 😅",
      24,
      "mint",
      30,
      1100,
    );
    softFlash(scene, hex("mint"), 0.18);
  }
}

/** A Ghost King hit: crack ring, shockwave and a knock-back trail. */
export function bossHitFx(
  scene: Scene,
  x: number,
  y: number,
  side: "left" | "right",
): void {
  const cy = y - 70;
  ring(scene, x, cy, hex("cream"), 150, 6, 420);
  ring(scene, x, cy, hex("purple"), 210, 4, 520);
  burst(scene, x, cy, 14, [hex("purple"), hex("pink"), hex("cream")], 220);
  // crack lines
  const g = scene.add.graphics().setDepth(DEPTH);
  g.lineStyle(4, hex("cream"), 1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.lineBetween(x, cy, x + Math.cos(a) * 46, cy + Math.sin(a) * 46);
  }
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: 380,
    onComplete: () => g.destroy(),
  });
  // trail behind the knock-back
  const dir = side === "left" ? -1 : 1;
  for (let i = 0; i < 4; i++) {
    const ghost = scene.add
      .rectangle(x + dir * i * 10, cy, 40, 120, hex("purple"), 0.25 - i * 0.05)
      .setDepth(DEPTH - 2);
    scene.tweens.add({
      targets: ghost,
      x: ghost.x + dir * 30,
      alpha: 0,
      duration: 320,
      onComplete: () => ghost.destroy(),
    });
  }
}

/** The Ghost King's last hit: firework, flying crown. (Slow-mo is the scene's.) */
export function bossFinaleFx(scene: Scene, x: number, y: number): void {
  const cy = y - 80;
  for (let k = 0; k < 4; k++) {
    scene.time.delayedCall(k * 140, () => {
      const ox = x + (Math.random() - 0.5) * 120;
      const oy = cy + (Math.random() - 0.5) * 80;
      burst(scene, ox, oy, 26, RAINBOW.map(hex), 260);
      ring(scene, ox, oy, hex(RAINBOW[k * 2] ?? "gold"), 170, 5, 520);
    });
  }
  const crown = scene.add
    .text(x, cy - 60, "👑", { fontSize: "44px" })
    .setOrigin(0.5)
    .setDepth(DEPTH + 3);
  scene.tweens.add({
    targets: crown,
    x: x + (x < scene.scale.width / 2 ? 140 : -140),
    y: cy - 180,
    angle: 720,
    duration: 900,
    ease: "Cubic.easeOut",
  });
  scene.tweens.add({
    targets: crown,
    y: scene.scale.height + 60,
    delay: 900,
    duration: 700,
    ease: "Quad.easeIn",
    onComplete: () => crown.destroy(),
  });
  floatText(
    scene,
    scene.scale.width / 2,
    scene.scale.height * 0.3,
    "GHOST KING DEFEATED! 👑",
    38,
    "gold",
    30,
    1800,
  );
}

/**
 * 20+ catches in a row: the flashlight gets a flaming glow and the screen
 * edges glow gold until the streak breaks.
 */
export class StreakAura {
  private flames: GameObjects.Particles.ParticleEmitter;
  private edge: GameObjects.Graphics;
  private on = false;

  constructor(scene: Scene) {
    this.flames = scene.add
      .particles(0, 0, "gh-sparkle", {
        lifespan: 450,
        speedY: { min: -90, max: -40 },
        speedX: { min: -20, max: 20 },
        scale: { start: 0.7, end: 0 },
        tint: [hex("orange"), hex("yellow"), hex("red")],
        frequency: 40,
        emitting: false,
      })
      .setDepth(DEPTH - 1);
    this.edge = scene.add
      .graphics()
      .setDepth(DEPTH + 5)
      .setScrollFactor(0);
    this.edge.setVisible(false);
    scene.tweens.add({
      targets: this.edge,
      alpha: { from: 0.35, to: 0.8 },
      yoyo: true,
      repeat: -1,
      duration: 600,
    });
  }

  update(scene: Scene, streak: number, x: number, y: number): void {
    const want = streak >= 20;
    this.flames.setPosition(x, y);
    if (want === this.on) return;
    this.on = want;
    if (want) {
      this.flames.start();
      const { width: W, height: H } = scene.scale;
      this.edge.clear();
      for (let i = 0; i < 4; i++) {
        this.edge.lineStyle(10 - i * 2, hex("gold"), 0.12 + i * 0.08);
        this.edge.strokeRect(i * 3, i * 3, W - i * 6, H - i * 6);
      }
      this.edge.setVisible(true);
    } else {
      this.flames.stop();
      this.edge.setVisible(false);
    }
  }
}

/** An armored ghost's helmet flies off: "CLANK!", sparks and metal bits. */
export function armorBreakFx(scene: Scene, x: number, y: number): void {
  const cy = y - 44;
  ring(scene, x, cy, hex("grey"), 90, 5, 320);
  burst(scene, x, cy, 12, [hex("grey"), hex("cream"), hex("yellow")], 200);
  floatText(scene, x, cy - 30, "CLANK! 🛡️", 22, "cream", 40, 700);
  for (const dir of [-1, 1]) {
    const bit = scene.add
      .rectangle(x, cy - 8, 16, 10, hex("grey"))
      .setStrokeStyle(2, hex("ink"))
      .setDepth(DEPTH);
    scene.tweens.add({
      targets: bit,
      x: x + dir * 60,
      y: cy + 40,
      angle: dir * 300,
      alpha: 0,
      duration: 600,
      ease: "Quad.easeIn",
      onComplete: () => bit.destroy(),
    });
  }
}

/** A twin splits: a pop of pink and mint. */
export function twinSplitFx(scene: Scene, x: number, y: number): void {
  ring(scene, x, y - 30, hex("pink"), 110, 4, 360);
  burst(scene, x, y - 30, 12, [hex("pink"), hex("mint"), hex("cream")], 180);
  floatText(scene, x, y - 70, "Split! 👯", 20, "pink", 40, 700);
}

/** A shy ghost shows its word. */
export function revealFx(scene: Scene, x: number, y: number): void {
  ring(scene, x, y - 72, hex("purple"), 70, 3, 300);
}

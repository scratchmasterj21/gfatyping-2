import { GameObjects, Scene, Structs, Time } from "phaser";

import { hex } from "../../shared/game-palette";
import { popBanner, TappyBuddy } from "../../shared/phaser-ui";
import { FRUIT_KINDS, JUICE } from "../art";
import { Fruit, FRUIT_SIZE } from "../entities/Fruit";
import {
  playBombExplode,
  playPop,
  playGameOver,
  playMiss,
  playWaveClear,
} from "../../shared/sounds";
import { WordMatcher } from "../../word-defender/systems/word-matcher";
import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

export const LIVES = 8;
const WAVE_PAUSE_MS = 2200;
const GRAVITY = 340; // px/s²
/**
 * Throw speed and gravity were tuned for a ~500px-tall play area. On taller
 * screens both scale up by the same factor, so fruit flies just as high
 * (relative to the screen) and stays in the air exactly as long.
 */
const DESIGN_HEIGHT = 500;

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private fruits: Fruit[] = [];
  private matcher!: WordMatcher;

  private lives = LIVES;
  private score = 0;
  private wave = 1;
  private hits = 0;
  private misses = 0;
  private streak = 0;
  private gameOver = false;

  private baseSpeed = 55;
  private speedIncrement = 8;
  private perWaveBase = 3;
  private maxWave = 0;
  private bombChance = 0.07;

  private fruitsThisWave = 0;
  private fruitsSpawned = 0;
  // Reserved spawns still waiting on a non-duplicate word (see
  // trySpawnFruitEntity) - counted separately from fruitsSpawned so
  // checkWaveComplete can't fire while one is still in flight.
  private pendingSpawns = 0;
  private betweenWaves = false;
  private spawnTimer: Time.TimerEvent | null = null;
  private fruitTypeCounter = 0;
  private backdrop!: GameObjects.Graphics;
  private tappy!: TappyBuddy;

  constructor() {
    super({ key: "Game" });
  }

  init(): void {
    const stored = this.registry.get("words") as string[] | undefined;
    this.words =
      stored !== undefined && stored.length > 0
        ? stored
        : ["slice", "apple", "ninja", "sword", "fruit"];
    this.wordPool = shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.fruits = [];
    this.gameOver = false;
    this.lives = LIVES;
    this.score = 0;
    this.wave = 1;
    this.hits = 0;
    this.misses = 0;
    this.streak = 0;
    this.fruitsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.fruitTypeCounter = 0;
    this.baseSpeed =
      (this.registry.get("baseSpeed") as number | undefined) ?? 400;
    this.speedIncrement =
      (this.registry.get("speedIncrement") as number | undefined) ?? 30;
    this.perWaveBase =
      (this.registry.get("perWaveBase") as number | undefined) ?? 3;
    this.maxWave = (this.registry.get("maxWave") as number | undefined) ?? 0;
    this.bombChance =
      (this.registry.get("bombChance") as number | undefined) ?? 0.07;
  }

  create(): void {
    this.game.events.emit("game-avatar-visible", true);
    const W = this.scale.width;
    const H = this.scale.height;
    this.backdrop = this.add.graphics().setDepth(-10);
    this.drawBackground(W, H);
    this.drawPlayer(W, H);
    this.scale.on("resize", (size: Structs.Size) => {
      this.drawBackground(size.width, size.height);
      this.tappy.setPosition(56, size.height - 10);
    });

    this.matcher = new WordMatcher((buf, locked) => {
      for (const fruit of this.fruits) {
        fruit.updateTyped(fruit.word === locked ? buf : "");
        fruit.setHighlighted(fruit.word === locked);
      }
      this.game.events.emit("ui-buffer", buf, locked);
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.betweenWaves || this.gameOver || e.repeat) return;
      const char =
        e.key.length === 1 ? e.key : e.key === "Backspace" ? "Backspace" : null;
      if (char === null) return;
      const result = this.matcher.handleKey(char);
      if (result.status === "complete") {
        this.onFruitSliced(result.word);
      } else if (result.status === "miss") {
        this.onMiss();
      }
    });

    this.scene.launch("UI");
    this.emitUI();
    this.startWave();
  }

  override update(_time: number, delta: number): void {
    if (this.gameOver) return;
    const dt = delta / 1000;
    const W = this.scale.width;
    const H = this.scale.height;
    const k = this.liftScale();

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      if (fruit === undefined) continue;

      fruit.vy += GRAVITY * k * dt;
      fruit.x += fruit.vx * dt;
      fruit.y += fruit.vy * dt;
      fruit.rotation += fruit.omega * dt;
      fruit.keepLabelsUpright();

      if (fruit.y > H + 80 || fruit.x < -100 || fruit.x > W + 100) {
        this.fruitEscaped(fruit, i);
      }
    }
  }

  private liftScale(): number {
    return Math.max(1, this.scale.height / DESIGN_HEIGHT);
  }

  /** Sunny picnic: sky, sun, hills, and a checked blanket along the bottom. */
  private drawBackground(W: number, H: number): void {
    const g = this.backdrop;
    g.clear();
    g.fillGradientStyle(
      hex("skyTop"),
      hex("skyTop"),
      hex("sky"),
      hex("sky"),
      1,
    );
    g.fillRect(0, 0, W, H);

    g.fillStyle(hex("yellow"), 0.35);
    g.fillCircle(W - 80, 150, 58);
    g.fillStyle(hex("yellow"), 1);
    g.fillCircle(W - 80, 150, 40);

    g.fillStyle(hex("cloud"), 0.9);
    for (const [fx, fy, r] of [
      [0.2, 0.22, 26],
      [0.55, 0.3, 20],
      [0.8, 0.42, 16],
    ] as const) {
      g.fillEllipse(W * fx, H * fy, r * 4, r * 1.6);
      g.fillEllipse(W * fx - r, H * fy + 4, r * 2.4, r * 1.2);
      g.fillEllipse(W * fx + r, H * fy + 4, r * 2.4, r * 1.2);
    }

    const hillY = H * 0.64;
    g.fillStyle(hex("grassDark"), 1);
    g.fillEllipse(W * 0.2, hillY + 40, W * 0.9, 160);
    g.fillEllipse(W * 0.85, hillY + 30, W * 0.8, 180);
    g.fillStyle(hex("grass"), 1);
    g.fillRect(0, hillY + 40, W, H - hillY);
    g.fillEllipse(W * 0.5, hillY + 50, W * 1.4, 120);

    // picnic blanket
    const top = H * 0.8;
    const cell = 36;
    for (let row = 0; row * cell < H - top; row++) {
      for (let col = 0; col * cell < W; col++) {
        g.fillStyle(
          (row + col) % 2 === 0 ? hex("red") : hex("cream"),
          (row + col) % 2 === 0 ? 0.9 : 1,
        );
        g.fillRect(col * cell, top + row * cell, cell, cell);
      }
    }
    g.fillStyle(hex("red"), 1);
    g.fillRect(0, top - 6, W, 8);

    // the player's cushion (avatar sits on it - see FruitNinjaModal)
    g.fillStyle(hex("ink"), 0.25);
    g.fillEllipse(W - 46, H - 18, 74, 22);
    g.fillStyle(hex("purple"), 1);
    g.fillEllipse(W - 46, H - 24, 70, 22);
  }

  private drawPlayer(_W: number, H: number): void {
    this.tappy = new TappyBuddy(this, 56, H - 10, 58);
  }

  private nextWord(): string {
    if (this.poolIdx >= this.wordPool.length) {
      this.wordPool = shuffleCyclic(this.words);
      this.poolIdx = 0;
    }
    const w = this.wordPool[this.poolIdx] as string;
    this.poolIdx++;
    return w;
  }

  /** Returns null (rather than a duplicate) if every unique word is already active elsewhere. */
  private tryNextWord(excludeWords: Set<string>): string | null {
    const maxTries = this.words.length * 2 + 1;
    for (let i = 0; i < maxTries; i++) {
      const w = this.nextWord();
      if (!excludeWords.has(w)) return w;
    }
    return null;
  }

  private spawnFruit(): void {
    if (this.fruitsSpawned >= this.fruitsThisWave) return;
    this.fruitsSpawned++;
    this.pendingSpawns++;
    this.trySpawnFruitEntity();
  }

  /**
   * Reserves the spawn slot immediately (see spawnFruit) but defers the
   * actual fruit until a non-duplicate word is available, retrying rather
   * than ever giving two on-screen items the same word - a duplicate would
   * make the WordMatcher (Set-backed) only ever resolve the first one,
   * permanently orphaning the second (and, for a bomb sharing a fruit's
   * word, could make typing a "safe" word detonate the bomb instead).
   */
  private trySpawnFruitEntity(): void {
    if (this.gameOver) {
      this.pendingSpawns--;
      return;
    }
    const activeWords = new Set(this.fruits.map((f) => f.word));
    const word = this.tryNextWord(activeWords);
    if (word === null) {
      this.time.delayedCall(400, () => this.trySpawnFruitEntity());
      return;
    }
    this.pendingSpawns--;

    const W = this.scale.width;
    const H = this.scale.height;
    const margin = 80;
    const x = margin + Math.random() * (W - margin * 2);

    const typeIdx = this.fruitTypeCounter % 5;
    this.fruitTypeCounter++;

    const launchSpeed =
      this.baseSpeed +
      (this.wave - 1) * (this.speedIncrement / 3) +
      (Math.random() * 60 - 30);

    const chance = Math.min(0.5, this.bombChance * (this.wave - 1));
    const isBomb = this.wave > 1 && Math.random() < chance;

    const fruit = new Fruit(this, x, H + 30, word, typeIdx, isBomb);
    fruit.vx = (Math.random() - 0.5) * 150;
    fruit.vy = -launchSpeed * this.liftScale();
    fruit.omega = (Math.random() - 0.5) * 4;
    this.fruits.push(fruit);
    this.matcher.register(word);
  }

  private startWave(): void {
    this.fruitsThisWave = this.perWaveBase + (this.wave - 1) * 2;
    this.fruitsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);

    const interval = Math.max(700, 2000 - this.wave * 120);
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnFruit,
      callbackScope: this,
      repeat: this.fruitsThisWave - 1,
    });
    this.spawnFruit();
  }

  private onFruitSliced(word: string): void {
    const idx = this.fruits.findIndex((f) => f.word === word);
    if (idx === -1) return;
    const fruit = this.fruits[idx] as Fruit;

    if (fruit.isBomb) {
      this.onBombTyped(fruit, idx);
      return;
    }

    this.hits++;
    this.streak++;
    this.score += 10 + word.length * 2 + this.streak;
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);
    playPop();
    this.tappy.cheer();

    this.sliceEffect(fruit.x, fruit.y, fruit.typeIdx);
    fruit.destroy();
    this.fruits.splice(idx, 1);
    this.checkWaveComplete();
  }

  private onBombTyped(fruit: Fruit, idx: number): void {
    this.streak = 0;
    this.game.events.emit("ui-streak", 0);

    playBombExplode();
    this.bombEffect(fruit.x, fruit.y);
    fruit.destroy();
    this.fruits.splice(idx, 1);

    this.cameras.main.shake(450, 0.022);
    this.cameras.main.flash(220, 200, 0, 0);

    const W = this.scale.width;
    const H = this.scale.height;
    popBanner(this, W / 2, H / 2, "💣 Oops, a bomb!", "red", 1300);

    this.loseLife();
    if (!this.gameOver) {
      this.checkWaveComplete();
    }
  }

  /** Shared life-loss + game-over handling for wrong keystrokes, bombs, and escaped fruit. */
  private loseLife(): void {
    if (this.gameOver) return;
    this.lives = Math.max(0, this.lives - 1);
    this.tappy.sad();
    this.game.events.emit("ui-lives", this.lives);

    if (this.lives <= 0) {
      this.gameOver = true;
      this.spawnTimer?.remove();
      playGameOver();
      this.time.delayedCall(600, () => {
        this.scene.stop("UI");
        this.scene.start("GameOver", {
          score: this.score,
          wave: this.wave,
          hits: this.hits,
          misses: this.misses,
        });
      });
    }
  }

  private bombEffect(x: number, y: number): void {
    const particles = this.add.particles(x, y, "fn-particle", {
      lifespan: 500,
      speed: { min: 60, max: 160 },
      scale: { start: 0.7, end: 0 },
      quantity: 16,
      tint: [hex("ink"), hex("orange"), hex("yellow"), hex("grey")],
      emitting: false,
    });
    particles.explode(16);
    this.time.delayedCall(550, () => particles.destroy());
  }

  private onMiss(): void {
    this.streak = 0;
    this.misses++;
    this.game.events.emit("ui-streak", 0);
    this.cameras.main.flash(80, 80, 0, 0);
    playMiss();
    this.loseLife();
  }

  private fruitEscaped(fruit: Fruit, idx: number): void {
    if (this.gameOver) return;
    this.matcher.unregister(fruit.word);
    fruit.destroy();
    this.fruits.splice(idx, 1);

    if (fruit.isBomb) {
      // Bomb escaped — player successfully avoided it, no penalty
      this.checkWaveComplete();
      return;
    }

    this.cameras.main.shake(200, 0.008);
    this.cameras.main.flash(120, 120, 0, 40);
    playMiss();
    this.loseLife();

    if (!this.gameOver) {
      this.checkWaveComplete();
    }
  }

  private checkWaveComplete(): void {
    if (
      this.fruits.length === 0 &&
      this.pendingSpawns === 0 &&
      this.fruitsSpawned >= this.fruitsThisWave
    ) {
      this.spawnTimer?.remove();
      this.betweenWaves = true;
      this.matcher.clear();
      playWaveClear();

      this.time.delayedCall(WAVE_PAUSE_MS, () => {
        // Check before incrementing so a maxWave=5 run reports "wave 5"
        // (the last wave actually played) instead of "wave 6".
        if (this.maxWave > 0 && this.wave >= this.maxWave) {
          playGameOver();
          this.scene.stop("UI");
          this.scene.start("GameOver", {
            score: this.score,
            wave: this.wave,
            hits: this.hits,
            misses: this.misses,
            cleared: true,
          });
          return;
        }
        this.wave++;
        this.startWave();
      });

      const W = this.scale.width;
      const H = this.scale.height;
      this.tappy.cheer();
      popBanner(
        this,
        W / 2,
        H / 2,
        `Wave ${this.wave} clear! 🍉`,
        "green",
        WAVE_PAUSE_MS,
      );
    }
  }

  /** The fruit splits into two halves, juice sprays, and a splat fades out. */
  private sliceEffect(x: number, y: number, typeIdx: number): void {
    const kind = FRUIT_KINDS[typeIdx % FRUIT_KINDS.length] ?? "apple";
    const juice = hex(JUICE[typeIdx % JUICE.length] ?? "red");

    const splat = this.add.graphics().setDepth(-1);
    splat.fillStyle(juice, 0.45);
    splat.fillCircle(x, y, 22);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const d = 24 + Math.random() * 16;
      splat.fillCircle(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        5 + Math.random() * 5,
      );
    }
    this.tweens.add({
      targets: splat,
      alpha: 0,
      delay: 500,
      duration: 900,
      onComplete: () => splat.destroy(),
    });

    for (const side of [-1, 1]) {
      const half = this.add.image(x, y, `fn-${kind}`);
      half.setDisplaySize(FRUIT_SIZE, FRUIT_SIZE);
      const fw = half.width;
      const fh = half.height;
      half.setCrop(side < 0 ? 0 : fw / 2, 0, fw / 2, fh);
      this.tweens.add({
        targets: half,
        x: x + side * 60,
        y: y + 50,
        angle: side * 70,
        alpha: 0,
        duration: 650,
        ease: "Quad.In",
        onComplete: () => half.destroy(),
      });
    }

    const particles = this.add.particles(x, y, "fn-particle", {
      lifespan: 450,
      speed: { min: 60, max: 160 },
      scale: { start: 0.6, end: 0 },
      quantity: 10,
      tint: [juice, hex("cream")],
      emitting: false,
    });
    particles.explode(10);
    this.time.delayedCall(500, () => particles.destroy());
  }

  private emitUI(): void {
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-lives", this.lives);
  }

  shutdown(): void {
    this.spawnTimer?.remove();
    this.matcher?.clear();
    this.input.keyboard?.removeAllListeners();
  }
}

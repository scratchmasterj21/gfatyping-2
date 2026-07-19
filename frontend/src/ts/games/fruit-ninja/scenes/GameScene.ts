import { Scene, Time } from "phaser";

import { Fruit, FRUIT_COLORS } from "../entities/Fruit";
import {
  playBombExplode,
  playPop,
  playGameOver,
  playMiss,
  playWaveClear,
} from "../../shared/sounds";
import { WordMatcher } from "../../word-defender/systems/word-matcher";
import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

const LIVES = 8;
const WAVE_PAUSE_MS = 2200;
const GRAVITY = 340; // px/s²

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
    const W = this.scale.width;
    const H = this.scale.height;
    this.drawBackground(W, H);
    this.drawPlayer(W);

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

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      if (fruit === undefined) continue;

      fruit.vy += GRAVITY * dt;
      fruit.x += fruit.vx * dt;
      fruit.y += fruit.vy * dt;
      fruit.rotation += fruit.omega * dt;
      fruit.keepLabelsUpright();

      if (fruit.y > H + 80 || fruit.x < -100 || fruit.x > W + 100) {
        this.fruitEscaped(fruit, i);
      }
    }
  }

  // PLACEHOLDER: wood plank background
  // ASSETS: replace with this.add.image(W/2, H/2, "fn-bg").setDisplaySize(W, H)
  private drawBackground(W: number, H: number): void {
    const plankW = Math.ceil(W / 7);
    const shades = [0x9b5523, 0x7a3b10, 0x8b4713, 0x6e3209, 0xa06030];
    for (let i = 0; i < 7; i++) {
      const bg = this.add.graphics();
      const shade = shades[i % shades.length] ?? 0x8b4513;
      bg.fillStyle(shade, 1);
      bg.fillRect(i * plankW, 0, plankW, H);
      bg.lineStyle(1, 0x3a1800, 0.2);
      for (let j = 0; j < 6; j++) {
        const gy = H * 0.15 * j + 20;
        bg.lineBetween(i * plankW + 6, gy, i * plankW + plankW - 6, gy + 10);
      }
    }
  }

  // PLACEHOLDER: ninja emoji top-right as character
  // ASSETS: replace with this.add.sprite(W - 60, 60, "ninja").setScale(0.8)
  private drawPlayer(W: number): void {
    this.add.text(W - 48, 48, "🥷", { fontSize: "52px" }).setOrigin(0.5);
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
    fruit.vy = -launchSpeed;
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
    const txt = this.add
      .text(W / 2, H / 2, "💣 BOMB!", {
        fontSize: "38px",
        fontFamily: "monospace",
        color: "#ff2200",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      y: H / 2 - 70,
      duration: 1100,
      onComplete: () => txt.destroy(),
    });

    this.loseLife();
    if (!this.gameOver) {
      this.checkWaveComplete();
    }
  }

  /** Shared life-loss + game-over handling for wrong keystrokes, bombs, and escaped fruit. */
  private loseLife(): void {
    if (this.gameOver) return;
    this.lives = Math.max(0, this.lives - 1);
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
      blendMode: "ADD",
      tint: [0xff2200, 0xff6600, 0xffcc00],
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
          });
          return;
        }
        this.wave++;
        this.startWave();
      });

      const W = this.scale.width;
      const H = this.scale.height;
      const banner = this.add
        .text(W / 2, H / 2, `Wave ${this.wave} Clear! 🍋`, {
          fontSize: "30px",
          fontFamily: "monospace",
          color: "#ffdd88",
        })
        .setOrigin(0.5);

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: H / 2 - 50,
        duration: WAVE_PAUSE_MS,
        onComplete: () => banner.destroy(),
      });
    }
  }

  // PLACEHOLDER: two offset circles flying apart
  // ASSETS: replace with fruit sprite split animation
  private sliceEffect(x: number, y: number, typeIdx: number): void {
    const color = FRUIT_COLORS[typeIdx % FRUIT_COLORS.length] ?? 0xffcc00;

    const left = this.add.graphics();
    left.fillStyle(color, 1);
    left.fillCircle(-6, 0, 14);
    left.setPosition(x, y);

    const right = this.add.graphics();
    right.fillStyle(color, 0.88);
    right.fillCircle(6, 0, 14);
    right.setPosition(x, y);

    this.tweens.add({
      targets: left,
      x: x - 45,
      y: y - 35,
      alpha: 0,
      duration: 380,
      ease: "Quad.Out",
      onComplete: () => left.destroy(),
    });
    this.tweens.add({
      targets: right,
      x: x + 45,
      y: y - 35,
      alpha: 0,
      duration: 380,
      ease: "Quad.Out",
      onComplete: () => right.destroy(),
    });

    const particles = this.add.particles(x, y, "fn-particle", {
      lifespan: 380,
      speed: { min: 30, max: 100 },
      scale: { start: 0.55, end: 0 },
      quantity: 8,
      blendMode: "ADD",
      tint: [color, 0xffffff],
      emitting: false,
    });
    particles.explode(8);
    this.time.delayedCall(420, () => particles.destroy());
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

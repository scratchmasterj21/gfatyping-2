import { Scene, GameObjects, Time, Structs } from "phaser";

import { hex, PALETTE, PaletteName } from "../../shared/game-palette";
import { kidText, popBanner, TappyBuddy } from "../../shared/phaser-ui";

import { Balloon } from "../entities/Balloon";
import { PowerUp, PowerUpKind } from "../entities/PowerUp";
import {
  playBombExplode,
  playBossDefeated,
  playDeflect,
  playGameOver,
  playHordeIncoming,
  playMiss,
  playPop,
  playWaveClear,
} from "../../shared/sounds";
import { WordMatcher } from "../../word-defender/systems/word-matcher";
import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

export const LIVES = 8;
const CONFETTI: PaletteName[] = ["yellow", "pink", "blue", "green", "purple"];
const WAVE_PAUSE_MS = 2500;

const BIG_BALLOON_CHANCE = 0.15;
const BIG_BALLOON_SCORE_MULT = 1.6;
const STREAK_SOUND_MILESTONE = 5; // extra celebratory sound every Nth streak

const POWERUP_WORDS: Record<PowerUpKind, string> = {
  gust: "gust",
  golden: "golden",
};
const POWERUP_SPAWN_MIN_MS = 14000;
const POWERUP_SPAWN_MAX_MS = 22000;
const POWERUP_RISE_SPEED = 40; // fixed, not wave-scaled - equally catchable at any wave
const GUST_DURATION_MS = 8000;

type Cloud = {
  x: number;
  y: number;
  speed: number;
  g: GameObjects.Graphics;
  r: number;
};

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private balloons: Balloon[] = [];
  private matcher!: WordMatcher;

  private lives = LIVES;
  private score = 0;
  private wave = 1;
  private hits = 0;
  private misses = 0;
  private streak = 0;

  private baseSpeed = 15;
  private speedIncrement = 3;
  private perWaveBase = 4;
  private maxWave = 0;
  private hordeEnabled = true;
  private isHordeWaveActive = false;
  private gameOver = false;

  private clouds: Cloud[] = [];
  private park!: GameObjects.Graphics;
  private tappy!: TappyBuddy;
  private balloonsThisWave = 0;
  private balloonsSpawned = 0;
  // Reserved spawns still waiting on a non-duplicate word (see
  // trySpawnBalloonEntity) - counted separately from balloonsSpawned so
  // checkWaveComplete can't fire while one is still in flight.
  private pendingSpawns = 0;
  private betweenWaves = false;
  private spawnTimer: Time.TimerEvent | null = null;

  private powerUp: PowerUp | null = null;
  private powerUpTimer: Time.TimerEvent | null = null;
  private heldPowerUp: PowerUpKind | null = null;

  constructor() {
    super({ key: "Game" });
  }

  init(): void {
    const stored = this.registry.get("words") as string[] | undefined;
    this.words =
      stored !== undefined && stored.length > 0 ? stored : ["pop", "fly", "up"];
    this.wordPool = shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.balloons = [];
    this.clouds = [];
    this.gameOver = false;
    this.lives = LIVES;
    this.score = 0;
    this.wave = 1;
    this.hits = 0;
    this.misses = 0;
    this.streak = 0;
    this.balloonsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.isHordeWaveActive = false;
    this.powerUp = null;
    this.heldPowerUp = null;
    this.baseSpeed =
      (this.registry.get("baseSpeed") as number | undefined) ?? 15;
    this.speedIncrement =
      (this.registry.get("speedIncrement") as number | undefined) ?? 3;
    this.perWaveBase =
      (this.registry.get("perWaveBase") as number | undefined) ?? 4;
    this.maxWave = (this.registry.get("maxWave") as number | undefined) ?? 0;
    this.hordeEnabled =
      (this.registry.get("hordeEnabled") as boolean | undefined) ?? true;
  }

  create(): void {
    this.game.events.emit("game-avatar-visible", true);
    const W = this.scale.width;
    const H = this.scale.height;

    // Sky gradient background
    const bg = this.add.graphics();
    const drawSky = (w: number, h: number): void => {
      bg.clear();
      bg.fillGradientStyle(
        hex("skyTop"),
        hex("skyTop"),
        hex("mint"),
        hex("mint"),
        1,
      );
      bg.fillRect(0, 0, w, h);
      bg.fillStyle(hex("yellow"), 0.3);
      bg.fillCircle(w * 0.18, h * 0.16, 60);
      bg.fillStyle(hex("yellow"), 1);
      bg.fillCircle(w * 0.18, h * 0.16, 40);
    };
    drawSky(W, H);

    this.createClouds(W, H);
    this.park = this.add.graphics();
    this.drawPark(W, H);
    this.tappy = new TappyBuddy(this, W - 56, H - 50, 56);

    this.matcher = new WordMatcher((buf, locked) => {
      this.game.events.emit("ui-buffer", buf, locked);

      for (const b of this.balloons) {
        if (locked !== null) {
          b.highlight(b.word === locked ? "locked" : "normal");
          if (b.word === locked) b.updateTyped(buf);
        } else if (buf.length > 0) {
          const matches = this.balloons.filter((bb) => bb.word.startsWith(buf));
          b.highlight(matches.includes(b) ? "partial" : "normal");
          b.updateTyped(b.word.startsWith(buf) ? buf : "");
        } else {
          b.highlight("normal");
          b.updateTyped("");
        }
      }
      if (this.powerUp !== null) {
        this.powerUp.updateTyped(this.powerUp.word === locked ? buf : "");
      }
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Blocked during the wave-clear pause too: activating a golden
        // power-up here re-enters checkWaveComplete() with nothing changed
        // (no balloons left either way), double-advancing the wave and
        // leaking an extra spawn timer. The held power-up just waits.
        if (!e.repeat && !this.betweenWaves) this.activateHeldPowerUp();
        return;
      }
      if (this.betweenWaves || e.repeat) return;
      const char =
        e.key.length === 1 ? e.key : e.key === "Backspace" ? "Backspace" : null;
      if (char === null) return;
      // Let a power-up interrupt a definite lock on a DIFFERENT balloon once
      // that lock is confirmed dead (this key wouldn't continue it anyway)
      // - never while it's still valid progress, or this would wrongly
      // abort a real word right on its last letter just because it starts
      // the same as the power-up. See WordMatcher.releaseLock()'s doc comment.
      {
        const locked = this.matcher.getLockedWord();
        const wouldStayValid =
          locked !== null && locked.startsWith(this.matcher.getBuffer() + char);
        if (
          this.powerUp !== null &&
          locked !== null &&
          !wouldStayValid &&
          this.powerUp.word.startsWith(char)
        ) {
          this.matcher.releaseLock();
        }
      }
      const result = this.matcher.handleKey(char);
      if (result.status === "complete") {
        if (this.powerUp !== null && result.word === this.powerUp.word) {
          this.onPowerUpCollected(this.powerUp);
        } else {
          this.onBalloonPopped(result.word);
        }
      } else if (result.status === "miss") {
        this.onMiss();
      }
    });

    this.scale.on("resize", (size: Structs.Size) => {
      drawSky(size.width, size.height);
      this.drawPark(size.width, size.height);
      this.tappy.setPosition(size.width - 56, size.height - 50);
    });

    this.scene.launch("UI");
    this.emitUI();
    this.startWave();
    if (this.maxWave === 0) this.schedulePowerUpSpawn();
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const speed = this.baseSpeed + (this.wave - 1) * this.speedIncrement;

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b === undefined) continue;
      if (b.isFrozen()) continue;
      b.y -= speed * dt;

      if (b.y <= -80) {
        this.balloonEscaped(b, i);
      }
    }

    if (this.powerUp !== null) {
      this.powerUp.y -= POWERUP_RISE_SPEED * dt;
      if (this.powerUp.y <= -80) {
        this.matcher.unregister(this.powerUp.word);
        this.powerUp.destroy();
        this.powerUp = null;
        this.schedulePowerUpSpawn();
      }
    }

    // Drift clouds left slowly
    const W = this.scale.width;
    const H = this.scale.height;
    for (const c of this.clouds) {
      c.x -= c.speed * dt;
      if (c.x + c.r < 0) {
        c.x = W + c.r;
        c.y = 30 + Math.random() * (H * 0.5);
      }
      this.drawCloud(c);
    }
  }

  private createClouds(W: number, H: number): void {
    for (let i = 0; i < 6; i++) {
      const g = this.add.graphics();
      const c: Cloud = {
        x: Math.random() * W,
        y: 30 + Math.random() * (H * 0.5),
        speed: 8 + Math.random() * 12,
        r: 24 + Math.random() * 18,
        g,
      };
      this.drawCloud(c);
      this.clouds.push(c);
    }
  }

  /** Rolling park hills with trees along the bottom of the sky. */
  private drawPark(W: number, H: number): void {
    const g = this.park;
    g.clear();
    g.fillStyle(hex("grassDark"), 1);
    g.fillEllipse(W * 0.2, H - 20, W * 0.9, 150);
    g.fillEllipse(W * 0.85, H - 10, W * 0.8, 170);
    for (const fx of [0.08, 0.36, 0.62, 0.92]) {
      const x = W * fx;
      const y = H - 72 - ((fx * 37) % 20);
      g.fillStyle(hex("brown"), 1);
      g.fillRect(x - 4, y, 8, 34);
      g.fillStyle(hex("green"), 1);
      g.fillCircle(x, y - 6, 24);
      g.fillCircle(x - 14, y + 6, 16);
      g.fillCircle(x + 14, y + 6, 16);
    }
    g.fillStyle(hex("grass"), 1);
    g.fillEllipse(W * 0.5, H + 10, W * 1.5, 110);
  }

  private drawCloud(c: Cloud): void {
    c.g.clear();
    c.g.fillStyle(0xffffff, 0.75);
    c.g.fillCircle(c.x, c.y, c.r);
    c.g.fillCircle(c.x + c.r * 0.6, c.y + 5, c.r * 0.7);
    c.g.fillCircle(c.x - c.r * 0.55, c.y + 8, c.r * 0.65);
  }

  /** Returns null (rather than a duplicate) if every unique word is already active elsewhere. */
  private tryNextWord(excludeWords: Set<string>): string | null {
    const maxTries = this.wordPool.length * 2 + 1;
    for (let i = 0; i < maxTries; i++) {
      if (this.poolIdx >= this.wordPool.length) {
        this.wordPool = shuffleCyclic(this.words);
        this.poolIdx = 0;
      }
      const w = this.wordPool[this.poolIdx++] as string;
      if (!excludeWords.has(w)) return w;
    }
    return null;
  }

  private spawnBalloon(): void {
    if (this.balloonsSpawned >= this.balloonsThisWave) return;
    this.balloonsSpawned++;
    this.pendingSpawns++;
    this.trySpawnBalloonEntity();
  }

  /**
   * Reserves the spawn slot immediately (see spawnBalloon) but defers the
   * actual balloon until a non-duplicate word is available, retrying rather
   * than ever giving two on-screen balloons the same word - a duplicate
   * would make the WordMatcher (Set-backed) only ever resolve the first one,
   * permanently orphaning the second.
   */
  private trySpawnBalloonEntity(): void {
    if (this.gameOver) {
      this.pendingSpawns--;
      return;
    }
    const active = new Set(this.balloons.map((b) => b.word));
    const word = this.tryNextWord(active);
    if (word === null) {
      this.time.delayedCall(400, () => this.trySpawnBalloonEntity());
      return;
    }
    this.pendingSpawns--;

    const W = this.scale.width;
    const H = this.scale.height;
    const margin = 70;
    const x = margin + Math.random() * (W - margin * 2);
    const isBig = Math.random() < BIG_BALLOON_CHANCE;
    const balloon = new Balloon(this, x, H + 60, word, isBig);
    this.balloons.push(balloon);
    this.matcher.register(word);
  }

  private schedulePowerUpSpawn(): void {
    if (this.gameOver || this.maxWave > 0) return;
    const delay =
      POWERUP_SPAWN_MIN_MS +
      Math.random() * (POWERUP_SPAWN_MAX_MS - POWERUP_SPAWN_MIN_MS);
    this.powerUpTimer = this.time.delayedCall(delay, () =>
      this.trySpawnPowerUp(),
    );
  }

  /** Only one power-up can be out (or held) at a time - retries later if the slot's taken. */
  private trySpawnPowerUp(): void {
    if (this.gameOver || this.maxWave > 0) return;
    if (this.heldPowerUp !== null || this.powerUp !== null) {
      this.schedulePowerUpSpawn();
      return;
    }
    const kind: PowerUpKind = Math.random() < 0.5 ? "gust" : "golden";
    const W = this.scale.width;
    const H = this.scale.height;
    const margin = 80;
    const x = margin + Math.random() * (W - margin * 2);

    this.powerUp = new PowerUp(this, x, H + 60, POWERUP_WORDS[kind], kind);
    this.matcher.register(this.powerUp.word);
    // No separate expiry timer - if uncollected it just rises off-screen
    // like a balloon (see update()), with no penalty for missing it.
  }

  private onPowerUpCollected(powerUp: PowerUp): void {
    this.matcher.unregister(powerUp.word);
    powerUp.destroy();
    this.powerUp = null;

    this.heldPowerUp = powerUp.kind;
    this.game.events.emit("ui-powerup", this.heldPowerUp);
    playDeflect();

    this.schedulePowerUpSpawn();
  }

  /** Enter activates whichever power-up is currently held (gust or golden), then clears the slot. */
  private activateHeldPowerUp(): void {
    if (this.heldPowerUp === null || this.gameOver) return;
    const kind = this.heldPowerUp;
    this.heldPowerUp = null;
    this.game.events.emit("ui-powerup", null);

    if (kind === "gust") {
      // Only the balloons on screen right now - anything spawned later
      // during this gust window should rise normally.
      const frozenBalloons = [...this.balloons];
      for (const b of frozenBalloons) b.setFrozen(true);
      this.time.delayedCall(GUST_DURATION_MS, () => {
        for (const b of frozenBalloons) {
          if (b.active) b.setFrozen(false);
        }
      });
      this.game.events.emit("ui-frozen", GUST_DURATION_MS);
      this.gustWind(GUST_DURATION_MS);
      this.cameras.main.flash(200, 150, 220, 255, false);
      playWaveClear();
    } else {
      for (let i = this.balloons.length - 1; i >= 0; i--) {
        const b = this.balloons[i];
        if (b === undefined) continue;
        this.matcher.unregister(b.word);
        this.hits++;
        this.streak++;
        this.score += Math.round(
          (10 + b.word.length * 2 + this.streak) *
            (b.isBig ? BIG_BALLOON_SCORE_MULT : 1),
        );
        this.pop(b.x, b.y, b.colorName);
        b.destroy();
        this.balloons.splice(i, 1);
      }
      this.game.events.emit("ui-score", this.score);
      this.game.events.emit("ui-streak", this.streak);
      this.cameras.main.flash(300, 255, 220, 80, false);
      this.cameras.main.shake(300, 0.015);
      playBombExplode();
      this.checkWaveComplete();
    }
  }

  private isHordeWave(wave: number): boolean {
    return this.hordeEnabled && wave % 3 === 0;
  }

  private startWave(): void {
    this.isHordeWaveActive = false;
    this.balloonsThisWave = this.perWaveBase + (this.wave - 1) * 2;
    this.balloonsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);

    const interval = Math.max(900, 2200 - this.wave * 150);
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnBalloon,
      callbackScope: this,
      repeat: this.balloonsThisWave - 1,
    });
    this.spawnBalloon();
  }

  private startHordeWave(): void {
    this.isHordeWaveActive = true;
    const normal = this.perWaveBase + (this.wave - 1) * 2;
    const bonus = Math.floor(this.wave / 3) * 2;
    this.balloonsThisWave = normal + bonus;
    this.balloonsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);

    const interval = Math.max(900, 2200 - this.wave * 150);
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnBalloon,
      callbackScope: this,
      repeat: this.balloonsThisWave - 1,
    });
    this.spawnBalloon();
  }

  private onBalloonPopped(word: string): void {
    const idx = this.balloons.findIndex((b) => b.word === word);
    if (idx === -1) return;
    const balloon = this.balloons[idx] as Balloon;

    this.hits++;
    this.streak++;
    this.score += Math.round(
      (10 + word.length * 2 + this.streak) *
        (balloon.isBig ? BIG_BALLOON_SCORE_MULT : 1),
    );
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);
    playPop();
    this.tappy.cheer();
    if (this.streak > 0 && this.streak % STREAK_SOUND_MILESTONE === 0) {
      playBossDefeated();
    }

    this.pop(balloon.x, balloon.y, balloon.colorName);
    balloon.destroy();
    this.balloons.splice(idx, 1);
    this.checkWaveComplete();
  }

  /** Shared life-loss + game-over handling for both wrong keystrokes and escaped balloons. */
  private loseLife(): void {
    if (this.gameOver) return;
    this.lives = Math.max(0, this.lives - 1);
    this.tappy.sad();
    this.game.events.emit("ui-lives", this.lives);

    if (this.lives <= 0) {
      this.gameOver = true;
      this.spawnTimer?.remove();
      this.powerUpTimer?.remove();
      playGameOver();
      this.time.delayedCall(500, () => {
        this.scene.stop("UI");
        this.scene.start("GameOver", {
          score: this.score,
          wave: this.wave,
          hits: this.hits,
          misses: this.misses,
          cleared: false,
        });
      });
    }
  }

  private onMiss(): void {
    this.streak = 0;
    this.misses++;
    this.game.events.emit("ui-streak", 0);
    this.cameras.main.flash(100, 80, 0, 0);
    playMiss();
    this.loseLife();
  }

  private balloonEscaped(balloon: Balloon, idx: number): void {
    if (this.gameOver) return;
    this.matcher.unregister(balloon.word);

    const missText = this.add
      .text(
        Math.min(Math.max(balloon.x, 60), this.scale.width - 60),
        40,
        "Floated away!",
        {
          ...kidText(16, "red"),
          stroke: PALETTE.cream,
          strokeThickness: 5,
        },
      )
      .setOrigin(0.5);
    this.tweens.add({
      targets: missText,
      alpha: 0,
      y: 16,
      duration: 500,
      onComplete: () => missText.destroy(),
    });

    balloon.destroy();
    this.balloons.splice(idx, 1);

    this.cameras.main.shake(250, 0.008);
    playMiss();
    this.loseLife();

    if (!this.gameOver) {
      this.checkWaveComplete();
    }
  }

  /** Burst ring + confetti in the balloon's colour. */
  private pop(x: number, y: number, color: PaletteName = "pink"): void {
    const ring = this.add.graphics();
    ring.lineStyle(5, hex(color), 1);
    ring.strokeCircle(0, 0, 22);
    ring.setPosition(x, y);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    const particles = this.add.particles(x, y, "bp-confetti", {
      lifespan: 900,
      speed: { min: 90, max: 220 },
      gravityY: 300,
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.6 },
      quantity: 16,
      tint: [hex(color), ...CONFETTI.map(hex)],
      emitting: false,
    });
    particles.explode(16);
    this.time.delayedCall(950, () => {
      particles.destroy();
    });
  }

  /** Wind streaks across the sky while a gust holds the balloons. */
  private gustWind(durationMs: number): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const until = this.time.now + durationMs;
    const streak = (): void => {
      if (this.time.now > until || this.gameOver) return;
      const y = 40 + Math.random() * (H - 160);
      const len = 60 + Math.random() * 80;
      const line = this.add.graphics();
      line.lineStyle(4, hex("cloud"), 0.8);
      line.lineBetween(0, 0, len, 0);
      line.setPosition(-len, y);
      this.tweens.add({
        targets: line,
        x: W + len,
        duration: 900,
        onComplete: () => line.destroy(),
      });
      this.time.delayedCall(180, streak);
    };
    streak();
  }

  private checkWaveComplete(): void {
    if (
      this.balloons.length === 0 &&
      this.pendingSpawns === 0 &&
      this.balloonsSpawned >= this.balloonsThisWave
    ) {
      this.spawnTimer?.remove();
      this.betweenWaves = true;
      this.isHordeWaveActive = false;
      this.matcher.clear();
      // clear() wipes every registered word, including an independently-timed
      // power-up that's still alive on screen - re-register it so it doesn't
      // silently become untypeable for the rest of its lifetime.
      if (this.powerUp !== null) this.matcher.register(this.powerUp.word);
      playWaveClear();

      const W = this.scale.width;
      const H = this.scale.height;

      if (this.isHordeWave(this.wave)) {
        popBanner(
          this,
          W / 2,
          H / 2,
          "🎈 Balloon party coming!",
          "pink",
          WAVE_PAUSE_MS,
        );
        this.tappy.cheer();
        this.cameras.main.flash(300, 255, 200, 80, false);
        playHordeIncoming();

        this.time.delayedCall(WAVE_PAUSE_MS, () => {
          this.wave++;
          if (this.maxWave > 0 && this.wave > this.maxWave) {
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
          this.startHordeWave();
        });
      } else {
        popBanner(
          this,
          W / 2,
          H / 2,
          `Wave ${this.wave} clear! 🎈`,
          "green",
          WAVE_PAUSE_MS,
        );
        this.tappy.cheer();

        this.time.delayedCall(WAVE_PAUSE_MS, () => {
          this.wave++;
          if (this.maxWave > 0 && this.wave > this.maxWave) {
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
          this.startWave();
        });
      }
    }
  }

  private emitUI(): void {
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-lives", this.lives);
    this.game.events.emit("ui-powerup", this.heldPowerUp);
  }

  shutdown(): void {
    this.spawnTimer?.remove();
    this.powerUpTimer?.remove();
    this.matcher?.clear();
    this.input.keyboard?.removeAllListeners();
  }
}

import { Scene, GameObjects, BlendModes, Time, Structs } from "phaser";

import { BombEntity } from "../entities/BombEntity";
import { BossShip } from "../entities/BossShip";
import { EnemyShip } from "../entities/EnemyShip";
import { PowerUp, PowerUpKind } from "../entities/PowerUp";
import {
  playBombExplode,
  playBossDefeated,
  playBossHit,
  playDeflect,
  playExplode,
  playGameOver,
  playMiss,
  playWaveClear,
} from "../../shared/sounds";
import { WordMatcher } from "../systems/word-matcher";
import { shuffleCyclic } from "../systems/vocab-pool";

const LIVES = 8;
const WAVE_PAUSE_MS = 2500;
const BASE_TINTS = [0xffffff, 0xffaa44, 0xff4422] as const;

const POWERUP_WORDS: Record<PowerUpKind, string> = {
  emp: "emp",
  nuke: "nuke",
};
const POWERUP_SPAWN_MIN_MS = 14000;
const POWERUP_SPAWN_MAX_MS = 22000;
const POWERUP_DESCEND_SPEED = 40; // fixed, not wave-scaled - equally catchable at any wave
const EMP_DURATION_MS = 8000;

type Star = { x: number; y: number; speed: number; g: GameObjects.Graphics };

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private ships: EnemyShip[] = [];
  private bossShip: BossShip | null = null;
  private bombs: BombEntity[] = [];
  private isBossWaveActive = false;
  private bossRaging = false;
  private bombTimer: Time.TimerEvent | null = null;
  private matcher!: WordMatcher;

  private lives = LIVES;
  private score = 0;
  private wave = 1;
  private hits = 0;
  private misses = 0;
  private streak = 0;

  private stars: Star[] = [];
  private baseImg!: GameObjects.Image;
  private baseX = 0;
  private baseY = 0;
  private baseCracks = 0;

  private baseSpeed = 20;
  private speedIncrement = 4;
  private perWaveBase = 4;
  private maxWave = 0;
  private bossEnabled = false;
  private gameOver = false;

  private spawnTimer: Time.TimerEvent | null = null;
  private shipsThisWave = 0;
  private shipsSpawned = 0;
  // Reserved spawns still waiting on a non-duplicate word (see
  // trySpawnShipEntity) - counted separately from shipsSpawned so
  // checkWaveComplete can't fire while one is still in flight.
  private pendingSpawns = 0;
  private betweenWaves = false;

  private powerUp: PowerUp | null = null;
  private powerUpTimer: Time.TimerEvent | null = null;
  private heldPowerUp: PowerUpKind | null = null;

  constructor() {
    super({ key: "Game" });
  }

  init(): void {
    const stored = this.registry.get("words") as string[] | undefined;
    this.words =
      stored !== undefined && stored.length > 0
        ? stored
        : ["asdf", "jkl", "fjdk"];
    this.wordPool = shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.ships = [];
    this.bossShip = null;
    this.bombs = [];
    this.isBossWaveActive = false;
    this.bossRaging = false;
    this.bombTimer = null;
    this.stars = [];
    this.gameOver = false;
    this.lives = LIVES;
    this.score = 0;
    this.wave = 1;
    this.hits = 0;
    this.misses = 0;
    this.streak = 0;
    this.shipsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.baseCracks = 0;
    this.powerUp = null;
    this.heldPowerUp = null;
    this.baseSpeed =
      (this.registry.get("baseSpeed") as number | undefined) ?? 20;
    this.speedIncrement =
      (this.registry.get("speedIncrement") as number | undefined) ?? 4;
    this.perWaveBase =
      (this.registry.get("perWaveBase") as number | undefined) ?? 4;
    this.maxWave = (this.registry.get("maxWave") as number | undefined) ?? 0;
    this.bossEnabled =
      (this.registry.get("bossEnabled") as boolean | undefined) ?? false;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.baseX = W / 2;
    this.baseY = H - 40;

    if (!this.textures.exists("particle")) {
      const pg = this.add.graphics();
      pg.fillStyle(0xffffff, 1);
      pg.fillCircle(16, 16, 16);
      pg.generateTexture("particle", 32, 32);
      pg.destroy();
    }

    this.createStars(W, H);

    this.baseImg = this.add.image(this.baseX, this.baseY - 20, "base");
    this.baseImg.setDisplaySize(120, 56);

    this.matcher = new WordMatcher((buf, locked) => {
      this.game.events.emit("ui-buffer", buf, locked);

      // Update boss typing display
      const boss = this.bossShip;
      if (boss !== null) {
        if (locked === boss.word) boss.updateTyped(buf);
        else boss.updateTyped("");
      }

      // Update bombs
      for (const bomb of this.bombs) {
        if (locked === bomb.word) bomb.updateTyped(buf);
        else bomb.updateTyped("");
      }

      // Update regular ships
      for (const ship of this.ships) {
        if (locked !== null) {
          ship.highlight(ship.word === locked ? "locked" : "normal");
          if (ship.word === locked) {
            ship.updateTyped(buf);
          }
        } else if (buf.length > 0) {
          const matches = this.ships.filter((s) => s.word.startsWith(buf));
          ship.highlight(matches.includes(ship) ? "partial" : "normal");
          ship.updateTyped(ship.word.startsWith(buf) ? buf : "");
        } else {
          ship.highlight("normal");
          ship.updateTyped("");
        }
      }
      if (this.powerUp !== null) {
        this.powerUp.updateTyped(this.powerUp.word === locked ? buf : "");
      }
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!e.repeat) this.activateHeldPowerUp();
        return;
      }
      if (this.betweenWaves || e.repeat) return;
      const char =
        e.key.length === 1 ? e.key : e.key === "Backspace" ? "Backspace" : null;
      if (char === null) return;
      // Let a power-up interrupt a definite lock on a DIFFERENT ship once
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
        this.onWordComplete(result.word);
      } else if (result.status === "miss") {
        this.onMiss();
      }
    });

    this.scale.on("resize", (size: Structs.Size) => {
      this.baseX = size.width / 2;
      this.baseY = size.height - 40;
      this.baseImg.setPosition(this.baseX, this.baseY - 20);
      this.repositionStars(size.width, size.height);
    });

    this.scene.launch("UI");
    this.emitUI();
    this.startWave();
    this.schedulePowerUpSpawn();
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const H = this.scale.height;
    const speed = this.baseSpeed + (this.wave - 1) * this.speedIncrement;

    for (let i = this.ships.length - 1; i >= 0; i--) {
      const ship = this.ships[i];
      if (ship === undefined) continue;
      if (ship.isFrozen()) continue;
      ship.y += speed * dt;

      if (ship.y >= this.baseY - 30) {
        this.shipReachedBase(ship, i);
      }
    }

    if (this.powerUp !== null) {
      this.powerUp.y += POWERUP_DESCEND_SPEED * dt;
      if (this.powerUp.y >= this.baseY - 30) {
        this.matcher.unregister(this.powerUp.word);
        this.powerUp.destroy();
        this.powerUp = null;
        this.schedulePowerUpSpawn();
      }
    }

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (bomb === undefined) continue;
      bomb.y += 95 * dt;
      if (bomb.y >= this.baseY - 30) {
        this.bombReachedBase(bomb, i);
      }
    }

    const boss = this.bossShip;
    if (boss !== null && !this.betweenWaves && !this.gameOver) {
      const W = this.scale.width;
      boss.x += boss.oscillateSpeed * boss.oscillateDir * dt;
      if (boss.x > W - 70) {
        boss.x = W - 70;
        boss.oscillateDir = -1;
      } else if (boss.x < 70) {
        boss.x = 70;
        boss.oscillateDir = 1;
      }
      boss.y += boss.descentSpeed * dt;
      if (boss.y >= this.baseY - 60) {
        this.bossReachedBase();
      }
    }

    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > H) {
        star.y = 0;
      }
      star.g.clear();
      star.g.fillStyle(0xffffff, 0.5);
      star.g.fillRect(star.x, star.y, 1, 1);
    }
  }

  private createStars(W: number, H: number): void {
    for (let i = 0; i < 80; i++) {
      const g = this.add.graphics();
      const star: Star = {
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 20 + Math.random() * 40,
        g,
      };
      g.fillStyle(0xffffff, 0.5);
      g.fillRect(star.x, star.y, 1, 1);
      this.stars.push(star);
    }
  }

  private repositionStars(W: number, H: number): void {
    for (const star of this.stars) {
      if (star.x > W) star.x = Math.random() * W;
      if (star.y > H) star.y = Math.random() * H;
    }
  }

  private updateBaseTint(): void {
    const tint = BASE_TINTS[Math.min(this.baseCracks, 2)] as number;
    this.baseImg.setTint(tint);
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

  private spawnShip(): void {
    if (this.shipsSpawned >= this.shipsThisWave) return;
    this.shipsSpawned++;
    this.pendingSpawns++;
    this.trySpawnShipEntity();
  }

  /**
   * Reserves the spawn slot immediately (see spawnShip) but defers the
   * actual ship until a non-duplicate word is available, retrying rather
   * than ever giving two on-screen ships the same word - a duplicate would
   * make the WordMatcher (Set-backed) only ever resolve the first one,
   * permanently orphaning the second.
   */
  private trySpawnShipEntity(): void {
    if (this.gameOver) {
      this.pendingSpawns--;
      return;
    }
    const activeWords = new Set(this.ships.map((s) => s.word));
    const word = this.tryNextWord(activeWords);
    if (word === null) {
      this.time.delayedCall(400, () => this.trySpawnShipEntity());
      return;
    }
    this.pendingSpawns--;

    const W = this.scale.width;
    const margin = 60;
    const x = margin + Math.random() * (W - margin * 2);
    const ship = new EnemyShip(this, x, -20, word);
    this.ships.push(ship);
    this.matcher.register(word);
  }

  private schedulePowerUpSpawn(): void {
    if (this.gameOver) return;
    const delay =
      POWERUP_SPAWN_MIN_MS +
      Math.random() * (POWERUP_SPAWN_MAX_MS - POWERUP_SPAWN_MIN_MS);
    this.powerUpTimer = this.time.delayedCall(delay, () =>
      this.trySpawnPowerUp(),
    );
  }

  /**
   * Only one power-up can be out (or held) at a time, and none spawn during
   * boss waves - the boss word + falling bombs are already a lot to track
   * without a power-up word competing for attention too.
   */
  private trySpawnPowerUp(): void {
    if (this.gameOver) return;
    if (
      this.heldPowerUp !== null ||
      this.powerUp !== null ||
      this.isBossWaveActive
    ) {
      this.schedulePowerUpSpawn();
      return;
    }
    const kind: PowerUpKind = Math.random() < 0.5 ? "emp" : "nuke";
    const W = this.scale.width;
    const margin = 70;
    const x = margin + Math.random() * (W - margin * 2);

    this.powerUp = new PowerUp(this, x, -20, POWERUP_WORDS[kind], kind);
    this.matcher.register(this.powerUp.word);
    // No separate expiry timer - if uncollected it just drifts down to the
    // base like a ship (see update()), with no penalty for missing it.
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

  /** Enter activates whichever power-up is currently held (EMP or nuke), then clears the slot. */
  private activateHeldPowerUp(): void {
    if (this.heldPowerUp === null || this.gameOver) return;
    const kind = this.heldPowerUp;
    this.heldPowerUp = null;
    this.game.events.emit("ui-powerup", null);

    if (kind === "emp") {
      // Only the ships on screen right now - anything spawned later during
      // this EMP window should descend normally.
      const frozenShips = [...this.ships];
      for (const ship of frozenShips) ship.setFrozen(true);
      this.time.delayedCall(EMP_DURATION_MS, () => {
        for (const ship of frozenShips) {
          if (ship.active) ship.setFrozen(false);
        }
      });
      this.game.events.emit("ui-frozen", EMP_DURATION_MS);
      this.cameras.main.flash(200, 150, 220, 255, false);
      playWaveClear();
    } else {
      for (let i = this.ships.length - 1; i >= 0; i--) {
        const ship = this.ships[i];
        if (ship === undefined) continue;
        this.matcher.unregister(ship.word);
        this.hits++;
        this.streak++;
        this.score += 10 + ship.word.length * 2 + this.streak;
        this.explode(ship.x, ship.y);
        ship.destroy();
        this.ships.splice(i, 1);
      }
      this.game.events.emit("ui-score", this.score);
      this.game.events.emit("ui-streak", this.streak);
      this.cameras.main.flash(300, 140, 255, 140, false);
      this.cameras.main.shake(300, 0.015);
      playBombExplode();
      this.checkWaveComplete();
    }
  }

  private startWave(): void {
    this.shipsThisWave = this.perWaveBase + (this.wave - 1) * 2;
    this.shipsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-boss", false);

    const interval = Math.max(800, 2000 - this.wave * 150);
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnShip,
      callbackScope: this,
      repeat: this.shipsThisWave - 1,
    });
    this.spawnShip();
  }

  private isBossWave(wave: number): boolean {
    return this.bossEnabled && wave % 3 === 0;
  }

  private startBossWave(): void {
    this.isBossWaveActive = true;
    this.betweenWaves = false;
    this.bossRaging = false;
    const W = this.scale.width;
    const bossHp = Math.floor(this.wave / 3) + 2;
    const oscillateSpeed = 50 + this.wave * 4;
    const descentSpeed = 10 + this.wave * 1.5;

    const word = this.nextWord();
    this.bossShip = new BossShip(
      this,
      W / 2,
      -60,
      word,
      bossHp,
      oscillateSpeed,
      descentSpeed,
    );
    this.matcher.register(word);
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-boss", true);
    this.startBombTimer(3500);
  }

  private startBombTimer(interval: number): void {
    this.bombTimer?.remove();
    this.bombTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnBomb,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnBomb(): void {
    const boss = this.bossShip;
    if (boss === null || this.betweenWaves || this.gameOver) return;

    // Bombs aren't wave-counted (an uncapped repeating timer during the boss
    // fight) so if every word is already in use, just skip this tick rather
    // than risk a duplicate - the timer retries on its own next interval.
    const activeWords = new Set([boss.word, ...this.bombs.map((b) => b.word)]);
    const word = this.tryNextWord(activeWords);
    if (word === null) return;

    const x = boss.x + (Math.random() - 0.5) * 80;
    const bomb = new BombEntity(this, x, boss.y + 40, word);
    this.bombs.push(bomb);
    this.matcher.register(word);
  }

  private clearBombs(): void {
    this.bombTimer?.remove();
    this.bombTimer = null;
    for (const b of this.bombs) {
      this.matcher.unregister(b.word);
      b.destroy();
    }
    this.bombs = [];
  }

  private onWordComplete(word: string): void {
    if (this.isBossWaveActive) {
      if (this.bossShip?.word === word) {
        this.onBossHit();
        return;
      }
      const bombIdx = this.bombs.findIndex((b) => b.word === word);
      if (bombIdx !== -1) {
        this.onBombDeflected(bombIdx);
        return;
      }
    }

    if (this.powerUp !== null && word === this.powerUp.word) {
      this.onPowerUpCollected(this.powerUp);
      return;
    }

    const idx = this.ships.findIndex((s) => s.word === word);
    if (idx === -1) return;
    const ship = this.ships[idx] as EnemyShip;

    this.hits++;
    this.streak++;
    this.score += 10 + word.length * 2 + this.streak;
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);
    playExplode();

    const bx = this.baseX;
    const by = this.baseY;
    const tx = ship.x;
    const ty = ship.y;

    const bullet = this.add.graphics();
    bullet.lineStyle(2, 0x44ffaa, 1);
    bullet.lineBetween(bx, by, bx, by);

    this.tweens.add({
      targets: { p: 0 },
      p: 1,
      duration: 180,
      onUpdate: (_tween, target: { p: number }) => {
        const progress = target.p;
        bullet.clear();
        bullet.lineStyle(2, 0x44ffaa, 1 - progress * 0.3);
        bullet.lineBetween(
          bx,
          by,
          bx + (tx - bx) * progress,
          by + (ty - by) * progress,
        );
      },
      onComplete: () => {
        bullet.destroy();
        this.explode(tx, ty);
        ship.destroy();
      },
    });

    this.ships.splice(idx, 1);
    this.checkWaveComplete();
  }

  private onBossHit(): void {
    const boss = this.bossShip;
    if (boss === null) return;

    this.hits++;
    this.streak++;
    this.score += 20 + boss.word.length * 3 + this.streak;
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);

    playBossHit();
    boss.pulse(this);
    this.cameras.main.flash(140, 255, 80, 0, false);

    if (boss.hp <= 1) {
      this.onBossDefeated();
    } else {
      const newWord = this.nextWord();
      boss.hit(newWord);
      this.matcher.register(newWord);

      if (!this.bossRaging && boss.hp <= Math.ceil(boss.maxHp / 2)) {
        this.bossRaging = true;
        this.startBombTimer(2000);
        this.cameras.main.flash(250, 255, 30, 0, false);
      }
    }
  }

  private onBombDeflected(idx: number): void {
    const bomb = this.bombs[idx];
    if (bomb === undefined) return;

    this.score += 5 + bomb.word.length;
    this.hits++;
    this.game.events.emit("ui-score", this.score);

    playDeflect();
    this.explodeSmall(bomb.x, bomb.y);
    bomb.destroy();
    this.bombs.splice(idx, 1);
  }

  private bombReachedBase(bomb: BombEntity, idx: number): void {
    if (this.gameOver) return;
    this.matcher.unregister(bomb.word);
    bomb.destroy();
    this.bombs.splice(idx, 1);

    this.cameras.main.shake(300, 0.012);
    playMiss();
    this.loseLife();
  }

  private onBossDefeated(): void {
    const boss = this.bossShip;
    if (boss === null) return;

    const bx = boss.x;
    const by = boss.y;
    this.bossShip = null;
    this.isBossWaveActive = false;
    this.bossRaging = false;
    this.clearBombs();
    this.matcher.clear();
    // clear() wipes every registered word, including an independently-timed
    // power-up that's still alive on screen - re-register it so it doesn't
    // silently become untypeable for the rest of its lifetime.
    if (this.powerUp !== null) this.matcher.register(this.powerUp.word);
    this.betweenWaves = true;

    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 110, () => {
        this.explode(
          bx + (Math.random() - 0.5) * 70,
          by + (Math.random() - 0.5) * 50,
        );
      });
    }
    boss.destroy();
    playBossDefeated();

    const W = this.scale.width;
    const H = this.scale.height;

    const banner = this.add
      .text(W / 2, H / 2, "BOSS DEFEATED!", {
        fontSize: "36px",
        fontFamily: "monospace",
        color: "#ffcc00",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: H / 2 - 60,
      duration: WAVE_PAUSE_MS,
      onComplete: () => {
        banner.destroy();
      },
    });

    this.game.events.emit("ui-boss", false);

    this.time.delayedCall(WAVE_PAUSE_MS, () => {
      this.wave++;
      if (this.maxWave > 0 && this.wave > this.maxWave) {
        this.endGame();
        return;
      }
      this.startWave();
    });
  }

  private bossReachedBase(): void {
    const boss = this.bossShip;
    if (boss === null || this.gameOver) return;

    boss.resetToTop();

    this.cameras.main.shake(350, 0.016);
    playMiss();
    this.loseLife();
  }

  /** Shared life-loss + game-over handling for both wrong keystrokes and enemies reaching the base. */
  private loseLife(): void {
    if (this.gameOver) return;
    this.lives = Math.max(0, this.lives - 1);
    this.baseCracks = LIVES - this.lives;
    this.updateBaseTint();
    this.game.events.emit("ui-lives", this.lives);

    if (this.lives <= 0) {
      this.gameOver = true;
      this.spawnTimer?.remove();
      this.powerUpTimer?.remove();
      this.clearBombs();
      this.bossShip?.destroy();
      this.bossShip = null;
      this.matcher.clear();
      playGameOver();
      this.time.delayedCall(600, () => {
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
    this.cameras.main.flash(120, 100, 0, 0);
    playMiss();
    this.loseLife();
  }

  private shipReachedBase(ship: EnemyShip, idx: number): void {
    if (this.gameOver) return;
    this.matcher.unregister(ship.word);
    ship.destroy();
    this.ships.splice(idx, 1);

    this.cameras.main.shake(300, 0.012);
    playMiss();
    this.loseLife();

    if (!this.gameOver) {
      this.checkWaveComplete();
    }
  }

  private explodeSmall(x: number, y: number): void {
    const particles = this.add.particles(x, y, "particle", {
      lifespan: 280,
      speed: { min: 25, max: 70 },
      scale: { start: 0.22, end: 0 },
      quantity: 6,
      blendMode: BlendModes.ADD,
      tint: [0xff3300, 0xff8800, 0xffcc00],
      emitting: false,
    });
    particles.explode(6);
    this.time.delayedCall(350, () => {
      particles.destroy();
    });
  }

  private explode(x: number, y: number): void {
    const particles = this.add.particles(x, y, "particle", {
      lifespan: 400,
      speed: { min: 40, max: 120 },
      scale: { start: 0.4, end: 0 },
      quantity: 12,
      blendMode: BlendModes.ADD,
      tint: [0xff8800, 0xffcc00, 0xff4400],
      emitting: false,
    });
    particles.explode(12);
    this.time.delayedCall(500, () => {
      particles.destroy();
    });
  }

  private checkWaveComplete(): void {
    if (this.isBossWaveActive) return;
    if (
      this.ships.length === 0 &&
      this.pendingSpawns === 0 &&
      this.shipsSpawned >= this.shipsThisWave
    ) {
      this.spawnTimer?.remove();
      this.betweenWaves = true;
      this.matcher.clear();
      // clear() wipes every registered word, including an independently-timed
      // power-up that's still alive on screen - re-register it so it doesn't
      // silently become untypeable for the rest of its lifetime.
      if (this.powerUp !== null) this.matcher.register(this.powerUp.word);

      const W = this.scale.width;
      const H = this.scale.height;

      if (this.isBossWave(this.wave)) {
        playWaveClear();
        const banner = this.add
          .text(W / 2, H / 2, "⚠ BOSS INCOMING!", {
            fontSize: "30px",
            fontFamily: "monospace",
            color: "#ff4422",
            fontStyle: "bold",
          })
          .setOrigin(0.5);

        this.tweens.add({
          targets: banner,
          alpha: 0,
          y: H / 2 - 40,
          duration: WAVE_PAUSE_MS,
          onComplete: () => {
            banner.destroy();
            this.startBossWave();
          },
        });
      } else {
        playWaveClear();
        const banner = this.add
          .text(W / 2, H / 2, `Wave ${this.wave} Clear!`, {
            fontSize: "32px",
            fontFamily: "monospace",
            color: "#44ffaa",
          })
          .setOrigin(0.5);

        this.tweens.add({
          targets: banner,
          alpha: 0,
          y: H / 2 - 40,
          duration: WAVE_PAUSE_MS,
          onComplete: () => {
            banner.destroy();
          },
        });

        this.time.delayedCall(WAVE_PAUSE_MS, () => {
          this.wave++;
          if (this.maxWave > 0 && this.wave > this.maxWave) {
            this.endGame();
            return;
          }
          this.startWave();
        });
      }
    }
  }

  private endGame(): void {
    playGameOver();
    this.scene.stop("UI");
    this.scene.start("GameOver", {
      score: this.score,
      wave: this.wave,
      hits: this.hits,
      misses: this.misses,
      cleared: true,
    });
  }

  private emitUI(): void {
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-lives", this.lives);
    this.game.events.emit("ui-boss", false);
    this.game.events.emit("ui-powerup", this.heldPowerUp);
  }

  shutdown(): void {
    this.spawnTimer?.remove();
    this.bombTimer?.remove();
    this.powerUpTimer?.remove();
    this.matcher?.clear();
    this.input.keyboard?.removeAllListeners();
  }
}

import { Scene, GameObjects, Time } from "phaser";

import { Ghost } from "../entities/Ghost";
import { PowerUp, PowerUpKind } from "../entities/PowerUp";
import {
  playBombExplode,
  playDeflect,
  playExplode,
  playGameOver,
  playHordeIncoming,
  playMiss,
  playWaveClear,
} from "../../shared/sounds";
import { WordMatcher } from "../../word-defender/systems/word-matcher";
import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

const WAVE_PAUSE_MS = 2500;
const GROUND_FRAC = 0.68; // the fence/ground line sits at this fraction of screen height
// Fixed pixel values (not fractions of screen height) since sprite sizes
// below are also fixed px and don't scale with the canvas - a margin big
// enough to clear a ~65-80px-tall sprite's head needs to stay that size
// however tall/short the canvas is.
const LAWN_TOP_MARGIN = 80; // gap below the fence before the lawn band starts, so sprites' heads clear it
const LAWN_BAND_HEIGHT = 130; // depth of the lawn band (entirely below the fence) the player patrols and ghosts spawn across
const LOG_MAX_HP = 5; // hits a log can absorb before it breaks
// Logs sit close to the player rather than out in the middle of the lawn, so
// a ghost has to cross almost the whole lawn before it can even reach one -
// maximizing the time kids have to type-kill it before any damage happens.
const LOG_X_OFFSET = 80; // distance from center where each side's log sits
const DANGER_X_OFFSET = 25; // distance from center that's fatal once that side's log is broken
const PLAYER_SPEED = 160; // patrol speed, px/sec
const DEFAULT_TARGET_Y_RANGE = 70; // fallback if no difficulty config is registered
// Logs absorb a few hits for free, so horde waves need noticeably more
// ghosts than before to still feel like a real spike in danger.
const HORDE_BONUS_MULTIPLIER = 2.5;

// Power-ups are fixed words (not drawn from the lesson word list) since
// they're a special pickup, not vocabulary practice.
const POWERUP_WORDS: Record<PowerUpKind, string> = {
  freeze: "freeze",
  tnt: "tnt",
};
const POWERUP_SPAWN_MIN_MS = 14000;
const POWERUP_SPAWN_MAX_MS = 22000;
const POWERUP_LIFESPAN_MS = 9000; // disappears if not collected in time
const FREEZE_DURATION_MS = 10000;

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private ghosts: Ghost[] = [];
  private matcher!: WordMatcher;

  private score = 0;
  private wave = 1;
  private hits = 0;
  private misses = 0;
  private streak = 0;
  private gameOver = false;

  private baseSpeed = 30;
  private speedIncrement = 6;
  private perWaveBase = 3;
  private maxWave = 0;
  private hordeEnabled = true;
  private targetYRange = DEFAULT_TARGET_Y_RANGE;

  private ghostsThisWave = 0;
  private ghostsSpawned = 0;
  // Reserved spawns still waiting on a non-duplicate word (see
  // trySpawnGhostEntity) - counted separately from ghostsSpawned so
  // checkWaveComplete can't fire while one is still in flight.
  private pendingSpawns = 0;
  private betweenWaves = false;
  private isHordeWaveActive = false;
  private spawnTimer: Time.TimerEvent | null = null;

  private centerX = 0;
  private groundY = 0;
  private lawnTop = 0;
  private lawnBottom = 0;

  private playerY = 0;
  private facing: "left" | "right" = "right";
  private movingUp = false;
  private movingDown = false;

  private leftLogHp = LOG_MAX_HP;
  private rightLogHp = LOG_MAX_HP;

  private powerUp: PowerUp | null = null;
  private powerUpTimer: Time.TimerEvent | null = null;
  private powerUpExpireTimer: Time.TimerEvent | null = null;
  private heldPowerUp: PowerUpKind | null = null;

  // PLACEHOLDER: player + log graphics — replace with sprites
  private playerGfx!: GameObjects.Graphics;
  private leftLogGfx!: GameObjects.Graphics;
  private rightLogGfx!: GameObjects.Graphics;

  constructor() {
    super({ key: "Game" });
  }

  init(): void {
    const stored = this.registry.get("words") as string[] | undefined;
    this.words =
      stored !== undefined && stored.length > 0
        ? stored
        : ["ghost", "haunt", "spook", "eerie", "crypt"];
    this.wordPool = shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.ghosts = [];
    this.gameOver = false;
    this.score = 0;
    this.wave = 1;
    this.hits = 0;
    this.misses = 0;
    this.streak = 0;
    this.ghostsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.isHordeWaveActive = false;
    this.facing = "right";
    this.movingUp = false;
    this.movingDown = false;
    this.leftLogHp = LOG_MAX_HP;
    this.rightLogHp = LOG_MAX_HP;
    this.powerUp = null;
    this.heldPowerUp = null;
    this.baseSpeed =
      (this.registry.get("baseSpeed") as number | undefined) ?? 30;
    this.speedIncrement =
      (this.registry.get("speedIncrement") as number | undefined) ?? 6;
    this.perWaveBase =
      (this.registry.get("perWaveBase") as number | undefined) ?? 3;
    this.maxWave = (this.registry.get("maxWave") as number | undefined) ?? 0;
    this.hordeEnabled =
      (this.registry.get("hordeEnabled") as boolean | undefined) ?? true;
    this.targetYRange =
      (this.registry.get("targetYRange") as number | undefined) ??
      DEFAULT_TARGET_Y_RANGE;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.centerX = W / 2;
    this.groundY = H * GROUND_FRAC;
    this.lawnTop = this.groundY + LAWN_TOP_MARGIN;
    this.lawnBottom = Math.min(this.lawnTop + LAWN_BAND_HEIGHT, H - 10);
    this.playerY = (this.lawnTop + this.lawnBottom) / 2;

    this.drawBackground(W, H);
    this.drawGround(W, H);
    this.leftLogGfx = this.add.graphics();
    this.rightLogGfx = this.add.graphics();
    this.redrawLogs();
    this.drawPlayer();

    this.matcher = new WordMatcher((buf, locked) => {
      for (const ghost of this.ghosts) {
        ghost.updateTyped(ghost.word === locked ? buf : "");
      }
      if (this.powerUp !== null) {
        this.powerUp.updateTyped(this.powerUp.word === locked ? buf : "");
      }
      this.game.events.emit("ui-buffer", buf, locked);
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault(); // stop the page from scrolling with the player
        this.movingUp = true;
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.movingDown = true;
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        this.facing = e.key === "ArrowLeft" ? "left" : "right";
        this.game.events.emit("ui-facing", this.facing);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!e.repeat) this.activateHeldPowerUp();
        return;
      }
      if (this.betweenWaves || this.gameOver || e.repeat) return;
      const char =
        e.key.length === 1 ? e.key : e.key === "Backspace" ? "Backspace" : null;
      if (char === null) return;
      // Let a targetable power-up interrupt a definite lock on a DIFFERENT
      // ghost once that lock is confirmed dead (this key wouldn't continue
      // it anyway) - never while it's still valid progress, or this would
      // wrongly abort a real word right on its last letter just because it
      // starts the same as the power-up. See WordMatcher.releaseLock()'s
      // doc comment.
      {
        const locked = this.matcher.getLockedWord();
        const wouldStayValid =
          locked !== null && locked.startsWith(this.matcher.getBuffer() + char);
        if (
          this.powerUp !== null &&
          this.powerUp.isTargetable() &&
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
          this.onGhostDestroyed(result.word);
        }
      } else if (result.status === "miss") {
        this.onMiss();
      }
    });

    this.input.keyboard?.on("keyup", (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") this.movingUp = false;
      else if (e.key === "ArrowDown") this.movingDown = false;
    });

    this.scale.on("resize", (size: { width: number; height: number }) => {
      this.centerX = size.width / 2;
      this.groundY = size.height * GROUND_FRAC;
      this.lawnTop = this.groundY + LAWN_TOP_MARGIN;
      this.lawnBottom = Math.min(
        this.lawnTop + LAWN_BAND_HEIGHT,
        size.height - 10,
      );
    });

    this.scene.launch("UI");
    this.emitUI();
    this.startWave();
    this.schedulePowerUpSpawn();
  }

  override update(time: number, delta: number): void {
    if (this.gameOver) return;
    const dt = delta / 1000;

    if (this.movingUp) this.playerY -= PLAYER_SPEED * dt;
    if (this.movingDown) this.playerY += PLAYER_SPEED * dt;
    this.playerY = Math.min(
      this.lawnBottom,
      Math.max(this.lawnTop, this.playerY),
    );
    this.redrawPlayer(this.playerGfx);

    this.refreshTargeting();

    const speed = this.baseSpeed + (this.wave - 1) * this.speedIncrement;
    const logX = {
      left: this.centerX - LOG_X_OFFSET,
      right: this.centerX + LOG_X_OFFSET,
    };
    const dangerX = {
      left: this.centerX - DANGER_X_OFFSET,
      right: this.centerX + DANGER_X_OFFSET,
    };

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const ghost = this.ghosts[i];
      if (ghost === undefined) continue;
      if (ghost.isFrozen()) continue; // paused - still typeable via refreshTargeting above
      ghost.x += ghost.side === "left" ? speed * dt : -(speed * dt);
      ghost.bob(time);

      const logHp = ghost.side === "left" ? this.leftLogHp : this.rightLogHp;
      const pastLog =
        ghost.side === "left" ? ghost.x >= logX.left : ghost.x <= logX.right;
      const pastDanger =
        ghost.side === "left"
          ? ghost.x >= dangerX.left
          : ghost.x <= dangerX.right;

      if (logHp > 0 && pastLog) {
        this.ghostHitLog(ghost, i);
      } else if (logHp <= 0 && pastDanger) {
        this.breachPlayer(ghost, i);
        return; // game over - stop processing this frame
      }
    }
  }

  // PLACEHOLDER: draw a simple haunted-house silhouette background
  // Replace with: this.add.image(W/2, H/2, "gh-bg").setDisplaySize(W, H)
  private drawBackground(W: number, H: number): void {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0d0022, 0x0d0022, 0x1a003a, 0x1a003a, 1);
    sky.fillRect(0, 0, W, H);

    // Moon
    const moon = this.add.graphics();
    moon.fillStyle(0xffffcc, 0.9);
    moon.fillCircle(W * 0.82, H * 0.12, 30);
    moon.fillStyle(0x1a003a, 1);
    moon.fillCircle(W * 0.82 + 10, H * 0.12 - 6, 25);

    // Stars
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 40; i++) {
      stars.fillRect(
        Math.random() * W,
        Math.random() * H * 0.55,
        Math.random() < 0.3 ? 2 : 1,
        Math.random() < 0.3 ? 2 : 1,
      );
    }
  }

  // PLACEHOLDER: draw a simple ground + fence
  // Replace with a tilemap or background image
  private drawGround(W: number, H: number): void {
    const g = this.add.graphics();

    // Grass
    g.fillStyle(0x1a4a1a, 1);
    g.fillRect(0, this.groundY + 10, W, H - this.groundY - 10);

    // Fence posts
    g.fillStyle(0x8b6a3a, 1);
    for (let x = 0; x < W; x += 38) {
      g.fillRect(x, this.groundY - 22, 8, 32);
    }
    // Fence rail
    g.fillStyle(0xb89060, 1);
    g.fillRect(0, this.groundY - 14, W, 5);
    g.fillRect(0, this.groundY - 4, W, 4);
  }

  private redrawLogs(): void {
    this.drawLog(this.leftLogGfx, this.centerX - LOG_X_OFFSET, this.leftLogHp);
    this.drawLog(
      this.rightLogGfx,
      this.centerX + LOG_X_OFFSET,
      this.rightLogHp,
    );
  }

  // PLACEHOLDER: simple wooden post with HP notches — replace with a sprite
  private drawLog(g: GameObjects.Graphics, x: number, hp: number): void {
    g.clear();
    // Spans nearly the full grass depth (not just the thin patrol band) so it
    // reads as a real barrier rather than a short fence post.
    const top = this.groundY + 15;
    const bottom = this.scale.height - 20;
    const broken = hp <= 0;

    g.fillStyle(broken ? 0x3a2a1a : 0x8b5a2b, broken ? 0.35 : 0.9);
    g.fillRoundedRect(x - 10, top, 20, bottom - top, 6);
    g.lineStyle(2, broken ? 0x5c3a22 : 0xc4843c, 0.8);
    g.strokeRoundedRect(x - 10, top, 20, bottom - top, 6);

    if (!broken) {
      for (let i = 0; i < LOG_MAX_HP; i++) {
        const notchY =
          top + 14 + i * ((bottom - top - 28) / Math.max(1, LOG_MAX_HP - 1));
        g.fillStyle(i < hp ? 0xd8a860 : 0x5c3a22, 1);
        g.fillCircle(x, notchY, 3);
      }
    }
  }

  // PLACEHOLDER: draw a simple ghost-buster character, facing left/right
  // Replace with: this.playerGfx = this.add.sprite(this.centerX, this.playerY, "player")
  private drawPlayer(): void {
    const g = this.add.graphics();
    this.playerGfx = g;
    this.redrawPlayer(g);
  }

  private redrawPlayer(g: GameObjects.Graphics): void {
    g.clear();
    const cx = this.centerX;
    const gy = this.playerY;
    const dir = this.facing === "left" ? -1 : 1;
    // Body
    g.fillStyle(0x4466cc, 1);
    g.fillRect(cx - 12, gy - 44, 24, 32);
    // Head
    g.fillStyle(0xffcc99, 1);
    g.fillCircle(cx, gy - 52, 13);
    // Proton pack (backpack) - slung on the side opposite the wand
    g.fillStyle(0x888888, 1);
    g.fillRect(cx - dir * 20, gy - 42, 10 * dir, 22);
    // Wand - points in the currently-faced direction
    g.lineStyle(3, 0xaaff44, 1);
    g.lineBetween(cx + dir * 20, gy - 34, cx + dir * 36, gy - 48);
    // Legs
    g.fillStyle(0x334488, 1);
    g.fillRect(cx - 10, gy - 12, 9, 12);
    g.fillRect(cx + 1, gy - 12, 9, 12);
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

  private spawnGhost(): void {
    if (this.ghostsSpawned >= this.ghostsThisWave) return;
    const side: "left" | "right" =
      this.ghostsSpawned % 2 === 0 ? "left" : "right";
    this.ghostsSpawned++;
    this.pendingSpawns++;
    this.trySpawnGhostEntity(side);
  }

  /**
   * Reserves the spawn slot immediately (see spawnGhost) but defers the
   * actual ghost until a non-duplicate word is available, retrying rather
   * than ever giving two on-screen ghosts the same word - a duplicate would
   * make the WordMatcher (Set-backed) only ever resolve the first one,
   * permanently orphaning the second.
   */
  private trySpawnGhostEntity(side: "left" | "right"): void {
    if (this.gameOver) {
      this.pendingSpawns--;
      return;
    }
    const activeWords = new Set(this.ghosts.map((g) => g.word));
    const word = this.tryNextWord(activeWords);
    if (word === null) {
      this.time.delayedCall(400, () => this.trySpawnGhostEntity(side));
      return;
    }
    this.pendingSpawns--;

    const W = this.scale.width;
    const x = side === "left" ? -30 : W + 30;
    const y = this.lawnTop + Math.random() * (this.lawnBottom - this.lawnTop);
    const ghost = new Ghost(this, x, y, word, side);
    this.ghosts.push(ghost);
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

  /** Only one power-up can be out (or held) at a time - retries later if the slot's taken. */
  private trySpawnPowerUp(): void {
    if (this.gameOver) return;
    if (this.heldPowerUp !== null || this.powerUp !== null) {
      this.schedulePowerUpSpawn();
      return;
    }

    const kind: PowerUpKind = Math.random() < 0.5 ? "freeze" : "tnt";
    const side: "left" | "right" = Math.random() < 0.5 ? "left" : "right";
    const W = this.scale.width;
    const edgeMargin = 70;
    const nearLogMargin = LOG_X_OFFSET + 60;
    let x: number;
    if (side === "left") {
      const lo = edgeMargin;
      const hi = Math.max(lo + 20, this.centerX - nearLogMargin);
      x = lo + Math.random() * (hi - lo);
    } else {
      const lo = this.centerX + nearLogMargin;
      const hi = Math.max(lo + 20, W - edgeMargin);
      x = lo + Math.random() * (hi - lo);
    }
    const y = this.lawnTop + Math.random() * (this.lawnBottom - this.lawnTop);

    this.powerUp = new PowerUp(this, x, y, POWERUP_WORDS[kind], kind, side);

    this.powerUpExpireTimer = this.time.delayedCall(POWERUP_LIFESPAN_MS, () => {
      this.removePowerUpPickup();
      this.schedulePowerUpSpawn();
    });
  }

  private removePowerUpPickup(): void {
    if (this.powerUp === null) return;
    this.matcher.unregister(this.powerUp.word);
    this.powerUp.destroy();
    this.powerUp = null;
  }

  private onPowerUpCollected(powerUp: PowerUp): void {
    this.powerUpExpireTimer?.remove();
    this.matcher.unregister(powerUp.word);
    powerUp.destroy();
    this.powerUp = null;

    this.heldPowerUp = powerUp.kind;
    this.game.events.emit("ui-powerup", this.heldPowerUp);
    playDeflect();

    this.schedulePowerUpSpawn();
  }

  /** Enter activates whichever power-up is currently held (freeze or TNT), then clears the slot. */
  private activateHeldPowerUp(): void {
    if (this.heldPowerUp === null || this.gameOver) return;
    const kind = this.heldPowerUp;
    this.heldPowerUp = null;
    this.game.events.emit("ui-powerup", null);

    if (kind === "freeze") {
      // Only the ghosts on screen right now - anything spawned later during
      // this freeze window should move normally.
      const frozenGhosts = [...this.ghosts];
      for (const ghost of frozenGhosts) ghost.setFrozen(true);
      this.time.delayedCall(FREEZE_DURATION_MS, () => {
        for (const ghost of frozenGhosts) {
          if (ghost.active) ghost.setFrozen(false);
        }
      });
      this.game.events.emit("ui-frozen", FREEZE_DURATION_MS);
      this.cameras.main.flash(200, 150, 220, 255, false);
      playWaveClear();
    } else {
      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        const ghost = this.ghosts[i];
        if (ghost === undefined) continue;
        this.matcher.unregister(ghost.word);
        this.hits++;
        this.streak++;
        this.score += 10 + ghost.word.length * 2 + this.streak;
        this.poof(ghost.x, ghost.y - 30);
        ghost.destroy();
        this.ghosts.splice(i, 1);
      }
      this.game.events.emit("ui-score", this.score);
      this.game.events.emit("ui-streak", this.streak);
      this.cameras.main.flash(300, 255, 140, 0, false);
      this.cameras.main.shake(350, 0.02);
      playBombExplode();
      this.checkWaveComplete();
    }
  }

  /**
   * Only ghosts on the faced side, within reach of the player's current
   * patrol position, can be seen/typed - registers/unregisters them with the
   * matcher on transitions so untargetable ghosts can't be matched.
   */
  private refreshTargeting(): void {
    for (const ghost of this.ghosts) {
      const shouldBeTargetable =
        ghost.side === this.facing &&
        Math.abs(ghost.y - this.playerY) <= this.targetYRange;
      if (shouldBeTargetable !== ghost.isTargetable()) {
        ghost.setTargetable(shouldBeTargetable);
        if (shouldBeTargetable) {
          this.matcher.register(ghost.word);
        } else {
          this.matcher.unregister(ghost.word);
        }
      }
    }

    // Power-ups only require facing their side (not Y-proximity like ghosts).
    const powerUp = this.powerUp;
    if (powerUp !== null) {
      const shouldBeTargetable = powerUp.side === this.facing;
      if (shouldBeTargetable !== powerUp.isTargetable()) {
        powerUp.setTargetable(shouldBeTargetable);
        if (shouldBeTargetable) {
          this.matcher.register(powerUp.word);
        } else {
          this.matcher.unregister(powerUp.word);
        }
      }
    }
  }

  private isHordeWave(wave: number): boolean {
    return this.hordeEnabled && wave % 3 === 0;
  }

  private startWave(): void {
    this.isHordeWaveActive = false;
    this.ghostsThisWave = this.perWaveBase + (this.wave - 1) * 2;
    this.ghostsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);

    const interval = Math.max(1000, 2400 - this.wave * 150);
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnGhost,
      callbackScope: this,
      repeat: this.ghostsThisWave - 1,
    });
    this.spawnGhost();
  }

  private startHordeWave(): void {
    this.isHordeWaveActive = true;
    const normal = this.perWaveBase + (this.wave - 1) * 2;
    const bonus = Math.ceil(
      Math.floor(this.wave / 3) * 2 * HORDE_BONUS_MULTIPLIER,
    );
    this.ghostsThisWave = normal + bonus;
    this.ghostsSpawned = 0;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);

    const interval = Math.max(1000, 2400 - this.wave * 150);
    this.spawnTimer = this.time.addEvent({
      delay: interval,
      callback: this.spawnGhost,
      callbackScope: this,
      repeat: this.ghostsThisWave - 1,
    });
    this.spawnGhost();
  }

  private onGhostDestroyed(word: string): void {
    const idx = this.ghosts.findIndex((g) => g.word === word);
    if (idx === -1) return;
    const ghost = this.ghosts[idx] as Ghost;

    this.hits++;
    this.streak++;
    this.score += 10 + word.length * 2 + this.streak;
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);
    playExplode();

    this.poof(ghost.x, ghost.y - 30);
    ghost.destroy();
    this.ghosts.splice(idx, 1);
    this.checkWaveComplete();
  }

  private onMiss(): void {
    this.streak = 0;
    this.misses++;
    this.game.events.emit("ui-streak", 0);
    this.cameras.main.flash(100, 80, 0, 0);
    playMiss();
  }

  /** A ghost that wasn't typed in time reaches its side's log - damages it and is removed there. */
  private ghostHitLog(ghost: Ghost, idx: number): void {
    this.matcher.unregister(ghost.word);
    ghost.destroy();
    this.ghosts.splice(idx, 1);

    if (ghost.side === "left") {
      this.leftLogHp = Math.max(0, this.leftLogHp - 1);
      this.game.events.emit("ui-log-left", this.leftLogHp);
    } else {
      this.rightLogHp = Math.max(0, this.rightLogHp - 1);
      this.game.events.emit("ui-log-right", this.rightLogHp);
    }
    this.redrawLogs();
    this.cameras.main.shake(180, 0.007);
    playMiss();
    this.checkWaveComplete();
  }

  /** A ghost got past that side's already-broken log and reached the player - immediate game over. */
  private breachPlayer(ghost: Ghost, idx: number): void {
    if (this.gameOver) return;
    this.matcher.unregister(ghost.word);
    ghost.destroy();
    this.ghosts.splice(idx, 1);

    this.gameOver = true;
    this.spawnTimer?.remove();
    this.powerUpTimer?.remove();
    this.powerUpExpireTimer?.remove();
    this.cameras.main.shake(400, 0.02);
    this.cameras.main.flash(220, 150, 0, 100);
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

  private checkWaveComplete(): void {
    if (
      this.ghosts.length === 0 &&
      this.pendingSpawns === 0 &&
      this.ghostsSpawned >= this.ghostsThisWave
    ) {
      this.spawnTimer?.remove();
      this.betweenWaves = true;
      this.isHordeWaveActive = false;
      this.matcher.clear();
      // clear() wipes every registered word, including an independently-timed
      // power-up that's still alive on screen - re-register it so it doesn't
      // silently become untypeable until the player happens to change facing.
      if (this.powerUp !== null) this.matcher.register(this.powerUp.word);
      playWaveClear();

      const W = this.scale.width;
      const H = this.scale.height;

      if (this.isHordeWave(this.wave)) {
        // Horde incoming — show warning, then unleash
        const banner = this.add
          .text(W / 2, H / 2, "👻 HORDE INCOMING!", {
            fontSize: "30px",
            fontFamily: "monospace",
            color: "#cc44ff",
            fontStyle: "bold",
          })
          .setOrigin(0.5);

        this.cameras.main.flash(300, 80, 0, 120, false);
        playHordeIncoming();

        this.tweens.add({
          targets: banner,
          alpha: 0,
          y: H / 2 - 50,
          duration: WAVE_PAUSE_MS,
          onComplete: () => banner.destroy(),
        });

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
        const banner = this.add
          .text(W / 2, H / 2, `Wave ${this.wave} Clear! 👻`, {
            fontSize: "30px",
            fontFamily: "monospace",
            color: "#aaddff",
          })
          .setOrigin(0.5);

        this.tweens.add({
          targets: banner,
          alpha: 0,
          y: H / 2 - 50,
          duration: WAVE_PAUSE_MS,
          onComplete: () => banner.destroy(),
        });

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

  private poof(x: number, y: number): void {
    const particles = this.add.particles(x, y, "gh-particle", {
      lifespan: 450,
      speed: { min: 40, max: 130 },
      scale: { start: 0.5, end: 0 },
      quantity: 10,
      blendMode: "ADD",
      tint: [0xaaddff, 0xffffff, 0xddccff],
      emitting: false,
    });
    particles.explode(10);
    this.time.delayedCall(500, () => particles.destroy());
  }

  private emitUI(): void {
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-log-left", this.leftLogHp);
    this.game.events.emit("ui-log-right", this.rightLogHp);
    this.game.events.emit("ui-facing", this.facing);
    this.game.events.emit("ui-powerup", this.heldPowerUp);
  }

  shutdown(): void {
    this.spawnTimer?.remove();
    this.powerUpTimer?.remove();
    this.powerUpExpireTimer?.remove();
    this.matcher?.clear();
    this.input.keyboard?.removeAllListeners();
  }
}

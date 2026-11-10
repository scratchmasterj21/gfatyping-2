import { Scene, GameObjects, Time } from "phaser";

import { hex } from "../../shared/game-palette";
import { popBanner, TappyBuddy } from "../../shared/phaser-ui";
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
export const LOG_MAX_HP = 5; // hits a log can absorb before it breaks
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
const WORLD_SNAPSHOT_INTERVAL_MS = 250;
/** Every this many waves the Ghost King comes (not in lesson checkpoints). */
const BOSS_EVERY = 5;
/** The Ghost King walks this much slower than normal ghosts. */
const BOSS_SPEED_FACTOR = 0.5;
/** Each word typed nudges the Ghost King back this far, px... */
const BOSS_KNOCKBACK = 15;
/** ...and makes him stagger (stand still) this long, ms. */
const BOSS_STAGGER_MS = 400;
/** Logs the Ghost King reaches take this many hits. */
const BOSS_LOG_DAMAGE = 2;
const BOSS_BONUS = 100;

type MultiplayerWorld = {
  wave: number;
  teamScore: number;
  leftLogHp: number;
  rightLogHp: number;
  ghosts: Array<{
    word: string;
    side: "left" | "right";
    x: number;
    y: number;
    frozen: boolean;
    boss?: { hp: number; maxHp: number };
  }>;
  finished: boolean;
  cleared: boolean;
  updatedAt: number;
};

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
  private bothSides = false;
  private multiplayerRole: "host" | "guest" | null = null;
  private lastWorldSnapshotAt = 0;
  private pendingRemoteWords = new Set<string>();
  private guestGhostTargets = new Map<string, { x: number; y: number }>();

  private ghostsThisWave = 0;
  private ghostsSpawned = 0;
  // Reserved spawns still waiting on a non-duplicate word (see
  // trySpawnGhostEntity) - counted separately from ghostsSpawned so
  // checkWaveComplete can't fire while one is still in flight.
  private pendingSpawns = 0;
  private betweenWaves = false;
  private isHordeWaveActive = false;
  private spawnTimer: Time.TimerEvent | null = null;
  private isBossWaveActive = false;

  private centerX = 0;
  private groundY = 0;
  private lawnTop = 0;
  private lawnBottom = 0;

  private playerY = 0;
  private facing: "left" | "right" = "right";
  private movingUp = false;
  private movingDown = false;
  private lastPlayerPositionEmitAt = 0;

  private leftLogHp = LOG_MAX_HP;
  private rightLogHp = LOG_MAX_HP;

  private powerUp: PowerUp | null = null;
  private powerUpTimer: Time.TimerEvent | null = null;
  private powerUpExpireTimer: Time.TimerEvent | null = null;
  private heldPowerUp: PowerUpKind | null = null;

  // PLACEHOLDER: player + log graphics — replace with sprites
  private playerGfx!: GameObjects.Graphics;
  private tappy!: TappyBuddy;
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
    this.isBossWaveActive = false;
    this.facing = "right";
    this.movingUp = false;
    this.movingDown = false;
    this.lastPlayerPositionEmitAt = 0;
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
    this.bothSides =
      (this.registry.get("bothSides") as boolean | undefined) ?? false;
    this.multiplayerRole =
      (this.registry.get("multiplayerRole") as "host" | "guest" | undefined) ??
      null;
    this.lastWorldSnapshotAt = 0;
    this.pendingRemoteWords.clear();
    this.guestGhostTargets.clear();
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
    this.tappy = new TappyBuddy(this, W * 0.12, this.groundY - 6, 50);

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
          if (this.multiplayerRole === "guest") {
            this.hits++;
            this.pendingRemoteWords.add(result.word);
            this.matcher.unregister(result.word);
            this.game.events.emit("multiplayer-word-action", result.word);
          } else {
            this.onGhostDestroyed(result.word);
          }
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
    if (this.multiplayerRole !== "guest") {
      this.startWave();
      if (this.multiplayerRole === null && this.maxWave === 0) {
        this.schedulePowerUpSpawn();
      }
    }
    this.game.events.on(
      "multiplayer-remote-action",
      (action: { uid: string; word: string }) => {
        if (this.multiplayerRole === "host") {
          this.onGhostDestroyed(action.word, action.uid);
        }
      },
    );
    this.game.events.on(
      "multiplayer-world-snapshot",
      (world: MultiplayerWorld) => {
        if (this.multiplayerRole === "guest") this.applyWorldSnapshot(world);
      },
    );
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

    if (time - this.lastPlayerPositionEmitAt >= 100) {
      this.lastPlayerPositionEmitAt = time;
      const range = Math.max(1, this.lawnBottom - this.lawnTop);
      this.game.events.emit("multiplayer-player-position", {
        position: (this.playerY - this.lawnTop) / range,
        facing: this.facing,
      });
    }

    if (this.multiplayerRole === "guest") {
      const smoothing = 1 - Math.exp(-12 * dt);
      for (const ghost of this.ghosts) {
        const target = this.guestGhostTargets.get(ghost.word);
        if (target === undefined) continue;
        ghost.x += (target.x - ghost.x) * smoothing;
        ghost.y += (target.y - ghost.y) * smoothing;
      }
      this.refreshTargeting();
      return;
    }

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
      if (ghost.staggeredUntil > this.time.now) continue; // Ghost King reeling from a hit
      const step =
        (ghost.boss === null ? speed : speed * BOSS_SPEED_FACTOR) * dt;
      ghost.x += ghost.side === "left" ? step : -step;
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

    if (
      this.multiplayerRole === "host" &&
      time - this.lastWorldSnapshotAt >= WORLD_SNAPSHOT_INTERVAL_MS
    ) {
      this.lastWorldSnapshotAt = time;
      this.emitWorldSnapshot(false, false);
    }
  }

  /** Friendly spooky night: moon, stars, bats, a haunted house and fog. */
  private drawBackground(W: number, H: number): void {
    const sky = this.add.graphics();
    sky.fillGradientStyle(
      hex("night"),
      hex("night"),
      hex("dusk"),
      hex("dusk"),
      1,
    );
    sky.fillRect(0, 0, W, H);

    const stars = this.add.graphics();
    stars.fillStyle(hex("cream"), 0.8);
    for (let i = 0; i < 50; i++) {
      stars.fillCircle(
        Math.random() * W,
        Math.random() * H * 0.55,
        Math.random() < 0.3 ? 2 : 1.2,
      );
    }

    const moonX = W * 0.8;
    const moonY = Math.max(200, H * 0.22);
    const moon = this.add.graphics();
    moon.fillStyle(hex("cream"), 0.18);
    moon.fillCircle(moonX, moonY, 64);
    moon.fillStyle(hex("cream"), 1);
    moon.fillCircle(moonX, moonY, 40);
    moon.fillStyle(hex("tan"), 0.8);
    moon.fillCircle(moonX - 12, moonY - 8, 8);
    moon.fillCircle(moonX + 14, moonY + 10, 6);
    moon.fillCircle(moonX + 4, moonY - 18, 4);

    // haunted house + spooky trees on the hill behind the fence
    const hill = this.add.graphics();
    hill.fillStyle(0x2f2463, 1);
    hill.fillEllipse(W * 0.3, this.groundY + 10, W * 1.1, 150);
    hill.fillEllipse(W * 0.85, this.groundY + 14, W * 0.9, 110);
    this.add
      .image(W * 0.3, this.groundY - 30, "gh-house")
      .setDisplaySize(170, 110)
      .setOrigin(0.5, 1);

    // bats flapping across the sky
    for (let i = 0; i < 3; i++) {
      const bat = this.add
        .image(-40, H * (0.12 + i * 0.1), "gh-bat")
        .setDisplaySize(36, 18);
      this.tweens.add({
        targets: bat,
        x: W + 40,
        duration: 9000 + i * 3000,
        delay: i * 2500,
        repeat: -1,
      });
      this.tweens.add({
        targets: bat,
        scaleY: bat.scaleY * 0.4,
        duration: 160,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** Picket fence, night lawn, pumpkins and drifting fog. */
  private drawGround(W: number, H: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x3f7a4c, 1);
    g.fillRect(0, this.groundY + 6, W, H - this.groundY - 6);
    g.fillStyle(0x4f8f5a, 1);
    for (let x = 20; x < W; x += 70) {
      g.fillEllipse(x, this.groundY + 40 + ((x * 13) % 60), 26, 8);
    }

    // picket fence
    g.fillStyle(hex("tan"), 1);
    g.fillRect(0, this.groundY - 16, W, 6);
    g.fillRect(0, this.groundY - 2, W, 5);
    for (let x = 4; x < W; x += 30) {
      g.fillRect(x, this.groundY - 28, 12, 34);
      g.fillTriangle(
        x,
        this.groundY - 28,
        x + 12,
        this.groundY - 28,
        x + 6,
        this.groundY - 36,
      );
    }

    for (const fx of [0.04, 0.96]) {
      this.add
        .image(W * fx, this.groundY + 26, "gh-pumpkin")
        .setDisplaySize(40, 37);
    }

    for (let i = 0; i < 4; i++) {
      const fog = this.add
        .image(W * (i / 3), this.groundY + 8, "gh-fog")
        .setDisplaySize(W * 0.6, 70)
        .setAlpha(0.14);
      this.tweens.add({
        targets: fog,
        x: fog.x + 60,
        duration: 6000 + i * 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private redrawLogs(): void {
    this.drawLog(this.leftLogGfx, this.centerX - LOG_X_OFFSET, this.leftLogHp);
    this.drawLog(
      this.rightLogGfx,
      this.centerX + LOG_X_OFFSET,
      this.rightLogHp,
    );
  }

  /** A stacked-log barricade; glowing dots show how many hits it has left. */
  private drawLog(g: GameObjects.Graphics, x: number, hp: number): void {
    g.clear();
    // Spans nearly the full grass depth (not just the thin patrol band) so it
    // reads as a real barrier rather than a short fence post.
    const top = this.groundY + 15;
    const bottom = this.scale.height - 20;
    const broken = hp <= 0;

    g.fillStyle(hex("brownDark"), broken ? 0.3 : 1);
    g.fillRoundedRect(x - 13, top + 4, 26, bottom - top, 10);
    g.fillStyle(hex("brown"), broken ? 0.3 : 1);
    g.fillRoundedRect(x - 13, top, 26, bottom - top - 4, 10);
    if (!broken) {
      g.fillStyle(hex("tan"), 1);
      g.fillEllipse(x, top + 8, 18, 10);
      g.lineStyle(2, hex("brownDark"), 0.6);
      g.strokeEllipse(x, top + 8, 10, 5);
      for (let i = 0; i < LOG_MAX_HP; i++) {
        const notchY =
          top + 30 + i * ((bottom - top - 50) / Math.max(1, LOG_MAX_HP - 1));
        g.fillStyle(i < hp ? hex("yellow") : hex("brownDark"), 1);
        g.fillCircle(x, notchY, 4.5);
      }
    }
  }

  // Player body - the kid's avatar (DOM, see GhostHunterModal) sits on the head.
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
    // flashlight glow in the faced direction
    g.fillStyle(hex("yellow"), 0.18);
    g.fillTriangle(
      cx + dir * 34,
      gy - 40,
      cx + dir * 120,
      gy - 74,
      cx + dir * 120,
      gy - 6,
    );
    // backpack
    g.fillStyle(hex("grey"), 1);
    g.fillRoundedRect(cx - dir * 18 - 7, gy - 44, 14, 24, 5);
    // body (raincoat)
    g.fillStyle(hex("yellow"), 1);
    g.fillRoundedRect(cx - 13, gy - 44, 26, 34, 10);
    g.fillStyle(hex("orange"), 1);
    g.fillRect(cx - 1, gy - 42, 2, 30);
    // head (under the avatar)
    g.fillStyle(hex("tan"), 1);
    g.fillCircle(cx, gy - 52, 13);
    // flashlight
    g.fillStyle(hex("navy"), 1);
    g.fillRoundedRect(cx + dir * 14 - (dir < 0 ? 18 : 0), gy - 38, 18, 8, 3);
    g.fillStyle(hex("cream"), 1);
    g.fillCircle(cx + dir * 34, gy - 34, 4);
    // boots
    g.fillStyle(hex("red"), 1);
    g.fillRoundedRect(cx - 11, gy - 12, 10, 12, 3);
    g.fillRoundedRect(cx + 1, gy - 12, 10, 12, 3);
  }

  /** A flash of light from the player to a ghost being caught. */
  private beam(x: number, y: number): void {
    const dir = x < this.centerX ? -1 : 1;
    const fx = this.centerX + dir * 34;
    const fy = this.playerY - 34;
    const g = this.add.graphics();
    g.lineStyle(14, hex("yellow"), 0.35);
    g.lineBetween(fx, fy, x, y);
    g.lineStyle(5, hex("cream"), 0.95);
    g.lineBetween(fx, fy, x, y);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 260,
      onComplete: () => g.destroy(),
    });
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
        // TNT clears the little ghosts - the Ghost King has to be typed
        if (ghost === undefined || ghost.boss !== null) continue;
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
        !this.pendingRemoteWords.has(ghost.word) &&
        (this.bothSides || ghost.side === this.facing) &&
        (ghost.boss !== null ||
          Math.abs(ghost.y - this.playerY) <= this.targetYRange);
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

  /** Lesson checkpoints (solo, fixed short length) never get the boss. */
  private isBossWave(wave: number): boolean {
    const lesson = this.multiplayerRole === null && this.maxWave > 0;
    return !lesson && wave % BOSS_EVERY === 0;
  }

  /** Hits the Ghost King takes: more each time he comes back, and on harder levels. */
  private bossMaxHp(): number {
    return (
      3 +
      Math.floor(this.wave / BOSS_EVERY) +
      Math.ceil(this.perWaveBase / 2) +
      (this.multiplayerRole !== null ? 3 : 0)
    );
  }

  /** The boss wave: the Ghost King plus a few normal ghosts. */
  private startBossWave(): void {
    this.isHordeWaveActive = false;
    this.isBossWaveActive = true;
    // the Ghost King counts as one of this wave's ghosts
    this.ghostsThisWave = this.perWaveBase + 1;
    this.ghostsSpawned = 1;
    this.pendingSpawns = 0;
    this.betweenWaves = false;
    this.game.events.emit("ui-wave", this.wave);
    const side: "left" | "right" = Math.random() < 0.5 ? "left" : "right";
    const W = this.scale.width;
    const hp = this.bossMaxHp();
    this.spawnBoss(side, side === "left" ? -50 : W + 50, hp, hp);
    this.spawnTimer = this.time.addEvent({
      delay: 4000,
      callback: this.spawnGhost,
      callbackScope: this,
      repeat: this.ghostsThisWave - 2,
    });
  }

  private spawnBoss(
    side: "left" | "right",
    x: number,
    hp: number,
    maxHp: number,
  ): Ghost {
    const active = new Set(this.ghosts.map((g) => g.word));
    const word = this.tryNextWord(active) ?? "boo";
    const y = (this.lawnTop + this.lawnBottom) / 2;
    const ghost = new Ghost(this, x, y, word, side, { hp, maxHp });
    this.ghosts.push(ghost);
    return ghost;
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

  private onGhostDestroyed(word: string, playerUid?: string): void {
    const idx = this.ghosts.findIndex((g) => g.word === word);
    if (idx === -1) return;
    const ghost = this.ghosts[idx] as Ghost;

    this.hits++;
    this.streak++;
    const points = 10 + word.length * 2 + this.streak;
    this.score += points;
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);
    playExplode();
    this.tappy.cheer();

    this.beam(ghost.x, ghost.y - 30);
    this.poof(ghost.x, ghost.y - 30);
    ghost.destroy();
    this.ghosts.splice(idx, 1);
    if (ghost.boss !== null) {
      if (ghost.boss.hp > 1) {
        // knocked back - and a new word to type
        const W = this.scale.width;
        const x =
          ghost.side === "left"
            ? Math.max(-50, ghost.x - BOSS_KNOCKBACK)
            : Math.min(W + 50, ghost.x + BOSS_KNOCKBACK);
        const king = this.spawnBoss(
          ghost.side,
          x,
          ghost.boss.hp - 1,
          ghost.boss.maxHp,
        );
        king.staggeredUntil = this.time.now + BOSS_STAGGER_MS;
        this.cameras.main.shake(120, 0.006);
      } else {
        this.score += BOSS_BONUS;
        this.game.events.emit("ui-score", this.score);
        this.cameras.main.flash(300, 255, 210, 63, false);
        this.cameras.main.shake(300, 0.015);
        playBombExplode();
      }
    }
    if (this.multiplayerRole === "host") {
      this.game.events.emit("multiplayer-player-award", {
        uid: playerUid,
        points,
        wave: this.wave,
      });
      this.emitWorldSnapshot(false, false);
    }
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
    const damage = ghost.boss === null ? 1 : BOSS_LOG_DAMAGE;
    if (ghost.boss !== null) {
      // the Ghost King bounces off the log and comes again
      const W = this.scale.width;
      this.spawnBoss(
        ghost.side,
        ghost.side === "left" ? -50 : W + 50,
        ghost.boss.hp,
        ghost.boss.maxHp,
      );
    }

    if (ghost.side === "left") {
      this.leftLogHp = Math.max(0, this.leftLogHp - damage);
      this.game.events.emit("ui-log-left", this.leftLogHp);
    } else {
      this.rightLogHp = Math.max(0, this.rightLogHp - damage);
      this.game.events.emit("ui-log-right", this.rightLogHp);
    }
    this.redrawLogs();
    this.tappy.sad();
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
    if (this.multiplayerRole === "host") {
      this.emitWorldSnapshot(true, false);
    }
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

      const lastWave = this.maxWave > 0 && this.wave >= this.maxWave;
      const nextIsBoss = !lastWave && this.isBossWave(this.wave + 1);
      const horde = !nextIsBoss && this.isHordeWave(this.wave);
      const beatBoss = this.isBossWaveActive;
      this.isBossWaveActive = false;

      if (nextIsBoss) {
        popBanner(
          this,
          W / 2,
          H / 2,
          "👑 The Ghost King is coming!",
          "purple",
          WAVE_PAUSE_MS,
        );
        this.cameras.main.flash(300, 80, 0, 120, false);
        playHordeIncoming();
      } else if (horde) {
        // Horde incoming — show warning, then unleash
        popBanner(
          this,
          W / 2,
          H / 2,
          "👻 Ghost party coming!",
          "purple",
          WAVE_PAUSE_MS,
        );
        this.cameras.main.flash(300, 80, 0, 120, false);
        playHordeIncoming();
      } else {
        this.tappy.cheer();
        popBanner(
          this,
          W / 2,
          H / 2,
          beatBoss ? "Ghost King defeated! 👑" : `Wave ${this.wave} clear! 👻`,
          beatBoss ? "yellow" : "green",
          WAVE_PAUSE_MS,
        );
      }

      this.time.delayedCall(WAVE_PAUSE_MS, () => {
        if (lastWave) {
          playGameOver();
          if (this.multiplayerRole === "host") {
            this.gameOver = true;
            this.emitWorldSnapshot(true, true);
          }
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
        if (nextIsBoss) this.startBossWave();
        else if (horde) this.startHordeWave();
        else this.startWave();
      });
    }
  }

  private poof(x: number, y: number): void {
    const particles = this.add.particles(x, y, "gh-sparkle", {
      lifespan: 550,
      speed: { min: 50, max: 140 },
      scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 180 },
      quantity: 10,
      tint: [hex("yellow"), hex("cream"), hex("mint"), hex("pink")],
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

  private emitWorldSnapshot(finished: boolean, cleared: boolean): void {
    if (this.multiplayerRole !== "host") return;
    const width = Math.max(1, this.scale.width);
    const lawnRange = Math.max(1, this.lawnBottom - this.lawnTop);
    const world: MultiplayerWorld = {
      wave: this.wave,
      teamScore: this.score,
      leftLogHp: this.leftLogHp,
      rightLogHp: this.rightLogHp,
      ghosts: this.ghosts.map((ghost) => ({
        word: ghost.word,
        side: ghost.side,
        x: ghost.x / width,
        y: (ghost.y - this.lawnTop) / lawnRange,
        frozen: ghost.isFrozen(),
        ...(ghost.boss === null ? {} : { boss: ghost.boss }),
      })),
      finished,
      cleared,
      updatedAt: Date.now(),
    };
    this.game.events.emit("multiplayer-world-out", world);
  }

  private applyWorldSnapshot(world: MultiplayerWorld): void {
    if (this.gameOver) return;
    const incoming = new Map(world.ghosts.map((ghost) => [ghost.word, ghost]));
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const ghost = this.ghosts[i];
      if (ghost === undefined || incoming.has(ghost.word)) continue;
      this.matcher.unregister(ghost.word);
      this.guestGhostTargets.delete(ghost.word);
      ghost.destroy();
      this.ghosts.splice(i, 1);
    }
    const width = this.scale.width;
    const lawnRange = Math.max(1, this.lawnBottom - this.lawnTop);
    for (const state of world.ghosts) {
      let ghost = this.ghosts.find(
        (candidate) => candidate.word === state.word,
      );
      if (ghost === undefined) {
        ghost = new Ghost(
          this,
          state.x * width,
          this.lawnTop + state.y * lawnRange,
          state.word,
          state.side,
          state.boss ?? null,
        );
        this.ghosts.push(ghost);
      }
      this.guestGhostTargets.set(state.word, {
        x: state.x * width,
        y: this.lawnTop + state.y * lawnRange,
      });
      ghost.setFrozen(state.frozen);
    }
    for (const word of this.pendingRemoteWords) {
      if (!incoming.has(word)) this.pendingRemoteWords.delete(word);
    }
    this.wave = world.wave;
    this.score = world.teamScore;
    this.leftLogHp = world.leftLogHp;
    this.rightLogHp = world.rightLogHp;
    this.redrawLogs();
    this.game.events.emit("ui-wave", this.wave);
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-log-left", this.leftLogHp);
    this.game.events.emit("ui-log-right", this.rightLogHp);
    this.refreshTargeting();

    if (world.finished) {
      this.gameOver = true;
      this.time.delayedCall(250, () => {
        this.scene.stop("UI");
        this.scene.start("GameOver", {
          score: this.score,
          wave: this.wave,
          hits: this.hits,
          misses: this.misses,
          cleared: world.cleared,
        });
      });
    }
  }

  shutdown(): void {
    this.spawnTimer?.remove();
    this.powerUpTimer?.remove();
    this.powerUpExpireTimer?.remove();
    this.matcher?.clear();
    this.input.keyboard?.removeAllListeners();
    this.game.events.off("multiplayer-remote-action");
    this.game.events.off("multiplayer-world-snapshot");
  }
}

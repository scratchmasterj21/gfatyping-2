import { Scene, Time } from "phaser";

import { Target, TargetKind } from "../entities/Target";
import {
  playPop,
  playGameOver,
  playMiss,
  playWaveClear,
} from "../../shared/sounds";
import { WordMatcher } from "../../word-defender/systems/word-matcher";
import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

type Cell = { x: number; y: number; target: Target | null; refilling: boolean };

const ROWS = 3;
// Long enough that camping/spamming one cell isn't the fastest strategy -
// students have to actually scan the other cells instead of ignoring them.
const REFILL_DELAY_MS = 2200;

// Fixed words (not drawn from the lesson word list) for the special target
// kinds, same convention as the other games' power-up pickups.
const SPECIAL_WORDS: Record<Exclude<TargetKind, "normal">, string> = {
  bonusTime: "time",
  doublePoints: "double",
  trap: "trap",
};
const TRAP_CHANCE = 0.1;
const BONUS_TIME_CHANCE = 0.05;
const DOUBLE_POINTS_CHANCE = 0.08;
const BONUS_TIME_SECONDS = 4;
const TRAP_TIME_PENALTY = 5;
const DOUBLE_POINTS_DURATION_MS = 8000;
const SHUFFLE_INTERVAL_MS = 22000;

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private cells: Cell[] = [];
  private matcher!: WordMatcher;
  private lockedWord: string | null = null;

  private score = 0;
  private wordsTyped = 0;
  private hits = 0;
  private misses = 0;
  private totalChars = 0;
  private streak = 0;
  private gameOver = false;

  private cols = 3;
  private totalTime = 60;
  private timeLeft = 60;
  private lastSecond = -1;

  private targetW = 0;
  private targetH = 0;
  private fontSize = 16;
  private typeCounter = 0;

  private doublePointsUntil = 0;
  private shuffleTimer: Time.TimerEvent | null = null;

  // unused but kept for shutdown typing
  private _spawnTimer: Time.TimerEvent | null = null;

  constructor() {
    super({ key: "Game" });
  }

  init(): void {
    const stored = this.registry.get("words") as string[] | undefined;
    this.words =
      stored !== undefined && stored.length > 0
        ? stored
        : ["type", "fast", "duck", "shelf", "score"];
    this.wordPool = shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.cells = [];
    this.lockedWord = null;
    this.gameOver = false;
    this.score = 0;
    this.wordsTyped = 0;
    this.hits = 0;
    this.misses = 0;
    this.totalChars = 0;
    this.streak = 0;
    this.typeCounter = 0;
    this.doublePointsUntil = 0;
    this.cols = (this.registry.get("cols") as number | undefined) ?? 3;
    this.totalTime = (this.registry.get("time") as number | undefined) ?? 60;
    this.timeLeft = this.totalTime;
    this.lastSecond = -1;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.drawBackground(W, H);
    this.computeLayout(W, H);

    this.matcher = new WordMatcher((buf, locked) => {
      this.lockedWord = locked;
      for (const cell of this.cells) {
        if (cell.target !== null) {
          cell.target.updateTyped(cell.target.word === locked ? buf : "");
          cell.target.setHighlighted(cell.target.word === locked);
        }
      }
      this.game.events.emit("ui-buffer", buf, locked);
    });

    this.createGrid(W, H);

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.gameOver || e.repeat) return;
      const char =
        e.key.length === 1 ? e.key : e.key === "Backspace" ? "Backspace" : null;
      if (char === null) return;
      // Let a special target (time/double/trap) interrupt a definite lock
      // on a DIFFERENT word once that lock is confirmed dead (this key
      // wouldn't continue it anyway) - never while it's still valid
      // progress, or this would wrongly abort real words like "had" right
      // on their last letter just because some active word starts the same
      // as an unrelated special. See WordMatcher.releaseLock()'s doc comment.
      if (char !== "Backspace") {
        const locked = this.matcher.getLockedWord();
        const wouldStayValid =
          locked !== null && locked.startsWith(this.matcher.getBuffer() + char);
        if (locked !== null && !wouldStayValid) {
          const interruptible = this.cells.find(
            (c) =>
              c.target !== null &&
              c.target.kind !== "normal" &&
              c.target.word.startsWith(char),
          );
          if (interruptible !== undefined) {
            this.matcher.releaseLock();
          }
        }
      }
      const result = this.matcher.handleKey(char);
      if (result.status === "complete") {
        this.onWordComplete(result.word);
      } else if (result.status === "miss") {
        this.onMiss();
      }
    });

    this.scene.launch("UI");
    this.emitUI();

    this.shuffleTimer = this.time.addEvent({
      delay: SHUFFLE_INTERVAL_MS,
      loop: true,
      callback: this.shuffleGrid,
      callbackScope: this,
    });
  }

  override update(_time: number, delta: number): void {
    if (this.gameOver) return;
    this.timeLeft = Math.max(0, this.timeLeft - delta / 1000);
    const seconds = Math.ceil(this.timeLeft);
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      this.game.events.emit("ui-timer", seconds, this.totalTime);
    }
    if (this.timeLeft <= 0) {
      this.endGame();
    }
  }

  // PLACEHOLDER: carnival curtain background
  // ASSETS: replace with this.add.image(W/2, H/2, "tt-bg").setDisplaySize(W, H)
  private drawBackground(W: number, H: number): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xb5651d, 0xb5651d, 0xd4a574, 0xd4a574, 1);
    bg.fillRect(0, 0, W, H);

    // Sunburst rays from center
    const cx = W / 2;
    const cy = H * 0.55;
    const rays = this.add.graphics();
    rays.fillStyle(0xc87941, 0.35);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const a2 = ((i + 0.4) / 12) * Math.PI * 2;
      const r = Math.max(W, H) * 1.2;
      rays.fillTriangle(
        cx,
        cy,
        cx + Math.cos(a) * r,
        cy + Math.sin(a) * r,
        cx + Math.cos(a2) * r,
        cy + Math.sin(a2) * r,
      );
    }

    // Red curtain strips on sides
    const curtain = this.add.graphics();
    curtain.fillStyle(0xcc2200, 0.88);
    curtain.fillRect(0, 0, W * 0.1, H);
    curtain.fillRect(W * 0.9, 0, W * 0.1, H);

    // Gold stars on curtains
    const stars = this.add.graphics();
    stars.fillStyle(0xffd700, 1);
    const positions = [
      [W * 0.05, H * 0.15],
      [W * 0.05, H * 0.4],
      [W * 0.05, H * 0.65],
      [W * 0.95, H * 0.15],
      [W * 0.95, H * 0.4],
      [W * 0.95, H * 0.65],
    ];
    for (const [sx, sy] of positions) {
      if (sx !== undefined && sy !== undefined) {
        stars.fillCircle(sx, sy, 7);
      }
    }
  }

  private computeLayout(W: number, H: number): void {
    const playW = W * 0.82;
    const rowH = (H * 0.74) / ROWS;
    this.targetW = (playW / this.cols) * 0.84;
    this.targetH = rowH * 0.62;
    this.fontSize = this.cols <= 2 ? 18 : this.cols === 3 ? 16 : 13;
  }

  private createGrid(W: number, H: number): void {
    const playW = W * 0.82;
    const playX = (W - playW) / 2;
    const cellW = playW / this.cols;
    const startY = H * 0.18;
    const rowH = (H * 0.74) / ROWS;

    for (let row = 0; row < ROWS; row++) {
      const cellY = startY + rowH * row + rowH * 0.44;
      const shelfY = startY + rowH * (row + 1) - rowH * 0.1;
      this.drawShelf(playX, shelfY, playW);

      for (let col = 0; col < this.cols; col++) {
        const x = playX + cellW * col + cellW / 2;
        const cell: Cell = { x, y: cellY, target: null, refilling: false };
        this.cells.push(cell);
        // Start the grid all-normal so the player isn't hit with a special
        // target before they've even seen how the game works.
        this.spawnTarget(cell, true, true);
      }
    }
  }

  // PLACEHOLDER: wooden shelf plank
  // ASSETS: replace with this.add.image(x + w/2, y, "shelf").setDisplaySize(w, 14)
  private drawShelf(x: number, y: number, w: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(x, y - 7, w, 14);
    g.lineStyle(1.5, 0x5c3317, 0.9);
    g.lineBetween(x, y - 7, x + w, y - 7);
    g.lineStyle(1, 0xc4843c, 0.5);
    g.lineBetween(x, y, x + w, y);
  }

  private pickTargetKind(): TargetKind {
    const r = Math.random();
    if (r < TRAP_CHANCE) return "trap";
    if (r < TRAP_CHANCE + BONUS_TIME_CHANCE) return "bonusTime";
    if (r < TRAP_CHANCE + BONUS_TIME_CHANCE + DOUBLE_POINTS_CHANCE) {
      return "doublePoints";
    }
    return "normal";
  }

  private spawnTarget(cell: Cell, instant: boolean, forceNormal = false): void {
    if (cell.target !== null) {
      // Defensive: a stale delayed refill racing a grid shuffle could
      // otherwise overwrite cell.target without destroying what's there,
      // orphaning an undestroyed target on screen forever.
      this.matcher.unregister(cell.target.word);
      cell.target.destroy();
      cell.target = null;
    }
    const activeWords = new Set<string>();
    for (const c of this.cells) {
      if (c !== cell && c.target !== null) activeWords.add(c.target.word);
    }
    let kind: TargetKind = forceNormal ? "normal" : this.pickTargetKind();
    if (kind !== "normal" && activeWords.has(SPECIAL_WORDS[kind])) {
      // That special word is already showing on another shelf - falling
      // back to normal instead of registering a second, effectively-dead
      // copy of the same word (only one can ever be typeable at once).
      kind = "normal";
    }

    let word: string | null;
    if (kind === "normal") {
      word = this.tryNextWord(activeWords);
      if (word === null) {
        // Every unique word in the pool is already active on another shelf
        // (small vocabulary + many cells, e.g. right after a shuffle) -
        // leave this cell empty and retry shortly rather than duplicating
        // a word, which would silently strand the second copy untypeable
        // once the first gets cleared elsewhere.
        cell.target = null;
        this.time.delayedCall(400, () => {
          if (!this.gameOver && cell.target === null && !cell.refilling) {
            this.spawnTarget(cell, false, forceNormal);
          }
        });
        return;
      }
    } else {
      word = SPECIAL_WORDS[kind];
    }

    const typeIdx = this.typeCounter % 5;
    this.typeCounter++;

    const startY = instant ? cell.y : cell.y - 55;
    const target = new Target(
      this,
      cell.x,
      startY,
      word,
      this.targetW,
      this.targetH,
      this.fontSize,
      typeIdx,
      kind,
    );
    cell.target = target;
    this.matcher.register(word);

    if (!instant) {
      this.tweens.add({
        targets: target,
        y: cell.y,
        duration: 220,
        ease: "Back.Out",
      });
    }
  }

  /** Returns null (rather than silently returning a duplicate) if every unique word in the pool is already active elsewhere. */
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

  private isDoublePointsActive(): boolean {
    return this.time.now < this.doublePointsUntil;
  }

  private onWordComplete(word: string): void {
    const cell = this.cells.find((c) => c.target?.word === word);
    if (cell === undefined) return;
    const target = cell.target;
    if (target === null) return;
    cell.target = null;

    if (target.kind === "trap") {
      this.onTrapPopped(target, cell);
      return;
    }

    this.hits++;
    this.streak++;
    this.wordsTyped++;
    this.totalChars += word.length;

    const scoreMult = this.multiplier() * (this.isDoublePointsActive() ? 2 : 1);
    this.score += word.length * scoreMult;
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", this.streak);

    if (target.kind === "bonusTime") {
      this.timeLeft += BONUS_TIME_SECONDS;
      this.totalTime += BONUS_TIME_SECONDS;
      this.game.events.emit(
        "ui-timer",
        Math.ceil(this.timeLeft),
        this.totalTime,
      );
      this.spawnFloatingText(
        target.x,
        target.y - 30,
        `+${BONUS_TIME_SECONDS}s`,
        "#44ee88",
      );
      playWaveClear();
    } else if (target.kind === "doublePoints") {
      this.doublePointsUntil = this.time.now + DOUBLE_POINTS_DURATION_MS;
      this.game.events.emit("ui-double-points", DOUBLE_POINTS_DURATION_MS);
      this.spawnFloatingText(target.x, target.y - 30, "2x!", "#e040fb");
      playWaveClear();
    } else if (this.streak === 5 || this.streak === 10) {
      playWaveClear();
    } else {
      playPop();
    }

    this.popAndRefill(target, cell);
  }

  private onTrapPopped(target: Target, cell: Cell): void {
    this.streak = 0;
    this.misses++;
    this.timeLeft = Math.max(0, this.timeLeft - TRAP_TIME_PENALTY);
    this.game.events.emit("ui-streak", 0);
    this.game.events.emit("ui-timer", Math.ceil(this.timeLeft), this.totalTime);
    this.spawnFloatingText(
      target.x,
      target.y - 30,
      `-${TRAP_TIME_PENALTY}s`,
      "#ff4444",
    );
    this.cameras.main.flash(180, 200, 0, 0);
    playMiss();
    this.popAndRefill(target, cell);
  }

  private popAndRefill(target: Target, cell: Cell): void {
    // Pop animation
    this.tweens.add({
      targets: target,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 200,
      ease: "Quad.Out",
      onComplete: () => target.destroy(),
    });

    // Particle burst
    const particles = this.add.particles(target.x, target.y, "tt-particle", {
      lifespan: 320,
      speed: { min: 30, max: 90 },
      scale: { start: 0.5, end: 0 },
      quantity: 7,
      blendMode: "ADD",
      emitting: false,
    });
    particles.explode(7);
    this.time.delayedCall(350, () => particles.destroy());

    // Delayed refill - also checks cell.target is still empty, since a grid
    // shuffle landing in this window can refill the cell itself first;
    // without that check this stale timer would spawn a second target on
    // top of it without destroying the first (an orphaned, undestroyed
    // "ghost" target stuck on screen).
    this.time.delayedCall(REFILL_DELAY_MS, () => {
      if (!this.gameOver && !cell.refilling && cell.target === null) {
        cell.refilling = true;
        this.spawnTarget(cell, false);
        cell.refilling = false;
      }
    });
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
  ): void {
    const t = this.add
      .text(x, y, text, {
        fontSize: "18px",
        fontFamily: "monospace",
        fontStyle: "bold",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 700,
      ease: "Quad.Out",
      onComplete: () => t.destroy(),
    });
  }

  /** Clears and instantly repopulates every shelf - a periodic burst of fresh targets. */
  private shuffleGrid(): void {
    if (this.gameOver) return;
    playWaveClear();

    const W = this.scale.width;
    const H = this.scale.height;
    const banner = this.add
      .text(W / 2, H * 0.42, "🔀 SHUFFLE!", {
        fontSize: "30px",
        fontFamily: "monospace",
        color: "#ffdd44",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: H * 0.42 - 30,
      duration: 900,
      onComplete: () => banner.destroy(),
    });

    for (const cell of this.cells) {
      if (cell.target !== null) {
        this.matcher.unregister(cell.target.word);
        cell.target.destroy();
        cell.target = null;
      }
      cell.refilling = true;
    }
    this.time.delayedCall(250, () => {
      if (this.gameOver) return;
      for (const cell of this.cells) {
        cell.refilling = false;
        this.spawnTarget(cell, false);
      }
    });
  }

  private onMiss(): void {
    this.streak = 0;
    this.misses++;
    this.game.events.emit("ui-streak", 0);
    playMiss();

    if (this.lockedWord !== null) {
      const cell = this.cells.find((c) => c.target?.word === this.lockedWord);
      cell?.target?.flashRed();
    }
  }

  private multiplier(): number {
    if (this.streak >= 10) return 3;
    if (this.streak >= 5) return 2;
    return 1;
  }

  private endGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.shuffleTimer?.remove();
    this.matcher.clear();
    playGameOver();
    this.time.delayedCall(300, () => {
      this.scene.stop("UI");
      this.scene.start("GameOver", {
        score: this.score,
        wordsTyped: this.wordsTyped,
        hits: this.hits,
        misses: this.misses,
        totalChars: this.totalChars,
        totalTime: this.totalTime,
      });
    });
  }

  private emitUI(): void {
    this.game.events.emit("ui-score", this.score);
    this.game.events.emit("ui-streak", 0);
    this.game.events.emit("ui-timer", this.totalTime, this.totalTime);
  }

  shutdown(): void {
    this._spawnTimer?.remove();
    this.shuffleTimer?.remove();
    this.matcher?.clear();
    this.input.keyboard?.removeAllListeners();
  }
}

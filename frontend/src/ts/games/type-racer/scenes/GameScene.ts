import { Scene, GameObjects, Structs } from "phaser";

import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

const QUEUE_SIZE = 12;
const COUNTDOWN_MS = 3000;

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private wordQueue: string[] = []; // current word is [0], upcoming are [1..N]
  private completedWordHistory: string[] = [];
  private typedBuffer = "";
  private goodPrefix = 0;
  private completedChars = 0;
  private mistakes = 0;
  private wordCount = 0;
  private startTime = 0;
  private raceOver = false;
  private raceStarted = false;
  private countdownEndsAt = 0;
  private durationSec = 60;
  private raceChars = 100;
  private playerWobbleMs = 0;
  private boostMs = 0;
  private lastProgressEmitAt = 0;
  private multiplayer = false;
  private opponentName = "CPU";

  private cpuFinishSec = 96;
  private playerProgress = 0;
  private visualPlayerProgress = 0;
  private furthestTypingProgress = 0;
  private playerVelocity = 0;
  private cpuProgress = 0;

  private trackG!: GameObjects.Graphics;
  private playerCarG!: GameObjects.Graphics;
  private cpuCarG!: GameObjects.Graphics;
  private typedText!: GameObjects.Text;
  private wrongText!: GameObjects.Text;
  private remainText!: GameObjects.Text;
  private upcomingText!: GameObjects.Text;
  private futureText!: GameObjects.Text;
  private historyText!: GameObjects.Text;
  private caretRect!: GameObjects.Rectangle;
  private wpmText!: GameObjects.Text;
  private wordCountText!: GameObjects.Text;
  private cpuLabel!: GameObjects.Text;
  private youLabel!: GameObjects.Text;
  private countdownText!: GameObjects.Text;
  private timerText!: GameObjects.Text;
  private positionText!: GameObjects.Text;

  private spaceErrorMs = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private resizeHandler: ((size: Structs.Size) => void) | null = null;

  constructor() {
    super({ key: "Game" });
  }

  init(): void {
    const stored = this.registry.get("words") as string[] | undefined;
    this.words =
      stored !== undefined && stored.length > 0
        ? stored
        : ["type", "race", "fast", "win"];
    const cpuWpm = (this.registry.get("cpuWpm") as number | undefined) ?? 35;
    this.durationSec =
      (this.registry.get("durationSec") as number | undefined) ?? 60;
    this.multiplayer = this.registry.get("multiplayer") === true;
    this.raceChars =
      (this.registry.get("targetChars") as number | undefined) ??
      Math.max(40, Math.round((cpuWpm * 5 * this.durationSec) / 60));
    this.cpuFinishSec = this.durationSec;
    this.wordPool = this.multiplayer
      ? [...this.words]
      : shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.wordQueue = [];
    for (let i = 0; i < QUEUE_SIZE; i++) this.wordQueue.push(this.popWord());
    this.typedBuffer = "";
    this.completedWordHistory = [];
    this.goodPrefix = 0;
    this.completedChars = 0;
    this.mistakes = 0;
    this.wordCount = 0;
    this.raceOver = false;
    this.raceStarted = false;
    this.playerProgress = 0;
    this.visualPlayerProgress = 0;
    this.furthestTypingProgress = 0;
    this.playerVelocity = 0;
    this.cpuProgress = 0;
    this.spaceErrorMs = 0;
    this.playerWobbleMs = 0;
    this.boostMs = 0;
    this.lastProgressEmitAt = 0;
  }

  private get currentWord(): string {
    return this.wordQueue[0] as string;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.events.once("shutdown", this.shutdown, this);
    this.game.events.emit("type-racer-race-active", true);
    this.game.events.on(
      "type-racer-opponent",
      (opponent: { name: string; progress: number }) => {
        this.opponentName = opponent.name;
        this.cpuProgress = Math.max(0, Math.min(1, opponent.progress));
        this.cpuLabel.setText(this.opponentName);
      },
    );

    this.trackG = this.add.graphics();
    this.playerCarG = this.add.graphics();
    this.cpuCarG = this.add.graphics();

    this.cpuLabel = this.add
      .text(0, 0, "CPU", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#cc6655",
      })
      .setOrigin(0.5);
    this.youLabel = this.add
      .text(0, 0, "YOU", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#4477cc",
      })
      .setOrigin(0.5);

    this.drawTrack(W, H);
    this.drawCars(W, H);

    const base = { fontSize: "30px", fontFamily: "monospace" };
    this.historyText = this.add
      .text(0, 0, "", { ...base, color: "#555568", maxLines: 1 })
      .setOrigin(0, 0.5);
    this.typedText = this.add
      .text(0, 0, "", { ...base, color: "#66ee88" })
      .setOrigin(0, 0.5);
    this.wrongText = this.add
      .text(0, 0, "", { ...base, color: "#ff5555", backgroundColor: "#330000" })
      .setOrigin(0, 0.5);
    this.remainText = this.add
      .text(0, 0, this.currentWord, { ...base, color: "#cccccc" })
      .setOrigin(0, 0.5);
    this.upcomingText = this.add
      .text(0, 0, "", { ...base, color: "#77778a", maxLines: 1 })
      .setOrigin(0, 0.5);
    this.futureText = this.add
      .text(0, 0, "", { ...base, color: "#77778a", maxLines: 1 })
      .setOrigin(0, 0.5);
    this.caretRect = this.add
      .rectangle(0, 0, 3, 36, 0xffffff)
      .setOrigin(0, 0.5);

    this.wpmText = this.add
      .text(0, 0, "WPM: —", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#666677",
      })
      .setOrigin(0, 1);
    this.wordCountText = this.add
      .text(0, 0, "Word 1", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#666677",
      })
      .setOrigin(1, 1);
    this.timerText = this.add
      .text(0, 0, `${this.durationSec}s`, {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#ffdd66",
      })
      .setOrigin(0.5, 0);
    this.positionText = this.add
      .text(0, 0, "NECK AND NECK", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#cccccc",
      })
      .setOrigin(0.5, 0);
    this.countdownText = this.add
      .text(W / 2, H / 2, "3", {
        fontSize: "64px",
        fontFamily: "monospace",
        fontStyle: "bold",
        color: "#ffdd44",
        stroke: "#111122",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.positionAll(W, H);
    this.refreshWordDisplay();
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === " ") e.preventDefault();
      this.onKeyDown(e);
    };
    document.addEventListener("keydown", this.keydownHandler);

    this.resizeHandler = (size: Structs.Size) => {
      this.drawTrack(size.width, size.height);
      this.drawCars(size.width, size.height);
      this.positionAll(size.width, size.height);
    };
    this.scale.on("resize", this.resizeHandler);

    this.countdownEndsAt = performance.now() + COUNTDOWN_MS;
  }

  override update(_time: number, delta: number): void {
    if (this.raceOver) return;

    const now = performance.now();
    if (!this.raceStarted) {
      const remaining = this.countdownEndsAt - now;
      if (remaining > 0) {
        this.countdownText.setText(`${Math.ceil(remaining / 1000)}`);
        return;
      }
      this.raceStarted = true;
      this.startTime = now;
      this.countdownText.setText("TYPE!");
      this.tweens.add({
        targets: this.countdownText,
        alpha: 0,
        scale: 1.35,
        duration: 550,
      });
    }

    const elapsed = (now - this.startTime) / 1000;
    if (!this.multiplayer) {
      this.cpuProgress = Math.max(
        this.cpuProgress,
        Math.min(
          1,
          elapsed / this.cpuFinishSec + Math.sin(elapsed * 1.7) * 0.012,
        ),
      );
    }

    this.playerWobbleMs = Math.max(0, this.playerWobbleMs - delta);
    this.boostMs = Math.max(0, this.boostMs - delta);

    if (this.spaceErrorMs > 0) {
      this.spaceErrorMs -= delta;
      if (this.spaceErrorMs <= 0) {
        this.remainText.setColor("#cccccc");
      }
    }

    if (elapsed > 1 && this.completedChars > 0) {
      const wpm = Math.round(this.completedChars / 5 / (elapsed / 60));
      this.wpmText.setText(`WPM: ${wpm}`);
    }

    this.caretRect.setVisible(Math.floor(performance.now() / 530) % 2 === 0);
    this.timerText.setText(
      `${Math.max(0, Math.ceil(this.durationSec - elapsed))}s`,
    );
    const livePlayerProgress = Math.min(
      1,
      (this.completedChars + this.goodPrefix) / this.raceChars,
    );
    this.furthestTypingProgress = Math.max(
      this.furthestTypingProgress,
      livePlayerProgress,
    );
    // Spring-like acceleration keeps typing authoritative while the car
    // catches up with momentum instead of teleporting on every keystroke.
    const dt = Math.min(delta / 1000, 0.05);
    const distanceToTarget =
      this.furthestTypingProgress - this.visualPlayerProgress;
    const acceleration = distanceToTarget * 22 - this.playerVelocity * 7;
    this.playerVelocity = Math.max(
      0,
      Math.min(0.42, this.playerVelocity + acceleration * dt),
    );
    this.visualPlayerProgress = Math.min(
      this.furthestTypingProgress,
      this.visualPlayerProgress + this.playerVelocity * dt,
    );
    if (Math.abs(distanceToTarget) < 0.0005) this.playerVelocity = 0;

    const gap = this.visualPlayerProgress - this.cpuProgress;
    this.positionText
      .setText(
        gap > 0.035 ? "AHEAD" : gap < -0.035 ? "CATCH UP!" : "NECK AND NECK",
      )
      .setColor(gap > 0.035 ? "#66ee88" : gap < -0.035 ? "#ff7766" : "#ffdd66");
    this.drawCars(this.scale.width, this.scale.height);
    if (_time - this.lastProgressEmitAt >= 50) {
      this.lastProgressEmitAt = _time;
      this.game.events.emit(
        "type-racer-player-progress",
        this.visualPlayerProgress,
      );
      if (this.multiplayer) {
        const total = this.completedChars + this.mistakes;
        this.game.events.emit("type-racer-local-stats", {
          progress: this.furthestTypingProgress,
          wpm:
            elapsed > 0
              ? Math.round(this.completedChars / 5 / (elapsed / 60))
              : 0,
          accuracy:
            total > 0 ? Math.round((this.completedChars / total) * 100) : 100,
          finished: false,
        });
      }
    }

    if (this.playerProgress >= 1) {
      this.endRace(true, elapsed);
    } else if (
      (!this.multiplayer && this.cpuProgress >= 1) ||
      (this.multiplayer && elapsed >= this.durationSec)
    ) {
      this.endRace(this.playerProgress >= this.cpuProgress, elapsed);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.raceOver || !this.raceStarted) return;

    if (e.key === "Backspace") {
      if (this.typedBuffer.length > 0) {
        this.typedBuffer = this.typedBuffer.slice(0, -1);
        this.recalcPrefix();
        this.refreshWordDisplay();
      }
      return;
    }

    if (e.key === " ") {
      if (this.typedBuffer === this.currentWord) {
        this.completedWordHistory.push(this.currentWord);
        if (this.completedWordHistory.length > 12) {
          this.completedWordHistory.shift();
        }
        this.completedChars += this.currentWord.length + 1;
        this.playerProgress = Math.min(1, this.completedChars / this.raceChars);
        this.playerVelocity = Math.min(0.42, this.playerVelocity + 0.025);
        this.boostMs = 220;
        this.wordCount++;
        this.wordQueue.shift();
        this.wordQueue.push(this.popWord());
        this.typedBuffer = "";
        this.goodPrefix = 0;
        this.wordCountText.setText(`Word ${this.wordCount + 1}`);
        this.refreshWordDisplay();
      } else {
        this.spaceErrorMs = 250;
        this.playerWobbleMs = 260;
        this.playerVelocity *= 0.45;
        this.remainText.setColor("#ff4444");
      }
      return;
    }

    if (e.key.length !== 1) return;

    const isCorrect = e.key === this.currentWord[this.typedBuffer.length];
    this.typedBuffer += e.key;
    if (!isCorrect) {
      this.mistakes++;
      this.playerWobbleMs = 180;
      this.playerVelocity *= 0.6;
    } else {
      this.playerVelocity = Math.min(0.42, this.playerVelocity + 0.004);
    }
    this.recalcPrefix();
    this.refreshWordDisplay();
  }

  private recalcPrefix(): void {
    this.goodPrefix = 0;
    while (
      this.goodPrefix < this.typedBuffer.length &&
      this.goodPrefix < this.currentWord.length &&
      this.typedBuffer[this.goodPrefix] === this.currentWord[this.goodPrefix]
    ) {
      this.goodPrefix++;
    }
  }

  private refreshWordDisplay(): void {
    this.typedText.setText(this.typedBuffer.slice(0, this.goodPrefix));
    this.wrongText.setText(this.typedBuffer.slice(this.goodPrefix));
    this.remainText.setText(this.currentWord.slice(this.goodPrefix));
    this.historyText.setText(this.completedWordHistory.slice(-6).join(" "));
    this.upcomingText.setText(
      this.wordQueue.length > 1
        ? ` ${this.wordQueue.slice(1, 6).join(" ")}`
        : "",
    );
    this.futureText.setText(this.wordQueue.slice(6, 12).join(" "));
    this.positionWordTexts(this.scale.width, this.scale.height);
  }

  private popWord(): string {
    if (this.poolIdx >= this.wordPool.length) {
      this.wordPool = shuffleCyclic(this.words);
      this.poolIdx = 0;
    }
    return this.wordPool[this.poolIdx++] as string;
  }

  private trackBounds(
    W: number,
    H: number,
  ): {
    roadY: number;
    roadH: number;
    laneH: number;
    margin: number;
    trackLen: number;
  } {
    const roadY = Math.round(H * 0.06);
    const roadH = Math.round(H * 0.38);
    return {
      roadY,
      roadH,
      laneH: roadH / 2,
      margin: 60,
      trackLen: W - 120,
    };
  }

  private drawTrack(W: number, H: number): void {
    const { roadY, roadH, laneH, margin, trackLen } = this.trackBounds(W, H);
    const finishX = margin + trackLen;

    this.trackG.clear();
    this.trackG.fillStyle(0x87ceeb, 1);
    this.trackG.fillRect(0, 0, W, roadY);
    this.trackG.fillStyle(0x3d4d3d, 1);
    this.trackG.fillRect(0, roadY, W, roadH);
    this.trackG.fillStyle(0xdddd44, 0.9);
    this.trackG.fillRect(0, roadY, W, 3);
    this.trackG.fillRect(0, roadY + roadH - 3, W, 3);
    this.trackG.fillStyle(0xdddd44, 0.5);
    for (let x = margin; x < finishX - 20; x += 32) {
      this.trackG.fillRect(x, roadY + laneH - 2, 20, 4);
    }
    const checkSize = 10;
    for (let row = 0; row < Math.ceil(roadH / checkSize); row++) {
      for (let col = 0; col < 2; col++) {
        this.trackG.fillStyle((row + col) % 2 === 0 ? 0x000000 : 0xffffff, 1);
        this.trackG.fillRect(
          finishX + col * checkSize,
          roadY + row * checkSize,
          checkSize,
          checkSize,
        );
      }
    }
    const panelY = roadY + roadH;
    this.trackG.fillStyle(0x080816, 1);
    this.trackG.fillRect(0, panelY, W, H - panelY);
    this.trackG.lineStyle(1, 0x222233, 1);
    this.trackG.lineBetween(0, panelY, W, panelY);
  }

  private drawCars(W: number, H: number): void {
    const { roadY, laneH, margin, trackLen } = this.trackBounds(W, H);
    const cpuY = roadY + laneH * 0.5;
    const playerY = roadY + laneH * 1.5;
    const cpuX = margin + this.cpuProgress * trackLen;
    // Advance visually per correct keystroke (completed chars + the current
    // word's correctly-typed prefix), not just once per completed word -
    // playerProgress itself stays word-granular for race-end/stat purposes.
    const playerX = margin + this.visualPlayerProgress * trackLen;

    this.cpuCarG.clear();
    this.playerCarG.clear();
    this.drawCar(this.cpuCarG, 0xcc3322, cpuX, cpuY);
    const wobble =
      this.playerWobbleMs > 0 ? Math.sin(performance.now() / 22) * 5 : 0;
    this.drawCar(
      this.playerCarG,
      this.boostMs > 0 ? 0x44aaff : 0x2266dd,
      playerX,
      playerY + wobble,
    );
    if (this.boostMs > 0) {
      this.playerCarG.fillStyle(0xffaa22, 0.9);
      this.playerCarG.fillTriangle(
        playerX - 34,
        playerY - 5 + wobble,
        playerX - 34,
        playerY + 6 + wobble,
        playerX - 52 - Math.random() * 12,
        playerY + wobble,
      );
    }
    this.cpuLabel.setPosition(cpuX, cpuY - 34);
    this.youLabel.setPosition(playerX, playerY - 34 + wobble);
  }

  private drawCar(
    g: GameObjects.Graphics,
    color: number,
    x: number,
    y: number,
  ): void {
    g.fillStyle(color, 1);
    g.fillRect(x - 34, y - 10, 68, 20);
    g.fillStyle(color, 0.75);
    g.fillRect(x - 17, y - 28, 34, 19);
    g.fillStyle(0x99ccff, 0.55);
    g.fillRect(x - 13, y - 25, 26, 12);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(x - 22, y + 11, 8);
    g.fillCircle(x + 22, y + 11, 8);
    g.fillStyle(0x666666, 1);
    g.fillCircle(x - 22, y + 11, 4);
    g.fillCircle(x + 22, y + 11, 4);
  }

  private positionWordTexts(W: number, H: number): void {
    const { roadY, roadH } = this.trackBounds(W, H);
    const panelY = roadY + roadH;
    const availableH = H - panelY;
    const historyY = panelY + availableH * 0.2;
    const wordY = panelY + availableH * 0.4;
    const upcomingY = panelY + availableH * 0.6;
    const wordLeft = Math.max(24, W * 0.08);
    const wordWidth = Math.max(100, W - wordLeft * 2);

    this.historyText
      .setPosition(wordLeft, historyY)
      .setWordWrapWidth(wordWidth, false);

    this.typedText.setPosition(wordLeft, wordY);
    this.wrongText.setPosition(wordLeft + this.typedText.width, wordY);
    this.remainText.setPosition(
      wordLeft + this.typedText.width + this.wrongText.width,
      wordY,
    );
    this.upcomingText
      .setPosition(
        wordLeft +
          this.typedText.width +
          this.wrongText.width +
          this.remainText.width,
        wordY,
      )
      .setWordWrapWidth(wordWidth, false);
    this.futureText
      .setPosition(wordLeft, upcomingY)
      .setWordWrapWidth(wordWidth, false);
    this.caretRect.setPosition(
      wordLeft + this.typedText.width + this.wrongText.width,
      wordY,
    );
  }

  private positionAll(W: number, H: number): void {
    this.positionWordTexts(W, H);
    this.wpmText.setPosition(14, H - 10);
    this.wordCountText.setPosition(W - 14, H - 10);
    this.timerText.setPosition(W / 2, 12);
    this.positionText.setPosition(W / 2, 38);
    this.countdownText.setPosition(W / 2, H / 2);
  }

  private removeKeyHandler(): void {
    if (this.keydownHandler !== null) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private endRace(playerWon: boolean, elapsed: number): void {
    this.raceOver = true;
    this.game.events.emit("type-racer-race-active", false);
    this.removeKeyHandler();
    const total = this.completedChars + this.mistakes;
    const accuracy =
      total > 0 ? Math.round((this.completedChars / total) * 100) : 100;
    const wpm =
      elapsed > 0 ? Math.round(this.completedChars / 5 / (elapsed / 60)) : 0;
    if (this.multiplayer) {
      this.game.events.emit("type-racer-local-stats", {
        progress: this.playerProgress,
        wpm,
        accuracy,
        finished: true,
      });
    }
    this.time.delayedCall(700, () => {
      this.scene.start("GameOver", {
        playerWon,
        wpm,
        accuracy,
        elapsed: Math.round(elapsed),
        wordsTyped: this.wordCount,
        marginChars: Math.max(
          0,
          Math.round(
            Math.abs(this.playerProgress - this.cpuProgress) * this.raceChars,
          ),
        ),
      });
    });
  }

  shutdown(): void {
    this.removeKeyHandler();
    if (this.resizeHandler !== null) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this.game.events.off("type-racer-opponent");
  }
}

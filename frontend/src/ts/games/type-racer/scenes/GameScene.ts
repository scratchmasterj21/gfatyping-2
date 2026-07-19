import { Scene, GameObjects, Structs } from "phaser";

import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

const RACE_CHARS = 240;
const QUEUE_SIZE = 7; // words visible ahead (including current)

export class GameScene extends Scene {
  private words: string[] = [];
  private wordPool: string[] = [];
  private poolIdx = 0;

  private wordQueue: string[] = []; // current word is [0], upcoming are [1..N]
  private typedBuffer = "";
  private goodPrefix = 0;
  private completedChars = 0;
  private mistakes = 0;
  private wordCount = 0;
  private startTime = 0;
  private raceOver = false;

  private cpuFinishSec = 96;
  private playerProgress = 0;
  private cpuProgress = 0;

  private trackG!: GameObjects.Graphics;
  private playerCarG!: GameObjects.Graphics;
  private cpuCarG!: GameObjects.Graphics;
  private typedText!: GameObjects.Text;
  private wrongText!: GameObjects.Text;
  private remainText!: GameObjects.Text;
  private upcomingText!: GameObjects.Text;
  private caretRect!: GameObjects.Rectangle;
  private wpmText!: GameObjects.Text;
  private wordCountText!: GameObjects.Text;
  private cpuLabel!: GameObjects.Text;
  private youLabel!: GameObjects.Text;

  private spaceErrorMs = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

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
    this.cpuFinishSec = (RACE_CHARS / 5 / cpuWpm) * 60;
    this.wordPool = shuffleCyclic(this.words);
    this.poolIdx = 0;
    this.wordQueue = [];
    for (let i = 0; i < QUEUE_SIZE; i++) this.wordQueue.push(this.popWord());
    this.typedBuffer = "";
    this.goodPrefix = 0;
    this.completedChars = 0;
    this.mistakes = 0;
    this.wordCount = 0;
    this.raceOver = false;
    this.playerProgress = 0;
    this.cpuProgress = 0;
    this.spaceErrorMs = 0;
  }

  private get currentWord(): string {
    return this.wordQueue[0] as string;
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

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

    const base = { fontSize: "24px", fontFamily: "monospace" };
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
      .text(0, 0, "", { ...base, color: "#44445a" })
      .setOrigin(0, 0.5);
    this.caretRect = this.add
      .rectangle(0, 0, 2, 26, 0xffffff)
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

    this.positionAll(W, H);
    this.refreshWordDisplay();
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === " ") e.preventDefault();
      this.onKeyDown(e);
    };
    document.addEventListener("keydown", this.keydownHandler);

    this.scale.on("resize", (size: Structs.Size) => {
      this.drawTrack(size.width, size.height);
      this.drawCars(size.width, size.height);
      this.positionAll(size.width, size.height);
    });

    this.startTime = performance.now();
  }

  override update(_time: number, delta: number): void {
    if (this.raceOver) return;

    this.cpuProgress = Math.min(
      1,
      this.cpuProgress + delta / 1000 / this.cpuFinishSec,
    );

    if (this.spaceErrorMs > 0) {
      this.spaceErrorMs -= delta;
      if (this.spaceErrorMs <= 0) {
        this.remainText.setColor("#cccccc");
      }
    }

    const elapsed = (performance.now() - this.startTime) / 1000;
    if (elapsed > 1 && this.completedChars > 0) {
      const wpm = Math.round(this.completedChars / 5 / (elapsed / 60));
      this.wpmText.setText(`WPM: ${wpm}`);
    }

    this.caretRect.setVisible(Math.floor(performance.now() / 530) % 2 === 0);
    this.drawCars(this.scale.width, this.scale.height);

    if (this.playerProgress >= 1) {
      this.endRace(true, elapsed);
    } else if (this.cpuProgress >= 1) {
      this.endRace(false, elapsed);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.raceOver) return;

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
        this.completedChars += this.currentWord.length + 1;
        this.playerProgress = Math.min(1, this.completedChars / RACE_CHARS);
        this.wordCount++;
        this.wordQueue.shift();
        this.wordQueue.push(this.popWord());
        this.typedBuffer = "";
        this.goodPrefix = 0;
        this.wordCountText.setText(`Word ${this.wordCount + 1}`);
        this.refreshWordDisplay();
      } else {
        this.spaceErrorMs = 250;
        this.remainText.setColor("#ff4444");
      }
      return;
    }

    if (e.key.length !== 1) return;

    this.typedBuffer += e.key;
    if (e.key !== this.currentWord[this.typedBuffer.length - 1]) {
      this.mistakes++;
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
    // upcoming words as one dim string with leading space
    this.upcomingText.setText(
      this.wordQueue.length > 1 ? ` ${this.wordQueue.slice(1).join(" ")}` : "",
    );
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
    const visualChars = Math.min(
      RACE_CHARS,
      this.completedChars + this.goodPrefix,
    );
    const playerX = margin + (visualChars / RACE_CHARS) * trackLen;

    this.cpuCarG.clear();
    this.playerCarG.clear();
    this.drawCar(this.cpuCarG, 0xcc3322, cpuX, cpuY);
    this.drawCar(this.playerCarG, 0x2266dd, playerX, playerY);
    this.cpuLabel.setPosition(cpuX, cpuY - 26);
    this.youLabel.setPosition(playerX, playerY - 26);
  }

  private drawCar(
    g: GameObjects.Graphics,
    color: number,
    x: number,
    y: number,
  ): void {
    g.fillStyle(color, 1);
    g.fillRect(x - 26, y - 8, 52, 15);
    g.fillStyle(color, 0.75);
    g.fillRect(x - 13, y - 20, 26, 14);
    g.fillStyle(0x99ccff, 0.55);
    g.fillRect(x - 10, y - 18, 20, 9);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(x - 16, y + 8, 6);
    g.fillCircle(x + 16, y + 8, 6);
    g.fillStyle(0x666666, 1);
    g.fillCircle(x - 16, y + 8, 3);
    g.fillCircle(x + 16, y + 8, 3);
  }

  private positionWordTexts(W: number, H: number): void {
    const { roadY, roadH } = this.trackBounds(W, H);
    const panelY = roadY + roadH;
    const wordY = panelY + (H - panelY) * 0.4;
    const wordLeft = Math.max(24, W * 0.12);

    this.typedText.setPosition(wordLeft, wordY);
    this.wrongText.setPosition(wordLeft + this.typedText.width, wordY);
    this.remainText.setPosition(
      wordLeft + this.typedText.width + this.wrongText.width,
      wordY,
    );
    this.upcomingText.setPosition(
      wordLeft +
        this.typedText.width +
        this.wrongText.width +
        this.remainText.width,
      wordY,
    );
    this.caretRect.setPosition(
      wordLeft + this.typedText.width + this.wrongText.width,
      wordY,
    );
  }

  private positionAll(W: number, H: number): void {
    this.positionWordTexts(W, H);
    this.wpmText.setPosition(14, H - 10);
    this.wordCountText.setPosition(W - 14, H - 10);
  }

  private removeKeyHandler(): void {
    if (this.keydownHandler !== null) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private endRace(playerWon: boolean, elapsed: number): void {
    this.raceOver = true;
    this.removeKeyHandler();
    const total = this.completedChars + this.mistakes;
    const accuracy =
      total > 0 ? Math.round((this.completedChars / total) * 100) : 100;
    const wpm =
      elapsed > 0 ? Math.round(this.completedChars / 5 / (elapsed / 60)) : 0;
    this.time.delayedCall(700, () => {
      this.scene.start("GameOver", {
        playerWon,
        wpm,
        accuracy,
        elapsed: Math.round(elapsed),
        wordsTyped: this.wordCount,
      });
    });
  }

  shutdown(): void {
    this.removeKeyHandler();
  }
}

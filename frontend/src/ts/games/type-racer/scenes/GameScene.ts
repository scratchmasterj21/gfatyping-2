import { Scene, GameObjects, Structs } from "phaser";

import { hex, PALETTE } from "../../shared/game-palette";
import { HudChip, kidText, rowLayout } from "../../shared/phaser-ui";
import { shuffleCyclic } from "../../word-defender/systems/vocab-pool";

/** Kart drawn size; its seat lines up with the avatar the modal floats above it. */
const KART_W = 84;
const KART_H = 45;

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
  private boostG!: GameObjects.Graphics;
  private playerKart!: GameObjects.Image;
  private cpuKart!: GameObjects.Image;
  private cpuDriver: GameObjects.Image | null = null;
  private typedText!: GameObjects.Text;
  private wrongText!: GameObjects.Text;
  private remainText!: GameObjects.Text;
  private upcomingText!: GameObjects.Text;
  private futureText!: GameObjects.Text;
  private historyText!: GameObjects.Text;
  private caretRect!: GameObjects.Rectangle;
  private currentBg!: GameObjects.Graphics;
  private wpmChip!: HudChip;
  private wordChip!: HudChip;
  private cpuLabel!: GameObjects.Text;
  private youLabel!: GameObjects.Text;
  private countdownText!: GameObjects.Text;
  private timerChip!: HudChip;
  private positionChip!: HudChip;

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
    this.boostG = this.add.graphics();
    this.cpuKart = this.add
      .image(0, 0, this.multiplayer ? "rc-kart-rival" : "rc-kart-cpu")
      .setDisplaySize(KART_W, KART_H)
      .setOrigin(0.5, 40 / 64);
    if (!this.multiplayer) {
      // Tappy drives the CPU kart in solo races
      this.cpuDriver = this.add
        .image(0, 0, "tappy-happy")
        .setDisplaySize(26, 27)
        .setOrigin(0.5, 1);
      this.cpuKart.setDepth(1);
    }
    this.playerKart = this.add
      .image(0, 0, "rc-kart-player")
      .setDisplaySize(KART_W, KART_H)
      .setOrigin(0.5, 40 / 64);

    const label = (
      text: string,
      fill: string,
      color: string,
    ): GameObjects.Text =>
      this.add
        .text(0, 0, text, {
          ...kidText(12, "ink"),
          color,
          backgroundColor: fill,
          padding: { x: 7, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(2);
    this.cpuLabel = label(
      this.multiplayer ? "CPU" : "Tappy",
      PALETTE.red,
      PALETTE.cream,
    );
    this.youLabel = label("YOU", PALETTE.blue, PALETTE.cream);

    this.drawTrack(W, H);
    this.drawCars(W, H);

    // soft highlight behind the word being typed (drawn under the text)
    this.currentBg = this.add.graphics();
    const base = kidText(30, "ink");
    this.historyText = this.add
      .text(0, 0, "", { ...base, color: PALETTE.grey, maxLines: 1 })
      .setOrigin(0, 0.5);
    this.typedText = this.add
      .text(0, 0, "", { ...base, color: PALETTE.grassDark })
      .setOrigin(0, 0.5);
    this.wrongText = this.add
      .text(0, 0, "", {
        ...base,
        color: PALETTE.red,
        backgroundColor: PALETTE.blush,
      })
      .setOrigin(0, 0.5);
    this.remainText = this.add
      .text(0, 0, this.currentWord, { ...base, color: PALETTE.ink })
      .setOrigin(0, 0.5);
    this.upcomingText = this.add
      .text(0, 0, "", { ...base, color: PALETTE.grey, maxLines: 1 })
      .setOrigin(0, 0.5);
    this.futureText = this.add
      .text(0, 0, "", { ...base, color: PALETTE.grey, maxLines: 1 })
      .setOrigin(0, 0.5);
    this.caretRect = this.add
      .rectangle(0, 0, 3, 36, hex("blue"))
      .setOrigin(0, 0.5);

    this.wpmChip = new HudChip(this, 0, 0, "🚀 WPM —");
    this.wordChip = new HudChip(this, 0, 0, "Word 1");
    this.timerChip = new HudChip(this, 0, 0, `⏱ ${this.durationSec}s`);
    this.positionChip = new HudChip(this, 0, 0, "Neck and neck!").setColors(
      "yellow",
      "ink",
    );
    this.countdownText = this.add
      .text(W / 2, H / 2, "3", {
        ...kidText(80, "yellow"),
        stroke: PALETTE.ink,
        strokeThickness: 12,
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
        this.remainText.setColor(PALETTE.ink);
      }
    }

    if (elapsed > 1 && this.completedChars > 0) {
      const wpm = Math.round(this.completedChars / 5 / (elapsed / 60));
      this.wpmChip.setLabel(`🚀 WPM ${wpm}`);
      this.layoutChips(this.scale.width, this.scale.height);
    }

    this.caretRect.setVisible(Math.floor(performance.now() / 530) % 2 === 0);
    this.timerChip.setLabel(
      `⏱ ${Math.max(0, Math.ceil(this.durationSec - elapsed))}s`,
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
    this.positionChip
      .setLabel(
        gap > 0.035
          ? "You're ahead!"
          : gap < -0.035
            ? "Catch up!"
            : "Neck and neck!",
      )
      .setColors(
        gap > 0.035 ? "green" : gap < -0.035 ? "red" : "yellow",
        gap < -0.035 ? "cream" : "ink",
      );
    this.layoutChips(this.scale.width, this.scale.height);
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
        this.wordChip.setLabel(`Word ${this.wordCount + 1}`);
        this.refreshWordDisplay();
      } else {
        this.spaceErrorMs = 250;
        this.playerWobbleMs = 260;
        this.playerVelocity *= 0.45;
        this.remainText.setColor(PALETTE.red);
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
    const g = this.trackG;
    g.clear();

    // stands with a cheering crowd above the track
    g.fillStyle(hex("sky"), 1);
    g.fillRect(0, 0, W, roadY);
    g.fillStyle(hex("purple"), 1);
    g.fillRect(0, roadY * 0.45, W, roadY * 0.55);
    const crowd = [
      "pink",
      "yellow",
      "blue",
      "orange",
      "green",
      "cream",
    ] as const;
    for (let x = 8, i = 0; x < W; x += 14, i++) {
      g.fillStyle(hex(crowd[i % crowd.length] ?? "pink"), 1);
      g.fillCircle(x, roadY * 0.62 + ((i * 7) % 5), 5);
    }

    // asphalt
    g.fillStyle(0x5b6378, 1);
    g.fillRect(0, roadY, W, roadH);

    // red & white kerbs
    const kerb = 8;
    for (let x = 0, i = 0; x < W; x += 24, i++) {
      g.fillStyle(i % 2 === 0 ? hex("red") : hex("cream"), 1);
      g.fillRect(x, roadY, 24, kerb);
      g.fillRect(x, roadY + roadH - kerb, 24, kerb);
    }

    // dashed lane line
    g.fillStyle(hex("cream"), 0.8);
    for (let x = margin; x < finishX - 20; x += 36) {
      g.fillRect(x, roadY + laneH - 3, 22, 6);
    }

    // start line
    g.fillStyle(hex("cream"), 0.9);
    g.fillRect(margin - 4, roadY + kerb, 4, roadH - kerb * 2);

    // checkered finish
    const checkSize = 10;
    for (let row = 0; row < Math.ceil((roadH - kerb * 2) / checkSize); row++) {
      for (let col = 0; col < 2; col++) {
        g.fillStyle((row + col) % 2 === 0 ? hex("ink") : hex("cream"), 1);
        g.fillRect(
          finishX + col * checkSize,
          roadY + kerb + row * checkSize,
          checkSize,
          Math.min(
            checkSize,
            roadY + roadH - kerb - (roadY + kerb + row * checkSize),
          ),
        );
      }
    }

    // grass field + the word dashboard card
    const panelY = roadY + roadH;
    g.fillStyle(hex("grass"), 1);
    g.fillRect(0, panelY, W, H - panelY);
    const pad = Math.max(10, W * 0.03);
    const cardY = panelY + 54;
    const cardH = H - cardY - 58;
    g.fillStyle(hex("grassDark"), 1);
    g.fillRoundedRect(pad, cardY + 6, W - pad * 2, cardH, 22);
    g.fillStyle(hex("cream"), 1);
    g.fillRoundedRect(pad, cardY, W - pad * 2, cardH, 22);
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
    const wobble =
      this.playerWobbleMs > 0 ? Math.sin(performance.now() / 22) * 5 : 0;

    this.cpuKart.setPosition(cpuX, cpuY);
    this.cpuDriver?.setPosition(cpuX - 4, cpuY - 6);
    this.playerKart.setPosition(playerX, playerY + wobble);

    this.boostG.clear();
    if (this.boostMs > 0) {
      const y = playerY + wobble;
      this.boostG.fillStyle(hex("orange"), 0.95);
      this.boostG.fillTriangle(
        playerX - 40,
        y - 6,
        playerX - 40,
        y + 6,
        playerX - 62 - Math.random() * 14,
        y,
      );
      this.boostG.fillStyle(hex("yellow"), 1);
      this.boostG.fillTriangle(
        playerX - 40,
        y - 3,
        playerX - 40,
        y + 3,
        playerX - 52 - Math.random() * 8,
        y,
      );
      this.boostG.lineStyle(3, hex("cream"), 0.7);
      for (const dy of [-14, 0, 14]) {
        const len = 18 + Math.random() * 16;
        this.boostG.lineBetween(
          playerX - 70 - len,
          y + dy,
          playerX - 70,
          y + dy,
        );
      }
    }
    this.cpuLabel.setPosition(cpuX, cpuY - 40);
    this.youLabel.setPosition(playerX, playerY - 46 + wobble);
  }

  private positionWordTexts(W: number, H: number): void {
    const { roadY, roadH } = this.trackBounds(W, H);
    const panelY = roadY + roadH;
    const cardY = panelY + 54;
    const cardH = H - cardY - 58;
    const historyY = cardY + cardH * 0.22;
    const wordY = cardY + cardH * 0.5;
    const upcomingY = cardY + cardH * 0.78;
    const wordLeft = Math.max(28, W * 0.08);
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
    const currentW =
      this.typedText.width + this.wrongText.width + this.remainText.width;
    this.currentBg.clear();
    this.currentBg.fillStyle(hex("yellow"), 0.45);
    this.currentBg.fillRoundedRect(
      wordLeft - 8,
      wordY - 24,
      currentW + 16,
      48,
      12,
    );
  }

  private positionAll(W: number, H: number): void {
    this.positionWordTexts(W, H);
    this.layoutChips(W, H);
    const { roadY, roadH } = this.trackBounds(W, H);
    this.countdownText.setPosition(W / 2, roadY + roadH / 2);
  }

  /** Timer + race position above the card, WPM + word count below it. */
  private layoutChips(W: number, H: number): void {
    const { roadY, roadH } = this.trackBounds(W, H);
    const topY = roadY + roadH + 27;
    this.timerChip.setY(topY);
    this.positionChip.setY(topY);
    rowLayout([this.timerChip, this.positionChip], W / 2);
    this.wpmChip.setY(H - 28);
    this.wordChip.setY(H - 28);
    rowLayout([this.wpmChip, this.wordChip], W / 2);
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
